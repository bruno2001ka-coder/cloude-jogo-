// Lago de peixes perto da fazenda. Visual leve para celular: geometria simples, materiais compartilhados
// e uma unica animacao para todos os peixes/ripples.
import*as THREE from'three';
import{bairro}from'./WorldGenerator.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa,superficiesAndaveis}from'./Physics.js';
import{criarSombraContato}from'./Materials.js';

export const LAGO_PEIXES={x:-66.2,z:-49.5,raioX:5.4,raioZ:3.8};

const amostras=[];
for(let i=0;i<16;i++){
  const a=i/16*Math.PI*2;
  amostras.push(obterElevacao(
    LAGO_PEIXES.x+Math.cos(a)*LAGO_PEIXES.raioX*.82,
    LAGO_PEIXES.z+Math.sin(a)*LAGO_PEIXES.raioZ*.82));
}
const centroY=obterElevacao(LAGO_PEIXES.x,LAGO_PEIXES.z);
// Mediana deixa a lamina estavel mesmo se um lado do terreno tiver um pequeno barranco.
amostras.sort((a,b)=>a-b);
const nivelAgua=(amostras[7]+amostras[8])/2+.055;

const lago=new THREE.Group();lago.name='lago-peixes';bairro.add(lago);

const matMargem=new THREE.MeshStandardMaterial({color:0x756348,roughness:1,metalness:0});
const matBarro=new THREE.MeshStandardMaterial({color:0x4b4334,roughness:1,metalness:0});
const matAgua=new THREE.MeshStandardMaterial({
  color:0x2e7f91,roughness:.18,metalness:.08,transparent:true,opacity:.66,
  depthWrite:false,side:THREE.DoubleSide
});
const matPedra=[0x6d6a62,0x817b70,0x595b57].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.96,metalness:0}));
const matMadeira=new THREE.MeshStandardMaterial({color:0x785535,roughness:.94,metalness:0});
const matMadeiraEscura=new THREE.MeshStandardMaterial({color:0x4d3827,roughness:.98,metalness:0});
const matFolha=new THREE.MeshStandardMaterial({color:0x4f7443,roughness:1,metalness:0});
const matJunco=new THREE.MeshStandardMaterial({color:0x64814d,roughness:1,metalness:0});

function add(geo,mat,x,y,z,parent=lago){
  const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}

// Fundo escuro por baixo da agua: cria profundidade sem precisar cavar a malha do terreno.
const fundo=add(new THREE.CircleGeometry(LAGO_PEIXES.raioX*.95,48),matBarro,LAGO_PEIXES.x,nivelAgua-.17,LAGO_PEIXES.z);
fundo.rotation.x=-Math.PI/2;fundo.scale.y=LAGO_PEIXES.raioZ/LAGO_PEIXES.raioX;

// Margem irregular em dois aneis. Pequenas variacoes de pedras escondem a transicao entre terreno e agua.
const margem=add(new THREE.RingGeometry(LAGO_PEIXES.raioX*.88,LAGO_PEIXES.raioX*1.08,48),matMargem,LAGO_PEIXES.x,nivelAgua-.025,LAGO_PEIXES.z);
margem.rotation.x=-Math.PI/2;margem.scale.y=LAGO_PEIXES.raioZ/LAGO_PEIXES.raioX;

const agua=add(new THREE.CircleGeometry(LAGO_PEIXES.raioX*.90,56),matAgua,LAGO_PEIXES.x,nivelAgua,LAGO_PEIXES.z);
agua.rotation.x=-Math.PI/2;agua.scale.y=LAGO_PEIXES.raioZ/LAGO_PEIXES.raioX;agua.renderOrder=1;agua.castShadow=false;

// Bloqueia so o miolo fundo. O jogador ainda consegue pisar na beirada e chegar no deque.
registrarCaixa(new THREE.Box3(
  new THREE.Vector3(LAGO_PEIXES.x-3.7,nivelAgua-.8,LAGO_PEIXES.z-2.15),
  new THREE.Vector3(LAGO_PEIXES.x+3.7,nivelAgua+.65,LAGO_PEIXES.z+2.15)
),'lago');

// Pedras de borda com tamanhos/rotacoes deterministas.
const pedras=[
  [-5.1,-.7,.45],[ -4.35,2.15,.34],[-2.7,3.25,.40],[-.5,3.55,.28],[1.8,3.35,.36],[4.1,2.25,.42],
  [5.15,.55,.32],[4.7,-1.85,.40],[2.8,-3.1,.30],[.65,-3.55,.38],[-1.7,-3.5,.29],[-3.7,-2.65,.41]
];
for(let i=0;i<pedras.length;i++){
  const[dx,dz,s]=pedras[i],x=LAGO_PEIXES.x+dx,z=LAGO_PEIXES.z+dz,y=obterElevacao(x,z);
  const p=add(new THREE.DodecahedronGeometry(s,0),matPedra[i%matPedra.length],x,y+s*.38,z);
  p.scale.set(1.15,.7,.9);p.rotation.set(.12*(i%3),i*.83,.08*((i+1)%2));
}

