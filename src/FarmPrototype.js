// UMA fazenda para aprovacao. Este modulo nao expoe buildFarm generico e nao replica nada.
import*as THREE from'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{scene,renderer}from'./core.js';
import{alturaDoChaoDesenhado}from'./Terrain.js';
import{
  obstaculos,registrarCaixa,marcarObstaculoMovel,removerCaixa,
  superficiesAndaveis,removerSuperficieAndavel,contarColisores,
}from'./Physics.js';
import{
  matReboco,matMadeira,matTelha,matConcreto,matTerraArada,matTerraBatida,
  uvPorMetro,janela,
}from'./Materials.js';
import{FARM_PROTOTYPE,pointInPolygon,validateFarmPrototypeConfig}from'./FarmPrototypeConfig.js';

const ROOT_NAME=FARM_PROTOTYPE.id;
const ROOT=new THREE.Group();ROOT.name=ROOT_NAME;
const colliders=[];
const walkSurfaces=[];
const ownedMaterials=new Set();
const animals=[];
const doors=[];
let mounted=false,gate=null,metrics=null;

const own=material=>{ownedMaterials.add(material);return material};
const M={
  wall:matReboco(0xd9cfbe),
  stone:own(new THREE.MeshStandardMaterial({color:0x817465,roughness:.96,metalness:0,flatShading:true})),
  wood:matMadeira(0x4a2e18),
  gateWood:own(new THREE.MeshStandardMaterial({color:0x9a6332,roughness:.88,metalness:0})),
  roof:matTelha(0x9e3d1b),
  concrete:matConcreto(),
  dirt:matTerraBatida(),
  soil:matTerraArada(),
  pasture:own(new THREE.MeshStandardMaterial({color:0x65754c,roughness:1,metalness:0})),
  dryGrass:own(new THREE.MeshStandardMaterial({color:0x8b7e55,roughness:1,metalness:0})),
  leaf:own(new THREE.MeshStandardMaterial({color:0x3f6b36,roughness:.96,metalness:0})),
  leaf2:own(new THREE.MeshStandardMaterial({color:0x587b42,roughness:.96,metalness:0})),
  metal:own(new THREE.MeshStandardMaterial({color:0x54575a,roughness:.62,metalness:.36})),
  hay:own(new THREE.MeshStandardMaterial({color:0xa88643,roughness:1,metalness:0})),
  cow:own(new THREE.MeshStandardMaterial({color:0xd8d0bf,roughness:.94,metalness:0})),
  cowDark:own(new THREE.MeshStandardMaterial({color:0x3b3028,roughness:.96,metalness:0})),
  chicken:own(new THREE.MeshStandardMaterial({color:0xd8c9aa,roughness:.96,metalness:0})),
  red:own(new THREE.MeshStandardMaterial({color:0xa94532,roughness:.9,metalness:0})),
};

const ground=(x,z)=>alturaDoChaoDesenhado(x,z);
function ensureUv1(geo){
  if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  if(!geo.attributes.uv1)geo.setAttribute('uv1',geo.attributes.uv.clone());
  return geo;
}
function boxGeometry(w,h,d,material){
  const g=new THREE.BoxGeometry(w,h,d);
  if(material?.map)uvPorMetro(g,1.25);
  return ensureUv1(g);
}
function matrix(x,y,z,rx=0,ry=0,rz=0){
  const p=new THREE.Vector3(x,y,z),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz));
  return new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1));
}

class StaticBatch{
  constructor(){this.groups=[]}
  add(geo,material,x,y,z,rx=0,ry=0,rz=0,cast=false){
    if(geo.index){const nonIndexed=geo.toNonIndexed();geo.dispose();geo=nonIndexed}
    ensureUv1(geo);geo.applyMatrix4(matrix(x,y,z,rx,ry,rz));
    let bucket=this.groups.find(g=>g.material===material&&g.cast===cast);
    if(!bucket){bucket={material,cast,geos:[]};this.groups.push(bucket)}
    bucket.geos.push(geo);
  }
  box(w,h,d,x,y,z,material,rx=0,ry=0,rz=0,cast=false){
    this.add(boxGeometry(w,h,d,material),material,x,y,z,rx,ry,rz,cast);
  }
  flush(){
    for(const bucket of this.groups){
      const geo=mergeGeometries(bucket.geos,false);
      if(!geo)throw new Error('Falha ao mesclar geometria estatica da fazenda');
      bucket.geos.forEach(g=>g.dispose());
      const mesh=new THREE.Mesh(geo,bucket.material);mesh.castShadow=bucket.cast;mesh.receiveShadow=true;
      ROOT.add(mesh);
    }
    this.groups.length=0;
  }
}
const batch=new StaticBatch();

