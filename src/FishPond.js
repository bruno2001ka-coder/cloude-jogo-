import*as THREE from'three';
import{bairro}from'./WorldGenerator.js';
import{alturaDoChaoDesenhado}from'./Terrain.js';
import{registrarCaixa,superficiesAndaveis}from'./Physics.js';

// Movido ~14 m para uma faixa muito mais plana. O ponto antigo tinha >1,3 m de desnivel na borda.
export const LAGO_PEIXES={x:-58.5,z:-37.5,raioX:4.5,raioZ:3.1};
const SEG=48,rx=LAGO_PEIXES.raioX,rz=LAGO_PEIXES.raioZ;
let topo=-Infinity;
for(let r=0;r<=7;r++)for(let i=0;i<SEG;i++){
  const a=i/SEG*Math.PI*2,k=.84*r/7;
  topo=Math.max(topo,alturaDoChaoDesenhado(LAGO_PEIXES.x+Math.cos(a)*rx*k,LAGO_PEIXES.z+Math.sin(a)*rz*k));
}
const nivel=topo+.04;
const lago=new THREE.Group();lago.name='lago-peixes';bairro.add(lago);
const barro=new THREE.MeshStandardMaterial({color:0x5d4f39,roughness:1});
const fundoMat=new THREE.MeshStandardMaterial({color:0x35362e,roughness:1});
const aguaMat=new THREE.MeshStandardMaterial({color:0x1d6473,roughness:.3,metalness:.02,transparent:true,opacity:.9,depthWrite:true,side:THREE.DoubleSide});
const pedraMats=[0x6c6b64,0x80796d,0x585b58].map(color=>new THREE.MeshStandardMaterial({color,roughness:.96}));
const madeira=new THREE.MeshStandardMaterial({color:0x755334,roughness:.94});
const madeiraEscura=new THREE.MeshStandardMaterial({color:0x4c3828,roughness:.98});
function add(geo,mat,x,y,z,parent=lago){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// Margem 3D: lado externo colado no terreno e lado interno na altura da agua.
{
  const pos=[],idx=[],aneis=[1.18,1.02,.9];
  for(let r=0;r<3;r++)for(let i=0;i<SEG;i++){
    const a=i/SEG*Math.PI*2,k=aneis[r],x=LAGO_PEIXES.x+Math.cos(a)*rx*k,z=LAGO_PEIXES.z+Math.sin(a)*rz*k;
    const chao=alturaDoChaoDesenhado(x,z),y=r===0?chao+.02:r===1?Math.max(chao+.04,nivel+.10):nivel+.05;
    pos.push(x,y,z);
  }
  for(let r=0;r<2;r++)for(let i=0;i<SEG;i++){
    const n=(i+1)%SEG,a=r*SEG+i,b=r*SEG+n,c=(r+1)*SEG+i,d=(r+1)*SEG+n;idx.push(a,b,c,b,d,c);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,barro);m.castShadow=true;m.receiveShadow=true;lago.add(m);
}

const fundo=add(new THREE.CircleGeometry(rx*.89,SEG),fundoMat,LAGO_PEIXES.x,nivel-.08,LAGO_PEIXES.z);fundo.rotation.x=-Math.PI/2;fundo.scale.y=rz/rx;
const agua=add(new THREE.CircleGeometry(rx*.88,SEG),aguaMat,LAGO_PEIXES.x,nivel,LAGO_PEIXES.z);agua.rotation.x=-Math.PI/2;agua.scale.y=rz/rx;agua.castShadow=false;agua.renderOrder=1;
registrarCaixa(new THREE.Box3(new THREE.Vector3(LAGO_PEIXES.x-3,nivel-.65,LAGO_PEIXES.z-1.65),new THREE.Vector3(LAGO_PEIXES.x+3,nivel+.16,LAGO_PEIXES.z+1.65)),'lago');

// Pedras sempre assentadas na malha visivel do terreno.
for(const[i,p]of[[-1,[-4.6,-.5,.38]],[0,[-3.8,1.8,.3]],[1,[-2.1,2.8,.34]],[2,[.2,2.95,.27]],[3,[2.5,2.45,.34]],[4,[4.3,1.05,.37]],[5,[4.2,-1.45,.31]],[6,[2.3,-2.75,.33]],[7,[-.2,-2.95,.29]],[8,[-3.2,-2.35,.36]]]){
  const[dx,dz,s]=p,x=LAGO_PEIXES.x+dx,z=LAGO_PEIXES.z+dz,y=alturaDoChaoDesenhado(x,z),m=add(new THREE.DodecahedronGeometry(s,0),pedraMats[(i+1)%3],x,y+s*.4,z);m.scale.set(1.15,.72,.9);m.rotation.y=i*.7;
}

// Deque curto, iniciando no solo e chegando na margem.
const deck=new THREE.Group(),dx0=LAGO_PEIXES.x-rx-1.35,dz0=LAGO_PEIXES.z+.08;deck.position.set(dx0,0,dz0);lago.add(deck);
for(let i=0;i<8;i++){
  const wx=dx0+i*.34,y0=alturaDoChaoDesenhado(dx0,dz0)+.10,wy=THREE.MathUtils.lerp(y0,nivel+.15,i/7),t=add(new THREE.BoxGeometry(.62,.09,.34),madeira,wx-dx0,wy,0,deck);superficiesAndaveis.push(t);
}
for(const i of[0,7])for(const zz of[-.22,.22]){
  const wx=dx0+i*.34,solo=alturaDoChaoDesenhado(wx,dz0+zz),topoTab=THREE.MathUtils.lerp(alturaDoChaoDesenhado(dx0,dz0)+.10,nivel+.15,i/7),h=Math.max(.5,topoTab-solo+.25);add(new THREE.CylinderGeometry(.04,.055,h,7),madeiraEscura,wx-dx0,solo+h/2,zz,deck);
}

// Peixes low-poly compartilhados.
const corpoGeo=new THREE.SphereGeometry(.22,9,6),caudaGeo=new THREE.ConeGeometry(.12,.25,5),cores=[0xd58c45,0xb7a34f,0x758f70,0xc46e4b,0x6f849e],mats=cores.map(color=>new THREE.MeshStandardMaterial({color,roughness:.6})),peixes=[];
for(let i=0;i<11;i++){
  const g=new THREE.Group();lago.add(g);const corpo=add(corpoGeo,mats[i%5],0,0,0,g);corpo.scale.set(1.35,.62,.68);const cauda=add(caudaGeo,mats[i%5],-.31,0,0,g);cauda.rotation.z=Math.PI/2;
  g.scale.setScalar(.7+(i%4)*.08);peixes.push({g,cauda,fase:i*.91,rx:1.2+(i%5)*.42,rz:.68+(i%4)*.3,vel:.28+(i%3)*.055,prof:.12+(i%4)*.045});
}
const ondas=[];
for(let i=0;i<3;i++){const mat=new THREE.MeshBasicMaterial({color:0x91cbd2,transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide}),o=add(new THREE.RingGeometry(.24,.28,24),mat,LAGO_PEIXES.x,nivel+.018,LAGO_PEIXES.z);o.rotation.x=-Math.PI/2;o.renderOrder=2;ondas.push({o,mat})}
function animar(t){requestAnimationFrame(animar);if(document.hidden)return;const tempo=t/1000;aguaMat.opacity=.88+Math.sin(tempo*.55)*.015;
  for(let i=0;i<peixes.length;i++){const p=peixes[i],a=tempo*p.vel+p.fase,x=LAGO_PEIXES.x+Math.cos(a)*p.rx,z=LAGO_PEIXES.z+Math.sin(a*1.13)*p.rz,y=nivel-p.prof+Math.sin(a*2.3+i)*.028,nx=-Math.sin(a)*p.rx*p.vel,nz=Math.cos(a*1.13)*p.rz*p.vel*1.13;p.g.position.set(x,y,z);p.g.rotation.y=Math.atan2(nx,nz)-Math.PI/2;p.cauda.rotation.y=Math.sin(tempo*8+i)*.38}
  for(let i=0;i<ondas.length;i++){const q=ondas[i],f=(tempo*.18+i/3)%1,s=.8+f*3.2;q.o.scale.set(s,s*.72,1);q.mat.opacity=(1-f)*.14}}
requestAnimationFrame(animar);
