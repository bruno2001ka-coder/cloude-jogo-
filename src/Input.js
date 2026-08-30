// Teclado, joystick virtual e olhar por arraste/Pointer Lock. PULAR (tecla ou botão) sobe o drone quando ele está ativo.
import*as THREE from'three';
import{pularJogador}from'./Player.js';
import{droneState,subirDrone}from'./Camera.js';
import{alternarDebug}from'./UI.js';
import{atirar}from'./Police.js';

export const inputState={yaw:0,targetYaw:0,pitch:.28,targetPitch:.28,joyX:0,joyY:0,joyActive:false,joyId:null};
export const keys=Object.create(null);
const keyMap={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',ArrowUp:'KeyW',ArrowLeft:'KeyA',ArrowDown:'KeyS',ArrowRight:'KeyD'};
const clearKeys=()=>{for(const k in keys)keys[k]=false};

function pularOuSubir(){if(droneState.ativo){subirDrone()}else{pularJogador()}}

addEventListener('keydown',e=>{
  if(e.code==='Space'){pularOuSubir();e.preventDefault();return}
  if(e.code==='KeyV'){alternarDebug();return}
  if(e.code==='KeyF'){atirar();return}
  const k=keyMap[e.key]||e.code;if(k){keys[k]=true;e.preventDefault()}
});
addEventListener('keyup',e=>{const k=keyMap[e.key]||e.code;if(k){keys[k]=false;e.preventDefault()}});
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
export function initDragLook(rendererDomElement){
  rendererDomElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;rendererDomElement.setPointerCapture?.(e.pointerId);if(e.pointerType==='mouse'){try{const p=rendererDomElement.requestPointerLock?.();p?.catch?.(()=>{})}catch(err){}}});
  rendererDomElement.addEventListener('pointermove',e=>{if(document.pointerLockElement===rendererDomElement){inputState.targetYaw-=e.movementX*.0035;inputState.targetPitch=Math.max(-.12,Math.min(.7,inputState.targetPitch-e.movementY*.0025))}else if(drag){const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;inputState.targetYaw-=dx*.009;inputState.targetPitch=Math.max(-.12,Math.min(.7,inputState.targetPitch-dy*.006))}});
  rendererDomElement.addEventListener('pointerup',()=>drag=false);
  rendererDomElement.addEventListener('pointercancel',()=>drag=false);
}

export function atualizarSuavizacaoInput(dt){
  inputState.yaw=THREE.MathUtils.lerp(inputState.yaw,inputState.targetYaw,1-Math.exp(-12*dt));
  inputState.pitch=THREE.MathUtils.lerp(inputState.pitch,inputState.targetPitch,1-Math.exp(-12*dt));
}