function addCollider(box,category){
  const registered=registrarCaixa(box,category);colliders.push(registered);return registered;
}
function axisCollider(cx,cz,w,d,y0,y1,category){
  return addCollider(new THREE.Box3(
    new THREE.Vector3(cx-w/2,y0,cz-d/2),new THREE.Vector3(cx+w/2,y1,cz+d/2)
  ),category);
}
function addWalkableBox(w,h,d,x,y,z,material=M.concrete){
  const mesh=new THREE.Mesh(boxGeometry(w,h,d,material),material);mesh.position.set(x,y,z);
  mesh.castShadow=false;mesh.receiveShadow=true;ROOT.add(mesh);
  superficiesAndaveis.push(mesh);walkSurfaces.push(mesh);return mesh;
}
function footprintHeights(cx,cz,w,d,sx=10,sz=8){
  let min=Infinity,max=-Infinity,sum=0,count=0;
  for(let ix=0;ix<=sx;ix++)for(let iz=0;iz<=sz;iz++){
    const h=ground(cx-w/2+w*ix/sx,cz-d/2+d*iz/sz);
    min=Math.min(min,h);max=Math.max(max,h);sum+=h;count++;
  }
  return{min,max,mean:sum/count,delta:max-min};
}
// Terrain.js ja deforma a propria malha antes do mundo nascer. Aqui medimos o resultado e recusamos
// construir caso o footprint ainda nao esteja plano; nao existe mais caixa de aterro sobre o mapa.
function requireLevelBuildingPad(cx,cz,w,d,label){
  const scan=footprintHeights(cx,cz,w,d,14,10);
  if(scan.delta>.035)throw new Error(`${label} fora de nivel: ${scan.delta.toFixed(3)} m`);
  return{level:scan.mean,scan};
}
function polygonMesh(points,material,yOffset=.025){
  const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cz=points.reduce((s,p)=>s+p.z,0)/points.length;
  const positions=[cx,ground(cx,cz)+yOffset,cz],uv=[cx/4,cz/4],indices=[];
  for(const p of points){positions.push(p.x,ground(p.x,p.z)+yOffset,p.z);uv.push(p.x/4,p.z/4)}
  const signedArea=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.z-q.x*p.z},0);
  for(let i=0;i<points.length;i++){
    const current=i+1,next=(i+1)%points.length+1;
    if(signedArea>0)indices.push(0,next,current);else indices.push(0,current,next);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('uv1',geo.attributes.uv.clone());
  geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;ROOT.add(mesh);return mesh;
}
function ribbon(points,width,material,yOffset=.035){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p.x,0,p.z)),false,'centripetal',.35);
  const n=Math.max(16,Math.ceil(curve.getLength()/1.5)),positions=[],uv=[],indices=[];
  for(let i=0;i<=n;i++){
    const u=i/n,p=curve.getPointAt(u),t=curve.getTangentAt(Math.min(.999,u)).normalize(),nx=-t.z,nz=t.x;
    for(const side of[-1,1]){
      const x=p.x+nx*width*.5*side,z=p.z+nz*width*.5*side;
      positions.push(x,ground(x,z)+yOffset,z);uv.push(i/3,side<0?0:1);
    }
    if(i<n){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,b,c,b,d,c)}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('uv1',geo.attributes.uv.clone());
  geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);
  mesh.receiveShadow=true;ROOT.add(mesh);return mesh;
}

