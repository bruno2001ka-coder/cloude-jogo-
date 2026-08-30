// Personagem principal: malha, hitbox cinemática, gravidade/salto e resolução de movimento com colisão.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{obstaculos,superficiesAndaveis,caixaColideComObstaculos}from'./Physics.js';
import{criarSombraContato}from'./Materials.js';

export const EYE_HEIGHT=1.27;
export const PLAYER_HEIGHT=1.4;
export const PLAYER_SCALE=PLAYER_HEIGHT/3.31;

export const player=new THREE.Group();
const skin=new THREE.MeshStandardMaterial({color:0xc79067,roughness:.55}),shirt=new THREE.MeshStandardMaterial({color:0x202b27,roughness:.75}),pants=new THREE.MeshStandardMaterial({color:0x495744,roughness:.85});
const body=new THREE.Mesh(new THREE.BoxGeometry(1.05,1.55,.62),shirt);body.position.y=1.65;body.castShadow=true;body.receiveShadow=true;player.add(body);const head=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.66),skin);head.position.y=2.8;head.castShadow=true;head.receiveShadow=true;player.add(head);const faceMat=new THREE.MeshStandardMaterial({color:0x171712,roughness:.8,flatShading:true});for(const x of [-.13,.13]){const eye=new THREE.Mesh(new THREE.BoxGeometry(.11,.12,.045),faceMat);eye.position.set(x,2.88,.345);eye.castShadow=true;eye.receiveShadow=true;player.add(eye)}const mouth=new THREE.Mesh(new THREE.BoxGeometry(.24,.055,.04),faceMat);mouth.position.set(0,2.68,.348);mouth.castShadow=true;mouth.receiveShadow=true;player.add(mouth);const hair=new THREE.Mesh(new THREE.BoxGeometry(.74,.18,.69),new THREE.MeshStandardMaterial({color:0x171712,roughness:.8,flatShading:true}));hair.position.y=3.22;hair.castShadow=true;hair.receiveShadow=true;player.add(hair);const legs=[],arms=[];for(const x of [-.27,.27]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.25,1.05,.3),pants);leg.position.set(x,.55,0);leg.castShadow=true;leg.receiveShadow=true;player.add(leg);legs.push(leg)}for(const x of [-.7,.7]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.25,1.1,.3),skin);arm.position.set(x,1.72,0);arm.castShadow=true;arm.receiveShadow=true;player.add(arm);arms.push(arm)}criarSombraContato(.85,player);player.scale.setScalar(PLAYER_SCALE);player.position.set(0,obterElevacao(0,8),8);scene.add(player);

// Hitbox alinhada à malha visual, sem margens artificiais e sem excesso.
const PLAYER_HITBOX_WIDTH=2*(.70+.25/2)*PLAYER_SCALE*.82;// um pouco mais estreita que a envergadura dos braços, pra sobrar folga das paredes
const PLAYER_HITBOX_DEPTH=2*Math.max(.66/2,.69/2,.348+.04/2)*PLAYER_SCALE;
const PLAYER_HITBOX_HALF_WIDTH=PLAYER_HITBOX_WIDTH/2;
const PLAYER_HITBOX_HALF_DEPTH=PLAYER_HITBOX_DEPTH/2;
const jogadorBoxTemp=new THREE.Box3();
export const jogadorBoxDebugTemp=new THREE.Box3();
export function preencherHitboxJogador(box,x,z){
  box.min.set(x-PLAYER_HITBOX_HALF_WIDTH,player.position.y,z-PLAYER_HITBOX_HALF_DEPTH);
  box.max.set(x+PLAYER_HITBOX_HALF_WIDTH,player.position.y+PLAYER_HEIGHT,z+PLAYER_HITBOX_HALF_DEPTH);
  return box;
}
export function jogadorColideNaPosicao(x,z){
  preencherHitboxJogador(jogadorBoxTemp,x,z);
  return caixaColideComObstaculos(jogadorBoxTemp);
}