// Juncos e capim em grupos, evitando dezenas de draw calls desnecessarios.
const geoJunco=new THREE.CylinderGeometry(.018,.025,.72,5);
for(const base of[[-4.45,-1.8],[-3.7,2.1],[3.7,-2.2],[4.2,1.7]]){
  for(let j=0;j<5;j++){
    const ang=j*2.1,rr=.12+.07*(j%3),x=LAGO_PEIXES.x+base[0]+Math.cos(ang)*rr,z=LAGO_PEIXES.z+base[1]+Math.sin(ang)*rr;
    const y=obterElevacao(x,z);
    const r=add(geoJunco,matJunco,x,y+.36,z);r.rotation.z=(j-2)*.025;
  }
}
for(const[dx,dz]of[[-4.8,1.1],[-2.4,-3.3],[2.2,3.15],[4.65,-.9]]){
  const x=LAGO_PEIXES.x+dx,z=LAGO_PEIXES.z+dz,y=obterElevacao(x,z);
  const g=new THREE.Group();g.position.set(x,y,z);lago.add(g);
  for(let j=0;j<6;j++){
    const folha=add(new THREE.ConeGeometry(.09,.55,5),matFolha,(j-2.5)*.06,.27,0,g);
    folha.rotation.z=(j-2.5)*.18;folha.rotation.y=j*.9;
  }
}

// Deque curto de madeira saindo da margem oeste. As tabuas entram em superficiesAndaveis para o
// jogador realmente conseguir subir e olhar os peixes por cima da agua.
const deck=new THREE.Group();deck.position.set(LAGO_PEIXES.x-LAGO_PEIXES.raioX+.35,nivelAgua+.13,LAGO_PEIXES.z+.15);lago.add(deck);
for(let i=0;i<8;i++){
  const t=add(new THREE.BoxGeometry(.62,.09,.34),matMadeira,i*.34,.02,0,deck);
  t.rotation.y=.015*(i%2?1:-1);superficiesAndaveis.push(t);
}
for(const x of[.05,2.36])for(const z of[-.22,.22]){
  const h=add(new THREE.CylinderGeometry(.045,.055,.95,7),matMadeiraEscura,x,-.39,z,deck);h.castShadow=true;
}
criarSombraContato(1.5,deck,1.2,0);

// Peixes low-poly: corpo oval, cauda e duas nadadeiras. Todos usam geometrias/materiais compartilhados.
const geoCorpo=new THREE.SphereGeometry(.22,9,6),geoCauda=new THREE.ConeGeometry(.12,.25,5),geoNadadeira=new THREE.ConeGeometry(.065,.16,4);
const coresPeixe=[0xd58c45,0xb7a34f,0x758f70,0xc46e4b,0x6f849e];
const matsPeixe=coresPeixe.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.58,metalness:.04}));
const peixes=[];
for(let i=0;i<11;i++){
  const g=new THREE.Group();lago.add(g);
  const corpo=add(geoCorpo,matsPeixe[i%matsPeixe.length],0,0,0,g);corpo.scale.set(1.35,.62,.68);
  const cauda=add(geoCauda,matsPeixe[i%matsPeixe.length],-.31,0,0,g);cauda.rotation.z=Math.PI/2;cauda.scale.set(1,.75,1);
  const n1=add(geoNadadeira,matsPeixe[(i+1)%matsPeixe.length],.02,-.09,.11,g);n1.rotation.x=-.8;n1.rotation.z=-.35;
  const n2=add(geoNadadeira,matsPeixe[(i+1)%matsPeixe.length],.02,-.09,-.11,g);n2.rotation.x=.8;n2.rotation.z=-.35;
  g.scale.setScalar(.7+(i%4)*.08);
  peixes.push({g,cauda,fase:i*.91,rx:1.4+(i%5)*.55,rz:.85+(i%4)*.38,vel:.28+(i%3)*.055,prof:.12+(i%4)*.055});
}

// Ondas circulares discretas. So 3 aneis transparentes, animados sem alocacao por frame.
const matOnda=[];const ondas=[];
for(let i=0;i<3;i++){
  const m=new THREE.MeshBasicMaterial({color:0x9fd4dc,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});matOnda.push(m);
  const o=add(new THREE.RingGeometry(.30,.34,28),m,LAGO_PEIXES.x,nivelAgua+.018,LAGO_PEIXES.z);o.rotation.x=-Math.PI/2;o.renderOrder=2;ondas.push(o);
}

let ultimo=performance.now();
function animar(t){
  requestAnimationFrame(animar);
  if(document.hidden)return;
  const dt=Math.min(.05,(t-ultimo)/1000);ultimo=t;
  const tempo=t/1000;
  // Oscilacao muito pequena de opacidade imita reflexo da superficie sem shader caro.
  matAgua.opacity=.63+Math.sin(tempo*.65)*.025;
  for(let i=0;i<peixes.length;i++){
    const p=peixes[i],a=tempo*p.vel+p.fase;
    const x=LAGO_PEIXES.x+Math.cos(a)*Math.min(p.rx,LAGO_PEIXES.raioX*.66);
    const z=LAGO_PEIXES.z+Math.sin(a*1.13)*Math.min(p.rz,LAGO_PEIXES.raioZ*.58);
    const y=nivelAgua-p.prof+Math.sin(a*2.3+i)*.035;
    const nx=-Math.sin(a)*p.rx*p.vel;
    const nz=Math.cos(a*1.13)*p.rz*p.vel*1.13;
    p.g.position.set(x,y,z);p.g.rotation.y=Math.atan2(nx,nz)-Math.PI/2;
    p.cauda.rotation.y=Math.sin(tempo*8+i)*.38;
  }
  for(let i=0;i<ondas.length;i++){
    const fase=(tempo*.20+i/3)%1,s=.85+fase*4.2;
    ondas[i].scale.set(s,s*.72,1);matOnda[i].opacity=(1-fase)*.20;
  }
}
requestAnimationFrame(animar);