function wallZ(cx,z,w,h,floor,openings=[]){
  const cuts=[-w/2,w/2];for(const o of openings)cuts.push(o.center-cx-o.width/2,o.center-cx+o.width/2);
  cuts.sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){
    const a=cuts[i],b=cuts[i+1],mid=(a+b)/2;
    if(openings.some(o=>mid>o.center-cx-o.width/2&&mid<o.center-cx+o.width/2))continue;
    const ww=b-a;if(ww>.02){batch.box(ww,h,.22,cx+mid,floor+h/2,z,M.wall,0,0,0,true);axisCollider(cx+mid,z,ww,.22,floor,floor+h,'farm-prototype-wall')}
  }
  for(const o of openings){const top=h-o.height;if(top>.02){batch.box(o.width,top,.22,o.center,floor+o.height+top/2,z,M.wall,0,0,0,true);axisCollider(o.center,z,o.width,.22,floor+o.height,floor+h,'farm-prototype-wall')}}
}
function wallX(x,cz,d,h,floor,openings=[]){
  const cuts=[-d/2,d/2];for(const o of openings)cuts.push(o.center-cz-o.width/2,o.center-cz+o.width/2);
  cuts.sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){
    const a=cuts[i],b=cuts[i+1],mid=(a+b)/2;
    if(openings.some(o=>mid>o.center-cz-o.width/2&&mid<o.center-cz+o.width/2))continue;
    const dd=b-a;if(dd>.02){batch.box(.22,h,dd,x,floor+h/2,cz+mid,M.wall,0,0,0,true);axisCollider(x,cz+mid,.22,dd,floor,floor+h,'farm-prototype-wall')}
  }
  for(const o of openings){const top=h-o.height;if(top>.02){batch.box(.22,top,o.width,x,floor+o.height+top/2,o.center,M.wall,0,0,0,true);axisCollider(x,o.center,.22,o.width,floor+o.height,floor+h,'farm-prototype-wall')}}
}
function gablePrismGeometry(cx,z,w,eave,ridge,thickness=.16){
  const za=z-thickness/2,zb=z+thickness/2,left=cx-w/2,right=cx+w/2;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([
    left,eave,za,right,eave,za,cx,ridge,za,
    left,eave,zb,right,eave,zb,cx,ridge,zb,
  ],3));
  geo.setIndex([
    0,2,1, 3,4,5,// faces sul e norte, com normais para fora
    0,1,4, 0,4,3,// base
    0,3,5, 0,5,2,// agua esquerda
    1,2,5, 1,5,4,// agua direita
  ]);
  geo.computeVertexNormals();return ensureUv1(geo);
}
function closedRoof(cx,cz,w,d,eave,ridge,gableMaterial=M.wall,thickness=.18){
  const run=w/2,rise=ridge-eave,angle=Math.atan2(rise,run),slope=Math.hypot(run,rise);
  // Duas aguas SOLIDAS, com espessura real. Os centros sao calculados pela mesma reta e se encontram
  // exatamente na cumeeira; a pequena sobra de 4 cm fica escondida sob a capa e elimina fresta.
  for(const side of[-1,1])batch.box(slope+.04,thickness,d,
    cx+side*Math.cos(angle)*slope/2,ridge-Math.sin(angle)*slope/2,cz,
    M.roof,0,0,-side*angle,true);
  batch.box(.28,thickness+.08,d+.10,cx,ridge+.01,cz,M.roof,0,0,0,true);
  batch.add(gablePrismGeometry(cx,cz-d/2,w,eave,ridge),gableMaterial,0,0,0,0,0,0,true);
  batch.add(gablePrismGeometry(cx,cz+d/2,w,eave,ridge),gableMaterial,0,0,0,0,0,0,true);
}

function movingColliderFor(object,category){
  object.updateWorldMatrix(true,true);
  return marcarObstaculoMovel(addCollider(new THREE.Box3().setFromObject(object),category));
}
function createDoorX(x,z,width,height,floor,swing=1){
  const pivot=new THREE.Group();pivot.position.set(x,floor,z-width/2);ROOT.add(pivot);
  const leaf=new THREE.Mesh(boxGeometry(.10,height,width,M.wood),M.wood);
  leaf.position.set(0,height/2,width/2);leaf.castShadow=true;leaf.receiveShadow=true;pivot.add(leaf);
  const collider=movingColliderFor(leaf,'farm-prototype-door');
  doors.push({pivot,leaf,collider,angle:0,target:0,x,z,swing});
}
function createDoorZ(x,z,width,height,floor,swing=-1){
  const pivot=new THREE.Group();pivot.position.set(x-width/2,floor,z);ROOT.add(pivot);
  const leaf=new THREE.Mesh(boxGeometry(width,height,.10,M.wood),M.wood);
  leaf.position.set(width/2,height/2,0);leaf.castShadow=true;leaf.receiveShadow=true;pivot.add(leaf);
  const collider=movingColliderFor(leaf,'farm-prototype-door');
  doors.push({pivot,leaf,collider,angle:0,target:0,x,z,swing});
}

