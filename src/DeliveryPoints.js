// ===== PONTOS DE ENTREGA NA FAVELA =====
// Os pontos sao casas reais do cenario, com zona de interacao e um cliente humanoide aguardando dentro.
import*as THREE from'three';
import{obterElevacao}from'./Terrain.js';
import{bairro,casasCliente}from'./WorldGenerator.js';
import{PLAYER_HEIGHT}from'./Player.js';
import{criarHumanoLowPoly}from'./HumanoidLowPoly.js';

export const deliveryPoints=[];
const zonaMat=new THREE.MeshBasicMaterial({color:0x55d6a6,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
const aroMat=new THREE.MeshBasicMaterial({color:0x8fffd0,transparent:true,opacity:.75,side:THREE.DoubleSide});
const CORES_ROUPA=[0x7e3f56,0x315b69,0x6b713d,0x594477];
const CORES_PELE=[0xc79067,0x8a5a3c,0xe0b088,0x6b4a30];
const CORES_CABELO=[0x171712,0x3a281e,0x5b3a25,0x25201d];

function criarReceptador(parent,indice){
  const visual=criarHumanoLowPoly({
    parent,
    roupa:CORES_ROUPA[indice%CORES_ROUPA.length],
    pele:CORES_PELE[indice%CORES_PELE.length],
    calca:indice%2?0x31363d:0x292b31,
    cabelo:CORES_CABELO[indice%CORES_CABELO.length],
    sapato:0x242424,
    sombras:true,
    largura:.96+(indice%3)*.04,
  });
  visual.grupo.scale.setScalar((PLAYER_HEIGHT/1.75)*(.96+(indice%2)*.05));
  return visual.grupo;
}
function criarZona(parent,raio){
  const zona=new THREE.Mesh(new THREE.CircleGeometry(raio,32),zonaMat);zona.rotation.x=-Math.PI/2;zona.position.y=.025;zona.renderOrder=1;parent.add(zona);
  const aro=new THREE.Mesh(new THREE.RingGeometry(raio-.06,raio,32),aroMat);aro.rotation.x=-Math.PI/2;aro.position.y=.04;aro.renderOrder=2;parent.add(aro);
}
function criarPonto(casa,indice){
  const x=casa.x,z=casa.z;
  const chao=Math.max(casa.y,obterElevacao(x,z));
  const g=new THREE.Group();g.position.set(x,chao,z);bairro.add(g);
  const raio=Math.max(1,Math.min(1.9,Math.min(casa.meiaLarg,casa.meiaProf)-.15));
  criarZona(g,raio);
  const npc=criarReceptador(g,indice);
  const recuo=Math.max(.5,casa.meiaProf-.7);
  const nx=-Math.sin(casa.giro)*recuo,nz=-Math.cos(casa.giro)*recuo;
  npc.position.set(nx,Math.max(casa.y,obterElevacao(x+nx,z+nz))-chao+.02,nz);
  npc.rotation.y=casa.giro;
  const ponto={id:`casa-${indice+1}`,x,y:g.position.y,z,raio,deliveryZone:g,npc,casa,ativo:true};
  deliveryPoints.push(ponto);return ponto;
}
for(const casa of casasCliente)criarPonto(casa,deliveryPoints.length);

export function pontoDeEntregaAtual(pos){
  return deliveryPoints.find(p=>p.ativo&&Math.hypot(pos.x-p.x,pos.z-p.z)<=p.raio&&Math.abs((pos.y??0)-p.y)<1.8)||null;
}
