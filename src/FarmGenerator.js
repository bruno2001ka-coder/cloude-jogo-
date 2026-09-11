// ===== FARM GENERATOR GLOBAL =====
// Uma única implementação para TODAS as fazendas do mapa.
// 1 unidade Three.js = 1 metro.
// Nada é criado no import: WorldGenerator/RuralWorld chamam buildFarm() explicitamente.
import*as THREE from'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{
  registrarCaixa,marcarObstaculoMovel,superficiesAndaveis,
  removerCaixa,removerSuperficieAndavel
}from'./Physics.js';

export const FARM_METRICS={
  unidade:'metro',
  sede:{peDireito:3.00,portaW:1.20,portaH:2.15,varanda:2.20},
  galpao:{lateral:2.80,cumeeira:4.20},
  moveis:{mesa:.75,assento:.45,encosto:.88,bancada:.90,cama:.50},
  circulacaoMin:1.00,
};

export const FARM_DEFS=[
  {id:'fazenda-base',nome:'Fazenda Base',x:-86,z:-50,porte:'media',meiaLarg:13,meiaProf:11,gateMode:'manual',gateStartsOpen:true},
  {id:'boa-vista',nome:'Sítio Boa Vista',x:-145,z:76,porte:'media',meiaLarg:30,meiaProf:22,gateMode:'auto',gateStartsOpen:false},
  {id:'vale-cedro',nome:'Fazenda Vale do Cedro',x:126,z:112,porte:'grande',meiaLarg:35,meiaProf:25,gateMode:'auto',gateStartsOpen:false},
  {id:'ribeirao',nome:'Roça do Ribeirão',x:154,z:-86,porte:'compacta',meiaLarg:32,meiaProf:23,gateMode:'auto',gateStartsOpen:false},
];
export const RURAL_FARM_DEFS=FARM_DEFS.filter(f=>f.id!=='fazenda-base');

const registry=new Map();