function buildHouse(){
  const {x:cx,z:cz,w,d}=FARM_PROTOTYPE.house,H=3;
  const pad=requireLevelBuildingPad(cx+1.2,cz,w+5,d+3,'Sede'),scan=pad.scan;
  const floor=pad.level+.18,foundationH=.18;
  batch.box(w+1.2,foundationH,d+1.2,cx,pad.level+foundationH/2,cz,M.stone,0,0,0,true);
  addWalkableBox(w-.44,.14,d-.44,cx,floor-.07,cz);
  // Fachadas com vaos reais. Entrada principal na face leste, voltada para a porteira.
  wallX(cx+w/2,cz,d,H,floor,[{center:cz,width:1.2,height:2.15},{center:cz-3.0,width:2.4,height:1.65}]);
  wallX(cx-w/2,cz,d,H,floor,[{center:cz+2.4,width:1.8,height:1.45}]);
  wallZ(cx,cz-d/2,w,H,floor,[{center:cx+3.4,width:2.8,height:1.55}]);
  wallZ(cx,cz+d/2,w,H,floor,[{center:cx-4.8,width:2.0,height:1.45}]);
  // Quarto e cozinha separados sem emparedar a circulacao.
  wallX(cx-2.8,cz+2.0,d-4,H,floor,[{center:cz+.7,width:1.0,height:2.15}]);
  wallZ(cx+2.6,cz+1.2,w-5.2,H,floor,[{center:cx+1.2,width:1.0,height:2.15}]);
  // Todas as tres portas possuem folha, vao real e colisor movel que acompanha a abertura.
  createDoorX(cx+w/2,cz,1.2,2.15,floor,1);
  createDoorX(cx-2.8,cz+.7,1.0,2.15,floor,-1);
  createDoorZ(cx+1.2,cz+1.2,1.0,2.15,floor,1);
  // Vidros ocupam apenas os vaos, nunca ficam colados sobre parede macica.
  for(const [x,y,z,wg,hg,ry]of[
    [cx+w/2+.012,floor+1.42,cz-3,2.32,1.5,Math.PI/2],
    [cx-w/2-.012,floor+1.38,cz+2.4,1.72,1.3,Math.PI/2],
    [cx+3.4,floor+1.42,cz-d/2-.012,2.72,1.45,0],
    [cx-4.8,floor+1.38,cz+d/2+.012,1.92,1.3,0],
  ])batch.add(new THREE.PlaneGeometry(wg,hg),janela,x,y,z,0,ry,0,false);
  // Varanda de 2,4 m e pilares com base consultada individualmente.
  const verandaX=cx+w/2+1.2;addWalkableBox(2.4,.14,d+1.2,verandaX,floor-.07,cz,M.stone);
  for(const z of[cz-d/2+.35,cz-1.8,cz+1.8,cz+d/2-.35]){
    const base=pad.level-.08,top=floor+2.72,h=top-base;
    batch.add(new THREE.CylinderGeometry(.15,.18,h,9),M.wood,cx+w/2+2.18,base+h/2,z,0,0,0,true);
    axisCollider(cx+w/2+2.18,z,.36,.36,base,top,'farm-prototype-pillar');
  }
  batch.box(.24,.24,d+.7,cx+w/2+2.18,floor+2.68,cz,M.wood,0,0,0,true);
  const aw=2.9,ah=.13,ad=d+1.4;
  batch.box(aw,ah,ad,cx+w/2+1.22,floor+2.62,cz,M.roof,0,0,-.09,true);
  // Forro plano impede ceu/faces escuras dentro da sede; o telhado colonial fica todo acima dele.
  batch.box(w-.30,.08,d-.30,cx,floor+3.02,cz,M.wall,0,0,0,false);
  closedRoof(cx,cz,w+1.2,d+1.2,floor+3.10,floor+4.72,M.wall,.18);

  // Interior economico, com medidas reais e colisores so onde bloqueiam.
  const table={x:cx+.7,z:cz-1.0};batch.box(2.35,.10,1.05,table.x,floor+.75,table.z,M.wood,0,0,0,false);
  for(const dx of[-1.0,1.0])for(const dz of[-.38,.38])batch.box(.10,.72,.10,table.x+dx,floor+.36,table.z+dz,M.wood);
  axisCollider(table.x,table.z,2.35,1.05,floor,floor+.82,'farm-prototype-table');
  // Quatro cadeiras: assento 0,45 m e encosto 0,90 m, sem collider pequeno.
  for(const [x,z,ry]of[[cx+.7,cz-2.0,0],[cx+.7,cz,Math.PI],[cx-1,cz-1,Math.PI/2],[cx+2.4,cz-1,-Math.PI/2]]){
    batch.box(.48,.08,.48,x,floor+.45,z,M.wood,0,ry,0);
    batch.box(.48,.86,.08,x,floor+.47,z-.24,M.wood,0,ry,0);
    for(const dx of[-.18,.18])for(const dz of[-.18,.18])batch.box(.06,.43,.06,x+dx,floor+.215,z+dz,M.wood);
  }
  const counter={x:cx+3.7,z:cz+3.8};batch.box(3.6,.90,.68,counter.x,floor+.45,counter.z,M.wood);
  axisCollider(counter.x,counter.z,3.6,.68,floor,floor+.95,'farm-prototype-counter');
  // Cama: topo do colchao em 0,50 m.
  const bed={x:cx-5.1,z:cz+2.9};batch.box(2.05,.32,1.62,bed.x,floor+.25,bed.z,M.wood);
  batch.box(1.95,.18,1.55,bed.x,floor+.41,bed.z,M.wall);
  axisCollider(bed.x,bed.z,2.05,1.62,floor,floor+.55,'farm-prototype-bed');
  const fireplace={x:cx-5.8,z:cz-3.9};batch.box(1.7,2.25,.72,fireplace.x,floor+1.125,fireplace.z,M.stone,0,0,0,true);
  batch.box(.86,2.1,.86,fireplace.x,floor+4.0,fireplace.z,M.stone,0,0,0,true);
  axisCollider(fireplace.x,fireplace.z,1.7,.72,floor,floor+2.25,'farm-prototype-fireplace');
  // Tapetes e quadros sao decoracao sem colisao.
  batch.box(3.2,.025,2.0,cx+1.0,floor+.018,cz-1.0,M.dryGrass);
  return{floor,terrain:scan,padLevel:pad.level};
}

