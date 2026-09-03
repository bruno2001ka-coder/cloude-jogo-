// ===== PONTOS DE ENTREGA NA FAVELA =====
// Os pontos são casas reais do cenário. Cada um tem um vão de porta visualmente aberto, uma zona
// circular de interação e um receptador humanoide completo, parado aguardando a encomenda.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{bairro,casasPos,refugios}from'./WorldGenerator.js';
import{PLAYER_HEIGHT}from'./Player.js';

export const deliveryPoints=[];
const zonaMat=new THREE.MeshBasicMaterial({color:0x55d6a6,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
const aroMat=new THREE.MeshBasicMaterial({color:0x8fffd0,transparent:true,opacity:.75,side:THREE.DoubleSide});
const peleMat=new THREE.MeshStandardMaterial({color:0xc79067,roughness:.6});
const roupaMats=[0x7e3f56,0x315b69,0x6b713d,0x594477].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.8}));
const calcaMat=new THREE.MeshStandardMaterial({color:0x292b31,roughness:.85});
const cabeloMat=new THREE.MeshStandardMaterial({color:0x171712,roughness:.9});
const rostoMat=new THREE.MeshStandardMaterial({color:0x211a18,roughness:.8});
function mesh(geo,mat,parent,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function criarReceptador(parent,indice){
  const g=new THREE.Group();parent.add(g);const roupa=roupaMats[indice%roupaMats.length];
  // Corpo proporcional unificado: tronco, cabeça, rosto, braços e pernas formam uma pessoa completa.
  mesh(new THREE.CapsuleGeometry(.25,.42,4,8),roupa,g,0,.55,0);
  mesh(new THREE.SphereGeometry(.17,12,8),peleMat,g,0,1.15,0);
  mesh(new THREE.BoxGeometry(.28,.08,.24),cabeloMat,g,0,1.31,0);
  mesh(new THREE.SphereGeometry(.025,8,6),rostoMat,g,-.06,1.16,.16);
  mesh(new THREE.SphereGeometry(.025,8,6),rostoMat,g,.06,1.16,.16);
  for(const x of[-.16,.16])mesh(new THREE.CapsuleGeometry(.055,.34,4,6),roupa,g,x,.7,0);
  for(const x of[-.11,.11])mesh(new THREE.CapsuleGeometry(.065,.34,4,6),calcaMat,g,x,.17,0);
  g.scale.setScalar(PLAYER_HEIGHT/1.45);return g;
}
function criarZona(parent,raio){
  const zona=new THREE.Mesh(new THREE.CircleGeometry(raio,32),zonaMat);zona.rotation.x=-Math.PI/2;zona.position.y=.025;zona.renderOrder=1;parent.add(zona);
  const aro=new THREE.Mesh(new THREE.RingGeometry(raio-.06,raio,32),aroMat);aro.rotation.x=-Math.PI/2;aro.position.y=.04;aro.renderOrder=2;parent.add(aro);
}
function criarPonto(casa,indice){
  const giro=casa.giro??0,prof=casa.prof??3.9;
  const x=casa.x+Math.sin(giro)*(prof/2+.85),z=casa.z+Math.cos(giro)*(prof/2+.85);
  const g=new THREE.Group();g.position.set(x,obterElevacao(x,z),z);bairro.add(g);
  criarZona(g,2.15);const npc=criarReceptador(g,indice);npc.position.set(0,.02,-.25);
  const ponto={id:`casa-${indice+1}`,x,y:g.position.y,z,raio:2.15,deliveryZone:g,npc,ativo:true};deliveryPoints.push(ponto);return ponto;
}
// Casas espaçadas no circuito principal; evita refúgios e mantém os pontos distribuídos pelas vielas.
const candidatas=(refugios.length?refugios:casasPos).map(c=>({...c,x:c.x,z:c.z,w:c.meiaLarg?c.meiaLarg*2:c.w,d:c.meiaProf?c.meiaProf*2:c.d})).filter(c=>c.w>3.2&&c.d>2.8);
const escolhidas=[];
for(const casa of candidatas){if(escolhidas.every(o=>Math.hypot(o.x-casa.x,o.z-casa.z)>18)){escolhidas.push(casa);if(escolhidas.length===4)break}}
escolhidas.forEach(criarPonto);
export function pontoDeEntregaAtual(pos){return deliveryPoints.find(p=>p.ativo&&Math.hypot(pos.x-p.x,pos.z-p.z)<=p.raio&&Math.abs((pos.y??0)-p.y)<1.8)||null}
export function pertoDePontoDeEntrega(pos){return!!pontoDeEntregaAtual(pos)}
export function sinalizarEntregaIlegal(ponto){if(ponto)ponto.ultimoUso=performance.now()/1000}