// Normais pequenas e compartilhadas. Os MATERIAIS são por fazenda e podem ser descartados sem
// invalidar outra fazenda; as texturas permanecem compartilhadas.
function normalProcedural(seed=1,size=48){
  const data=new Uint8Array(size*size*4);let x=seed|0;
  for(let i=0;i<size*size;i++){
    x=(Math.imul(x^x>>>15,2246822519)+3266489917)|0;
    const k=i*4;data[k]=128+((((x>>>24)&255)-128)>>4);data[k+1]=128+((((x>>>16)&255)-128)>>4);data[k+2]=245;data[k+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);t.needsUpdate=true;return t;
}
const N_MADEIRA=normalProcedural(11),N_TELHA=normalProcedural(37),N_PEDRA=normalProcedural(71),N_REBOCO=normalProcedural(103);

function makeMaterials(seed,owned){
  const add=m=>{owned.add(m);return m};
  const wallColors=[0xd7c8aa,0xc9d0bd,0xd9c4a9];
  return{
    reboco:add(new THREE.MeshStandardMaterial({color:wallColors[seed%wallColors.length],roughness:.93,metalness:0,normalMap:N_REBOCO,normalScale:new THREE.Vector2(.18,.18)})),
    madeira:add(new THREE.MeshStandardMaterial({color:0x5b3925,roughness:.80,metalness:.05,normalMap:N_MADEIRA,normalScale:new THREE.Vector2(.28,.28)})),
    madeiraEsc:add(new THREE.MeshStandardMaterial({color:0x352419,roughness:.84,metalness:.03})),
    madeiraClara:add(new THREE.MeshStandardMaterial({color:0x725033,roughness:.84,metalness:.04,normalMap:N_MADEIRA,normalScale:new THREE.Vector2(.20,.20)})),
    telha:add(new THREE.MeshStandardMaterial({color:0xa84c26,roughness:.90,metalness:.02,normalMap:N_TELHA,normalScale:new THREE.Vector2(.28,.28)})),
    pedra:add(new THREE.MeshStandardMaterial({color:0x95856f,roughness:1,metalness:0,normalMap:N_PEDRA,normalScale:new THREE.Vector2(.42,.42)})),
    vidro:add(new THREE.MeshPhysicalMaterial({color:0x718b94,roughness:.08,metalness:.03,transparent:true,opacity:.48,depthWrite:false,clearcoat:.8,side:THREE.DoubleSide})),
    piso:add(new THREE.MeshStandardMaterial({color:0xb9aa91,roughness:.92,metalness:0})),
    terra:add(new THREE.MeshStandardMaterial({color:0x75583d,roughness:1,metalness:0})),
    palha:add(new THREE.MeshStandardMaterial({color:0xb89a55,roughness:1,metalness:0})),
    tecido:add(new THREE.MeshStandardMaterial({color:0x695549,roughness:1,metalness:0})),
    tecidoClaro:add(new THREE.MeshStandardMaterial({color:0xd7d0c2,roughness:1,metalness:0})),
    metal:add(new THREE.MeshStandardMaterial({color:0x2e3030,roughness:.45,metalness:.72})),
    arame:add(new THREE.MeshStandardMaterial({color:0x3e403e,roughness:.56,metalness:.55})),
  };
}
const ground=(x,z)=>obterElevacao(x,z);
function snapQuarterTurn(r=0){return Math.round(r/(Math.PI/2))*(Math.PI/2)}
function point(cx,cz,lx,lz,r){
  const c=Math.cos(r),s=Math.sin(r);return{x:cx+lx*c+lz*s,z:cz-lx*s+lz*c};
}
function footprintHeights(cx,cz,w,d,r){
  let min=Infinity,max=-Infinity;
  for(let ix=0;ix<=8;ix++)for(let iz=0;iz<=6;iz++){
    const lx=-w/2+w*ix/8,lz=-d/2+d*iz/6,p=point(cx,cz,lx,lz,r),h=ground(p.x,p.z);
    min=Math.min(min,h);max=Math.max(max,h);
  }
  return{min,max};
}
function disposeTree(root,ownedMaterials){
  const geos=new Set(),mats=new Set();
  root.traverse(o=>{
    if(o.geometry&&!geos.has(o.geometry)){geos.add(o.geometry);o.geometry.dispose?.()}
    const arr=Array.isArray(o.material)?o.material:[o.material];
    for(const m of arr)if(m&&ownedMaterials.has(m)&&!mats.has(m)){mats.add(m);m.dispose?.()}
  });
}
function trackedBox(handle,box,cat,movable=false){
  registrarCaixa(box,cat);if(movable)marcarObstaculoMovel(box);handle.colliders.push(box);return box;
}
function trackedSurface(handle,m){
  superficiesAndaveis.push(m);handle.surfaces.push(m);return m;
}
function mesh(parent,geo,mat,cast=true){
  const m=new THREE.Mesh(geo,mat);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function worldAABB(cx,cz,lx,lz,w,d,r,y0,y1){
  const corners=[
    point(cx,cz,lx-w/2,lz-d/2,r),point(cx,cz,lx+w/2,lz-d/2,r),
    point(cx,cz,lx-w/2,lz+d/2,r),point(cx,cz,lx+w/2,lz+d/2,r)
  ];
  return new THREE.Box3(
    new THREE.Vector3(Math.min(...corners.map(p=>p.x)),y0,Math.min(...corners.map(p=>p.z))),
    new THREE.Vector3(Math.max(...corners.map(p=>p.x)),y1,Math.max(...corners.map(p=>p.z)))
  );
}
function mergedBox(list,w,h,d,cx,cy,cz,ry=0){
  const g=new THREE.BoxGeometry(w,h,d),m=new THREE.Matrix4().makeRotationY(ry);m.setPosition(cx,cy,cz);g.applyMatrix4(m);list.push(g);
}
function mergeInto(parent,list,mat){
  if(!list.length)return null;
  const g=mergeGeometries(list,false);list.forEach(x=>x.dispose());if(!g)return null;
  const m=mesh(parent,g,mat);m.frustumCulled=true;return m;
}
function terrainPatch(parent,cx,cz,w,d,mat,handle,segments=8){
  const g=new THREE.PlaneGeometry(w,d,segments,segments),pos=g.attributes.position;
  const base=ground(cx,cz);
  for(let i=0;i<pos.count;i++){
    const lx=pos.getX(i),ly=pos.getY(i),wx=cx+lx,wz=cz-ly;
    pos.setZ(i,ground(wx,wz)-base+.025);
  }
  pos.needsUpdate=true;g.computeVertexNormals();
  const m=mesh(parent,g,mat,false);m.rotation.x=-Math.PI/2;m.position.set(cx,base,cz);
  // É só acabamento: o personagem continua andando no terreno real, evitando plano invisível.
  return m;
}
function placeBox(parent,w,h,d,cx,cy,cz,ry,mat,cast=true){
  const m=mesh(parent,new THREE.BoxGeometry(w,h,d),mat,cast);m.position.set(cx,cy,cz);m.rotation.y=ry;return m;
}
function lineBar(parent,a,b,thick,mat,cast=false){
  const A=new THREE.Vector3(a.x,a.y,a.z),B=new THREE.Vector3(b.x,b.y,b.z),dir=new THREE.Vector3().subVectors(B,A);
  const len=dir.length();if(len<.02)return null;
  const m=mesh(parent,new THREE.BoxGeometry(len,thick,thick),mat,cast);
  m.position.addVectors(A,B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),dir.normalize());return m;
}
function roof2(parent,cx,cz,w,d,yEave,yRidge,ry,mat){
  const half=w/2,rise=yRidge-yEave,ang=Math.atan2(rise,half),len=Math.hypot(half,rise)+.48;
  for(const side of[-1,1]){
    const g=new THREE.Group();g.position.set(cx,0,cz);g.rotation.y=ry;parent.add(g);
    const m=mesh(g,new THREE.BoxGeometry(len,.15,d+.8),mat);
    m.position.set(side*Math.cos(ang)*len/2,yRidge-Math.sin(ang)*len/2,0);m.rotation.z=-side*ang;
  }
}
function wallSegmentZ(handle,parent,list,cx,cz,w,h,yBase,doorCx=null,doorW=0,doorH=0,ry=0){
  const t=.22;
  const add=(ww,hh,lx,yy)=>{
    const p=point(cx,cz,lx,0,ry);mergedBox(list,ww,hh,t,p.x,yy,p.z,ry);
    trackedBox(handle,worldAABB(cx,cz,lx,0,ww,t,ry,yy-hh/2,yy+hh/2),'parede-sede-rural');
  };
  if(doorCx===null){add(w,h,0,yBase+h/2);return}
  const left=(doorCx-doorW/2)-(-w/2),right=(w/2)-(doorCx+doorW/2);
  if(left>.02)add(left,h,-w/2+left/2,yBase+h/2);
  if(right>.02)add(right,h,doorCx+doorW/2+right/2,yBase+h/2);
  const top=h-doorH;if(top>.02)add(doorW,top,doorCx,yBase+doorH+top/2);
}
function wallSegmentX(handle,parent,list,cx,cz,d,h,yBase,doorCz=null,doorW=0,doorH=0,ry=0){
  const t=.22;
  const add=(dd,hh,lz,yy)=>{
    const p=point(cx,cz,0,lz,ry);mergedBox(list,t,hh,dd,p.x,yy,p.z,ry);
    trackedBox(handle,worldAABB(cx,cz,0,lz,t,dd,ry,yy-hh/2,yy+hh/2),'parede-sede-rural');
  };
  if(doorCz===null){add(d,h,0,yBase+h/2);return}
  const a=(doorCz-doorW/2)-(-d/2),b=(d/2)-(doorCz+doorW/2);
  if(a>.02)add(a,h,-d/2+a/2,yBase+h/2);
  if(b>.02)add(b,h,doorCz+doorW/2+b/2,yBase+h/2);
  const top=h-doorH;if(top>.02)add(doorW,top,doorCz,yBase+doorH+top/2);
}

function buildArchitecture(handle,cx,cz,rotation,porte,M){
  const cfg=porte==='grande'
    ?{cw:16.5,cd:10.8,gw:14,gd:10,house:[-4.5,5.4],barn:[8,-7]}
    :porte==='compacta'
      ?{cw:13.6,cd:9.0,gw:11.2,gd:8.0,house:[-4.2,5.0],barn:[6.8,-6.0]}
      :{cw:14.8,cd:9.8,gw:12.4,gd:8.8,house:[-4.4,5.2],barn:[7.2,-6.5]};

  const H=FARM_METRICS.sede.peDireito,houseCenter=point(cx,cz,cfg.house[0],cfg.house[1],rotation);
  const hh=footprintHeights(houseCenter.x,houseCenter.z,cfg.cw+2.4,cfg.cd+2.4,rotation),floorY=hh.max+.14;
  const walls=[],stones=[];

  // Fundação maciça de pedra: topo nivelado, base desce além do canto mais baixo.
  const foundationH=Math.max(.45,floorY-hh.min+.28);
  mergedBox(stones,cfg.cw+1.0,foundationH,cfg.cd+1.0,houseCenter.x,floorY-foundationH/2,houseCenter.z,rotation);

  // Paredes externas com vãos vazios.
  const front=point(houseCenter.x,houseCenter.z,0,-cfg.cd/2,rotation);
  const back =point(houseCenter.x,houseCenter.z,0, cfg.cd/2,rotation);
  wallSegmentZ(handle,handle.group,walls,front.x,front.z,cfg.cw,H,floorY,-1.4,1.20,2.15,rotation);
  wallSegmentZ(handle,handle.group,walls,back.x,back.z,cfg.cw,H,floorY,null,0,0,rotation);
  const left=point(houseCenter.x,houseCenter.z,-cfg.cw/2,0,rotation);
  const right=point(houseCenter.x,houseCenter.z,cfg.cw/2,0,rotation);
  wallSegmentX(handle,handle.group,walls,left.x,left.z,cfg.cd,H,floorY,null,0,0,rotation);
  wallSegmentX(handle,handle.group,walls,right.x,right.z,cfg.cd,H,floorY,1.8,1.0,2.15,rotation);

  // Parede interna do quarto, também com vão real.
  const room=point(houseCenter.x,houseCenter.z,-3.2,1.6,rotation);
  wallSegmentX(handle,handle.group,walls,room.x,room.z,3.6,H,floorY,.9,1.0,2.15,rotation);

  // Rodapé/pilastras de pedra.
  const rod=point(houseCenter.x,houseCenter.z,0,-cfg.cd/2-.03,rotation);
  mergedBox(stones,cfg.cw,.70,.28,rod.x,floorY+.35,rod.z,rotation);
  for(const lx of[-cfg.cw/2+.18,cfg.cw/2-.18])for(const lz of[-cfg.cd/2+.18,cfg.cd/2-.18]){
    const p=point(houseCenter.x,houseCenter.z,lx,lz,rotation);mergedBox(stones,.44,H+.16,.44,p.x,floorY+(H+.16)/2,p.z,rotation);
  }
  mergeInto(handle.group,walls,M.reboco);mergeInto(handle.group,stones,M.pedra);

  // Piso plano interno, apoiado pela fundação.
  const floor=placeBox(handle.group,cfg.cw-.44,.14,cfg.cd-.44,houseCenter.x,floorY-.07,houseCenter.z,rotation,M.piso,false);
  trackedSurface(handle,floor);

  // Janelas grandes.
  for(const[lx,w]of[[2.5,3.0],[5.2,1.6]]){
    const p=point(houseCenter.x,houseCenter.z,lx,-cfg.cd/2-.116,rotation);
    const j=mesh(handle.group,new THREE.PlaneGeometry(w,1.55),M.vidro,false);j.position.set(p.x,floorY+1.55,p.z);j.rotation.y=rotation;
  }
  const jp=point(houseCenter.x,houseCenter.z,-cfg.cw/2-.116,-1.2,rotation);
  const jl=mesh(handle.group,new THREE.PlaneGeometry(2.0,1.45),M.vidro,false);jl.position.set(jp.x,floorY+1.55,jp.z);jl.rotation.y=rotation+Math.PI/2;

  // Varanda frontal e lateral.
  const vp=FARM_METRICS.sede.varanda;
  const pvP=point(houseCenter.x,houseCenter.z,0,-cfg.cd/2-vp/2,rotation);
  const pv=placeBox(handle.group,cfg.cw+1.2,.14,vp,pvP.x,floorY-.01,pvP.z,rotation,M.pedra,false);trackedSurface(handle,pv);
  const sideP=point(houseCenter.x,houseCenter.z,cfg.cw/2+vp/2,-vp/2,rotation);
  const ps=placeBox(handle.group,vp,.14,cfg.cd+vp,sideP.x,floorY-.01,sideP.z,rotation,M.pedra,false);trackedSurface(handle,ps);

  // Pilares da varanda: base individual presa ao chão local; topo fica alinhado.
  const pillarLocals=[];
  for(const lx of[-cfg.cw/2+.8,-cfg.cw*.20,cfg.cw*.20,cfg.cw/2-.8])pillarLocals.push([lx,-cfg.cd/2-vp+.25]);
  for(const lz of[-cfg.cd/2+.5,.6,cfg.cd/2-.5])pillarLocals.push([cfg.cw/2+vp-.28,lz]);
  for(const[lx,lz]of pillarLocals){
    const p=point(houseCenter.x,houseCenter.z,lx,lz,rotation),base=ground(p.x,p.z)-.06,top=floorY+2.72,h=Math.max(.6,top-base);
    const col=mesh(handle.group,new THREE.CylinderGeometry(.13,.15,h,9),M.madeira);col.position.set(p.x,base+h/2,p.z);
    trackedBox(handle,new THREE.Box3(new THREE.Vector3(p.x-.16,base,p.z-.16),new THREE.Vector3(p.x+.16,top,p.z+.16)),'pilar-sede-rural');
  }

  roof2(handle.group,houseCenter.x,houseCenter.z,cfg.cw+1.0,cfg.cd+1.0,floorY+3.05,floorY+4.85,rotation,M.telha);
  const marqP=point(houseCenter.x,houseCenter.z,0,-cfg.cd/2-vp/2,rotation);
  const marq=placeBox(handle.group,cfg.cw+1.4,.12,vp+.7,marqP.x,floorY+2.55,marqP.z,rotation,M.telha);marq.rotation.x=-.11;

  // Chaminé.
  const chP=point(houseCenter.x,houseCenter.z,cfg.cw*.27,.6,rotation);
  placeBox(handle.group,.88,2.1,.88,chP.x,floorY+4.15,chP.z,rotation,M.pedra);

  // Porta aberta, sem colisor.
  const doorHinge=point(houseCenter.x,houseCenter.z,-2.0,-cfg.cd/2-.12,rotation);
  const dg=new THREE.Group();dg.position.set(doorHinge.x,floorY,doorHinge.z);dg.rotation.y=rotation-.55;handle.group.add(dg);
  const door=mesh(dg,new THREE.BoxGeometry(1.16,2.10,.07),M.madeiraEsc);door.position.set(.58,1.05,0);

  // ===== INTERIOR ERGONÔMICO =====
  const table=point(houseCenter.x,houseCenter.z,.8,.2,rotation);
  placeBox(handle.group,2.25,.07,1.0,table.x,floorY+.715,table.z,rotation,M.madeira);
  for(const dx of[-.95,.95])for(const dz of[-.34,.34]){
    const p=point(table.x,table.z,dx,dz,rotation);placeBox(handle.group,.10,.70,.10,p.x,floorY+.35,p.z,rotation,M.madeira);
  }
  trackedBox(handle,worldAABB(table.x,table.z,0,0,2.25,1.0,rotation,floorY,floorY+.78),'mesa-fazenda-rural');

  // Cadeiras: assento a 0.45, sem colisor para manter 1m de circulação.
  const chairs=[[-.65,-1.0,0],[.65,-1.0,0],[-.65,1.0,Math.PI],[.65,1.0,Math.PI],[-1.55,0,Math.PI/2],[1.55,0,-Math.PI/2]];
  for(const[lx,lz,rr]of chairs){
    const p=point(table.x,table.z,lx,lz,rotation),cg=new THREE.Group();cg.position.set(p.x,floorY,p.z);cg.rotation.y=rotation+rr;handle.group.add(cg);
    const seat=mesh(cg,new THREE.BoxGeometry(.46,.07,.46),M.madeira,false);seat.position.y=.45;
    for(const dx of[-.18,.18])for(const dz of[-.18,.18]){const leg=mesh(cg,new THREE.BoxGeometry(.055,.43,.055),M.madeira,false);leg.position.set(dx,.215,dz)}
    const back=mesh(cg,new THREE.BoxGeometry(.46,.43,.055),M.madeira,false);back.position.set(0,.665,.20);
  }

  const benchP=point(houseCenter.x,houseCenter.z,-1.0,cfg.cd/2-.55,rotation);
  placeBox(handle.group,3.5,.90,.65,benchP.x,floorY+.45,benchP.z,rotation,M.madeiraEsc);
  trackedBox(handle,worldAABB(benchP.x,benchP.z,0,0,3.5,.65,rotation,floorY,floorY+.95),'bancada-sede-rural');

  const bedP=point(houseCenter.x,houseCenter.z,-5.0,2.3,rotation);
  placeBox(handle.group,1.95,.24,1.55,bedP.x,floorY+.16,bedP.z,rotation,M.madeira);
  placeBox(handle.group,1.85,.24,1.45,bedP.x,floorY+.43,bedP.z,rotation,M.tecidoClaro);
  trackedBox(handle,worldAABB(bedP.x,bedP.z,0,0,1.95,1.55,rotation,floorY,floorY+.55),'cama-sede-rural');

  const fireP=point(houseCenter.x,houseCenter.z,cfg.cw*.30,cfg.cd/2-.45,rotation);
  placeBox(handle.group,1.8,2.3,.7,fireP.x,floorY+1.15,fireP.z,rotation,M.pedra);
  trackedBox(handle,worldAABB(fireP.x,fireP.z,0,0,1.8,.7,rotation,floorY,floorY+2.3),'lareira-sede-rural');

  // ===== GALPÃO / CURRAL =====
  const barnCenter=point(cx,cz,cfg.barn[0],cfg.barn[1],rotation);
  const gh=footprintHeights(barnCenter.x,barnCenter.z,cfg.gw+1.4,cfg.gd+1.4,rotation),eave=gh.max+FARM_METRICS.galpao.lateral+.12,ridge=gh.max+FARM_METRICS.galpao.cumeeira+.12;
  terrainPatch(handle.group,barnCenter.x,barnCenter.z,cfg.gw,cfg.gd,M.terra,handle,8);

  // Pilares: cada base toca o chão real naquele X/Z; topo alinhado para receber a tesoura.
  for(const lz of[-cfg.gd/2,0,cfg.gd/2])for(const lx of[-cfg.gw/2,cfg.gw/2]){
    const p=point(barnCenter.x,barnCenter.z,lx,lz,rotation),base=ground(p.x,p.z)-.08,h=eave-base;
    const col=mesh(handle.group,new THREE.CylinderGeometry(.15,.18,h,9),M.madeiraClara);col.position.set(p.x,base+h/2,p.z);
    trackedBox(handle,new THREE.Box3(new THREE.Vector3(p.x-.19,base,p.z-.19),new THREE.Vector3(p.x+.19,eave,p.z+.19)),'pilar-galpao-rural');
  }
  for(const lz of[-cfg.gd/2,0,cfg.gd/2]){
    const p=point(barnCenter.x,barnCenter.z,0,lz,rotation);
    placeBox(handle.group,cfg.gw,.20,.18,p.x,eave,p.z,rotation,M.madeiraEsc);
    const half=cfg.gw/2,rise=ridge-eave,ang=Math.atan2(rise,half),len=Math.hypot(half,rise);
    for(const side of[-1,1]){
      const g=new THREE.Group();g.position.set(p.x,0,p.z);g.rotation.y=rotation;handle.group.add(g);
      const tr=mesh(g,new THREE.BoxGeometry(len,.18,.18),M.madeiraEsc);tr.position.set(side*Math.cos(ang)*len/2,ridge-Math.sin(ang)*len/2,0);tr.rotation.z=-side*ang;
    }
  }
  roof2(handle.group,barnCenter.x,barnCenter.z,cfg.gw+.8,cfg.gd+.8,eave,ridge,rotation,M.telha);

  // Baias laterais: cada ripa usa a altura do chão nas duas pontas.
  for(const lx of[-cfg.gw/2+1.5,cfg.gw/2-1.5])for(const lz of[-cfg.gd/2+.9,-1.0,2.3])for(const ah of[.48,.88,1.28]){
    const a=point(barnCenter.x,barnCenter.z,lx,lz-1.4,rotation),b=point(barnCenter.x,barnCenter.z,lx,lz+1.4,rotation);
    lineBar(handle.group,{x:a.x,y:ground(a.x,a.z)+ah,z:a.z},{x:b.x,y:ground(b.x,b.z)+ah,z:b.z},.13,M.madeiraClara,false);
  }

  // Bancada oficina ancorada no solo local; tampo exato a 0.90 m.
  const wbP=point(barnCenter.x,barnCenter.z,-3.2,cfg.gd/2-.60,rotation),wbGround=ground(wbP.x,wbP.z);
  placeBox(handle.group,2.8,.12,.68,wbP.x,wbGround+.90,wbP.z,rotation,M.madeira);
  trackedBox(handle,worldAABB(wbP.x,wbP.z,0,0,2.8,.68,rotation,wbGround,wbGround+.96),'bancada-galpao-rural');

  // Fardos: cada um consulta sua cota, nenhum Y absoluto.
  for(const[lx,lz,layer]of[[cfg.gw/2-1.6,cfg.gd/2-1.2,0],[cfg.gw/2-.85,cfg.gd/2-1.2,0],[cfg.gw/2-1.2,cfg.gd/2-1.2,1]]){
    const p=point(barnCenter.x,barnCenter.z,lx,lz,rotation),base=ground(p.x,p.z)+layer*.55;
    placeBox(handle.group,.70,.55,1.0,p.x,base+.275,p.z,rotation,M.palha,false);
  }

  handle.sede={x:houseCenter.x,z:houseCenter.z,y:floorY,larg:cfg.cw,prof:cfg.cd};
  handle.galpao={x:barnCenter.x,z:barnCenter.z,y:gh.max+.12,larg:cfg.gw,prof:cfg.gd,meiaLarg:cfg.gw/2,meiaProf:cfg.gd/2};
}

function defaultBoundary(cx,cz,halfW,halfD,rotation){
  return[
    point(cx,cz,-halfW,-halfD,rotation),point(cx,cz,halfW,-halfD,rotation),
    point(cx,cz,halfW,halfD,rotation),point(cx,cz,-halfW,halfD,rotation)
  ];
}
function colliderAlong(handle,a,b,height=1.32,thick=.11){
  const len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(len/.60));
  for(let i=0;i<n;i++){
    const t0=i/n,t1=(i+1)/n,x0=a.x+(b.x-a.x)*t0,z0=a.z+(b.z-a.z)*t0,x1=a.x+(b.x-a.x)*t1,z1=a.z+(b.z-a.z)*t1;
    const y0=ground(x0,z0),y1=ground(x1,z1);
    trackedBox(handle,new THREE.Box3(
      new THREE.Vector3(Math.min(x0,x1)-thick,Math.min(y0,y1)-.28,Math.min(z0,z1)-thick),
      new THREE.Vector3(Math.max(x0,x1)+thick,Math.max(y0,y1)+height,Math.max(z0,z1)+thick)
    ),'cerca-fazenda');
  }
}
function fenceSegment(handle,a,b,M){
  const len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(len/3.0));
  let prev=null;
  for(let i=0;i<=n;i++){
    const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=ground(x,z);
    const p=mesh(handle.group,new THREE.CylinderGeometry(.075,.095,1.34,7),M.madeiraClara,false);p.position.set(x,y+.67,z);
    if(prev)for(const h of[.38,.76,1.12])lineBar(handle.group,{x:prev.x,y:prev.y+h,z:prev.z},{x,y:y+h,z},.045,M.arame,false);
    prev={x,y,z};
  }
  colliderAlong(handle,a,b);
}
function buildPerimeter(handle,boundary,gateIndex,M,gateMode,gateStartsOpen){
  const n=boundary.length,idx=((gateIndex%n)+n)%n,a=boundary[idx],b=boundary[(idx+1)%n],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
  const gateW=Math.min(4.2,Math.max(3.4,len-.8)),ux=dx/len,uz=dz/len,cx=(a.x+b.x)/2,cz=(a.z+b.z)/2;
  const left={x:cx-ux*gateW/2,z:cz-uz*gateW/2},right={x:cx+ux*gateW/2,z:cz+uz*gateW/2};
  for(let i=0;i<n;i++){
    const A=boundary[i],B=boundary[(i+1)%n];
    if(i===idx){fenceSegment(handle,A,left,M);fenceSegment(handle,right,B,M)}
    else fenceSegment(handle,A,B,M);
  }

  // Pivôs seguem a direção real do trecho. Cada folha abre devagar; colisor é segmentado e móvel.
  const yaw=Math.atan2(dx,dz),baseL=ground(left.x,left.z),baseR=ground(right.x,right.z);
  const gL=new THREE.Group(),gR=new THREE.Group();gL.position.set(left.x,baseL,left.z);gR.position.set(right.x,baseR,right.z);gL.rotation.y=yaw;gR.rotation.y=yaw;handle.group.add(gL,gR);
  const leafLen=gateW/2+.035;
  for(const[g,side]of[[gL,1],[gR,-1]]){
    for(const h of[.38,.78,1.18]){const bar=mesh(g,new THREE.BoxGeometry(.08,.11,leafLen),M.madeiraClara,false);bar.position.set(0,h,side*leafLen/2)}
    for(const z of[.07,leafLen-.07]){const post=mesh(g,new THREE.BoxGeometry(.10,1.28,.10),M.madeiraClara,false);post.position.set(0,.64,side*z)}
  }
  const gate={x:cx,z:cz,raio:4.4,mode:gateMode,aberta:!!gateStartsOpen,angulo:gateStartsOpen?Math.PI*.48:0,pivos:[{g:gL,side:1},{g:gR,side:-1}],colliders:[],colisorAtivo:!gateStartsOpen};
  const segs=8;
  for(let i=0;i<segs;i++){
    const t0=i/segs,t1=(i+1)/segs,x0=left.x+dx*(gateW/len)*t0,z0=left.z+dz*(gateW/len)*t0,x1=left.x+dx*(gateW/len)*t1,z1=left.z+dz*(gateW/len)*t1;
    const y0=ground(x0,z0),y1=ground(x1,z1);
    const box=new THREE.Box3(new THREE.Vector3(Math.min(x0,x1)-.10,Math.min(y0,y1)-.25,Math.min(z0,z1)-.10),new THREE.Vector3(Math.max(x0,x1)+.10,Math.max(y0,y1)+1.35,Math.max(z0,z1)+.10));
    if(gateStartsOpen)box.makeEmpty();
    trackedBox(handle,box,'porteira-fazenda',true);gate.colliders.push({box,closed:box.clone()});
  }
  // closed foi clonado DEPOIS de makeEmpty quando começa aberta; reconstrói a geometria fechada explicitamente.
  gate.colliders.length=0;
  for(let i=0;i<segs;i++){
    const t0=i/segs,t1=(i+1)/segs,x0=left.x+(right.x-left.x)*t0,z0=left.z+(right.z-left.z)*t0,x1=left.x+(right.x-left.x)*t1,z1=left.z+(right.z-left.z)*t1;
    const y0=ground(x0,z0),y1=ground(x1,z1),closed=new THREE.Box3(
      new THREE.Vector3(Math.min(x0,x1)-.10,Math.min(y0,y1)-.25,Math.min(z0,z1)-.10),
      new THREE.Vector3(Math.max(x0,x1)+.10,Math.max(y0,y1)+1.35,Math.max(z0,z1)+.10)
    );
    // reutiliza as últimas caixas já registradas para não duplicar física
    const box=handle.colliders[handle.colliders.length-segs+i];if(gateStartsOpen)box.makeEmpty();else box.copy(closed);
    gate.colliders.push({box,closed});
  }
  applyGate(gate);
  handle.gate=gate;
}
function applyGate(gate){
  const target=gate.aberta?Math.PI*.48:0;
  for(const p of gate.pivos)p.g.rotation.y+=0; // yaw base já está no grupo; a folha gira no próprio eixo abaixo.
  for(const p of gate.pivos)p.g.children.length; // mantém V8 sem alocação; rotação é aplicada no grupo relativo ao yaw salvo.
  // Como yaw está no próprio pivo, guardamos a base uma vez.
  for(const p of gate.pivos){
    if(p.baseYaw===undefined)p.baseYaw=p.g.rotation.y;
    p.g.rotation.y=p.baseYaw+p.side*gate.angulo;
  }
  const openEnough=gate.angulo>Math.PI*.31;
  for(const q of gate.colliders){if(openEnough)q.box.makeEmpty();else q.box.copy(q.closed)}
  gate.colisorAtivo=!openEnough;
}
function updateGate(gate,dt,playerPos){
  if(gate.mode==='auto'&&playerPos){
    const d=Math.hypot(playerPos.x-gate.x,playerPos.z-gate.z);
    if(d<4.8)gate.aberta=true;else if(d>7.5)gate.aberta=false;
  }
  const target=gate.aberta?Math.PI*.48:0,delta=target-gate.angulo;
  if(Math.abs(delta)>.0005)gate.angulo+=Math.sign(delta)*Math.min(Math.abs(delta),.62*dt);
  applyGate(gate);
}