function buildBarn(){
  const {x:cx,z:cz,w,d}=FARM_PROTOTYPE.barn,pad=requireLevelBuildingPad(cx,cz,w+2.6,d+2.4,'Galpao'),scan=pad.scan;
  const eave=pad.level+2.8,ridge=pad.level+4.2;
  polygonMesh([{x:cx-w/2-1.1,z:cz-d/2-1},{x:cx+w/2+1.1,z:cz-d/2-1},
    {x:cx+w/2+1.1,z:cz+d/2+1},{x:cx-w/2-1.1,z:cz+d/2+1}],M.dirt,.025);
  for(const x of[cx-w/2,cx+w/2])for(const z of[cz-d/2,cz,cz+d/2]){
    const base=pad.level-.08,h=eave-base;
    batch.add(new THREE.CylinderGeometry(.17,.21,h,9),M.wood,x,base+h/2,z,0,0,0,true);
    axisCollider(x,z,.42,.42,base,eave,'farm-prototype-barn-post');
  }
  for(const z of[cz-d/2,cz,cz+d/2]){
    batch.box(w,.22,.22,cx,eave,z,M.wood,0,0,0,true);
    const half=w/2,rise=ridge-eave,angle=Math.atan2(rise,half),len=Math.hypot(half,rise);
    for(const side of[-1,1])batch.box(len,.18,.18,cx+side*Math.cos(angle)*len/2,ridge-Math.sin(angle)*len/2,z,M.wood,0,0,-side*angle,true);
  }
  closedRoof(cx,cz,w+1.2,d+1.2,eave,ridge,M.wood,.16);
  // Fechamento parcial de tabuas nas laterais; corredor central de 5,2 m permanece livre.
  for(const x of[cx-w/2+.08,cx+w/2-.08])for(const z of[cz-d/2+1.3,cz+d/2-1.3]){
    batch.box(.16,1.65,2.4,x,pad.level+.825,z,M.wood,0,0,0,true);
  }
  const work={x:cx-3.8,z:cz+d/2-.7,y:pad.level};
  batch.box(3.0,.12,.74,work.x,work.y+.9,work.z,M.wood);
  axisCollider(work.x,work.z,3.0,.74,work.y,work.y+.98,'farm-prototype-workbench');
  // Feno e espaco de maquina/trator do lado oposto.
  for(const [x,z]of[[cx+4.7,cz+3.4],[cx+5.2,cz+2.2],[cx+3.9,cz+3.2]]){
    const y=pad.level;batch.add(new THREE.CylinderGeometry(.55,.55,1.0,12),M.hay,x,y+.55,z,Math.PI/2,0,0,false);
  }
  return{terrain:scan,eave,ridge,padLevel:pad.level};
}

function fenceCollider(a,b,category){
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),diagonal=Math.abs(dx)>.05&&Math.abs(dz)>.05;
  const n=diagonal?Math.max(1,Math.ceil(len/.72)):1;
  for(let i=0;i<n;i++){
    const t0=i/n,t1=(i+1)/n,x0=a.x+dx*t0,z0=a.z+dz*t0,x1=a.x+dx*t1,z1=a.z+dz*t1;
    const y0=ground(x0,z0),y1=ground(x1,z1),pad=.12;
    addCollider(new THREE.Box3(
      new THREE.Vector3(Math.min(x0,x1)-pad,Math.min(y0,y1)-.35,Math.min(z0,z1)-pad),
      new THREE.Vector3(Math.max(x0,x1)+pad,Math.max(y0,y1)+1.35,Math.max(z0,z1)+pad)
    ),category);
  }
}
function fenceSegment(a,b,category='farm-prototype-fence'){
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(len/2.7)),yaw=-Math.atan2(dz,dx);
  let prev=null;
  for(let i=0;i<=n;i++){
    const t=i/n,x=a.x+dx*t,z=a.z+dz*t,y=ground(x,z);
    batch.add(new THREE.CylinderGeometry(.075,.10,1.38,7),M.wood,x,y+.64,z,0,0,0,i%3===0);
    if(prev){
      const A=new THREE.Vector3(prev.x,prev.y,prev.z),B=new THREE.Vector3(x,y,z),horizontal=Math.hypot(B.x-A.x,B.z-A.z);
      for(const h of[.42,.82,1.16]){
        const rise=B.y-A.y,angle=Math.atan2(rise,horizontal),mx=(A.x+B.x)/2,mz=(A.z+B.z)/2,my=(A.y+B.y)/2+h;
        batch.box(Math.hypot(horizontal,rise),.10,.07,mx,my,mz,M.wood,0,yaw,-angle,false);
      }
    }
    prev={x,y,z};
  }
  fenceCollider(a,b,category);
}
function buildPropertyFence(){
  const p=FARM_PROTOTYPE.property;
  for(let i=0;i<p.length;i++)if(i!==4)fenceSegment(p[i],p[(i+1)%p.length]);
}
function buildGate(){
  const {x,z,width}=FARM_PROTOTYPE.gate,y=ground(x,z),half=width/2;
  const left=new THREE.Group(),right=new THREE.Group();left.position.set(x,y,z-half);right.position.set(x,y,z+half);ROOT.add(left,right);
  const leaf=half+.03,addPart=(parent,w,h,d,px,py,pz,rx=0)=>{
    const m=new THREE.Mesh(boxGeometry(w,h,d,M.gateWood),M.gateWood);m.position.set(px,py,pz);m.rotation.x=rx;
    m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  };
  for(const [parent,side]of[[left,1],[right,-1]]){
    // Moldura clara e uma diagonal REAL: o giro em X transforma a barra local Z numa travessa Y/Z.
    for(const h of[.28,.72,1.16])addPart(parent,.13,.13,leaf,0,h,side*leaf/2);
    for(const zz of[.08,leaf-.08])addPart(parent,.14,1.34,.14,0,.67,side*zz);
    const diagonalLength=Math.hypot(leaf-.22,.72),diagonalAngle=Math.atan2(.72,leaf-.22);
    addPart(parent,.12,.12,diagonalLength,0,.70,side*leaf/2,-side*diagonalAngle);
  }
  for(const zz of[z-half-.14,z+half+.14]){
    const gy=ground(x,zz);
    batch.box(.42,1.72,.42,x,gy+.78,zz,M.stone,0,0,0,true);
    batch.box(.52,.12,.52,x,gy+1.64,zz,M.gateWood,0,0,0,true);
  }
  const leafColliders=[movingColliderFor(left,'farm-prototype-gate'),movingColliderFor(right,'farm-prototype-gate')];
  gate={left,right,angle:0,target:0,leafColliders,x,z,open:false};
}

