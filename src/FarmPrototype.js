// Fazenda-protótipo isolada v1: só aparece com ?farmtest=1.
// Não substitui nenhuma fazenda existente e não é carregada no jogo normal.
import*as THREE from'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{scene}from'./core.js';
import{alturaDoChaoDesenhado}from'./Terrain.js';
import{registrarCaixa,marcarObstaculoMovel,superficiesAndaveis}from'./Physics.js';
import{matReboco,matMadeira,matTelha,matConcreto,matTerraBatida,uvPorMetro,janela}from'./Materials.js';

export const FARM_TEST={x:-190,z:-150,spawnX:-190,spawnZ:-118};
const ROOT=new THREE.Group();ROOT.name='farm-prototype-v1';
let montada=false;
let gate=null;

const M={
  wall:matReboco(0xd9cfbe),
  stone:matReboco(0x93816d),
  wood:matMadeira(0x4a2e18),
  roof:matTelha(0x9e3d1b),
  concrete:matConcreto(),
  dirt:matTerraBatida(),
};

const gy=(x,z)=>alturaDoChaoDesenhado(x,z);
function boxGeo(w,h,d){return uvPorMetro(new THREE.BoxGeometry(w,h,d),1.35)}
function addBox(w,h,d,x,y,z,mat,parent=ROOT,cast=true){
  const m=new THREE.Mesh(boxGeo(w,h,d),mat);m.position.set(x,y,z);
  m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function col(x,z,w,d,y0,y1,cat){
  return registrarCaixa(new THREE.Box3(
    new THREE.Vector3(x-w/2,y0,z-d/2),
    new THREE.Vector3(x+w/2,y1,z+d/2)
  ),cat);
}
function sampleRect(cx,cz,w,d){
  let min=Infinity,max=-Infinity;
  for(let ix=0;ix<=8;ix++)for(let iz=0;iz<=6;iz++){
    const x=cx-w/2+w*ix/8,z=cz-d/2+d*iz/6,h=gy(x,z);
    min=Math.min(min,h);max=Math.max(max,h);
  }
  return{min,max};
}
function addWalkFloor(w,d,cx,cz,y,mat=M.concrete){
  const m=addBox(w,.14,d,cx,y-.07,cz,mat,ROOT,false);superficiesAndaveis.push(m);return m;
}
function roofClosed(cx,cz,w,d,eave,ridge){
  const half=w/2,z0=cz-d/2,z1=cz+d/2;
  const make=(verts,uvs,idx,mat)=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    g.setAttribute('uv1',g.attributes.uv);
    g.setIndex(idx);g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;ROOT.add(m);return m;
  };
  make(
    [cx-half,eave,z0,cx,ridge,z0,cx-half,eave,z1,cx,ridge,z1],
    [0,0,half/1.2,1,0,d/1.2,half/1.2,d/1.2],[0,2,1,2,3,1],M.roof
  );
  make(
    [cx,ridge,z0,cx+half,eave,z0,cx,ridge,z1,cx+half,eave,z1],
    [0,0,half/1.2,1,0,d/1.2,half/1.2,d/1.2],[0,1,2,1,3,2],M.roof
  );
  // Cumeeira cobre fisicamente a junta.
  addBox(.24,.18,d+.06,cx,ridge+.04,cz,M.roof);
  // Empenas triangulares fechadas.
  make([cx-half,eave,z0-.01,cx+half,eave,z0-.01,cx,ridge,z0-.01],[0,0,1,0,.5,1],[0,2,1],M.wall);
  make([cx-half,eave,z1+.01,cx,ridge,z1+.01,cx+half,eave,z1+.01],[0,0,.5,1,1,0],[0,2,1],M.wall);
}
function wallZ(cx,z,w,h,y,doorCx=null,doorW=0,doorH=0){
  const t=.22;
  const part=(x,ww,yy,hh)=>{addBox(ww,hh,t,x,yy,z,M.wall);col(x,z,ww,t,yy-hh/2,yy+hh/2,'farmtest-wall')};
  if(doorCx===null){part(cx,w,y+h/2,h);return}
  const l=(doorCx-doorW/2)-(cx-w/2),r=(cx+w/2)-(doorCx+doorW/2);
  if(l>.02)part(cx-w/2+l/2,l,y+h/2,h);
  if(r>.02)part(doorCx+doorW/2+r/2,r,y+h/2,h);
  const top=h-doorH;if(top>.02)part(doorCx,doorW,y+doorH+top/2,top);
}
function wallX(x,cz,d,h,y,doorCz=null,doorW=0,doorH=0){
  const t=.22;
  const part=(z,dd,yy,hh)=>{addBox(t,hh,dd,x,yy,z,M.wall);col(x,z,t,dd,yy-hh/2,yy+hh/2,'farmtest-wall')};
  if(doorCz===null){part(cz,d,y+h/2,h);return}
  const a=(doorCz-doorW/2)-(cz-d/2),b=(cz+d/2)-(doorCz+doorW/2);
  if(a>.02)part(cz-d/2+a/2,a,y+h/2,h);
  if(b>.02)part(doorCz+doorW/2+b/2,b,y+h/2,h);
  const top=h-doorH;if(top>.02)part(doorCz,doorW,y+doorH+top/2,top);
}
function buildHouse(){
  const cx=-203,cz=-141,w=16,d=10.5,H=3;
  const h=sampleRect(cx,cz,w+3,d+3),floor=h.max+.12;
  // Fundação profunda até abaixo do ponto mais baixo: nenhuma quina flutua.
  const fH=Math.max(.45,floor-h.min+.28);
  addBox(w+1.2,fH,d+1.2,cx,floor-fH/2,cz,M.stone);
  addWalkFloor(w-.44,d-.44,cx,cz,floor);
  // Rodapé de pedra de 1 m.
  addBox(w,.98,.18,cx,floor+.49,cz-d/2-.13,M.stone);
  addBox(w,.98,.18,cx,floor+.49,cz+d/2+.13,M.stone);
  addBox(.18,.98,d,cx-w/2-.13,floor+.49,cz,M.stone);
  addBox(.18,.98,d,cx+w/2+.13,floor+.49,cz,M.stone);

  wallZ(cx,cz-d/2,w,H,floor,cx-1.4,1.20,2.15);
  wallZ(cx,cz+d/2,w,H,floor);
  wallX(cx-w/2,cz,d,H,floor);
  wallX(cx+w/2,cz,d,H,floor,cz+1.8,1.0,2.15);

  // Vãos internos reais.
  wallX(cx-3.4,cz+1.4,3.4,H,floor,cz+.8,1.0,2.15);

  // Grandes panos de vidro.
  for(const[x,ww]of[[cx+2.3,3.0],[cx+5.2,1.8]]){
    const g=new THREE.Mesh(new THREE.PlaneGeometry(ww,1.55),janela);g.position.set(x,floor+1.55,cz-d/2-.125);ROOT.add(g);
  }

  // Varanda frontal profunda.
  const vp=2.4;
  addWalkFloor(w+1.4,vp,cx,cz-d/2-vp/2,floor,M.stone);
  const pillarZ=cz-d/2-vp+.28;
  for(const x of[cx-w/2+.8,cx-4,cx,cx+4,cx+w/2-.8]){
    const base=gy(x,pillarZ)-.05,top=floor+2.72,ph=top-base;
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,ph,10),M.wood);p.position.set(x,base+ph/2,pillarZ);p.castShadow=true;p.receiveShadow=true;ROOT.add(p);
    col(x,pillarZ,.32,.32,base,top,'farmtest-pillar');
  }
  addBox(w+1.0,.24,.24,cx,floor+2.68,pillarZ,M.wood);

  // Telhado principal totalmente fechado + beiral de 0,60 m.
  roofClosed(cx,cz,w+1.20,d+1.20,floor+3.08,floor+5.02);

  // Cobertura inclinada da varanda, independente e abaixo do beiral.
  const aw=w+1.5,ad=vp+1.0;
  const vg=new THREE.BoxGeometry(aw,.13,ad),vm=new THREE.Mesh(vg,M.roof);
  vm.position.set(cx,floor+2.58,cz-d/2-vp/2);vm.rotation.x=-.10;vm.castShadow=true;vm.receiveShadow=true;ROOT.add(vm);

  // Lareira/chaminé.
  addBox(1.8,2.3,.72,cx+4.8,floor+1.15,cz+d/2-.48,M.stone);
  col(cx+4.8,cz+d/2-.48,1.8,.72,floor,floor+2.3,'farmtest-fireplace');
  addBox(.90,2.25,.90,cx+4.8,floor+4.15,cz+1.0,M.stone);

  // Mesa e bancada proporcionais.
  addBox(2.35,.07,1.05,cx+.8,floor+.715,cz+.2,M.wood);
  for(const dx of[-.98,.98])for(const dz of[-.36,.36])addBox(.10,.70,.10,cx+.8+dx,floor+.35,cz+.2+dz,M.wood);
  col(cx+.8,cz+.2,2.35,1.05,floor,floor+.78,'farmtest-table');
  addBox(3.6,.90,.66,cx-1.0,floor+.45,cz+d/2-.58,M.wood);
  col(cx-1.0,cz+d/2-.58,3.6,.66,floor,floor+.96,'farmtest-bench');
}
function roofBarn(cx,cz,w,d,eave,ridge){
  roofClosed(cx,cz,w,d,eave,ridge);
}
function buildBarn(){
  const cx=-177,cz=-163,w=14,d=10,h=sampleRect(cx,cz,w+2,d+2),eave=h.max+2.85,ridge=h.max+4.25;
  // Pátio de terra acompanha terreno; não vira placa flutuante.
  const pg=new THREE.PlaneGeometry(w+6,d+6,10,8),pos=pg.attributes.position,base=gy(cx,cz);
  for(let i=0;i<pos.count;i++){const wx=cx+pos.getX(i),wz=cz-pos.getY(i);pos.setZ(i,gy(wx,wz)-base+.025)}
  pg.computeVertexNormals();const pm=new THREE.Mesh(pg,M.dirt);pm.rotation.x=-Math.PI/2;pm.position.set(cx,base,cz);pm.receiveShadow=true;ROOT.add(pm);

  // Pilares individuais ancorados no chão.
  for(const z of[cz-d/2,cz,cz+d/2])for(const x of[cx-w/2,cx+w/2]){
    const baseY=gy(x,z)-.06,ph=eave-baseY;
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.16,.20,ph,9),M.wood);p.position.set(x,baseY+ph/2,z);p.castShadow=true;p.receiveShadow=true;ROOT.add(p);
    col(x,z,.38,.38,baseY,eave,'farmtest-barn-post');
  }
  // Vigas e tesouras.
  for(const z of[cz-d/2,cz,cz+d/2]){
    addBox(w,.22,.20,cx,eave,z,M.wood);
    const half=w/2,rise=ridge-eave,ang=Math.atan2(rise,half),len=Math.hypot(half,rise);
    for(const side of[-1,1]){
      const m=addBox(len,.18,.18,cx+side*Math.cos(ang)*len/2,ridge-Math.sin(ang)*len/2,z,M.wood);
      m.rotation.z=-side*ang;
    }
  }
  roofBarn(cx,cz,w+1.0,d+1.0,eave,ridge);

  // Baias laterais, deixando corredor central livre de 5,2m.
  for(const x of[cx-w/2+1.5,cx+w/2-1.5])for(const z of[cz-d/2+1.6,cz,cz+d/2-1.6])for(const yy of[.52,.95,1.38]){
    addBox(.12,.12,2.6,x,gy(x,z)+yy,z,M.wood);
  }
  // Bancada oficina na borda.
  const wy=gy(cx-3.8,cz+d/2-.7);
  addBox(3.0,.12,.72,cx-3.8,wy+.90,cz+d/2-.7,M.wood);
  col(cx-3.8,cz+d/2-.7,3.0,.72,wy,wy+.96,'farmtest-workbench');
}
function buildPasture(){
  const minX=-189,maxX=-167,minZ=-148,maxZ=-128;
  // Cerca de arame/madeira com postes aterrados individualmente.
  const segments=[[minX,minZ,maxX,minZ],[maxX,minZ,maxX,maxZ],[maxX,maxZ,minX,maxZ],[minX,maxZ,minX,minZ]];
  for(const[a,z0,b,z1]of segments){
    const len=Math.hypot(b-a,z1-z0),n=Math.max(1,Math.ceil(len/2.5));
    let prev=null;
    for(let i=0;i<=n;i++){
      const t=i/n,x=a+(b-a)*t,z=z0+(z1-z0)*t,y=gy(x,z);
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.075,.10,1.35,7),M.wood);p.position.set(x,y+.675,z);p.receiveShadow=true;ROOT.add(p);
      if(prev){
        for(const hh of[.40,.78,1.14]){
          const A=new THREE.Vector3(prev.x,prev.y+hh,prev.z),B=new THREE.Vector3(x,y+hh,z),dir=B.clone().sub(A),l=dir.length();
          const r=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,l,6),M.wood);
          r.position.addVectors(A,B).multiplyScalar(.5);r.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());ROOT.add(r);
        }
      }
      prev={x,y,z};
    }
  }
  // Curral coberto na BORDA norte do pasto, centro livre.
  const cx=-178,cz=-132,w=7,d=4,e=gy(cx,cz)+2.7,r=e+.9;
  for(const x of[cx-w/2,cx+w/2])for(const z of[cz-d/2,cz+d/2]){
    const by=gy(x,z)-.05,ph=e-by;
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,ph,8),M.wood);p.position.set(x,by+ph/2,z);ROOT.add(p);
    col(x,z,.32,.32,by,e,'farmtest-pasture-post');
  }
  roofClosed(cx,cz,w+.8,d+.8,e,r);
}
function buildGate(){
  const x=-165,z=-150,w=4.2,y=gy(x,z);
  const left=new THREE.Group(),right=new THREE.Group();
  left.position.set(x,y,z-w/2);right.position.set(x,y,z+w/2);ROOT.add(left,right);
  const leaf=w/2+.04;
  for(const[g,side]of[[left,1],[right,-1]]){
    for(const hh of[.38,.78,1.18]){const b=addBox(.10,.11,leaf,0,hh,side*leaf/2,M.wood,g,false)}
    for(const zz of[.07,leaf-.07])addBox(.11,1.28,.11,0,.64,side*zz,M.wood,g,false);
  }
  const closed=new THREE.Box3(new THREE.Vector3(x-.18,y-.25,z-w/2),new THREE.Vector3(x+.18,y+1.35,z+w/2));
  const collider=marcarObstaculoMovel(registrarCaixa(closed.clone(),'farmtest-gate'));
  gate={left,right,baseLeft:0,baseRight:0,ang:0,target:0,collider,closed,x,z};
}
function updateGate(dt,playerPos){
  if(!gate)return;
  const d=Math.hypot(playerPos.x-gate.x,playerPos.z-gate.z);
  gate.target=d<4.5?Math.PI*.48:d>7?0:gate.target;
  const delta=gate.target-gate.ang;gate.ang+=Math.sign(delta)*Math.min(Math.abs(delta),.62*dt);
  gate.left.rotation.y=-gate.ang;gate.right.rotation.y=gate.ang;
  if(gate.ang>Math.PI*.30)gate.collider.makeEmpty();else gate.collider.copy(gate.closed);
}
export function montarFarmPrototype(){
  if(montada)return;montada=true;scene.add(ROOT);
  buildHouse();buildBarn();buildPasture();buildGate();
}
export function atualizarFarmPrototype(dt,playerPos){if(montada)updateGate(dt,playerPos)}
