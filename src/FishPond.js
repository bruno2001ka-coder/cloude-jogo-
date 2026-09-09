import*as THREE from'three';
import{bairro}from'./WorldGenerator.js';
import{alturaDoChaoDesenhado}from'./Terrain.js';
import{registrarCaixa,superficiesAndaveis}from'./Physics.js';

// Lago ATRAS da fazenda, lado oeste. A cerca da fazenda termina perto de x=-99;
// a borda leste do lago fica perto de x=-104,8, deixando corredor de mais de 5 m.
export const LAGO_PEIXES={x:-110,z:-50,raioX:5.2,raioZ:3.6};
const SEG=56,rx=LAGO_PEIXES.raioX,rz=LAGO_PEIXES.raioZ;

// ===== NIVELAMENTO REAL DO CONJUNTO =====
// O lago anterior usava a maior altura encontrada como nivel da agua. Em terreno inclinado isso
// transforma a agua numa placa suspensa. Aqui a regiao foi escolhida por ser quase plana e a cota
// vem da MEDIANA da borda. A margem 3D desce ate o terreno em cada ponto, portanto nenhum lado flutua.
const cotas=[];
for(let i=0;i<SEG;i++){
  const a=i/SEG*Math.PI*2;
  cotas.push(alturaDoChaoDesenhado(
    LAGO_PEIXES.x+Math.cos(a)*rx*1.08,
    LAGO_PEIXES.z+Math.sin(a)*rz*1.08));
}
cotas.sort((a,b)=>a-b);
const cotaBorda=(cotas[Math.floor(SEG*.45)]+cotas[Math.floor(SEG*.55)])/2;
const nivel=cotaBorda-.06;