function buildPasture(){
  const p=FARM_PROTOTYPE.pasture;
  polygonMesh(p,M.pasture,.028);
  // Entrada de 3 m no lado sul; o restante da cerca chega exatamente aos dois batentes.
  for(let i=0;i<p.length;i++)if(i!==2)fenceSegment(p[i],p[(i+1)%p.length],'farm-prototype-pasture-fence');
  // Abrigo coberto fica na borda norte, nunca no centro de spawn.
  const cx=-160,cz=-129,w=8,d=4,scan=footprintHeights(cx,cz,w,d),eave=scan.max+2.55,ridge=eave+.85;
  for(const x of[cx-w/2,cx+w/2])for(const z of[cz-d/2,cz+d/2]){
    const base=ground(x,z)-.06,h=eave-base;batch.add(new THREE.CylinderGeometry(.12,.15,h,8),M.wood,x,base+h/2,z,0,0,0,true);
    axisCollider(x,z,.32,.32,base,eave,'farm-prototype-corral-post');
  }
  closedRoof(cx,cz,w+.8,d+.8,eave,ridge,M.wood);
  const trough={x:-150.5,z:-134.5,y:ground(-150.5,-134.5)};
  batch.box(2.2,.42,.72,trough.x,trough.y+.25,trough.z,M.wood);
  axisCollider(trough.x,trough.z,2.2,.72,trough.y,trough.y+.5,'farm-prototype-trough');
}

function buildCropAndRoad(){
  polygonMesh(FARM_PROTOTYPE.crop,M.soil,.04);
  // Duas trilhas internas irregulares reservam expansao sem preencher o campo de plantas.
  ribbon([{x:-207,z:-179},{x:-199,z:-176},{x:-190,z:-180},{x:-182,z:-177}],.85,M.dirt,.055);
  ribbon([{x:-203,z:-188},{x:-197,z:-181},{x:-193,z:-171}],.72,M.dirt,.058);
  // Acesso liga a porteira ao corredor do deposito rural; termina no vao, nunca na cerca.
  const road=[{x:-91,z:-58},{x:-106,z:-79},{x:-121,z:-105},{x:-136,z:-130},{x:-146,z:-154}];
  ribbon(road,4.2,M.dirt,.035);
  ribbon(road,.30,own(new THREE.MeshStandardMaterial({color:0x654532,roughness:1})),.052);
}

