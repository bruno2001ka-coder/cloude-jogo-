// Teclado, joystick virtual e olhar por arraste/Pointer Lock. PULAR (tecla ou botão) sobe o drone quando ele está ativo.
import*as THREE from'three';
import{pularJogador}from'./Player.js';
import{droneState,subirDrone,miraState}from'./Camera.js';
import{alternarDebug}from'./UI.js';
import{trocarArma,definirGatilho,definirMira}from'./Police.js';
import{acaoPrimaria,alternarInventario}from'./Economy.js';
import{ORDEM_ARMAS}from'./Weapons.js';

// ===== SENSIBILIDADE (mexa AQUI pra deixar a câmera mais rápida/lenta) =====
// Positivo = comportamento NORMAL (não invertido). rad por pixel de movimento do mouse.
export const SENSIBILIDADE_MOUSE=.0035;      // giro horizontal (yaw) com pointer lock
export const SENSIBILIDADE_MOUSE_VERTICAL=.0025;// giro vertical (pitch) com pointer lock
export const SENSIBILIDADE_TOQUE=.009,SENSIBILIDADE_TOQUE_VERTICAL=.006;// arraste de dedo/mouse sem lock

export const inputState={yaw:0,targetYaw:0,pitch:.28,targetPitch:.28,joyX:0,joyY:0,joyActive:false,joyId:null,joyForca:0,
  aimX:0,aimY:0,aimActive:false,aimId:null,correndo:false};
export const keys=Object.create(null);
const keyMap={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',ArrowUp:'KeyW',ArrowLeft:'KeyA',ArrowDown:'KeyS',ArrowRight:'KeyD'};
// Solta o gatilho junto com as teclas: trocar de aba com F pressionado deixaria o tiro preso ligado.
// Solta também a corrida: se o Shift ficar "preso" ao trocar de aba, o jogador voltaria correndo sozinho.
const clearKeys=()=>{for(const k in keys)keys[k]=false;inputState.correndo=false;inputState.joyForca=0;inputState.aimX=0;inputState.aimY=0;inputState.aimActive=false;inputState.aimId=null;definirGatilho(false);if(document.pointerLockElement)definirMira(false)};

function pularOuSubir(){if(droneState.ativo){subirDrone()}else{pularJogador()}}

addEventListener('keydown',e=>{
  if(e.repeat&&(e.code==='KeyE'||e.code==='KeyQ'||e.code==='KeyX'||e.code==='Tab'))return;// autorrepeat abriria/fecharia o inventário em loop
  if(e.code==='Space'){pularOuSubir();e.preventDefault();return}
  if(e.code==='KeyV'){alternarDebug();return}
  // E = ação de mundo (colher planta, abrir/fechar porta). Não toca em mira nem gatilho: dá pra agir mirando.
  if(e.code==='KeyE'){acaoPrimaria();e.preventDefault();return}
  // Q = inventário (padrão de jogo moderno). A troca de arma foi pra Tab/X e pra rodinha do mouse.
  if(e.code==='KeyQ'){alternarInventario();e.preventDefault();return}
  if(e.code==='Tab'||e.code==='KeyX'){trocarArma();e.preventDefault();return}
  if(e.code.startsWith('Digit')){const n=+e.code.slice(5);if(n>=1&&n<=4){trocarArma(ORDEM_ARMAS[n-1]);return}}
  // F vira gatilho SEGURADO. O autorrepeat do teclado tem atraso e taxa próprios do sistema, que não
  // têm nada a ver com o cooldown da arma — quem controla a cadência é o loop, não o teclado.
  if(e.code==='KeyF'){definirGatilho(true);e.preventDefault();return}
  // Shift = CORRER (estilo COD). A mira saiu daqui e ficou só no botão direito do mouse / botão 🎯,
  // que é onde a mão já está — assim o Shift volta a ser sprint como em qualquer jogo de tiro.
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){inputState.correndo=true;e.preventDefault();return}
  const k=keyMap[e.key]||e.code;if(k){keys[k]=true;e.preventDefault()}
});
addEventListener('keyup',e=>{
  if(e.code==='KeyF'){definirGatilho(false);return}
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){inputState.correndo=false;return}
  const k=keyMap[e.key]||e.code;if(k){keys[k]=false;e.preventDefault()}
});
addEventListener('blur',clearKeys);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearKeys()});

const jumpBtn=document.getElementById('jumpBtn');
jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();pularOuSubir()});

