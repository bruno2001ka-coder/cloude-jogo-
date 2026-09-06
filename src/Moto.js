import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{player}from'./Player.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';

const moto=new THREE.Group();moto.name='motoJogador';moto.visible=false;scene.add(moto);
let montado=false,modeloCarregado=false,velocidade=0,modelo=null;
const MAX_VEL=8,ACELERACAO=13,FREIO=18,ATRITO=8,RAIO_MONTAR=4;
const _box=new THREE.Box3(),_size=new THREE.Vector3(),_center=new THREE.Vector3();

function aviso(txt){const el=document.getElementById('avisoPolicia');if(!el)return;el.textContent=txt;el.style.display='block';el.style.opacity='1';clearTimeout(el._motoT);el._motoT=setTimeout(()=>{el.style.opacity='0';setTimeout(()=>{el.style.display='none'},300)},1800)}
function ajustarModelo(root){
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  _box.setFromObject(root);_box.getSize(_size);const maior=Math.max(_size.x,_size.y,_size.z)||1;root.scale.setScalar(2.2/maior);
  _box.setFromObject(root);_box.getCenter(_center);root.position.sub(_center);root.position.y+=_size.y*.5/maior*2.2;
}
new GLTFLoader().load('assets/moto.glb',gltf=>{
  modelo=gltf.scene;ajustarModelo(modelo);moto.add(modelo);modeloCarregado=true;
  moto.position.set(player.position.x+3,obterElevacao(player.position.x+3,player.position.z+3),player.position.z+3);moto.visible=true;
},undefined,err=>console.warn('Quintal 3D: moto não carregou',err));

function perto(){return Math.hypot(moto.position.x-player.position.x,moto.position.z-player.position.z)<=RAIO_MONTAR}
export function motoMontada(){return montado}
export function alternarMoto(){
  if(!modeloCarregado){aviso('A moto ainda está carregando.');return}
  if(montado){montado=false;velocidade=0;player.visible=true;player.position.y=obterElevacao(player.position.x,player.position.z);moto.visible=true;atualizarBotao();aviso('Você desceu da moto.');return}
  if(!perto()){aviso('Chegue perto da moto para montar.');return}
  montado=true;velocidade=0;player.visible=false;moto.visible=true;player.rotation.y=moto.rotation.y;aviso('Moto montada — WASD ou joystick para dirigir.');atualizarBotao()
}
function atualizarBotao(){const b=document.getElementById('motoBtn');if(b)b.textContent=montado?'DESCER':'MOTO'}
export function atualizarMoto(dt,keys,joyX=0,joyY=0){
  if(!modeloCarregado)return montado;
  if(!montado)return false;
  const frente=-(keys.KeyW?1:0)+(keys.KeyS?1:0)-joyY;
  const giro=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joyX;
  if(Math.abs(frente)>.05)velocidade+=frente*ACELERACAO*dt;
  else if(Math.abs(velocidade)>0)velocidade-=Math.sign(velocidade)*Math.min(Math.abs(velocidade),ATRITO*dt);
  if(Math.abs(velocidade)>0.15)player.rotation.y+=giro*dt*(1.4+Math.abs(velocidade)*.12)*Math.sign(velocidade);
  velocidade=THREE.MathUtils.clamp(velocidade,-MAX_VEL*.35,MAX_VEL);
  const nx=player.position.x+Math.sin(player.rotation.y)*velocidade*dt;
  const nz=player.position.z+Math.cos(player.rotation.y)*velocidade*dt;
  player.position.x=THREE.MathUtils.clamp(nx,-124,124);player.position.z=THREE.MathUtils.clamp(nz,-124,124);player.position.y=obterElevacao(player.position.x,player.position.z);
  moto.position.copy(player.position);moto.position.y+=.02;moto.rotation.y=player.rotation.y;moto.rotation.z=THREE.MathUtils.clamp(-giro*.12,-.12,.12);
  return true;
}
const btn=document.getElementById('motoBtn');btn?.addEventListener('pointerdown',e=>{e.preventDefault();alternarMoto()});
addEventListener('keydown',e=>{if(e.code==='KeyM'&&!e.repeat){e.preventDefault();alternarMoto()}});
atualizarBotao();