export function buildFarm(originX,originZ,rotation=0,opts={}){
  const id=opts.id||`farm-${originX.toFixed(1)}-${originZ.toFixed(1)}`;
  destroyFarm(id);
  const ownedMaterials=new Set(),M=makeMaterials(opts.seed??1,ownedMaterials);
  const group=new THREE.Group();group.name='farm-root-'+id;(opts.parent||scene).add(group);
  const handle={id,group,colliders:[],surfaces:[],ownedMaterials,gate:null,sede:null,galpao:null,rotation:snapQuarterTurn(rotation),name:opts.name||id};
  registry.set(id,handle);

  buildArchitecture(handle,originX,originZ,handle.rotation,opts.porte||'media',M);

  const boundary=opts.boundaryPoints?.length>=4
    ?opts.boundaryPoints.map(p=>({x:p.x,z:p.z}))
    :defaultBoundary(originX,originZ,opts.meiaLarg??14,opts.meiaProf??12,handle.rotation);
  buildPerimeter(handle,boundary,opts.gateIndex??1,M,opts.gateMode||'auto',opts.gateStartsOpen??false);

  console.info(`[farm] ${handle.name} @ ${originX.toFixed(1)},${originZ.toFixed(1)} | colisores=${handle.colliders.length} | superficies=${handle.surfaces.length}`);
  return handle;
}
export function destroyFarm(id){
  const h=registry.get(id);if(!h)return false;
  for(const b of h.colliders)removerCaixa(b);
  for(const s of h.surfaces)removerSuperficieAndavel(s);
  h.group.parent?.remove(h.group);
  disposeTree(h.group,h.ownedMaterials);
  registry.delete(id);return true;
}
export function destroyAllFarms(){for(const id of[...registry.keys()])destroyFarm(id)}
export function updateFarms(dt,playerPos){for(const h of registry.values())if(h.gate)updateGate(h.gate,dt,playerPos)}
export function getFarm(id){return registry.get(id)||null}
export function toggleFarmGate(id){
  const h=registry.get(id);if(!h?.gate)return false;h.gate.aberta=!h.gate.aberta;return h.gate.aberta;
}
export function nearFarmGate(id,pos){
  const g=registry.get(id)?.gate;return!!g&&Math.hypot(pos.x-g.x,pos.z-g.z)<g.raio;
}