// ===== CORRER É EMPURRAR O JOYSTICK ATÉ O BATENTE =====
// Foi um BOTÃO por uma versão, e o Bruno pediu o jeito de jogo de tiro: "pra correr rápido tem que
// arrastar o joystick até o finalzinho". Ele tem razão, e o botão saiu — por dois motivos.
//
// O primeiro é a mão: correr é coisa que se faz ENQUANTO anda, e um botão obriga o polegar a fazer
// duas coisas ao mesmo tempo ou a soltar a direção pra apertar. No batente, andar e correr são o
// MESMO gesto, só que mais longe. É por isso que todo jogo de tiro de celular faz assim.
// O segundo é espaço: o botão comia 74 px de tela num aparelho onde área de polegar é o recurso mais
// escasso, e a tela dele já estava cheia.
//
// O limiar é 0,88 e não 1,00: o dedo raramente encosta no batente exato, e exigir o batente exato
// daria uma corrida que só liga por acidente. A 88% ele já está claramente empurrando pra fora, e a
// borda do joystick acende pra ele ver que pegou.
const LIMIAR_CORRIDA=.88;

const stickBase=document.getElementById('stickBase'),stick=document.getElementById('stick');
function updateJoy(e){const r=stickBase.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max}inputState.joyX=dx/max;inputState.joyY=dy/max;
  // Quanto o polegar empurrou, de 0 (centro) a 1 (batente). É daqui que sai a corrida.
  inputState.joyForca=Math.min(1,len/max);
  stickBase.classList.toggle('correndo',inputState.joyForca>=LIMIAR_CORRIDA);
  stick.style.transform=`translate(${dx}px,${dy}px)`}
function releaseJoy(e){if(inputState.joyId!==null&&e.pointerId!==inputState.joyId)return;inputState.joyX=0;inputState.joyY=0;inputState.joyForca=0;inputState.joyActive=false;inputState.joyId=null;stickBase.classList.remove('correndo');stick.style.transform='translate(0,0)'}
stickBase.addEventListener('pointerdown',e=>{e.preventDefault();inputState.joyActive=true;inputState.joyId=e.pointerId;stickBase.setPointerCapture?.(e.pointerId);updateJoy(e)});
stickBase.addEventListener('pointermove',e=>{if(inputState.joyActive&&e.pointerId===inputState.joyId)updateJoy(e)});
stickBase.addEventListener('pointerup',releaseJoy);
stickBase.addEventListener('pointercancel',releaseJoy);

// ===== ÁREA DIREITA: ARRASTAR PARA MIRAR, ESTILO FREE FIRE =====
// Não é um segundo analógico: o lado direito é uma área livre de arraste. O dedo move a câmera pela
// diferença entre quadros, enquanto o botão de tiro continua separado, como nos jogos de tiro mobile.
const aimBase=document.getElementById('aimBase'),aimStick=document.getElementById('aimStick');
const AIM_SENS_X=.0065,AIM_SENS_Y=.0042;
let aimLastX=0,aimLastY=0;
function updateAim(e){
  if(!inputState.aimActive)return;
  const dx=e.clientX-aimLastX,dy=e.clientY-aimLastY;
  inputState.targetYaw-=dx*AIM_SENS_X;
  inputState.targetPitch=limitarPitch(inputState.targetPitch+dy*AIM_SENS_Y);
  aimLastX=e.clientX;aimLastY=e.clientY;
}
function releaseAim(e){if(inputState.aimId!==null&&e.pointerId!==inputState.aimId)return;inputState.aimX=0;inputState.aimY=0;inputState.aimActive=false;inputState.aimId=null;aimStick.style.transform='translate(0,0)'}
aimBase?.addEventListener('pointerdown',e=>{e.preventDefault();inputState.aimActive=true;inputState.aimId=e.pointerId;aimLastX=e.clientX;aimLastY=e.clientY;aimBase.setPointerCapture?.(e.pointerId);updateAim(e)});
aimBase?.addEventListener('pointermove',e=>{if(inputState.aimActive&&e.pointerId===inputState.aimId)updateAim(e)});
aimBase?.addEventListener('pointerup',releaseAim);aimBase?.addEventListener('pointercancel',releaseAim);

