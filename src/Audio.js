// ===== SOUND ENGINE NATIVO, LEVE E ESPACIAL =====
// Todos os buffers são criados uma vez por contexto. O disparo só instancia nós curtos e reutilizáveis.
let contexto=null,ruidoBuffer=null,preparado=false,ecoEntrada=null,ecoDelay=null,ecoGanho=null;
let motorBuffer=null,motorCarregando=null,motorFonte=null,motorGanho=null,motorFiltro=null,motorElemento=null,motorSintetico=null,motorRotacao=.18,motorCarga=0,motorAceleradorAnterior=0,motorUltimaAceleracao=-Infinity;
const buffers=new Map(),vozes=[];const MAX_VOZES=12;
const PERFIS={
  pistola:{f:185,d:.105,crack:3900,cauda:.045,ganho:1.0},
  rifle:{f:105,d:.16,crack:2700,cauda:.11,ganho:1.18},
  escopeta:{f:72,d:.22,crack:1750,cauda:.16,ganho:1.3},
  metralhadora:{f:145,d:.075,crack:3300,cauda:.035,ganho:.82},
  policia:{f:135,d:.13,crack:3000,cauda:.075,ganho:.72},
};
function obterContexto(){try{const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContext)return null;contexto??=new AudioContext();if(contexto.state==='suspended')contexto.resume().catch(()=>{});preparar();return contexto}catch(e){return null}}
export function desbloquearAudio(){const ctx=obterContexto();if(ctx?.state==='suspended')ctx.resume().catch(()=>{});prepararMotorHTMLNoGesto();if(ctx){prepararMotorProcedural(ctx);carregarSomMotor(ctx)}return ctx}
if(typeof window!=='undefined'){const acordar=()=>desbloquearAudio();window.addEventListener('pointerdown',acordar,{once:false,passive:true});window.addEventListener('touchstart',acordar,{once:false,passive:true})}
function ruído(ctx){if(ruidoBuffer)return ruidoBuffer;const n=Math.floor(ctx.sampleRate*.4),b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);let s=0;for(let i=0;i<n;i++){s=s*.985+(Math.random()*2-1)*.32;d[i]=s}return ruidoBuffer=b}
// ===== TIRO É RUÍDO, NÃO TOM =====
// "quero melhorar o som das armas, está muito feio e sem realismo."
//
// O corpo do disparo era uma SENOIDE de 185 Hz com envelope, mais uma segunda harmônica. Senoide com
// envelope o ouvido lê como SINO — tem altura definida, dá pra cantar junto. Tiro não tem altura:
// é uma explosão, ou seja ruído de banda larga moldado.
//
// A régua é a PLANURA ESPECTRAL (tom puro tende a 0, ruído tende a 1), medida no buffer que o jogo
// toca — `scratchpad/somtiro.mjs`. Instrumentei o código ANTIGO pra ter o número honesto em vez de
// chutar (eu tinha escrito "0,01" de cabeça; o valor real é 0,12):
//
//     corpo       antes          agora
//     pistola     0,1225   ->    0,6973
//     rifle       0,1966   ->    0,5813
//     escopeta    0,2507   ->    0,5500
//     ataque      2,0-2,8 ms ->  0,7-1,0 ms
//
// E o estalo tinha uma modulação de amplitude a 90 Hz (`1+.4*sin(t*2π*90)`) que acrescentava zumbido
// — outra coisa com altura definida onde não devia haver nenhuma.
//
// Agora:
//  · CORPO = ruído passado por um filtro passa-baixa cuja frequência de corte CAI ao longo do
//    disparo. É o estouro grave, sem virar nota.
//  · ESTALO = ruído com passa-alta e queda muito rápida (7,5 ms). É o crack seco que chega primeiro.
//  · CAUDA = o mesmo ruído, muito mais fraco e longo, que é a rua devolvendo o som das paredes.
// O gerador é uma congruência linear com semente por arma: cada arma soa como ela mesma em toda
// sessão, em vez de sortear um timbre novo a cada carregamento.
function criarPerfil(ctx,id,p){
  const sr=ctx.sampleRate,n=Math.ceil(sr*(p.d+p.cauda+.03));
  const body=ctx.createBuffer(1,n,sr),crack=ctx.createBuffer(1,n,sr);
  const bd=body.getChannelData(0),cd=crack.getChannelData(0);
  let semente=(id.length*7919+Math.round(p.f*13))>>>0;
  const rnd=()=>{semente=(semente*1664525+1013904223)>>>0;return semente/2147483648-1};
  // CORPO: passa-baixa de um pólo com corte descendo. O corte parte perto de `f` e cai, que é o
  // que faz o estouro "abrir" e fechar.
  let lp=0;
  for(let i=0;i<n;i++){
    const t=i/sr;
    const env=Math.exp(-t/(p.d*.30));
    const cauda=Math.exp(-t/(p.d+p.cauda))*.12;// a rua devolvendo o som
    const corte=Math.min(.85,(p.f/sr)*26*(1-Math.min(1,t/p.d)*.62)+.004);
    lp+=corte*(rnd()-lp);
    bd[i]=lp*(env*2.4+cauda);
  }
  // ESTALO: passa-alta de um pólo (tira o grave, que já está no corpo) e queda rápida.
  let hp=0,ant=0;
  const queda=p.d<.1?.0055:.0085;
  for(let i=0;i<n;i++){
    const t=i/sr,r=rnd();
    hp=.87*(hp+r-ant);ant=r;
    cd[i]=hp*(Math.exp(-t/queda)+Math.exp(-t/(queda*9))*.16);
  }
  return{body,crack};
}
// Exposto pro teste medir a PLANURA ESPECTRAL do que o jogo vai tocar de verdade — e não a minha
// fórmula recalculada por fora, que provaria só que eu sei repetir a própria conta.
export function __perfilParaTeste(id){const ctx=obterContexto();if(!ctx)return null;const b=buffers.get(id);
  return b?{body:Array.from(b.body.getChannelData(0)),crack:Array.from(b.crack.getChannelData(0)),taxa:ctx.sampleRate}:null}
