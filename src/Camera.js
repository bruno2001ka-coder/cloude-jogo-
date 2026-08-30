// Câmera terceira-pessoa estilo GTA SA (anti-clipping por raycaster) + modo drone.
import*as THREE from'three';
import{camera}from'./core.js';
import{obstaculos}from'./Physics.js';
import{obterElevacao}from'./Terrain.js';

// Raycaster contra BoundingBoxes: aproxima a câmera da parede mais próxima e mantém uma margem.
const cameraRaycaster=new THREE.Raycaster();
const cameraDirectionTemp=new THREE.Vector3();
const cameraHitTemp=new THREE.Vector3();
const cameraSafeGoalTemp=new THREE.Vector3();
export function cameraSemClipping(target,goal){const distancia=target.distanceTo(goal);cameraDirectionTemp.subVectors(goal,target).normalize();cameraRaycaster.set(target,cameraDirectionTemp);let menor=distancia;for(const box of obstaculos){const hit=cameraRaycaster.ray.intersectBox(box,cameraHitTemp);if(hit){const d=hit.distanceTo(target);if(d>0&&d<menor)menor=d}}if(menor<distancia){cameraSafeGoalTemp.copy(cameraDirectionTemp).multiplyScalar(Math.max(.8,menor-.35)).add(target);return cameraSafeGoalTemp}return goal}

const camGoal=new THREE.Vector3(),lookGoal=new THREE.Vector3();
export function atualizarCameraSeguidora(dt,playerPos,yaw,pitch,eyeHeight){
  const camSmooth=1-Math.exp(-7*dt);
  const target=new THREE.Vector3(playerPos.x,playerPos.y+eyeHeight,playerPos.z);
  const dist=5;const cp=Math.cos(pitch);
  camGoal.set(target.x+Math.sin(yaw)*dist*cp,playerPos.y+2+Math.sin(pitch)*dist,target.z+Math.cos(yaw)*dist*cp);
  const camGoalSeguro=cameraSemClipping(target,camGoal);
  camera.position.lerp(camGoalSeguro,camSmooth);
  lookGoal.lerp(target,camSmooth);
  camera.lookAt(lookGoal);
}

// ===== MODO DRONE: câmera livre estilo drone pra ver o mapa por cima. Joystick voa a câmera (não move o jogador),
// arrastar continua girando/inclinando a vista. PULAR sobe; sem empuxo, desce sozinho aos poucos, como um drone de verdade.
export const droneState={ativo:false,x:0,z:0,y:70};
const DRONE_VELOCIDADE=32;
const droneBtn=document.getElementById('droneBtn');
export function alternarDrone(playerPos,inputState){
  droneState.ativo=!droneState.ativo;
  if(droneState.ativo){droneState.x=playerPos.x;droneState.z=playerPos.z;droneState.y=Math.max(droneState.y,45);inputState.targetPitch=.55}
  droneBtn.classList.toggle('on',droneState.ativo);droneBtn.textContent=droneState.ativo?'🚁 SAIR':'🚁';
}
export function subirDrone(){droneState.y=Math.min(110,droneState.y+14)}

export function atualizarCameraDrone(dt,keys,joyX,joyY,yaw,pitch){
  let x=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joyX,z=(keys.KeyS?1:0)-(keys.KeyW?1:0)-joyY,m=Math.hypot(x,z);
  if(m){x/=m;z/=m;const f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));droneState.x+=(r.x*x-f.x*z)*DRONE_VELOCIDADE*dt;droneState.z+=(r.z*x-f.z*z)*DRONE_VELOCIDADE*dt}
  droneState.y-=6*dt;droneState.y=THREE.MathUtils.clamp(droneState.y,10,110);droneState.x=THREE.MathUtils.clamp(droneState.x,-125,125);droneState.z=THREE.MathUtils.clamp(droneState.z,-125,125);
  const chaoDrone=obterElevacao(droneState.x,droneState.z);
  camera.position.set(droneState.x,chaoDrone+droneState.y,droneState.z);
  const fDrone=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),cpDrone=Math.cos(pitch),spDrone=Math.sin(pitch);
  lookGoal.set(camera.position.x+fDrone.x*cpDrone*40,camera.position.y-spDrone*40,camera.position.z+fDrone.z*cpDrone*40);
  camera.lookAt(lookGoal);
}