function buildVegetation(){
  const trees=[[-208,-137,1.0],[-204,-128,.82],[-190,-128,1.05],[-209,-160,.9],[-205,-196,1.1],[-173,-198,.92],[-145,-190,.86]];
  let seed=1;
  for(const [x,z,s]of trees){
    const y=ground(x,z),h=2.5*s;batch.add(new THREE.CylinderGeometry(.13*s,.21*s,h,7),M.wood,x,y+h/2,z,0,0,0,true);
    const lobes=[[-.45,2.35,.05,.72],[.38,2.48,-.12,.68],[0,2.78,.18,.78],[-.12,2.55,.48,.58]];
    for(let i=0;i<lobes.length;i++){
      const [dx,dy,dz,r]=lobes[i],g=new THREE.IcosahedronGeometry(r*s,1);
      g.scale(.9+(i%2)*.14,.72+(i%3)*.06,1.02);batch.add(g,i%2?M.leaf:M.leaf2,x+dx*s,y+dy*s,z+dz*s,0,seed*.47,0,i<2);
    }
    seed++;
  }
  // Pequeno capao de bananeiras junto ao limite, distribuicao assimetrica.
  for(const [x,z]of[[-185,-190],[-182.8,-188.8],[-187,-187.4]]){
    const y=ground(x,z),h=1.75;batch.add(new THREE.CylinderGeometry(.055,.09,h,7),M.dryGrass,x,y+h/2,z);
    for(let i=0;i<5;i++){
      const a=i/5*Math.PI*2+.18,leaf=new THREE.PlaneGeometry(1.45,.34);
      batch.add(leaf,M.leaf,x+Math.cos(a)*.42,y+h,z+Math.sin(a)*.42,-.24,-a,.12*Math.sin(a),false);
    }
  }
}

function mergedAnimalGeometry(type){
  const body=type==='chicken'?new THREE.SphereGeometry(.23,8,6):new THREE.SphereGeometry(.55,9,7);
  body.scale(type==='chicken'?1:type==='cow'?1:.75,type==='chicken'?1.15:.62,type==='chicken'?1.1:1.35);
  const head=type==='chicken'?new THREE.SphereGeometry(.14,8,6):new THREE.SphereGeometry(.28,8,6);
  head.translate(0,type==='chicken'?.28:.17,type==='chicken'?.22:.62);
  return mergeGeometries([body,head],false);
}
function createAnimals(){
  for(const cfg of FARM_PROTOTYPE.animalSpawns){
    if(!pointInPolygon(cfg.x,cfg.z,FARM_PROTOTYPE.pasture))throw new Error(`Spawn fora do pasto: ${cfg.id}`);
    const group=new THREE.Group();group.name=cfg.id;
    const main=new THREE.Mesh(mergedAnimalGeometry(cfg.type),cfg.type==='chicken'?M.chicken:M.cow);main.castShadow=true;main.receiveShadow=true;main.position.y=cfg.type==='chicken'?.28:.5;group.add(main);
    const legGeo=new THREE.CylinderGeometry(cfg.type==='chicken'?.025:.055,cfg.type==='chicken'?.022:.05,cfg.type==='chicken'?.22:.48,6);
    for(const x of cfg.type==='chicken'?[-.06,.06]:[-.26,.26])for(const z of cfg.type==='chicken'?[0]:[-.36,.36]){
      const leg=new THREE.Mesh(legGeo,cfg.type==='chicken'?M.red:M.cowDark);leg.position.set(x,cfg.type==='chicken'?.11:.24,z);group.add(leg);
    }
    group.position.set(cfg.x,ground(cfg.x,cfg.z),cfg.z);ROOT.add(group);
    animals.push({id:cfg.id,group,x:cfg.x,z:cfg.z,target:{x:cfg.x,z:cfg.z},speed:cfg.type==='chicken'?.45:.28,next:0});
  }
}
function safePasturePoint(){
  for(let i=0;i<40;i++){
    const x=-177+Math.random()*28,z=-155+Math.random()*24;
    if(pointInPolygon(x,z,FARM_PROTOTYPE.pasture)&&Math.hypot(x+160,z+129)>7&&Math.hypot(x+150.5,z+134.5)>3)return{x,z};
  }
  return{x:-160,z:-143};
}

const reserved=[
  {name:'favela/cidade',x:0,z:-20,r:85},{name:'deposito rural antigo',x:-94,z:-53,r:38},
  {name:'lago',x:-113,z:-50,r:18},{name:'vila rural',x:82,z:98,r:58},
  {name:'fazenda Boa Vista',x:-145,z:76,r:45},{name:'fazenda Cedro',x:126,z:112,r:50},
  {name:'fazenda Ribeirao',x:154,z:-86,r:48},{name:'casa do jogador',x:54,z:62,r:35},
];
export function checkFarmPrototypeOccupancy(){
  const b=FARM_PROTOTYPE.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,r=Math.hypot(b.maxX-b.minX,b.maxZ-b.minZ)/2;
  const reservedHits=reserved.filter(q=>Math.hypot(cx-q.x,cz-q.z)<r+q.r).map(q=>q.name);
  const colliderHits=obstaculos.filter(o=>o.max.x>b.minX&&o.min.x<b.maxX&&o.max.z>b.minZ&&o.min.z<b.maxZ).length;
  const terrain=footprintHeights(cx,cz,b.maxX-b.minX,b.maxZ-b.minZ,12,12);
  return{free:reservedHits.length===0&&colliderHits===0,reservedHits,colliderHits,terrain};
}