function preparar(){if(preparado||!contexto)return;preparado=true;for(const [id,p] of Object.entries(PERFIS))buffers.set(id,criarPerfil(contexto,id,p));ruído(contexto);ecoEntrada=contexto.createGain();ecoDelay=contexto.createDelay(.28);ecoGanho=contexto.createGain();ecoDelay.delayTime.value=.075;ecoGanho.gain.value=.045;ecoEntrada.connect(ecoDelay);ecoDelay.connect(ecoGanho);ecoGanho.connect(contexto.destination)}
// O ATAQUE ERA DE 3 ms, E 3 ms É UMA SUBIDA AUDÍVEL. Tiro tem ataque instantâneo — é a frente de
// onda batendo no ouvido. 0,4 ms mantém o clique sem estalar o alto-falante do celular.
function ganho(ctx,t,valor,queda,ataque=.0004){const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0001,valor),t+ataque);g.gain.exponentialRampToValueAtTime(.0001,t+queda);return g}
function conectarEspacial(ctx,no,t,volume,posicao,cauda){const g=ganho(ctx,t,volume,cauda);const f=ctx.createBiquadFilter();f.type='lowpass';let pan=0,dist=0;if(posicao){const dx=posicao.x-(globalThis.__audioListenerX||0),dz=posicao.z-(globalThis.__audioListenerZ||0);dist=Math.hypot(dx,dz);const yaw=globalThis.__audioListenerYaw||0;pan=Math.max(-1,Math.min(1,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(1,dist)));f.frequency.value=Math.max(650,11000/(1+dist*.075));g.gain.value*=1/(1+dist*.045)}else f.frequency.value=15000;const p=ctx.createStereoPanner?ctx.createStereoPanner():null;if(p){p.pan.setValueAtTime(pan,t);g.connect(f);f.connect(p);p.connect(ctx.destination)}else{g.connect(f);f.connect(ctx.destination)}no.connect(g);return{g,f,p,dist}}
function tocarPerfil(id,posicao,origem='jogador'){const ctx=obterContexto();if(!ctx)return;if(ctx.state==='suspended'){ctx.resume().then(()=>tocarPerfil(id,posicao,origem)).catch(()=>{});return}const p=PERFIS[id]||PERFIS.pistola,b=buffers.get(id)||buffers.get('pistola'),t=ctx.currentTime,dist=posicao?Math.hypot(posicao.x-(globalThis.__audioListenerX||0),posicao.z-(globalThis.__audioListenerZ||0)):0;let volume=p.ganho*(origem==='policia'?.9:1);if(dist>75)return;if(vozes.length>=MAX_VOZES){const velha=vozes.shift();velha?.stop()};const body=ctx.createBufferSource(),crack=ctx.createBufferSource();body.buffer=b.body;crack.buffer=b.crack;const cb=conectarEspacial(ctx,body,t,volume*.8,posicao,p.d+p.cauda);conectarEspacial(ctx,crack,t,volume*(dist>15?.46:.72),posicao,.06);body.playbackRate.value=.985+Math.random()*.03;crack.playbackRate.value=.97+Math.random()*.06;body.start(t);crack.start(t);if(ecoEntrada){ecoGanho.gain.value=origem==='policia'?.035:.045;cb.g.connect(ecoEntrada)}const voz={stop:()=>{try{body.stop()}catch(e){}try{crack.stop()}catch(e){}}};vozes.push(voz);const retirar=()=>{const i=vozes.indexOf(voz);if(i>=0)vozes.splice(i,1)};body.onended=retirar;crack.onended=retirar}
export function tocarSomTiro(perfil='pistola',posicao=null,origem='jogador'){tocarPerfil(perfil,posicao,origem)}
export function definirPosicaoAudio(x,z,yaw=0){globalThis.__audioListenerX=x;globalThis.__audioListenerZ=z;globalThis.__audioListenerYaw=yaw}
// ===== MOTOR DO CARRO PRINCIPAL =====
// O arquivo é um recorte real do Opala enviado pelo usuário. Ele toca em loop somente enquanto o
// jogador está dentro do carro principal; a velocidade altera pitch e filtro, e o acelerador altera
// a presença do som. O carregamento é assíncrono para não bloquear a entrada do jogo.
async function carregarSomMotor(ctx){
  if(motorBuffer||motorCarregando)return motorCarregando;
  const url=new URL('../assets/som-carro-opala.mp3',import.meta.url).href;
  motorCarregando=fetch(url).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status} ao carregar ${url}`);return r.arrayBuffer()}).then(b=>ctx.decodeAudioData(b)).then(b=>{motorBuffer=b;return b}).catch(e=>{
    console.warn('Quintal 3D: Web Audio não decodificou o motor; usando Audio HTML',e);
    if(typeof Audio!=='undefined'){
      motorElemento=new Audio(url);motorElemento.loop=true;motorElemento.preload='auto';motorElemento.volume=.55;
      motorElemento.addEventListener('error',()=>console.warn('Quintal 3D: o arquivo do motor não pôde ser reproduzido',motorElemento.error),{once:true});
    }
    return null;
  }).finally(()=>{motorCarregando=null});
  return motorCarregando;
}
function prepararMotorHTMLNoGesto(){
  if(motorElemento||typeof Audio==='undefined')return;
  const url=new URL('../assets/som-carro-opala.mp3',import.meta.url).href;
  motorElemento=new Audio(url);motorElemento.loop=true;motorElemento.preload='auto';motorElemento.volume=0;
  const tentativa=motorElemento.play();
  if(tentativa?.then)tentativa.then(()=>{motorElemento.pause();motorElemento.currentTime=0}).catch(()=>{});
}
function prepararMotorProcedural(ctx){
  if(motorSintetico)return;
  const saida=ctx.createGain(),filtro=ctx.createBiquadFilter();
  saida.gain.value=.0001;filtro.type='lowpass';filtro.frequency.value=1250;filtro.Q.value=.8;filtro.connect(saida);saida.connect(ctx.destination);
  const base=ctx.createOscillator(),harm2=ctx.createOscillator(),harm3=ctx.createOscillator();
  const g1=ctx.createGain(),g2=ctx.createGain(),g3=ctx.createGain();
  base.type='sawtooth';harm2.type='triangle';harm3.type='sine';g1.gain.value=.7;g2.gain.value=.22;g3.gain.value=.1;
  base.connect(g1);harm2.connect(g2);harm3.connect(g3);g1.connect(filtro);g2.connect(filtro);g3.connect(filtro);
  const ruido=ctx.createBufferSource(),ruidoFiltro=ctx.createBiquadFilter(),ruidoGanho=ctx.createGain();
  ruido.buffer=ruído(ctx);ruido.loop=true;ruidoFiltro.type='bandpass';ruidoFiltro.frequency.value=850;ruidoFiltro.Q.value=.7;ruidoGanho.gain.value=.035;ruido.connect(ruidoFiltro);ruidoFiltro.connect(ruidoGanho);ruidoGanho.connect(filtro);
  base.start();harm2.start();harm3.start();ruido.start();
  motorSintetico={saida,filtro,base,harm2,harm3,ruidoGanho};
}
function tocarAceleracao(ctx,carga,rotacao){
  if(!motorBuffer||carga<.28||ctx.currentTime-motorUltimaAceleracao<.38)return;
  motorUltimaAceleracao=ctx.currentTime;
  const fonte=ctx.createBufferSource(),ganhoA=ctx.createGain(),filtroA=ctx.createBiquadFilter();
  fonte.buffer=motorBuffer;fonte.loop=false;fonte.playbackRate.value=.72+rotacao*.55;filtroA.type='lowpass';filtroA.frequency.value=1700+rotacao*2600;
  ganhoA.gain.setValueAtTime(.0001,ctx.currentTime);ganhoA.gain.exponentialRampToValueAtTime(.11+carga*.12,ctx.currentTime+.025);ganhoA.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+Math.min(1.7,motorBuffer.duration/.8));
  fonte.connect(filtroA);filtroA.connect(ganhoA);ganhoA.connect(ctx.destination);fonte.start();fonte.stop(ctx.currentTime+Math.min(1.7,motorBuffer.duration/.8));
}
function iniciarSomMotor(ctx){
  if(!motorBuffer||motorFonte)return;
  motorFonte=ctx.createBufferSource();motorFonte.buffer=motorBuffer;motorFonte.loop=true;
  motorFiltro=ctx.createBiquadFilter();motorFiltro.type='lowpass';motorFiltro.frequency.value=1900;motorFiltro.Q.value=.7;
  motorGanho=ctx.createGain();motorGanho.gain.value=.0001;
  motorFonte.connect(motorFiltro);motorFiltro.connect(motorGanho);motorGanho.connect(ctx.destination);
  motorFonte.start();
}
export function atualizarSomMotorCarro(montado,velocidade=0,acelerador=0){
  const ctx=obterContexto();if(!ctx)return;
  if(ctx.state==='suspended'){ctx.resume().catch(()=>{});return}
  const t=ctx.currentTime;
  if(montado&&!motorBuffer&&!motorElemento)carregarSomMotor(ctx);
  const v=Math.min(1,Math.abs(velocidade)/33.333),a=Math.max(0,Math.min(1,acelerador));
  const alvo=montado?.18+v*.48+a*(.20+(1-v)*.22):.18;
  motorRotacao+=(alvo-motorRotacao)*(1-Math.exp(-7*(1/60)));
  const carga=montado?Math.max(a*.72,(a-v)*.9,0):0;
  motorCarga+=(carga-motorCarga)*(1-Math.exp(-6*(1/60)));
  const acelerou=a-motorAceleradorAnterior>.055&&montado;
  if(acelerou)tocarAceleracao(ctx,carga,motorRotacao);
  motorAceleradorAnterior=a;
  if(motorSintetico){
    const hz=montado?58+motorRotacao*42:58;
    motorSintetico.base.frequency.setTargetAtTime(hz,t,.055);
    motorSintetico.harm2.frequency.setTargetAtTime(hz*2.01,t,.055);
    motorSintetico.harm3.frequency.setTargetAtTime(hz*3.02,t,.055);
    motorSintetico.filtro.frequency.setTargetAtTime(850+motorRotacao*2650+motorCarga*850,t,.08);
    motorSintetico.ruidoGanho.gain.setTargetAtTime(montado?.018+motorCarga*.045:.0001,t,.08);
    motorSintetico.saida.gain.setTargetAtTime(montado?.055+motorRotacao*.10+motorCarga*.12:.0001,t,montado?.07:.18);
    return;
  }
  if(motorElemento){
    motorElemento.playbackRate=montado?.68+motorRotacao*.62:.68;
    motorElemento.volume=montado?Math.min(1,.34+motorRotacao*.16+motorCarga*.22):0;
    if(montado){motorElemento.play().catch(e=>console.warn('Quintal 3D: o navegador bloqueou o motor até uma interação',e))}else motorElemento.pause();
    return;
  }
  if(!motorFonte||!motorGanho||!motorFiltro)return;
  const volume=montado?.18+motorRotacao*.16+motorCarga*.18:.0001;
  const pitch=montado?.68+motorRotacao*.62:.68;
  motorFonte.playbackRate.setTargetAtTime(pitch,t,.055);
  motorFiltro.frequency.setTargetAtTime(1250+motorRotacao*2600+motorCarga*900,t,.08);
  motorGanho.gain.setTargetAtTime(volume,t,montado?.07:.18);
}
export function tocarSomEquiparColete(){const ctx=obterContexto();if(!ctx)return;const t=ctx.currentTime;const o=ctx.createOscillator(),g=ganho(ctx,t,.045,.12);o.type='square';o.frequency.setValueAtTime(155,t);o.frequency.exponentialRampToValueAtTime(235,t+.1);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.13)}
export function tocarSomImpacto(alvo='parede'){const ctx=obterContexto();if(!ctx)return;const t=ctx.currentTime,src=ctx.createBufferSource(),f=ctx.createBiquadFilter();src.buffer=ruído(ctx);f.type=alvo==='inimigo'?'lowpass':'highpass';f.frequency.value=alvo==='inimigo'?420:900;const g=ganho(ctx,t,alvo==='inimigo'?.09:.065,alvo==='inimigo'?.11:.075);src.connect(f);f.connect(g);g.connect(ctx.destination);src.start(t);src.stop(t+(alvo==='inimigo'?.11:.08))}
export function tocarSomColisaoCarro(impacto=2,posicao=null){const ctx=obterContexto();if(!ctx)return;if(ctx.state==='suspended'){ctx.resume().then(()=>tocarSomColisaoCarro(impacto,posicao)).catch(()=>{});return}const t=ctx.currentTime,src=ctx.createBufferSource(),f=ctx.createBiquadFilter();src.buffer=ruído(ctx);f.type='lowpass';f.frequency.setValueAtTime(2600,t);f.frequency.exponentialRampToValueAtTime(480,t+.18);const força=Math.min(1,Math.max(.15,impacto/18)),dist=posicao?Math.hypot(posicao.x-(globalThis.__audioListenerX||0),posicao.z-(globalThis.__audioListenerZ||0)):0;if(dist>75)return;const g=ganho(ctx,t,(.06+.22*força)/(1+dist*.045),.16+.18*força),yaw=globalThis.__audioListenerYaw||0,dx=posicao?posicao.x-(globalThis.__audioListenerX||0):0,dz=posicao?posicao.z-(globalThis.__audioListenerZ||0):0,pan=posicao?Math.max(-1,Math.min(1,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(1,dist))):0,p=ctx.createStereoPanner?ctx.createStereoPanner():null;src.connect(f);f.connect(g);if(p){p.pan.setValueAtTime(pan,t);g.connect(p);p.connect(ctx.destination)}else g.connect(ctx.destination);src.start(t);src.stop(t+.22+.18*força)}
export function tocarSomSemMunicao(){const ctx=obterContexto();if(!ctx)return;const t=ctx.currentTime,o=ctx.createOscillator(),g=ganho(ctx,t,.035,.07);o.type='square';o.frequency.value=105;o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.08)}