// Mouse (desktop): Pointer Lock dá o giro livre estilo GTA SA, sem precisar segurar o botão depois do 1º clique (exigência do navegador).
// Touch (celular): mantém o arrastar-pra-olhar de sempre, sem mudança nenhuma.
// UM DEDO POR VEZ GIRA A CÂMERA. Isto era `drag` booleano com um `lastX/lastY` global, sem olhar o
// `pointerId`: no celular, encostar um segundo dedo na tela (comum — polegar mirando e outro dedo
// apoiado) fazia o giro passar a ser calculado com o `lastX` do PRIMEIRO dedo, e a câmera dava um
// salto violento. Pior: levantar o segundo dedo zerava `drag` e a câmera PARAVA de girar até
// levantar e reencostar o dedo que estava girando.
// Guardando o id, o canvas ignora qualquer ponteiro que não seja o que começou o arraste.
let dragId=null,lastX=0,lastY=0;
// Faixa vertical da mira. Era [-.12,.7]: com o mínimo em -0,12 rad dava pra apontar no máximo ~7°
// acima da horizontal, ou seja, era IMPOSSÍVEL mirar no helicóptero (38 m de altura) ou em alguém em
// cima de uma laje. Abrir o lado negativo é o que devolve a pontaria pra cima.
const PITCH_MIN=-.6,PITCH_MAX=.85;
const limitarPitch=v=>Math.max(PITCH_MIN,Math.min(PITCH_MAX,v));
export function initDragLook(rendererDomElement){
  rendererDomElement.addEventListener('pointerdown',e=>{
    // O segundo dedo no canvas não rouba o arraste do primeiro.
    if(dragId!==null&&e.pointerId!==dragId)return;
    dragId=e.pointerId;lastX=e.clientX;lastY=e.clientY;
    // No desktop, com o mouse já travado, o clique é tiro — antes só a tecla F atirava, e com o
    // ponteiro travado o cursor nem alcançava o botão 🔫 na tela.
    if(e.pointerType==='mouse'){
      if(document.pointerLockElement===rendererDomElement)sincronizarBotoesMouse(e);
      else{try{const p=rendererDomElement.requestPointerLock?.();p?.catch?.(()=>{})}catch(err){}}
    }
    // A captura de ponteiro serve pro ARRASTE (dedo, ou mouse sem lock): sem ela, arrastar pra fora
    // do canvas larga o olhar no meio do giro. Com o pointer lock ativo ela não só é inútil — o
    // navegador já entrega todo evento aqui — como LANÇA InvalidStateError. Sendo a primeira linha
    // do handler, essa exceção abortava o resto: no PC o botão esquerdo não atirava e o direito não
    // mirava. Agora fica por último e dentro de try — nada aqui pode derrubar o tiro e a mira.
    if(!document.pointerLockElement){try{rendererDomElement.setPointerCapture?.(e.pointerId)}catch(err){}}
  });
  // Um mouse é UM ponteiro só, e o navegador dispara `pointerdown` apenas na PRIMEIRA tecla apertada:
  // segurar o botão direito (mirar) e depois apertar o esquerdo não gera pointerdown nenhum, gera
  // pointermove. Por isso o gatilho e a mira saem do bitmask `buttons` — que diz quais botões estão
  // apertados AGORA — em vez de `button`, que só diz qual acabou de mudar. Sem isso era impossível
  // atirar mirando, que é justamente o jeito de jogar de quem mira.
  const sincronizarBotoesMouse=e=>{
    if(e.pointerType!=='mouse')return;
    if(document.pointerLockElement!==rendererDomElement){definirGatilho(false);definirMira(false);return}
    definirGatilho((e.buttons&1)!==0);// esquerdo
    definirMira((e.buttons&2)!==0);   // direito
  };
  // Sem o menu de contexto o botão direito fica livre pra mirar em vez de abrir o menu do navegador.
  rendererDomElement.addEventListener('contextmenu',e=>e.preventDefault());
  // Mirando, o giro fica 45% mais lento: é o que transforma a mira em precisão de verdade em vez de
  // só um zoom — sem isso, o mesmo arraste de dedo joga a mira pra longe do alvo com o FOV fechado.
  const sens=()=>1-.45*miraState.fator;
  // SINAIS (checados contra a matemática de Camera.js, não no chute):
  // yaw: a câmera fica em (sin yaw,cos yaw)*dist atrás da cabeça, então o olhar é -(sin yaw,cos yaw) e
  //   d(olhar)/d(yaw) aponta pra ESQUERDA — logo yaw DECRESCENTE vira pra direita: `-= movementX` está certo.
  // pitch: camGoal.y = alvo.y + sin(pitch)*dist, ou seja pitch POSITIVO ergue a câmera e olha PRA BAIXO.
  //   Mouse pra cima dá movementY NEGATIVO e tem que olhar pra cima, isto é, DIMINUIR o pitch →
  //   o certo é `+= movementY`. O `-=` de antes era o eixo vertical invertido.
  rendererDomElement.addEventListener('pointermove',e=>{sincronizarBotoesMouse(e);if(document.pointerLockElement===rendererDomElement){const s=sens();inputState.targetYaw-=e.movementX*SENSIBILIDADE_MOUSE*s;inputState.targetPitch=limitarPitch(inputState.targetPitch+e.movementY*SENSIBILIDADE_MOUSE_VERTICAL*s)}else if(e.pointerId===dragId){const s=sens(),dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;inputState.targetYaw-=dx*SENSIBILIDADE_TOQUE*s;inputState.targetPitch=limitarPitch(inputState.targetPitch+dy*SENSIBILIDADE_TOQUE_VERTICAL*s)}});
  // Rodinha do mouse troca de arma: a mão direita nunca sai do mouse durante o tiroteio.
  rendererDomElement.addEventListener('wheel',e=>{if(document.pointerLockElement===rendererDomElement){trocarArma();e.preventDefault()}},{passive:false});
  // Só o mouse solta o gatilho aqui: no celular o tiro é o botão 🔫 (com captura de ponteiro própria),
  // e soltar por qualquer pointerup do canvas cortaria a rajada quando o segundo dedo, o que gira a
  // câmera, saísse da tela.
  // Soltar um dos dois botões também passa pelo bitmask: soltar o esquerdo com o direito ainda
  // apertado tem que parar o tiro e MANTER a mira, e o `button` sozinho não sabe disso.
  const soltar=e=>{
    // Só o dedo que estava girando encerra o giro. Antes qualquer pointerup zerava o arraste.
    if(dragId!==null&&e.pointerId!==dragId)return;
    dragId=null;
    if(e.pointerType==='mouse'){
    if(e.type==='pointercancel'){definirGatilho(false);definirMira(false)}else sincronizarBotoesMouse(e);
  }};
  rendererDomElement.addEventListener('pointerup',soltar);
  rendererDomElement.addEventListener('pointercancel',soltar);
}

