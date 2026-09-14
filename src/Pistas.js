// ===== PISTA DO RIBEIRAO: DESAFIO DE OBSTACULOS =====
// Uma fase curta e legivel, com inicio, quatro checkpoints e chegada. Os obstaculos misturam
// slalom, troncos, barreiras e uma travessia de lama; cada bloqueio visual importante tem um
// colisor simples para manter a leitura do jogo honesta sem multiplicar draw calls.
import*as THREE from'three';
import{scene}from'./core.js';
import{player}from'./Player.js';
import{alturaDoChaoDesenhado}from'./Terrain.js';
import{registrarCaixa}from'./Physics.js';

const grupo=new THREE.Group();grupo.name='pista-do-ribeirao';scene.add(grupo);
const pistaMat=new THREE.MeshStandardMaterial({color:0x6d5840,roughness:.98,metalness:0});
const bordaMat=new THREE.MeshStandardMaterial({color:0x9a8155,roughness:.99,metalness:0});
const madeiraMat=new THREE.MeshStandardMaterial({color:0x69452c,roughness:.93,metalness:0});
const madeiraClara=new THREE.MeshStandardMaterial({color:0xb17c45,roughness:.9,metalness:0});
const palhaMat=new THREE.MeshStandardMaterial({color:0xd0a85c,roughness:.98,metalness:0});
const metalMat=new THREE.MeshStandardMaterial({color:0x3e4645,roughness:.55,metalness:.6});
const lamaMat=new THREE.MeshStandardMaterial({color:0x4e3b2d,roughness:1,metalness:0});
const faixaMat=new THREE.MeshStandardMaterial({color:0xf0c85b,roughness:.7,metalness:.05});
const checkpointMat=new THREE.MeshStandardMaterial({color:0x51d3b2,emissive:0x0b5348,emissiveIntensity:.8,roughness:.42,metalness:.12});
const finishMat=new THREE.MeshStandardMaterial({color:0xf0a84b,emissive:0x63300c,emissiveIntensity:.65,roughness:.45,metalness:.12});
const chao=(x,z)=>alturaDoChaoDesenhado(x,z)+.045;
const caixas=[];
const checkpoints=[];
const inicio={x:-58,z:-145,raio:7};
const rota=[[-58,-145],[-35,-124],[-8,-105],[18,-82],[42,-58],[63,-35]];
const fase={ativa:false,indice:0,tempo:0,melhor:Infinity,concluida:false,avisado:false};
let painel=null;
function materialCor(c,r=.9){return new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0})}
function caixa(x,z,w,d,h,mat,categoria='pista-obstaculo'){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,chao(x,z)+h/2-.04,z);m.castShadow=true;m.receiveShadow=true;grupo.add(m);
  const b=new THREE.Box3(new THREE.Vector3(x-w/2,chao(x,z)-.1,z-d/2),new THREE.Vector3(x+w/2,chao(x,z)+h,z+d/2));registrarCaixa(b,categoria);caixas.push(b);return m;
}
function faixa(x,z,w,d,mat=bordaMat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,.055,d),mat);m.position.set(x,chao(x,z),z);m.receiveShadow=true;grupo.add(m);return m}
function trecho(a,b){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ang=Math.atan2(dx,dz),m=new THREE.Mesh(new THREE.BoxGeometry(7.2,.08,len),pistaMat);m.position.set((a[0]+b[0])/2,(chao((a[0]+b[0])/2,(a[1]+b[1])/2)),(a[1]+b[1])/2);m.rotation.y=ang;m.receiveShadow=true;grupo.add(m);const nx=Math.cos(ang)*4,nz=-Math.sin(ang)*4;faixa(m.position.x+nx,m.position.z+nz,.24,len,bordaMat);faixa(m.position.x-nx,m.position.z-nz,.24,len,bordaMat)}
function arco(x,z,mat=checkpointMat){const h=3.3,w=7;caixa(x-w/2,z,w*.12,.18,h,mat,'pista-portico');caixa(x+w/2,z,w*.12,.18,h,mat,'pista-portico');const topo=new THREE.Mesh(new THREE.BoxGeometry(w,.18,.22),mat);topo.position.set(x,chao(x,z)+h-.04,z);topo.castShadow=true;grupo.add(topo)}
function anel(x,z,mat=checkpointMat){const y=chao(x,z)+1.9;const t=new THREE.Mesh(new THREE.TorusGeometry(2.2,.10,8,24),mat);t.position.set(x,y,z);t.rotation.x=Math.PI/2;t.castShadow=true;grupo.add(t);checkpoints.push({x,z,mesh:t,raio:5})}
function tronco(x,z,ang){const len=3.1,m=new THREE.Mesh(new THREE.CylinderGeometry(.28,.34,len,10),madeiraMat);m.position.set(x,chao(x,z)+.35,z);m.rotation.z=Math.PI/2;m.rotation.y=ang;m.castShadow=true;grupo.add(m);const w=Math.abs(Math.cos(ang))*len+.7,d=Math.abs(Math.sin(ang))*len+.7;registrarCaixa(new THREE.Box3(new THREE.Vector3(x-w/2,chao(x,z),z-d/2),new THREE.Vector3(x+w/2,chao(x,z)+.7,z+d/2)),'pista-tronco')}
function cone(x,z){const m=new THREE.Mesh(new THREE.ConeGeometry(.34,.85,10),faixaMat);m.position.set(x,chao(x,z)+.4,z);m.castShadow=true;grupo.add(m);registrarCaixa(new THREE.Box3(new THREE.Vector3(x-.32,chao(x,z),z-.32),new THREE.Vector3(x+.32,chao(x,z)+.85,z+.32)),'pista-cone')}
function montar(){
  for(let i=0;i<rota.length-1;i++)trecho(rota[i],rota[i+1]);
  arco(inicio.x,inicio.z,finishMat);caixa(inicio.x,inicio.z-1,3.4,.14,1.05,madeiraClara,'pista-placa');
  // Slalom de cones: a linha alternada cria escolha de direcao sem bloquear toda a pista.
  [[-44,-132,-2.1],[-25,-121,2.1],[-17,-110,-2.1],[2,-96,2.1]].forEach(([x,z,off])=>{cone(x,z);cone(x+off,z+.9)});
  // Troncos atravessados, com orientacoes diferentes para exigir desaceleracao e controle.
  tronco(-30,-116,.08);tronco(9,-88,-.28);tronco(36,-66,.18);
  // Barreiras de fardos deixam uma abertura alternada; o jogador pode contornar, mas nao atravessar.
  [[-2,-101],[29,-76],[52,-48]].forEach(([x,z])=>{caixa(x-1.35,z,1.8,1.25,1.2,palhaMat,'pista-fardo');caixa(x+1.35,z,1.8,1.25,1.2,palhaMat,'pista-fardo')});
  // Travessia de lama: visualiza a mudanca de terreno, mas continua transponivel.
  faixa(18,-82,6.8,8.2,lamaMat);faixa(42,-58,6.8,7.4,lamaMat);
  // Quatro checkpoints e uma chegada laranja para deixar o objetivo legivel no radar e no mundo.
  for(const [x,z] of rota.slice(1,-1))anel(x,z,checkpointMat);anel(63,-35,finishMat);arco(63,-35,finishMat);
}
function criarPainel(){painel=document.createElement('div');painel.id='pistaRibeiraoHUD';painel.style.cssText='position:fixed;top:76px;left:50%;transform:translateX(-50%);z-index:17;display:none;padding:8px 14px;border:1px solid rgba(240,200,91,.7);border-radius:9px;background:rgba(25,18,12,.78);color:#ffe7a1;font:800 12px system-ui;letter-spacing:.04em;text-align:center;pointer-events:none;backdrop-filter:blur(4px)';document.body.appendChild(painel)}
function atualizarPainel(txt,visivel=true){if(!painel)return;painel.style.display=visivel?'block':'none';if(visivel)painel.textContent=txt}
function distancia(x,z,p){return Math.hypot(x-p[0],z-p[1])}
export function atualizarPistaRibeirao(dt){
  const x=player.position.x,z=player.position.z;
  if(!fase.ativa&&!fase.concluida&&Math.hypot(x-inicio.x,z-inicio.z)<inicio.raio){fase.ativa=true;fase.indice=0;fase.tempo=0;fase.avisado=true;atualizarPainel('PISTA DO RIBEIRAO  ·  passe pelos porticos verdes  ·  1/5')}
  if(!fase.ativa){if(Math.hypot(x-inicio.x,z-inicio.z)<14)atualizarPainel('PISTA DO RIBEIRAO  ·  aproxime-se da faixa amarela para iniciar');else atualizarPainel('',false);return}
  fase.tempo+=dt;const alvo=checkpoints[fase.indice];
  if(alvo&&distancia(x,z,[alvo.x,alvo.z])<alvo.raio){alvo.mesh.material=fase.indice===checkpoints.length-1?finishMat:checkpointMat;fase.indice++;if(fase.indice>=checkpoints.length){fase.ativa=false;fase.concluida=true;const novo=fase.tempo<fase.melhor;fase.melhor=Math.min(fase.melhor,fase.tempo);atualizarPainel(`PISTA CONCLUIDA  ·  ${fase.tempo.toFixed(1)} s  ·  ${novo?'novo melhor tempo':''}`)}else atualizarPainel(`PISTA DO RIBEIRAO  ·  checkpoint ${fase.indice+1}/${checkpoints.length}  ·  ${fase.tempo.toFixed(1)} s`)}
  else atualizarPainel(`PISTA DO RIBEIRAO  ·  checkpoint ${Math.min(fase.indice+1,checkpoints.length)}/${checkpoints.length}  ·  ${fase.tempo.toFixed(1)} s`);
}
montar();criarPainel();
