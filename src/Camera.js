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
// A margem recuada era de 0,35 m com piso de 0,80 m — números pensados pro personagem de 1,4 m.
// Com 0,9 m, esse piso deixa a câmera longe demais pra encostar na parede sem atravessar, e o recuo
// grande faz ela pular pra frente cedo demais. Margem menor = a câmera chega perto da parede e para.
const CAM_MARGEM=.18,CAM_MIN=.4;
export function cameraSemClipping(target,goal){const distancia=target.distanceTo(goal);cameraDirectionTemp.subVectors(goal,target).normalize();cameraRaycaster.set(target,cameraDirectionTemp);let menor=distancia;for(const box of obstaculos){const hit=cameraRaycaster.ray.intersectBox(box,cameraHitTemp);if(hit){const d=hit.distanceTo(target);if(d>0&&d<menor)menor=d}}if(menor<distancia){cameraSafeGoalTemp.copy(cameraDirectionTemp).multiplyScalar(Math.max(CAM_MIN,menor-CAM_MARGEM)).add(target);return cameraSafeGoalTemp}return goal}

// ===== MODO DE MIRA (ADS) =====
// `fator` é o 0→1 suavizado da transição: trocar distância e FOV de um frame pro outro dá um
// solavanco de zoom; interpolar é o que faz parecer que a arma foi levada ao olho.
export const miraState={ativo:false,fator:0};
const FOV_NORMAL=58,FOV_MIRA=38;

const camGoal=new THREE.Vector3(),lookGoal=new THREE.Vector3(),alvoTemp=new THREE.Vector3(),ladoTemp=new THREE.Vector3();
export function atualizarCameraSeguidora(dt,playerPos,yaw,pitch,eyeHeight){
  miraState.fator+=((miraState.ativo?1:0)-miraState.fator)*(1-Math.exp(-12*dt));
  const f=miraState.fator;
  // Na mira a câmera para de "perseguir": o lerp de posição a 7/s é ótimo pra terceira pessoa solta,
  // mas com o FOV em 38° ele vira aquele arrasto de meio segundo atrás do mouse. Subindo pra 45/s a
  // câmera assenta dentro do frame — mira firme, sem tremer e sem puxar. Fora da mira nada muda.
  const camSmooth=1-Math.exp(-(7+38*f)*dt);
  // Tudo dimensionado pela altura do olho, não em metros soltos: quando o personagem encolheu de
  // 1,4 m pra 0,9 m, a distância fixa de 5 m e o "+2" de altura viraram uma câmera de helicóptero —
  // é o enquadramento distante e de cima que aparece no print.
  const dist=eyeHeight*(3.2-1.5*f);
  const cp=Math.cos(pitch);
  // A órbita é em volta da CABEÇA. Antes o alvo do olhar era a cabeça mas a altura da câmera saía de
  // `playerPos.y+2` — dois centros diferentes, o que fazia o enquadramento subir sozinho.
  alvoTemp.set(playerPos.x,playerPos.y+eyeHeight,playerPos.z);
  // Na mira, desloca pro ombro direito pra o próprio boneco não tapar exatamente o ponto visado.
  ladoTemp.set(Math.cos(yaw),0,-Math.sin(yaw)).multiplyScalar(eyeHeight*.55*f);
  alvoTemp.add(ladoTemp);
  camGoal.set(alvoTemp.x+Math.sin(yaw)*dist*cp,alvoTemp.y+Math.sin(pitch)*dist,alvoTemp.z+Math.cos(yaw)*dist*cp);
  // Trava de chão: olhando pra cima a câmera desce pela órbita e ia parar DEBAIXO do terreno (e do
  // telhado em que o jogador estivesse). O piso é o mais alto entre o terreno sob a câmera e os pés
  // do jogador, com uma margem — é a diferença entre "visão baixa" e "visão dentro do chão".
  const piso=Math.max(obterElevacao(camGoal.x,camGoal.z),playerPos.y)+eyeHeight*.4;
  if(camGoal.y<piso)camGoal.y=piso;
  const camGoalSeguro=cameraSemClipping(alvoTemp,camGoal);
  // E de novo DEPOIS do recuo anti-parede: aquele recuo desliza a câmera pela reta até a cabeça, e
  // num terreno em aclive esse ponto intermediário pode voltar pra dentro do chão. Travar só antes
  // deixaria justamente o caso "encostou no muro numa ladeira" passar.
  const pisoFinal=obterElevacao(camGoalSeguro.x,camGoalSeguro.z)+eyeHeight*.25;
  if(camGoalSeguro.y<pisoFinal)camGoalSeguro.y=pisoFinal;
  camera.position.lerp(camGoalSeguro,camSmooth);
  lookGoal.lerp(alvoTemp,camSmooth);
  camera.lookAt(lookGoal);
  const fovAlvo=FOV_NORMAL+(FOV_MIRA-FOV_NORMAL)*f;
  if(Math.abs(camera.fov-fovAlvo)>.01){camera.fov=fovAlvo;camera.updateProjectionMatrix()}
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
  let x=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joyX,z=(keys.KeyS?1:0)-(keys.KeyW?1:0)+joyY,m=Math.hypot(x,z);
  if(m){x/=m;z/=m;const f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));droneState.x+=(r.x*x-f.x*z)*DRONE_VELOCIDADE*dt;droneState.z+=(r.z*x-f.z*z)*DRONE_VELOCIDADE*dt}
  droneState.y-=6*dt;droneState.y=THREE.MathUtils.clamp(droneState.y,10,110);droneState.x=THREE.MathUtils.clamp(droneState.x,-125,125);droneState.z=THREE.MathUtils.clamp(droneState.z,-125,125);
  const chaoDrone=obterElevacao(droneState.x,droneState.z);
  camera.position.set(droneState.x,chaoDrone+droneState.y,droneState.z);
  const fDrone=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),cpDrone=Math.cos(pitch),spDrone=Math.sin(pitch);
  lookGoal.set(camera.position.x+fDrone.x*cpDrone*40,camera.position.y-spDrone*40,camera.position.z+fDrone.z*cpDrone*40);
  camera.lookAt(lookGoal);
}