// A suavização existe pro modo normal (mouse/dedo em passos grandes ficam serrilhados sem ela), mas na
// MIRA ela vira atraso: o cano segue a mão com meio frame de sobra e a cruz "puxa" em vez de parar no
// alvo. Então a constante sobe de 12 pra 60 conforme a mira fecha — a 60 o lerp já converge dentro do
// próprio frame, ou seja, na mira cheia o giro é 1:1 com o mouse, sem tremida.
const SUAVIZACAO_NORMAL=12,SUAVIZACAO_MIRA=60;
export function atualizarSuavizacaoInput(dt){
  const k=SUAVIZACAO_NORMAL+(SUAVIZACAO_MIRA-SUAVIZACAO_NORMAL)*miraState.fator;
  const a=1-Math.exp(-k*dt);
  inputState.yaw=THREE.MathUtils.lerp(inputState.yaw,inputState.targetYaw,a);
  inputState.pitch=THREE.MathUtils.lerp(inputState.pitch,inputState.targetPitch,a);
  // Mira quase cheia: crava o valor. Sobra de lerp é o que faz a cruz "escorregar" depois que a mão parou.
  if(miraState.fator>.92){inputState.yaw=inputState.targetYaw;inputState.pitch=inputState.targetPitch}
}

// Multiplicador de velocidade de andar. Exportado (em vez de calculado no main.js) porque quem sabe se o
// Shift está segurado é o Input. Correr é desligado enquanto mira: ninguém corre de arma no olho.
export const VEL_CORRIDA=1.7,VEL_MIRA=.45;
export function fatorVelocidadeDesejado(){
  const f=miraState.fator;
  // Duas fontes, uma pergunta: Shift no teclado OU joystick no batente. Ficam separadas em vez de uma
  // escrever na outra — se `updateJoy` escrevesse em `correndo`, o dedo saindo do joystick apagaria um
  // Shift que o teclado ainda está segurando.
  const correndo=inputState.correndo||inputState.joyForca>=LIMIAR_CORRIDA;
  const base=correndo&&f<.15?VEL_CORRIDA:1;
  return base+(VEL_MIRA-base)*f;
}
