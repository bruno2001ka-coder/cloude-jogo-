import*as THREE from'three';
import{bairro}from'./WorldGenerator.js';
import{obterElevacao}from'./Terrain.js';
import{superficiesAndaveis}from'./Physics.js';
import{LAGO_PEIXES}from'./LakeConfig.js';

// O buraco NAO e criado aqui. Terrain.js deforma o proprio chao usando LakeConfig.
// Este modulo apenas preenche aquela cavidade com agua, peixes, pedras e um pequeno deque.
const{x:cx,z:cz,raioX:rx,raioZ:rz,nivelAgua:nivel,profundidade}=LAGO_PEIXES;
const SEG=72;
const lago=new THREE.Group();lago.name='lago-peixes-fisico';bairro.add(lago);

const aguaSuperficie=new THREE.MeshStandardMaterial({
  color:0x2b8798,roughness:.16,metalness:.04,transparent:true,opacity:.68,
  depthWrite:false,side:THREE.DoubleSide
});
const aguaVolume=new THREE.MeshStandardMaterial({
  color:0x155767,roughness:.28,metalness:0,transparent:true,opacity:.30,
  depthWrite:false,side:THREE.DoubleSide
});
const lodo=new THREE.MeshStandardMaterial({color:0x33433a,roughness:1,metalness:0});
const pedraMats=[0x67665f,0x817a6d,0x555954].map(color=>new THREE.MeshStandardMaterial({color,roughness:.97,metalness:0}));
const madeira=new THREE.MeshStandardMaterial({color:0x765435,roughness:.94,metalness:0});
const madeiraEscura=new THREE.MeshStandardMaterial({color:0x493426,roughness:.98,metalness:0});
const juncoMat=new THREE.MeshStandardMaterial({color:0x557747,roughness:1,metalness:0});
function add(geo,mat,x,y,z,parent=lago){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// ===== AGUA PREENCHENDO A ESCAVACAO =====
// A borda molhada do terreno cruza o nivel da agua perto de 94% do raio. Por isso o volume termina
// ali: a agua encontra o TALUDE real do chao, em vez de desenhar uma margem falsa por cima dele.
const fatorAgua=.945;
const fundoY=nivel-profundidade;
const fundo=add(new THREE.CircleGeometry(rx*.76,SEG),lodo,cx,fundoY+.018,cz);
fundo.rotation.x=-Math.PI/2;fundo.scale.y=rz/rx;

const volume=add(new THREE.CylinderGeometry(rx*fatorAgua,rx*fatorAgua,profundidade-.03,SEG,1,false),aguaVolume,cx,nivel-profundidade/2,cz);
volume.scale.z=rz/rx;volume.castShadow=false;volume.renderOrder=1;
const superficie=add(new THREE.CircleGeometry(rx*fatorAgua,SEG),aguaSuperficie,cx,nivel+.006,cz);
superficie.rotation.x=-Math.PI/2;superficie.scale.y=rz/rx;superficie.castShadow=false;superficie.renderOrder=2;

// Pedras assentam no TERRENO JA ESCAVADO; nenhuma delas sustenta a agua.
const pedras=[[-5.85,-.7,.37],[-5.1,2.2,.31],[-3.3,3.65,.35],[-.65,4.05,.27],[2.35,3.75,.34],[4.85,2.35,.38],[5.95,.25,.31],[5.25,-2.35,.36],[2.65,-3.75,.31],[-.45,-4.0,.29],[-3.9,-3.15,.35]];
for(let i=0;i<pedras.length;i++){
  const[dx,dz,s]=pedras[i],x=cx+dx,z=cz+dz,y=obterElevacao(x,z);
  const p=add(new THREE.DodecahedronGeometry(s,0),pedraMats[i%3],x,y+s*.38,z);p.scale.set(1.15,.72,.9);p.rotation.y=i*.73;
}

// Juncos na linha externa da margem.
const juncoGeo=new THREE.CylinderGeometry(.018,.025,.7,5);
for(const[dx,dz]of[[-4.65,-2.25],[-4.5,2.35],[4.55,-2.25],[4.6,2.2]])for(let j=0;j<5;j++){
  const x=cx+dx+(j-2)*.075,z=cz+dz+Math.sin(j*1.6)*.075,y=obterElevacao(x,z);
  const r=add(juncoGeo,juncoMat,x,y+.35,z);r.rotation.z=(j-2)*.026;
}

// Deque curto do lado leste, voltado para a fazenda. A primeira tabua nasce no chao real e as
// seguintes chegam pouco acima da superficie da agua.
const deck=new THREE.Group();lago.add(deck);
const inicioX=cx+rx*1.23,inicioZ=cz+.12,comprimento=3.25,tabuas=10;
const yInicio=obterElevacao(inicioX,inicioZ)+.11;
for(let i=0;i<tabuas;i++){
  const t=i/(tabuas-1),wx=inicioX-comprimento*t,wy=THREE.MathUtils.lerp(yInicio,nivel+.17,t);
  const m=add(new THREE.BoxGeometry(.62,.09,.38),madeira,wx,wy,inicioZ);m.rotation.y=.01*(i%2?1:-1);superficiesAndaveis.push(m);
}
for(const t of[0,1])for(const dz of[-.25,.25]){
  const wx=inicioX-comprimento*t,top=THREE.MathUtils.lerp(yInicio,nivel+.17,t),solo=obterElevacao(wx,inicioZ+dz),h=Math.max(.48,top-solo+.28);
  add(new THREE.CylinderGeometry(.045,.06,h,7),madeiraEscura,wx,solo+h/2,inicioZ+dz);
}

// ===== PEIXES DENTRO DO VOLUME =====
const corpoGeo=new THREE.SphereGeometry(.22,10,7),caudaGeo=new THREE.ConeGeometry(.12,.25,6);
const cores=[0xd58c45,0xb7a34f,0x758f70,0xc46e4b,0x6f849e,0xc7b690];
const mats=cores.map(color=>new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.02}));
const peixes=[];
for(let i=0;i<12;i++){
  const g=new THREE.Group();lago.add(g);
  const corpo=add(corpoGeo,mats[i%mats.length],0,0,0,g);corpo.scale.set(1.35,.62,.68);
  const cauda=add(caudaGeo,mats[i%mats.length],-.31,0,0,g);cauda.rotation.z=Math.PI/2;
  g.scale.setScalar(.68+(i%4)*.085);
  peixes.push({g,cauda,fase:i*.93,rx:1.1+(i%5)*.52,rz:.72+(i%4)*.36,vel:.24+(i%3)*.055,prof:.28+(i%5)*.10});
}

