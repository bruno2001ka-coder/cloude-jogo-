import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{player}from'./Player.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{colideObstaculoXZ}from'./Physics.js';

const moto=new THREE.Group();moto.name='motoJogador';moto.visible=false;scene.add(moto);
let montado=false,modeloCarregado=false,velocidade=0,modelo=null;

// A moto usa uma dinâmica arcade previsível: W acelera, S freia/engata ré e A/D esterçam.
// Os limites são separados para a ré não disparar como se fosse marcha à frente.
const MAX_VEL=11,MAX_RE=3.8,ACELERACAO=14,ACELERACAO_RE=7,FREIO=24,ATRITO=5.5;
const RAIO_MONTAR=4,LIMITE_MUNDO=124;
const MEIA_LARGURA_MOTO=.62,MEIA_PROFUNDIDADE_MOTO=1.0,ALTURA_COLISAO_MOTO=1.25;
const ZONA_MORTA=.12;
const _box=new THREE.Box3(),_size=new THREE.Vector3(),_center=new THREE.Vector3();
const _frente=new THREE.Vector3(),_lado=new THREE.Vector3();

function aviso(txt){const el=document.getElementById('avisoPolicia');if(!el)return;el.textContent=txt;el.style.display='block';el.style.opacity='1';clearTimeout(el._motoT);el._motoT=setTimeout(()=>{el.style.opacity='0';setTimeout(()=>{el.style.display='none'},300)},1800)}
function ajustarModelo(root){
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  _box.setFromObject(root);_box.getSize(_size);const maior=Math.max(_size.x,_size.y,_size.z)||1;root.scale.setScalar(2.2/maior);
  _box.setFromObject(root);_box.getCenter(_center);root.position.sub(_center);root.position.y+=_size.y*.5/maior*2.2;
  // O GLB foi exportado longitudinalmente no eixo X, com a frente apontando para -X.
  // A física da moto usa +Z como frente quando a rotação é zero; este giro interno
  // alinha guidão e roda dianteira ao vetor de deslocamento sem alterar a física.
  root.rotation.y=Math.PI/2;
}
new GLTFLoader().load('assets/moto.glb',gltf=>{
  modelo=gltf.scene;ajustarModelo(modelo);moto.add(modelo);modeloCarregado=true;
  moto.position.set(player.position.x+3,obterElevacao(player.position.x+3,player.position.z+3),player.position.z+3);moto.visible=true;
},undefined,err=>console.warn('Quintal 3D: moto não carregou',err));

function perto(){return Math.hypot(moto.position.x-player.position.x,moto.position.z-player.position.z)<=RAIO_MONTAR}
function limitarEntrada(v){return Math.abs(v)<ZONA_MORTA?0:THREE.MathUtils.clamp(v,-1,1)}
function colideMoto(x,z){
  const y=obterElevacao(x,z)+.03;
  return colideObstaculoXZ(x,z,y,MEIA_LARGURA_MOTO,MEIA_PROFUNDIDADE_MOTO,ALTURA_COLISAO_MOTO);
}
function moverComColisao(dx,dz){
  let x=THREE.MathUtils.clamp(player.position.x+dx,-LIMITE_MUNDO,LIMITE_MUNDO);
  let z=THREE.MathUtils.clamp(player.position.z+dz,-LIMITE_MUNDO,LIMITE_MUNDO);
  // Resolve cada eixo separadamente para a moto conseguir raspar e contornar paredes,
  // em vez de travar completamente quando encosta em um canto.
  if(!colideMoto(x,player.position.z))player.position.x=x;
  if(!colideMoto(player.position.x,z))player.position.z=z;
  player.position.y=obterElevacao(player.position.x,player.position.z);
}
function atualizarVelocidade(dt,acelerador){
  if(acelerador>0){
    if(velocidade<0)velocidade=Math.min(0,velocidade+FREIO*dt);
    else velocidade=Math.min(MAX_VEL,velocidade+acelerador*ACELERACAO*dt);
  }else if(acelerador<0){
    if(velocidade>0)velocidade=Math.max(0,velocidade+acelerador*FREIO*dt);
    else velocidade=Math.max(-MAX_RE,velocidade+acelerador*ACELERACAO_RE*dt);
  }else if(Math.abs(velocidade)>0){
    const perda=Math.min(Math.abs(velocidade),ATRITO*dt);velocidade-=Math.sign(velocidade)*perda;
  }
}
export function motoMontada(){return montado}
export function alternarMoto(){
  if(!modeloCarregado){aviso('A moto ainda está carregando.');return}
  if(montado){
    montado=false;velocidade=0;player.visible=true;player.position.y=obterElevacao(player.position.x,player.position.z);moto.visible=true;atualizarBotao();aviso('Você desceu da moto.');return
  }
  if(!perto()){aviso('Chegue perto da moto para montar.');return}
  montado=true;velocidade=0;player.visible=false;moto.visible=true;player.rotation.y=moto.rotation.y;aviso('Moto montada — W acelera, S freia e A/D viram.');atualizarBotao()
}
function atualizarBotao(){const b=document.getElementById('motoBtn');if(b)b.textContent=montado?'DESCER':'MOTO'}
export function atualizarMoto(dt,keys,joyX=0,joyY=0){
  if(!modeloCarregado)return montado;
  if(!montado)return false;

  // No teclado, W/S são acelerador e freio. No joystick, Y para cima é aceleração;
  // por isso o eixo vertical é invertido apenas na leitura, não na apresentação do stick.
  const teclado=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  const acelerador=limitarEntrada(teclado||-joyY);
  const direcao=limitarEntrada((keys.KeyD?1:0)-(keys.KeyA?1:0)+joyX);
  atualizarVelocidade(dt,acelerador);

  const rapidez=Math.min(1,Math.abs(velocidade)/MAX_VEL);
  if(Math.abs(velocidade)>.08&&direcao){
    // A direção fica leve ao manobrar devagar e firme em velocidade, como uma moto arcade;
    // ao dar ré, o sentido do esterço é naturalmente invertido.
    const taxa=1.05+rapidez*1.25;
    player.rotation.y+=direcao*taxa*dt*Math.sign(velocidade);
  }

  _frente.set(Math.sin(player.rotation.y),0,Math.cos(player.rotation.y));
  const distancia=velocidade*dt;
  moverComColisao(_frente.x*distancia,_frente.z*distancia);

  moto.position.copy(player.position);moto.position.y+=.02;
  moto.rotation.y=player.rotation.y;
  // Inclinação visual sem alterar a colisão: dá feedback de esterço, mas volta ao centro ao parar.
  const inclinacao=direcao*rapidez*.22;
  moto.rotation.z=THREE.MathUtils.lerp(moto.rotation.z,-inclinacao,1-Math.exp(-10*dt));
  return true;
}
const btn=document.getElementById('motoBtn');btn?.addEventListener('pointerdown',e=>{e.preventDefault();alternarMoto()});
addEventListener('keydown',e=>{if(e.code==='KeyM'&&!e.repeat){e.preventDefault();alternarMoto()}});
atualizarBotao();
