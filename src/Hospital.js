// ===== HOSPITAL FUNCIONAL =====
// Posto hospitalar assentado no platô 10x8 já criado pelo WorldGenerator. A fachada fica no lado leste,
// exatamente onde a escada de acesso chega. A geometria usa medidas de jogador, não escala arbitrária.
import*as THREE from'three';
import{scene}from'./core.js';
import{player}from'./Player.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,registrarCaixa,superficiesAndaveis,marcarSemFusao,marcarObstaculoMovel}from'./Physics.js';
import{matConcreto,matReboco,matTelha,janela,molduraJanela,matMadeira,concreto,uvPorMetro}from'./Materials.js';

const CENTRO={x:65.7,z:-1.8};
const LARGURA=6.8,PROFUNDIDADE=6.1,ALTURA=3.2;
const PORTA_LARG=1.8,PORTA_ALT=2.25;
const hospital=new THREE.Group();
const cotas=[];
for(let ix=0;ix<=20;ix++)for(let iz=0;iz<=16;iz++){
  const x=CENTRO.x-5+ix*.5,z=CENTRO.z-4+iz*.5;cotas.push(obterElevacao(x,z));
}
const cotaPiso=Math.max(...cotas)+.12;
hospital.position.set(CENTRO.x,cotaPiso,CENTRO.z);
scene.add(hospital);

const paredeMat=matReboco(0xe5e8e5),fundacaoMat=matConcreto(),telhadoMat=matTelha(0x6d7379);
const vidroMat=new THREE.MeshPhysicalMaterial({color:0x8fd4e8,transparent:true,opacity:.38,roughness:.12,metalness:.08,transmission:.15,side:THREE.DoubleSide});
const metalMat=new THREE.MeshStandardMaterial({color:0x9da7ad,roughness:.34,metalness:.72});
const azulMat=new THREE.MeshStandardMaterial({color:0x2a78a2,roughness:.42,metalness:.18});
const brancoMat=new THREE.MeshStandardMaterial({color:0xf5f7f5,roughness:.7});
const vermelhoMat=new THREE.MeshStandardMaterial({color:0xd83232,roughness:.48,emissive:0x360000,emissiveIntensity:.18});
const pisoMat=new THREE.MeshStandardMaterial({color:0xd4d8d8,roughness:.86});

function bloco(geo,material,x,y,z,parent=hospital,collider=null){
  if(material&&material.map)uvPorMetro(geo);
  const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  if(collider){const box=marcarSemFusao(registrarObstaculo(mesh,collider));return{mesh,box}}
  return{mesh,box:null};
}

// Fundação enterrada e piso plano.
bloco(new THREE.BoxGeometry(LARGURA+.28,.65,PROFUNDIDADE+.28),fundacaoMat,0,-.325,0);
const piso=bloco(new THREE.BoxGeometry(LARGURA,.16,PROFUNDIDADE),pisoMat,0,-.08,0).mesh;
superficiesAndaveis.push(piso);

const meiaL=LARGURA/2,meiaP=PROFUNDIDADE/2,meiaPorta=PORTA_LARG/2;
// Fachada leste dividida ao redor do vão.
bloco(new THREE.BoxGeometry(.22,ALTURA,.22),paredeMat,meiaP,ALTURA/2,-meiaL,hospital,'parede-hospital');
bloco(new THREE.BoxGeometry(.22,ALTURA,meiaL-meiaPorta-.11),paredeMat,meiaP,ALTURA/2,-meiaL/2-meiaPorta/2-.055,hospital,'parede-hospital');
bloco(new THREE.BoxGeometry(.22,ALTURA,meiaL-meiaPorta-.11),paredeMat,meiaP,ALTURA/2,meiaL/2+meiaPorta/2+.055,hospital,'parede-hospital');
bloco(new THREE.BoxGeometry(.22,ALTURA-PORTA_ALT,PORTA_LARG),paredeMat,meiaP,PORTA_ALT+(ALTURA-PORTA_ALT)/2,0,hospital,'verga-hospital');
bloco(new THREE.BoxGeometry(PROFUNDIDADE,ALTURA,.22),paredeMat,0,ALTURA/2,-meiaL,hospital,'parede-hospital');
bloco(new THREE.BoxGeometry(PROFUNDIDADE,ALTURA,.22),paredeMat,0,ALTURA/2,meiaL,hospital,'parede-hospital');
bloco(new THREE.BoxGeometry(.22,ALTURA,LARGURA),paredeMat,-meiaP,ALTURA/2,0,hospital,'parede-hospital');
// Teto e marquise.
bloco(new THREE.BoxGeometry(LARGURA+.35,.18,PROFUNDIDADE+.35),telhadoMat,0,ALTURA+.09,0);
bloco(new THREE.BoxGeometry(PORTA_LARG+1.1,.16,1.45),azulMat,meiaP+.62,ALTURA-.12,0);
for(const z of[-(PORTA_LARG/2+.45),PORTA_LARG/2+.45])bloco(new THREE.CylinderGeometry(.07,.07,ALTURA-.2,8),metalMat,meiaP+.62,(ALTURA-.2)/2,z);

function janelaHospital(x,y,z,w,d){
  bloco(new THREE.BoxGeometry(w,.95,d),janela,x,y,z);
  const t=.07;
  if(w>d){bloco(new THREE.BoxGeometry(w+t,t,d+t),molduraJanela,x,y+.51,z);bloco(new THREE.BoxGeometry(w+t,t,d+t),molduraJanela,x,y-.51,z)}
  else bloco(new THREE.BoxGeometry(w+t,t,d+t),molduraJanela,x,y,z);
}
for(const z of[-2.05,2.05])janelaHospital(-meiaP-.012,1.95,z,.04,1.35);
for(const z of[-2.0,2.0])janelaHospital(meiaP+.012,1.95,z,.04,1.35);
for(const x of[-1.25,1.25])janelaHospital(x,1.95,meiaL+.012,1.15,.04);