// Pequenos aneis de superficie. Sao so 3 malhas leves, nao uma simulacao GPU de fluido.
const ondas=[];
for(let i=0;i<3;i++){
  const mat=new THREE.MeshBasicMaterial({color:0xa8dce2,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide});
  const o=add(new THREE.RingGeometry(.24,.28,28),mat,cx,nivel+.016,cz);o.rotation.x=-Math.PI/2;o.renderOrder=3;ondas.push({o,mat});
}

function animar(t){
  requestAnimationFrame(animar);if(document.hidden)return;
  const tempo=t/1000;
  aguaSuperficie.opacity=.66+Math.sin(tempo*.7)*.018;
  for(let i=0;i<peixes.length;i++){
    const p=peixes[i],a=tempo*p.vel+p.fase;
    const x=cx+Math.cos(a)*p.rx,z=cz+Math.sin(a*1.11)*p.rz;
    const y=nivel-p.prof+Math.sin(a*2.2+i)*.03;
    const vx=-Math.sin(a)*p.rx*p.vel,vz=Math.cos(a*1.11)*p.rz*p.vel*1.11;
    p.g.position.set(x,y,z);p.g.rotation.y=Math.atan2(vx,vz)-Math.PI/2;p.cauda.rotation.y=Math.sin(tempo*8+i)*.38;
  }
  for(let i=0;i<ondas.length;i++){
    const q=ondas[i],f=(tempo*.17+i/3)%1,s=.85+f*3.5;q.o.scale.set(s,s*.72,1);q.mat.opacity=(1-f)*.13;
  }
}
requestAnimationFrame(animar);

export{LAGO_PEIXES};