// Encontra a superfície andável (laje/degrau) ou o terreno mais alto logo abaixo de um ponto X/Z.
const raycasterVertical=new THREE.Raycaster();const direcaoBaixo=new THREE.Vector3(0,-1,0);const origemVertical=new THREE.Vector3();
function encontrarSuperficieAbaixo(x,z,yOrigem){origemVertical.set(x,yOrigem,z);raycasterVertical.set(origemVertical,direcaoBaixo);const terrenoY=obterElevacao(x,z);const hits=raycasterVertical.intersectObjects(superficiesAndaveis,true);const suporte=hits.find(hit=>hit.point.y>=terrenoY-.35);let alvo=suporte?Math.max(suporte.point.y,terrenoY):terrenoY;
  // Trava também contra o topo de paredes/muretas sólidas sob o jogador: sem isso, caindo perto da
  // borda de um telhado (fora do alcance de qualquer laje/degrau registrado) o jogador atravessava
  // reto o volume da parede e aparecia "dentro" da casa em vez de pousar em cima dela.
  for(const box of obstaculos){
    if(box.max.y<=yOrigem&&box.max.y>alvo&&x>=box.min.x&&x<=box.max.x&&z>=box.min.z&&z<=box.max.z)alvo=box.max.y;
  }
  return alvo}

// Gravidade real + salto: velocidadeY acumula por frame, noChao habilita o próximo pulo.
const GRAVIDADE=-24,VELOCIDADE_PULO=8.2;let velocidadeY=0,noChao=true;
export function pularJogador(){if(noChao){velocidadeY=VELOCIDADE_PULO;noChao=false}}
export function atualizarFisicaVertical(dt){velocidadeY+=GRAVIDADE*dt;const proximoY=player.position.y+velocidadeY*dt;const origemY=Math.max(player.position.y,proximoY)+1.2;const superficieY=encontrarSuperficieAbaixo(player.position.x,player.position.z,origemY);if(proximoY<=superficieY){player.position.y=superficieY;velocidadeY=0;noChao=true}else{player.position.y=proximoY;noChao=false}}

// Movimento horizontal relativo à câmera (yaw), com colisão resolvida por eixo, e animação de andar.
let walk=0;const velocity=new THREE.Vector3(),desired=new THREE.Vector3();
export function atualizarMovimentoJogador(dt,keys,joyX,joyY,yaw){
  const smooth=1-Math.exp(-18*dt);
  let x=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joyX,z=(keys.KeyS?1:0)-(keys.KeyW?1:0)-joyY,m=Math.hypot(x,z);desired.set(0,0,0);if(m){x/=m;z/=m;const f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));desired.set((r.x*x-f.x*z)*5.8,0,(r.z*x-f.z*z)*5.8)}velocity.lerp(desired,smooth);const proximaX=player.position.x+velocity.x*dt;if(!jogadorColideNaPosicao(proximaX,player.position.z)){player.position.x=proximaX}else{velocity.x=0}const proximaZ=player.position.z+velocity.z*dt;if(!jogadorColideNaPosicao(player.position.x,proximaZ)){player.position.z=proximaZ}else{velocity.z=0}player.position.x=THREE.MathUtils.clamp(player.position.x,-100,92);player.position.z=THREE.MathUtils.clamp(player.position.z,-100,100);atualizarFisicaVertical(dt);preencherHitboxJogador(jogadorBoxDebugTemp,player.position.x,player.position.z);const speed=Math.hypot(velocity.x,velocity.z);if(speed>.08){const wanted=Math.atan2(velocity.x,velocity.z);let da=wanted-player.rotation.y;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;player.rotation.y+=da*(1-Math.exp(-14*dt));walk+=dt*(6+speed*1.3);const swing=Math.sin(walk)*Math.min(.55,speed*.075);legs[0].rotation.x=swing;legs[1].rotation.x=-swing;arms[0].rotation.x=-swing*.45;arms[1].rotation.x=swing*.45}else{for(const limb of [...legs,...arms])limb.rotation.x*=Math.exp(-12*dt)}
}