// Porta dupla de vidro deslizante com dois colliders móveis independentes.
const portaGrupo=new THREE.Group();portaGrupo.position.set(meiaP+.13,0,0);hospital.add(portaGrupo);
const portas=[{lado:-1,folha:null,box:null},{lado:1,folha:null,box:null}];
for(const p of portas){
  p.folha=bloco(new THREE.BoxGeometry(.08,PORTA_ALT,PORTA_LARG/2-.04),vidroMat,0,PORTA_ALT/2,p.lado*(PORTA_LARG/4),portaGrupo).mesh;
  bloco(new THREE.CylinderGeometry(.025,.025,.55,8),metalMat,.07,1.12,p.lado*.12,portaGrupo).mesh.rotation.z=Math.PI/2;
  p.box=marcarObstaculoMovel(registrarCaixa(new THREE.Box3(),`porta-hospital-${p.lado<0?'esquerda':'direita'}`));
}
function atualizarBoxPorta(p,aberta){
  const z=p.lado*(aberta?1.06:.45),minX=CENTRO.x+meiaP+.09,maxX=minX+.08;
  if(aberta){p.box.min.set(minX,9999,z+CENTRO.z-(PORTA_LARG/4-.02));p.box.max.set(maxX,10000,z+CENTRO.z+(PORTA_LARG/4-.02));return}
  p.box.min.set(minX,cotaPiso+.04,z+CENTRO.z-(PORTA_LARG/4-.02));
  p.box.max.set(maxX,cotaPiso+PORTA_ALT,z+CENTRO.z+(PORTA_LARG/4-.02));
}
let portaAbertura=0,curarHospital=()=>{};
export function atualizarPortasHospital(dt){
  const d=Math.hypot(player.position.x-(CENTRO.x+meiaP),player.position.z-CENTRO.z),alvo=d<4.2?1:0;
  portaAbertura+=((alvo-portaAbertura)*Math.min(1,dt*5));
  const aberta=portaAbertura>.92;
  portas.forEach(p=>{p.folha.position.z=p.lado*(.45+.61*portaAbertura);atualizarBoxPorta(p,aberta)});
}
export function atualizarHospital(dt){
  const dentro=Math.abs(player.position.x-(CENTRO.x-1.1))<1.5&&Math.abs(player.position.z-(CENTRO.z+1.35))<1.25;
  if(dentro)curarHospital(18*dt);
}
export function registrarCuraHospital(fn){curarHospital=typeof fn==='function'?fn:()=>{}}
portas.forEach(p=>atualizarBoxPorta(p,false));

// Recepção e emergência: o corredor central fica livre da porta até a maca.
bloco(new THREE.BoxGeometry(2.35,.95,.65),matMadeira(0x8b6549),-1.45,.58,0,hospital,'balcao-hospital');
bloco(new THREE.BoxGeometry(1.65,.06,.55),brancoMat,-1.45,1.08,0);
bloco(new THREE.BoxGeometry(1.65,.16,.68),metalMat,1.35,.92,-1.65,hospital,'maca-hospital');
bloco(new THREE.BoxGeometry(1.52,.16,.62),brancoMat,1.35,1.08,-1.65);
bloco(new THREE.BoxGeometry(.75,1.7,.55),matMadeira(0xb2b7b5),2.25,.85,1.55,hospital,'armario-hospital');
bloco(new THREE.BoxGeometry(1.55,.18,.48),matMadeira(0x68747a),-.2,.48,1.55,hospital,'banco-hospital');

const luzInterior=new THREE.PointLight(0xe9f7ff,1.8,9);luzInterior.position.set(0,2.7,0);hospital.add(luzInterior);
const luzEntrada=new THREE.PointLight(0x66d8ff,1.6,7);luzEntrada.position.set(meiaP+.5,2.8,0);hospital.add(luzEntrada);
function spriteTexto(texto,cor,x,y,z,escalaX){
  const cv=document.createElement('canvas');cv.width=512;cv.height=128;const ctx=cv.getContext('2d');ctx.font='bold 58px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=cor;ctx.fillText(texto,256,64);
  const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthWrite:false}));sp.position.set(x,y,z);sp.scale.set(escalaX,.75,1);hospital.add(sp);
}
spriteTexto('HOSPITAL','white',meiaP+.14,ALTURA+.42,0,2.7);
spriteTexto('EMERGENCIA','white',meiaP+.16,2.8,-meiaL-.03,1.6);
bloco(new THREE.BoxGeometry(.22,.7,.08),vermelhoMat,meiaP+.15,2.55,0);
bloco(new THREE.BoxGeometry(.7,.22,.08),vermelhoMat,meiaP+.15,2.55,0);

const PONTO_NASCIMENTO={x:CENTRO.x-1.1,y:cotaPiso+.22,z:CENTRO.z+1.35};
export function obterPontoNascimento(){return{...PONTO_NASCIMENTO}}
export function atualizarPosicaoJogador(){}
export function atualizarLuzesEmergencia(){luzEntrada.intensity=1.4+.2*Math.sin(performance.now()*.006)}
export const hospitalInfo={x:CENTRO.x,z:CENTRO.z,largura:LARGURA,profundidade:PROFUNDIDADE,cota:cotaPiso};
