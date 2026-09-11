// ===== FARM GENERATOR REUTILIZAVEL =====
// Arquitetura rural brasileira para TODAS as fazendas do RuralWorld.
// Importante: este modulo NAO cria nada sozinho e NAO toca na fazenda antiga.
// Ele apenas exporta criarArquiteturaRuralPadrao(), usado por cada zona rural.
import*as THREE from'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa,superficiesAndaveis}from'./Physics.js';

export const FARM_METRICS={
  unidade:'metro',
  sede:{peDireito:3.00,portaW:1.20,portaH:2.15,varanda:2.20},
  galpao:{lateral:2.80,cumeeira:4.20},
  moveis:{mesa:.75,assento:.45,encosto:.88,bancada:.90,cama:.50},
  circulacaoMin:1.00,
};

function mat(c,r=.9,m=0){return new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m})}
const MAT={
  reboco:[mat(0xd7c8aa,.93),mat(0xc9d0bd,.93),mat(0xd9c4a9,.93)],
  madeira:mat(0x5b3925,.80,.05),
  madeiraEsc:mat(0x352419,.84,.03),
  madeiraInst:mat(0x725033,.84,.04),
  telha:mat(0xa84c26,.90,.02),
  pedra:mat(0x95856f,1,0),
  vidro:new THREE.MeshPhysicalMaterial({color:0x718b94,roughness:.08,metalness:.03,transparent:true,opacity:.48,depthWrite:false,clearcoat:.8,side:THREE.DoubleSide}),
  piso:mat(0xb9aa91,.92),
  terra:mat(0x75583d,1),
  palha:mat(0xb89a55,1),
  tecido:mat(0x695549,1),
  tecidoClaro:mat(0xd7d0c2,1),
  metal:mat(0x2e3030,.45,.72),
};