export function mountFarmPrototype(){
  if(mounted||scene.getObjectByName(ROOT_NAME))throw new Error(`Instancia duplicada bloqueada: ${ROOT_NAME}`);
  const configCheck=validateFarmPrototypeConfig(),occupancy=checkFarmPrototypeOccupancy();
  if(!configCheck.ok)throw new Error(configCheck.errors.join('; '));
  if(!occupancy.free)throw new Error(`Area ocupada: ${[...occupancy.reservedHits,`${occupancy.colliderHits} colisores`].join(', ')}`);
  const before={meshes:countSceneMeshes(),colliders:contarColisores().registrados,calls:renderer.info.render.calls};
  scene.add(ROOT);mounted=true;
  const house=buildHouse(),barn=buildBarn();buildPropertyFence();buildGate();buildPasture();buildCropAndRoad();buildVegetation();createAnimals();batch.flush();
  const after={meshes:countSceneMeshes(),colliders:contarColisores().registrados};
  metrics={id:ROOT_NAME,position:FARM_PROTOTYPE.origin,occupancy,houseTerrain:house.terrain,barnTerrain:barn.terrain,
    addedMeshes:after.meshes-before.meshes,addedColliders:after.colliders-before.colliders,
    estimatedDrawCalls:countRootDrawCalls(),renderCallsBeforeMount:before.calls,animalCount:animals.length};
  console.info('[farm-prototype]',metrics);return metrics;
}
function countSceneMeshes(){let n=0;scene.traverse(o=>{if(o.isMesh)n++});return n}
function countRootDrawCalls(){let n=0;ROOT.traverse(o=>{if(o.isMesh)n+=Array.isArray(o.material)?o.material.length:1});return n}
export function updateFarmPrototype(dt,playerPosition){
  if(!mounted)return;
  if(gate){
    const distance=Math.hypot(playerPosition.x-gate.x,playerPosition.z-gate.z);
    // O spawn fica a 9 m: a porteira comeca a abrir assim que o teste inicia e termina antes de o
    // jogador chegar ao vao. A histerese ate 14 m evita abre-fecha quando ele para perto da entrada.
    gate.open=distance<10?true:distance>14?false:gate.open;gate.target=gate.open?Math.PI*.5:0;
    const delta=gate.target-gate.angle,speed=Math.PI/5;// 2,5 s para 90 graus
    gate.angle+=Math.sign(delta)*Math.min(Math.abs(delta),speed*dt);
    gate.left.rotation.y=-gate.angle;gate.right.rotation.y=gate.angle;
    gate.left.updateWorldMatrix(true,true);gate.right.updateWorldMatrix(true,true);
    gate.leafColliders[0].setFromObject(gate.left);gate.leafColliders[1].setFromObject(gate.right);
  }
  for(const door of doors){
    const distance=Math.hypot(playerPosition.x-door.x,playerPosition.z-door.z);
    door.target=distance<2.15?Math.PI*.5:distance>3.6?0:door.target;
    const delta=door.target-door.angle,speed=Math.PI/3.6;// abertura suave em 1,8 s
    door.angle+=Math.sign(delta)*Math.min(Math.abs(delta),speed*dt);
    door.pivot.rotation.y=door.swing*door.angle;door.pivot.updateWorldMatrix(true,true);
    door.collider.setFromObject(door.leaf);
  }
  const now=performance.now()/1000;
  for(const animal of animals){
    if(now>=animal.next||Math.hypot(animal.target.x-animal.x,animal.target.z-animal.z)<.35){animal.target=safePasturePoint();animal.next=now+4+Math.random()*5}
    const dx=animal.target.x-animal.x,dz=animal.target.z-animal.z,len=Math.hypot(dx,dz);
    if(len>.02){const step=Math.min(len,animal.speed*dt);animal.x+=dx/len*step;animal.z+=dz/len*step;animal.group.rotation.y=Math.atan2(dx,dz)}
    animal.group.position.set(animal.x,ground(animal.x,animal.z),animal.z);
  }
}
export function getFarmPrototypeMetrics(){
  return metrics?{...metrics,renderCallsCurrent:renderer.info.render.calls,meshesCurrent:countRootDrawCalls(),collidersCurrent:colliders.length}:null;
}
export function disposeFarmPrototype(){
  if(!mounted)return false;
  scene.remove(ROOT);for(const box of[...colliders])removerCaixa(box);colliders.length=0;
  for(const surface of[...walkSurfaces])removerSuperficieAndavel(surface);walkSurfaces.length=0;
  ROOT.traverse(o=>{if(o.geometry)o.geometry.dispose()});for(const material of ownedMaterials)material.dispose();
  ROOT.clear();animals.length=0;doors.length=0;gate=null;mounted=false;metrics=null;return true;
}
