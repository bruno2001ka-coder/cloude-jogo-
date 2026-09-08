// ===== SOUND ENGINE NATIVO, LEVE E ESPACIAL =====
// Todos os buffers são criados uma vez por contexto. O disparo só instancia nós curtos e reutilizáveis.
let contexto=null,ruidoBuffer=null,preparado=false,ecoEntrada=null,ecoDelay=null,ecoGanho=null;
const buffers=new Map(),vozes=[];const MAX_VOZES=12;
const PERFIS={
  pistola:{f:185,d:.105,crack:3900,cauda:.045,ganho:1.0},
  rifle:{f:105,d:.16,crack:2700,cauda:.11,ganho:1.18},
  escopeta:{f:72,d:.22,crack:1750,cauda:.16,ganho:1.3},
  metralhadora:{f:145,d:.075,crack:3300,cauda:.035,ganho:.82},
  policia:{f:135,d:.13,crack:3000,cauda:.075,ganho:.72},
};
function obterContexto(){try{const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContext)return null;contexto??=new AudioContext();if(contexto.state==='suspended')contexto.resume().catch(()=>{});preparar();return contexto}catch(e){return null}}
export function desbloquearAudio(){const ctx=obterContexto();if(ctx?.state==='suspended')ctx.resume().catch(()=>{});return ctx}
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
function conectarEspacial(ctx,no,t,volume,posicao,cauda){const g=ganho(ctx,t,volume,cauda);const f=ctx.createBiquadFilter();f.type='lowpass';let pan=0,dist=0;if(posicao){const dx=posicao.x-(globalThis.__audioListenerX||0),dz=posicao.z-(globalThis.__audioListenerZ||0);dist=Math.hypot(dx,dz);pan=Math.max(-1,Math.min(1,dx/Math.max(1,dist)));f.frequency.value=Math.max(650,11000/(1+dist*.075));g.gain.value*=1/(1+dist*.045)}else f.frequency.value=15000;const p=ctx.createStereoPanner?ctx.createStereoPanner():null;if(p){p.pan.setValueAtTime(pan,t);g.connect(f);f.connect(p);p.connect(ctx.destination)}else{g.connect(f);f.connect(ctx.destination)}no.connect(g);return{g,f,p,dist}}
function tocarPerfil(id,posicao,origem='jogador'){const ctx=obterContexto();if(!ctx)return;if(ctx.state==='suspended'){ctx.resume().then(()=>tocarPerfil(id,posicao,origem)).catch(()=>{});return}const p=PERFIS[id]||PERFIS.pistola,b=buffers.get(id)||buffers.get('pistola'),t=ctx.currentTime,dist=posicao?Math.hypot(posicao.x-(globalThis.__audioListenerX||0),posicao.z-(globalThis.__audioListenerZ||0)):0;let volume=p.ganho*(origem==='policia'?.9:1);if(dist>75)return;if(vozes.length>=MAX_VOZES){const velha=vozes.shift();velha?.stop()};const body=ctx.createBufferSource(),crack=ctx.createBufferSource();body.buffer=b.body;crack.buffer=b.crack;const cb=conectarEspacial(ctx,body,t,volume*.8,posicao,p.d+p.cauda);conectarEspacial(ctx,crack,t,volume*(dist>15?.46:.72),posicao,.06);body.playbackRate.value=.985+Math.random()*.03;crack.playbackRate.value=.97+Math.random()*.06;body.start(t);crack.start(t);if(ecoEntrada){ecoGanho.gain.value=origem==='policia'?.035:.045;cb.g.connect(ecoEntrada)}const voz={stop:()=>{try{body.stop()}catch(e){}try{crack.stop()}catch(e){}}};vozes.push(voz);const retirar=()=>{const i=vozes.indexOf(voz);if(i>=0)vozes.splice(i,1)};body.onended=retirar;crack.onended=retirar}
export function tocarSomTiro(perfil='pistola',posicao=null,origem='jogador'){tocarPerfil(perfil,posicao,origem)}
export function definirPosicaoAudio(x,z){globalThis.__audioListenerX=x;globalThis.__audioListenerZ=z}
export function tocarSomEquiparColete(){const ctx=obterContexto();if(!ctx)return;const t=ctx.currentTime;const o=ctx.createOscillator(),g=ganho(ctx,t,.045,.12);o.type='square';o.frequency.setValueAtTime(155,t);o.frequency.exponentialRampToValueAtTime(235,t+.1);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.13)}
export function tocarSomImpacto(alvo='parede'){const ctx=obterContexto();if(!ctx)return;const t=ctx.currentTime,src=ctx.createBufferSource(),f=ctx.createBiquadFilter();src.buffer=ruído(ctx);f.type=alvo==='inimigo'?'lowpass':'highpass';f.frequency.value=alvo==='inimigo'?420:900;const g=ganho(ctx,t,alvo==='inimigo'?.09:.065,alvo==='inimigo'?.11:.075);src.connect(f);f.connect(g);g.connect(ctx.destination);src.start(t);src.stop(t+(alvo==='inimigo'?.11:.08))}
export function tocarSomSemMunicao(){const ctx=obterContexto();if(!ctx)return;const t=ctx.currentTime,o=ctx.createOscillator(),g=ganho(ctx,t,.035,.07);o.type='square';o.frequency.value=105;o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.08)}