const lago=new THREE.Group();lago.name='lago-peixes';bairro.add(lago);
const terra=new THREE.MeshStandardMaterial({color:0x725b3d,roughness:1,metalness:0});
const barroMolhado=new THREE.MeshStandardMaterial({color:0x3f3b2d,roughness:.96,metalness:0});
const fundoMat=new THREE.MeshStandardMaterial({color:0x263d3b,roughness:1,metalness:0});
const aguaMat=new THREE.MeshStandardMaterial({
  color:0x176f83,roughness:.20,metalness:0,transparent:true,opacity:.78,
  depthWrite:true,side:THREE.DoubleSide
});
const aguaLateralMat=new THREE.MeshStandardMaterial({
  color:0x145766,roughness:.26,metalness:0,transparent:true,opacity:.72,
  depthWrite:true,side:THREE.DoubleSide
});
const pedraMats=[0x66655f,0x7d766a,0x555853].map(color=>new THREE.MeshStandardMaterial({color,roughness:.97,metalness:0}));
const madeira=new THREE.MeshStandardMaterial({color:0x755334,roughness:.94,metalness:0});
const madeiraEscura=new THREE.MeshStandardMaterial({color:0x483426,roughness:.98,metalness:0});
const juncoMat=new THREE.MeshStandardMaterial({color:0x557744,roughness:1,metalness:0});
function add(geo,mat,x,y,z,parent=lago){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// ===== BACIA / MARGEM =====
// Quatro aneis: o de fora toca o terreno real; os seguintes formam um pequeno plato de terra e
// descem para dentro da agua. Assim a margem fecha 360 graus mesmo quando o chao varia alguns cm.
{
  const fatores=[1.26,1.10,.99,.91],pos=[],idx=[];
  for(let r=0;r<fatores.length;r++)for(let i=0;i<SEG;i++){
    const a=i/SEG*Math.PI*2,k=fatores[r];
    const x=LAGO_PEIXES.x+Math.cos(a)*rx*k,z=LAGO_PEIXES.z+Math.sin(a)*rz*k;
    const chao=alturaDoChaoDesenhado(x,z);
    let y;
    if(r===0)y=chao+.015;                    // cola no terreno
    else if(r===1)y=Math.max(chao+.025,nivel+.12); // borda nivelada
    else if(r===2)y=nivel+.08;               // beirada da agua
    else y=nivel-.22;                        // barranco submerso
    pos.push(x,y,z);
  }
  for(let r=0;r<fatores.length-1;r++)for(let i=0;i<SEG;i++){
    const n=(i+1)%SEG,a=r*SEG+i,b=r*SEG+n,c=(r+1)*SEG+i,d=(r+1)*SEG+n;
    idx.push(a,b,c,b,d,c);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
  const margem=new THREE.Mesh(geo,terra);margem.castShadow=true;margem.receiveShadow=true;lago.add(margem);
}

// Faixa de barro molhado logo abaixo da linha d'agua: esconde qualquer encontro duro entre margem e agua.
const barro=add(new THREE.RingGeometry(rx*.88,rx*.995,SEG),barroMolhado,LAGO_PEIXES.x,nivel-.045,LAGO_PEIXES.z);
barro.rotation.x=-Math.PI/2;barro.scale.y=rz/rx;

// Fundo baixo para os peixes realmente parecerem dentro de uma bacia.
const fundo=add(new THREE.CircleGeometry(rx*.90,SEG),fundoMat,LAGO_PEIXES.x,nivel-.62,LAGO_PEIXES.z);
fundo.rotation.x=-Math.PI/2;fundo.scale.y=rz/rx;

// ===== LAGO CHEIO =====
// Volume raso + superficie quase ate a margem interna. O volume evita o efeito de folha unica vista de lado.
const volume=add(new THREE.CylinderGeometry(rx*.905,rx*.905,.56,SEG,1,false),aguaLateralMat,LAGO_PEIXES.x,nivel-.29,LAGO_PEIXES.z);
volume.scale.z=rz/rx;volume.castShadow=false;volume.renderOrder=1;
const agua=add(new THREE.CircleGeometry(rx*.91,SEG),aguaMat,LAGO_PEIXES.x,nivel+.006,LAGO_PEIXES.z);
agua.rotation.x=-Math.PI/2;agua.scale.y=rz/rx;agua.castShadow=false;agua.renderOrder=2;

// O centro fundo continua bloqueado para o jogador nao caminhar pelo fundo como se fosse terra seca.
registrarCaixa(new THREE.Box3(
  new THREE.Vector3(LAGO_PEIXES.x-rx*.64,nivel-.9,LAGO_PEIXES.z-rz*.56),
  new THREE.Vector3(LAGO_PEIXES.x+rx*.64,nivel+.12,LAGO_PEIXES.z+rz*.56)
),'lago');

// Pedras assentadas na borda externa, sempre usando a altura real do chao.
const pedras=[[-5.7,-.6,.38],[-4.8,2.25,.31],[-3.0,3.45,.36],[-.5,3.75,.28],[2.25,3.35,.34],[4.7,2.1,.39],[5.65,.25,.32],[5.0,-2.15,.37],[2.6,-3.45,.31],[-.35,-3.75,.29],[-3.7,-3.0,.36]];
for(let i=0;i<pedras.length;i++){
  const[dx,dz,s]=pedras[i],x=LAGO_PEIXES.x+dx,z=LAGO_PEIXES.z+dz,y=alturaDoChaoDesenhado(x,z);
  const p=add(new THREE.DodecahedronGeometry(s,0),pedraMats[i%3],x,y+s*.38,z);p.scale.set(1.15,.72,.9);p.rotation.y=i*.71;
}

// Juncos nos quatro cantos da margem.
const juncoGeo=new THREE.CylinderGeometry(.018,.025,.68,5);
for(const[dx,dz]of[[-4.55,-2.0],[-4.3,2.15],[4.4,-2.05],[4.45,1.95]])for(let j=0;j<5;j++){
  const x=LAGO_PEIXES.x+dx+(j-2)*.08,z=LAGO_PEIXES.z+dz+Math.sin(j*1.7)*.07,y=alturaDoChaoDesenhado(x,z);
  const r=add(juncoGeo,juncoMat,x,y+.34,z);r.rotation.z=(j-2)*.025;
}

// Deque pelo lado leste, o lado voltado para a fazenda. Comeca no terreno e sobe poucos cm ate a agua.
const deck=new THREE.Group(),dx0=LAGO_PEIXES.x+rx+1.55,dz0=LAGO_PEIXES.z+.10;deck.position.set(dx0,0,dz0);deck.rotation.y=Math.PI;lago.add(deck);
const yInicio=alturaDoChaoDesenhado(dx0,dz0)+.10;
for(let i=0;i<9;i++){
  const wx=dx0-i*.34,wy=THREE.MathUtils.lerp(yInicio,nivel+.16,i/8);
  const t=add(new THREE.BoxGeometry(.62,.09,.36),madeira,i*.34,wy,0,deck);superficiesAndaveis.push(t);
}
for(const i of[0,8])for(const zz of[-.24,.24]){
  const wx=dx0-i*.34,solo=alturaDoChaoDesenhado(wx,dz0+zz),top=THREE.MathUtils.lerp(yInicio,nivel+.16,i/8),h=Math.max(.45,top-solo+.22);
  add(new THREE.CylinderGeometry(.04,.055,h,7),madeiraEscura,i*.34,solo+h/2,zz,deck);
}

// Peixes low-poly leves.
const corpoGeo=new THREE.SphereGeometry(.22,9,6),caudaGeo=new THREE.ConeGeometry(.12,.25,5);
const cores=[0xd58c45,0xb7a34f,0x758f70,0xc46e4b,0x6f849e],mats=cores.map(color=>new THREE.MeshStandardMaterial({color,roughness:.6,metalness:0})),peixes=[];
for(let i=0;i<12;i++){
  const g=new THREE.Group();lago.add(g);
  const corpo=add(corpoGeo,mats[i%5],0,0,0,g);corpo.scale.set(1.35,.62,.68);
  const cauda=add(caudaGeo,mats[i%5],-.31,0,0,g);cauda.rotation.z=Math.PI/2;
  g.scale.setScalar(.70+(i%4)*.08);
  peixes.push({g,cauda,fase:i*.83,rx:1.35+(i%5)*.48,rz:.82+(i%4)*.34,vel:.26+(i%3)*.05,prof:.16+(i%4)*.07});
}

// Ondas discretas na superficie.
const ondas=[];
for(let i=0;i<3;i++){
  const mat=new THREE.MeshBasicMaterial({color:0xa5dce3,transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide});
  const o=add(new THREE.RingGeometry(.24,.28,24),mat,LAGO_PEIXES.x,nivel+.018,LAGO_PEIXES.z);o.rotation.x=-Math.PI/2;o.renderOrder=3;ondas.push({o,mat});
}
function animar(t){
  requestAnimationFrame(animar);if(document.hidden)return;const tempo=t/1000;
  aguaMat.opacity=.77+Math.sin(tempo*.55)*.018;
  for(let i=0;i<peixes.length;i++){
    const p=peixes[i],a=tempo*p.vel+p.fase,x=LAGO_PEIXES.x+Math.cos(a)*p.rx,z=LAGO_PEIXES.z+Math.sin(a*1.13)*p.rz,y=nivel-p.prof+Math.sin(a*2.3+i)*.028,nx=-Math.sin(a)*p.rx*p.vel,nz=Math.cos(a*1.13)*p.rz*p.vel*1.13;
    p.g.position.set(x,y,z);p.g.rotation.y=Math.atan2(nx,nz)-Math.PI/2;p.cauda.rotation.y=Math.sin(tempo*8+i)*.38;
  }
  for(let i=0;i<ondas.length;i++){const q=ondas[i],f=(tempo*.18+i/3)%1,s=.85+f*3.3;q.o.scale.set(s,s*.72,1);q.mat.opacity=(1-f)*.14;}
}
requestAnimationFrame(animar);