function cotaMax(cx,cz,w,d){
  let max=-Infinity,min=Infinity;
  for(let ix=0;ix<=6;ix++)for(let iz=0;iz<=5;iz++){
    const x=cx-w/2+w*ix/6,z=cz-d/2+d*iz/5,h=obterElevacao(x,z);
    max=Math.max(max,h);min=Math.min(min,h);
  }
  return{max,min};
}
function regBox(x,z,w,d,y0,y1,cat){
  return registrarCaixa(new THREE.Box3(
    new THREE.Vector3(x-w/2,y0,z-d/2),
    new THREE.Vector3(x+w/2,y1,z+d/2)
  ),cat);
}
function addMesh(parent,geo,material,cast=true){
  const m=new THREE.Mesh(geo,material);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function instancedBox(parent,w,h,d,material,items,cast=true){
  const g=new THREE.BoxGeometry(w,h,d),im=new THREE.InstancedMesh(g,material,items.length),o=new THREE.Object3D();
  items.forEach((q,i)=>{o.position.set(q.x,q.y,q.z);o.rotation.set(q.rx||0,q.ry||0,q.rz||0);o.scale.set(q.sx||1,q.sy||1,q.sz||1);o.updateMatrix();im.setMatrixAt(i,o.matrix)});
  im.instanceMatrix.needsUpdate=true;im.castShadow=cast;im.receiveShadow=true;parent.add(im);return im;
}
function telhadoDuasAguas(parent,cx,cz,w,d,yBeiral,yCume){
  const meia=w/2,sub=yCume-yBeiral,ang=Math.atan2(sub,meia),comp=Math.hypot(meia,sub)+.5;
  for(const lado of[-1,1]){
    const m=addMesh(parent,new THREE.BoxGeometry(comp,.15,d+.8),MAT.telha);
    m.position.set(cx+lado*Math.cos(ang)*comp/2,yCume-Math.sin(ang)*comp/2,cz);
    m.rotation.z=-lado*ang;
  }
}
function paredeZ(parent,stack,matParede,cx,z,w,h,yBase,portaCx=null,portaW=0,portaH=0){
  const t=.22;
  const add=(ww,hh,x,yy)=>{const g=new THREE.BoxGeometry(ww,hh,t);g.translate(x,yy,z);stack.push(g);regBox(x,z,ww,t,yy-hh/2,yy+hh/2,'parede-sede-rural')};
  if(portaCx===null){add(w,h,cx,yBase+h/2);return}
  const l=(portaCx-portaW/2)-(cx-w/2),r=(cx+w/2)-(portaCx+portaW/2);
  if(l>.02)add(l,h,cx-w/2+l/2,yBase+h/2);
  if(r>.02)add(r,h,portaCx+portaW/2+r/2,yBase+h/2);
  const topo=h-portaH;if(topo>.02)add(portaW,topo,portaCx,yBase+portaH+topo/2);
}
function paredeX(parent,stack,matParede,x,cz,d,h,yBase,portaCz=null,portaW=0,portaH=0){
  const t=.22;
  const add=(dd,hh,z,yy)=>{const g=new THREE.BoxGeometry(t,hh,dd);g.translate(x,yy,z);stack.push(g);regBox(x,z,t,dd,yy-hh/2,yy+hh/2,'parede-sede-rural')};
  if(portaCz===null){add(d,h,cz,yBase+h/2);return}
  const a=(portaCz-portaW/2)-(cz-d/2),b=(cz+d/2)-(portaCz+portaW/2);
  if(a>.02)add(a,h,cz-d/2+a/2,yBase+h/2);
  if(b>.02)add(b,h,portaCz+portaW/2+b/2,yBase+h/2);
  const topo=h-portaH;if(topo>.02)add(portaW,topo,portaCz,yBase+portaH+topo/2);
}

export function criarArquiteturaRuralPadrao({parent,cx,cz,seed=1,porte='media',nome='Fazenda'}={}){
  if(!parent)throw new Error('FarmGenerator: parent obrigatorio');
  const cfg=porte==='grande'
    ?{cw:16.5,cd:10.8,gw:14,gd:10,offCasa:[-4.5,5.4],offGal:[8,-7]}
    :porte==='compacta'
      ?{cw:13.6,cd:9.0,gw:11.2,gd:8.0,offCasa:[-4.2,5.0],offGal:[6.8,-6.0]}
      :{cw:14.8,cd:9.8,gw:12.4,gd:8.8,offCasa:[-4.4,5.2],offGal:[7.2,-6.5]};

  const group=new THREE.Group();group.name='arquitetura-'+nome.toLowerCase().replace(/\s+/g,'-');parent.add(group);
  const matParede=MAT.reboco[seed%MAT.reboco.length];

  // ===== SEDE =====
  const hx=cx+cfg.offCasa[0],hz=cz+cfg.offCasa[1],H=3.0;
  const hc=cotaMax(hx,hz,cfg.cw+3,cfg.cd+3),hy=hc.max+.14,front=hz-cfg.cd/2;
  const stack=[];

  const fundH=Math.max(.35,hy-hc.min+.18);
  const fund=new THREE.BoxGeometry(cfg.cw+1.0,fundH,cfg.cd+1.0);fund.translate(hx,hy-fundH/2,hz);stack.push(fund);

  const piso=addMesh(group,new THREE.BoxGeometry(cfg.cw-.44,.14,cfg.cd-.44),MAT.piso,false);
  piso.position.set(hx,hy-.07,hz);superficiesAndaveis.push(piso);

  const portaX=hx-1.4;
  paredeZ(group,stack,matParede,hx,front,cfg.cw,H,hy,portaX,1.20,2.15);
  paredeZ(group,stack,matParede,hx,hz+cfg.cd/2,cfg.cw,H,hy,null);
  paredeX(group,stack,matParede,hx-cfg.cw/2,hz,cfg.cd,H,hy,null);
  paredeX(group,stack,matParede,hx+cfg.cw/2,hz,cfg.cd,H,hy,hz+1.8,1.0,2.15);

  // Parede interna simples do quarto, com vao de 1m.
  paredeX(group,stack,matParede,hx-3.2,hz+1.6,3.6,H,hy,hz+.9,1.0,2.15);

  // Fundação/rodapé de pedra e pilastras.
  const rod=new THREE.BoxGeometry(cfg.cw,.70,.28);rod.translate(hx,hy+.35,front-.03);stack.push(rod);
  for(const x of[hx-cfg.cw/2+.18,hx+cfg.cw/2-.18])for(const z of[hz-cfg.cd/2+.18,hz+cfg.cd/2-.18]){
    const g=new THREE.BoxGeometry(.44,H+.16,.44);g.translate(x,hy+(H+.16)/2,z);stack.push(g);
  }

  const merged=mergeGeometries(stack,false);stack.forEach(g=>g.dispose());
  if(merged){const m=addMesh(group,merged,matParede);m.frustumCulled=true}

  // Janelas.
  for(const[x,w]of[[hx+2.5,3.0],[hx+5.2,1.6]]){
    const j=addMesh(group,new THREE.PlaneGeometry(w,1.55),MAT.vidro,false);j.position.set(x,hy+1.55,front-.116);
  }
  const jl=addMesh(group,new THREE.PlaneGeometry(2.0,1.45),MAT.vidro,false);jl.rotation.y=Math.PI/2;jl.position.set(hx-cfg.cw/2-.116,hy+1.55,hz-1.2);

  // Varanda.
  const vp=2.2;
  const pv=addMesh(group,new THREE.BoxGeometry(cfg.cw+1.2,.14,vp),MAT.pedra,false);pv.position.set(hx,hy-.01,front-vp/2);superficiesAndaveis.push(pv);
  const pl=addMesh(group,new THREE.BoxGeometry(vp,.14,cfg.cd+vp),MAT.pedra,false);pl.position.set(hx+cfg.cw/2+vp/2,hy-.01,hz-vp/2);superficiesAndaveis.push(pl);

  const pilares=[];
  for(const x of[hx-cfg.cw/2+.8,hx-cfg.cw*.2,hx+cfg.cw*.2,hx+cfg.cw/2-.8])pilares.push({x,y:hy+1.35,z:front-vp+.25});
  for(const z of[hz-cfg.cd/2+.5,hz+.6,hz+cfg.cd/2-.5])pilares.push({x:hx+cfg.cw/2+vp-.28,y:hy+1.35,z});
  instancedBox(group,.26,2.70,.26,MAT.madeiraInst,pilares,true);
  for(const p of pilares)regBox(p.x,p.z,.28,.28,hy,hy+2.75,'pilar-sede-rural');

  // Telhado principal + varanda.
  telhadoDuasAguas(group,hx,hz,cfg.cw+1.0,cfg.cd+1.0,hy+3.05,hy+4.85);
  const marq=addMesh(group,new THREE.BoxGeometry(cfg.cw+1.4,.12,vp+.7),MAT.telha);
  marq.position.set(hx,hy+2.55,front-vp/2);marq.rotation.x=-.11;

  // Chaminé.
  const ch=addMesh(group,new THREE.BoxGeometry(.88,2.1,.88),MAT.pedra);ch.position.set(hx+cfg.cw*.27,hy+4.15,hz+.6);

  // Porta visual aberta, sem colisor.
  const porta=new THREE.Group();porta.position.set(portaX-.6,hy,front-.12);group.add(porta);
  const pf=addMesh(porta,new THREE.BoxGeometry(1.16,2.10,.07),MAT.madeiraEsc);pf.position.set(.58,1.05,0);porta.rotation.y=-.55;

  // Interior proporcional.
  const mesaX=hx+.8,mesaZ=hz+.2;
  const tamp=addMesh(group,new THREE.BoxGeometry(2.25,.07,1.0),MAT.madeira);tamp.position.set(mesaX,hy+.715,mesaZ);
  for(const dx of[-.95,.95])for(const dz of[-.34,.34]){const p=addMesh(group,new THREE.BoxGeometry(.10,.70,.10),MAT.madeira);p.position.set(mesaX+dx,hy+.35,mesaZ+dz)}
  regBox(mesaX,mesaZ,2.25,1.0,hy,hy+.78,'mesa-fazenda-rural');

  const bancada=addMesh(group,new THREE.BoxGeometry(3.5,.90,.65),MAT.madeiraEsc);bancada.position.set(hx-1.0,hy+.45,hz+cfg.cd/2-.55);
  regBox(hx-1.0,hz+cfg.cd/2-.55,3.5,.65,hy,hy+.95,'bancada-sede-rural');

  const camaBase=addMesh(group,new THREE.BoxGeometry(1.95,.24,1.55),MAT.madeira);camaBase.position.set(hx-5.0,hy+.16,hz+2.3);
  const colch=addMesh(group,new THREE.BoxGeometry(1.85,.24,1.45),MAT.tecidoClaro);colch.position.set(hx-5.0,hy+.43,hz+2.3);
  regBox(hx-5.0,hz+2.3,1.95,1.55,hy,hy+.55,'cama-sede-rural');

  const lareira=addMesh(group,new THREE.BoxGeometry(1.8,2.3,.7),MAT.pedra);lareira.position.set(hx+cfg.cw*.30,hy+1.15,hz+cfg.cd/2-.45);
  regBox(hx+cfg.cw*.30,hz+cfg.cd/2-.45,1.8,.7,hy,hy+2.3,'lareira-sede-rural');

  // ===== GALPAO/CURRAL =====
  const gx=cx+cfg.offGal[0],gz=cz+cfg.offGal[1],gc=cotaMax(gx,gz,cfg.gw+2,cfg.gd+2),gy=gc.max+.08;
  const gp=addMesh(group,new THREE.BoxGeometry(cfg.gw,.10,cfg.gd),MAT.terra,false);gp.position.set(gx,gy-.05,gz);superficiesAndaveis.push(gp);

  const posts=[];
  for(const z of[gz-cfg.gd/2,gz,gz+cfg.gd/2])for(const x of[gx-cfg.gw/2,gx+cfg.gw/2])posts.push({x,y:gy+1.40,z});
  instancedBox(group,.30,2.80,.30,MAT.madeiraInst,posts,true);
  for(const p of posts)regBox(p.x,p.z,.32,.32,gy,gy+2.82,'pilar-galpao-rural');

  for(const z of[gz-cfg.gd/2,gz,gz+cfg.gd/2]){
    const v=addMesh(group,new THREE.BoxGeometry(cfg.gw,.20,.18),MAT.madeiraEsc);v.position.set(gx,gy+2.80,z);
    const meia=cfg.gw/2,sub=4.20-2.80,ang=Math.atan2(sub,meia),comp=Math.hypot(meia,sub);
    for(const lado of[-1,1]){
      const t=addMesh(group,new THREE.BoxGeometry(comp,.18,.18),MAT.madeiraEsc);
      t.position.set(gx+lado*Math.cos(ang)*comp/2,gy+4.20-Math.sin(ang)*comp/2,z);t.rotation.z=-lado*ang;
    }
  }
  telhadoDuasAguas(group,gx,gz,cfg.gw+.8,cfg.gd+.8,gy+2.80,gy+4.20);

  // Baias laterais de ripa.
  const rails=[];
  for(const bx of[gx-cfg.gw/2+1.5,gx+cfg.gw/2-1.5])for(const z of[gz-cfg.gd/2+.9,gz-1.0,gz+2.3])for(const h of[.48,.88,1.28])
    rails.push({x:bx,y:gy+h,z});
  instancedBox(group,.12,.13,2.8,MAT.madeiraInst,rails,false);

  // Bancada oficina a 0.90m.
  const wb=addMesh(group,new THREE.BoxGeometry(2.8,.12,.68),MAT.madeira);wb.position.set(gx-3.2,gy+.90,gz+cfg.gd/2-.60);
  regBox(gx-3.2,gz+cfg.gd/2-.60,2.8,.68,gy,gy+.96,'bancada-galpao-rural');

  // Fardos instanciados.
  const fenos=[
    {x:gx+cfg.gw/2-1.6,y:gy+.28,z:gz+cfg.gd/2-1.2},
    {x:gx+cfg.gw/2-.85,y:gy+.28,z:gz+cfg.gd/2-1.2},
    {x:gx+cfg.gw/2-1.2,y:gy+.82,z:gz+cfg.gd/2-1.2}
  ];
  instancedBox(group,.70,.55,1.0,MAT.palha,fenos,false);

  return{group,sede:{x:hx,z:hz,y:hy,larg:cfg.cw,prof:cfg.cd},galpao:{x:gx,z:gz,y:gy,larg:cfg.gw,prof:cfg.gd}};
}
