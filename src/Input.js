// Teclado, joystick virtual e olhar por arraste/Pointer Lock. PULAR (tecla ou botão) sobe o drone quando ele está ativo.
import*as THREE from'three';
import{pularJogador}from'./Player.js';
import{droneState,subirDrone,miraState}from'./Camera.js';
import{alternarDebug}from'./UI.js';
import{trocarArma,definirGatilho,definirMira}from'./Police.js';
import{ORDEM_ARMAS}from'./Weapons.js';

export const inputState={yaw:0,targetYaw:0,pitch:.28,targetPitch:.28,joyX:0,joyY:0,joyActive:false,joyId:null};
export const keys=Object.create(null);
const keyMap={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',ArrowUp:'KeyW',ArrowLeft:'KeyA',ArrowDown:'KeyS',ArrowRight:'KeyD'};
// Solta o gatilho junto com as teclas: trocar de aba com F pressionado deixaria o tiro preso ligado.
const clearKeys=()=>{for(const k in keys)keys[k]=false;definirGatilho(false);definirMira(false)};

function pularOuSubir(){if(droneState.ativo){subirDrone()}else{pularJogador()}}

addEventListener('keydown',e=>{
  if(e.code==='Space'){pularOuSubir();e.preventDefault();return}
  if(e.code==='KeyV'){alternarDebug();return}
  if(e.code==='KeyQ'){trocarArma();return}
  if(e.code.startsWith('Digit')){const n=+e.code.slice(5);if(n>=1&&n<=4){trocarArma(ORDEM_ARMAS[n-1]);return}}
  // F vira gatilho SEGURADO. O autorrepeat do teclado tem atraso e taxa próprios do sistema, que não
  // têm nada a ver com o cooldown da arma — quem controla a cadência é o loop, não o teclado.
  if(e.code==='KeyF'){definirGatilho(true);e.preventDefault();return}
  // Mira SEGURADA no teclado (botão direito do mouse faz o mesmo): é o gesto que todo mundo já tem
  // no dedo em jogo de tiro. No celular o botão 🎯 alterna, porque lá não dá pra segurar dois.
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){definirMira(true);e.preventDefault();return}
  const k=keyMap[e.key]||e.code;if(k){keys[k]=true;e.preventDefault()}
});
addEventListener('keyup',e=>{
  if(e.code==='KeyF'){definirGatilho(false);return}
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){definirMira(false);return}
  const k=keyMap[e.key]||e.code;if(k){keys[k]=false;e.preventDefault()}
});
addEventListener('blur',clearKeys);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearKeys()});

const jumpBtn=document.getElementById('jumpBtn');
jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();pularOuSubir()});

const stickBase=document.getElementById('stickBase'),stick=document.getElementById('stick');
function updateJoy(e){const r=stickBase.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max}inputState.joyX=dx/max;inputState.joyY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}
function releaseJoy(e){if(inputState.joyId!==null&&e.pointerId!==inputState.joyId)return;inputState.joyX=0;inputState.joyY=0;inputState.joyActive=false;inputState.joyId=null;stick.style.transform='translate(0,0)'}
stickBase.addEventListener('pointerdown',e=>{e.preventDefault();inputState.joyActive=true;inputState.joyId=e.pointerId;stickBase.setPointerCapture?.(e.pointerId);updateJoy(e)});
stickBase.addEventListener('pointermove',e=>{if(inputState.joyActive&&e.pointerId===inputState.joyId)updateJoy(e)});
stickBase.addEventListener('pointerup',releaseJoy);
stickBase.addEventListener('pointercancel',releaseJoy);

// Mouse (desktop): Pointer Lock dá o giro livre estilo GTA SA, sem precisar segurar o botão depois do 1º clique (exigência do navegador).
// Touch (celular): mantém o arrastar-pra-olhar de sempre, sem mudança nenhuma.
let drag=false,lastX=0,lastY=0;
// Faixa vertical da mira. Era [-.12,.7]: com o mínimo em -0,12 rad dava pra apontar no máximo ~7°
// acima da horizontal, ou seja, era IMPOSSÍVEL mirar no helicóptero (38 m de altura) ou em alguém em
// cima de uma laje. Abrir o lado negativo é o que devolve a pontaria pra cima.
const PITCH_MIN=-.6,PITCH_MAX=.85;
const limitarPitch=v=>Math.max(PITCH_MIN,Math.min(PITCH_MAX,v));
export function initDragLook(rendererDomElement){
  rendererDomElement.addEventListener('pointerdown',e=>{
    drag=true;lastX=e.clientX;lastY=e.clientY;rendererDomElement.setPointerCapture?.(e.pointerId);
    // No desktop, com o mouse já travado, o clique é tiro — antes só a tecla F atirava, e com o
    // ponteiro travado o cursor nem alcançava o botão 🔫 na tela.
    if(e.pointerType==='mouse'){
      if(document.pointerLockElement===rendererDomElement){
        if(e.button===0)definirGatilho(true);
        if(e.button===2)definirMira(true);// botão direito = mira, como em qualquer jogo de tiro
      }
      else{try{const p=rendererDomElement.requestPointerLock?.();p?.catch?.(()=>{})}catch(err){}}
    }
  });
  // Sem o menu de contexto o botão direito fica livre pra mirar em vez de abrir o menu do navegador.
  rendererDomElement.addEventListener('contextmenu',e=>e.preventDefault());
  // Mirando, o giro fica 45% mais lento: é o que transforma a mira em precisão de verdade em vez de
  // só um zoom — sem isso, o mesmo arraste de dedo joga a mira pra longe do alvo com o FOV fechado.
  const sens=()=>1-.45*miraState.fator;
  rendererDomElement.addEventListener('pointermove',e=>{if(document.pointerLockElement===rendererDomElement){const s=sens();inputState.targetYaw-=e.movementX*.0035*s;inputState.targetPitch=limitarPitch(inputState.targetPitch-e.movementY*.0025*s)}else if(drag){const s=sens(),dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;inputState.targetYaw-=dx*.009*s;inputState.targetPitch=limitarPitch(inputState.targetPitch-dy*.006*s)}});
  // Só o mouse solta o gatilho aqui: no celular o tiro é o botão 🔫 (com captura de ponteiro própria),
  // e soltar por qualquer pointerup do canvas cortaria a rajada quando o segundo dedo, o que gira a
  // câmera, saísse da tela.
  const soltar=e=>{drag=false;if(e.pointerType==='mouse'){definirGatilho(false);if(e.button===2||e.type==='pointercancel')definirMira(false)}};
  rendererDomElement.addEventListener('pointerup',soltar);
  rendererDomElement.addEventListener('pointercancel',soltar);
}

export function atualizarSuavizacaoInput(dt){
  inputState.yaw=THREE.MathUtils.lerp(inputState.yaw,inputState.targetYaw,1-Math.exp(-12*dt));
  inputState.pitch=THREE.MathUtils.lerp(inputState.pitch,inputState.targetPitch,1-Math.exp(-12*dt));
}
