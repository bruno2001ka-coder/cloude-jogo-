// ===== FARM GENERATOR =====
// Sede de fazenda + galpao/curral em escala real (1 unidade = 1 metro).
// Referencias: rancho colonial contemporaneo com telha ceramica, pedra e madeira;
// galpao aberto em madeira bruta com baias laterais.
// O modulo constrói visual + colisao limpa e exporta somente o estado necessario ao jogo.
import*as THREE from'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa,superficiesAndaveis,marcarObstaculoMovel}from'./Physics.js';

// ===== ESCALA / PLANTA =====
export const FARM_METRICS={
  unidade:'metro',
  sede:{larg:18,prof:12,peDireito:3,parede:.22,porta:1.20,portaAlt:2.15,varanda:2.35},
  galpao:{larg:14,prof:10,cumeeira:4.20,lateral:2.80,vaoCentral:5.20},
  moveis:{mesa:.75,assento:.45,encosto:.88,bancada:.90,cama:.50},
  circulacaoMin:1.00,
};
export const FAZENDA={
  cx:-86,cz:-50,meiaLarg:24,meiaProf:20,
  sede:{x:-93,z:-46,larg:FARM_METRICS.sede.larg,prof:FARM_METRICS.sede.prof},
  celeiro:{x:-75,z:-55,meiaLarg:FARM_METRICS.galpao.larg/2,meiaProf:FARM_METRICS.galpao.prof/2},
};

export const farmGroup=new THREE.Group();farmGroup.name='fazenda-arquitetura-rural';scene.add(farmGroup);

// ===== PBR PROCEDURAL =====
// Evita downloads extras. Normal maps pequenos criados em memoria dão micro-relevo sem pesar o bundle.
function normalProcedural(seed=1,size=64){
  const data=new Uint8Array(size*size*4);let x=seed|0;
  for(let i=0;i<size*size;i++){
    x=(Math.imul(x^x>>>15,2246822519)+3266489917)|0;
    const a=((x>>>24)&255)-128,b=((x>>>16)&255)-128;
    const k=i*4;data[k]=128+(a>>4);data[k+1]=128+(b>>4);data[k+2]=245;data[k+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);t.needsUpdate=true;return t;
}
const nMadeira=normalProcedural(11),nTelha=normalProcedural(37),nPedra=normalProcedural(71),nReboco=normalProcedural(103);
const MAT={
  reboco:new THREE.MeshStandardMaterial({color:0xd7c8aa,roughness:.93,metalness:0,normalMap:nReboco,normalScale:new THREE.Vector2(.18,.18)}),
  madeira:new THREE.MeshStandardMaterial({color:0x5d3924,roughness:.80,metalness:.05,normalMap:nMadeira,normalScale:new THREE.Vector2(.30,.30)}),
  madeiraEscura:new THREE.MeshStandardMaterial({color:0x3a251a,roughness:.84,metalness:.03}),
  madeiraInst:new THREE.MeshStandardMaterial({color:0x725033,roughness:.84,metalness:.04}),
  telha:new THREE.MeshStandardMaterial({color:0xa84c26,roughness:.90,metalness:.02,normalMap:nTelha,normalScale:new THREE.Vector2(.28,.28)}),
  pedra:new THREE.MeshStandardMaterial({color:0x9b8a72,roughness:1,metalness:0,normalMap:nPedra,normalScale:new THREE.Vector2(.45,.45)}),
  vidro:new THREE.MeshPhysicalMaterial({color:0x6f8992,roughness:.08,metalness:.05,transparent:true,opacity:.48,depthWrite:false,clearcoat:.8}),
  metal:new THREE.MeshStandardMaterial({color:0x2d2e2d,roughness:.42,metalness:.75}),
  piso:new THREE.MeshStandardMaterial({color:0xb9aa91,roughness:.92,metalness:0}),
  terra:new THREE.MeshStandardMaterial({color:0x76583d,roughness:1,metalness:0}),
  palha:new THREE.MeshStandardMaterial({color:0xb89a55,roughness:1,metalness:0}),
  tecido:new THREE.MeshStandardMaterial({color:0x655145,roughness:1,metalness:0}),
  tecidoClaro:new THREE.MeshStandardMaterial({color:0xd7d0c2,roughness:1,metalness:0}),
  grama:new THREE.MeshStandardMaterial({color:0x5c773f,roughness:1,metalness:0}),
};

// ===== GERADOR ESTATICO FUNDIDO =====
const pilhas=new Map();
function pilha(mat){let a=pilhas.get(mat);if(!a){a=[];pilhas.set(mat,a)}return a}
function geoCaixa(w,h,d,x,y,z,ry=0,mat=MAT.reboco){
  const g=new THREE.BoxGeometry(w,h,d);
  const m=new THREE.Matrix4().makeRotationY(ry);m.setPosition(x,y,z);g.applyMatrix4(m);pilha(mat).push(g);return g;
}
function geoCil(r,h,x,y,z,mat=MAT.madeira,seg=10){
  const g=new THREE.CylinderGeometry(r,r,h,seg);
  g.translate(x,y,z);pilha(mat).push(g);return g;
}
function finalizarFundidos(parent=farmGroup){
  for(const[mat,list]of pilhas){
    if(!list.length)continue;
    const g=mergeGeometries(list,false);list.forEach(x=>x.dispose());
    if(!g)continue;
    const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=true;parent.add(m);
  }
  pilhas.clear();
}
function mesh(geo,mat,parent=farmGroup,sombra=true){
  const m=new THREE.Mesh(geo,mat);m.castShadow=sombra;m.receiveShadow=true;parent.add(m);return m;
}

// ===== COLISORES LIMPOS =====
function box(x,z,w,d,y0,y1,categoria){
  return registrarCaixa(new THREE.Box3(
    new THREE.Vector3(x-w/2,y0,z-d/2),
    new THREE.Vector3(x+w/2,y1,z+d/2)
  ),categoria);
}
function colisorPilar(x,z,y,w=.28,h=3,categoria='pilar-fazenda'){return box(x,z,w,w,y,y+h,categoria)}

// ===== TERRENO / COTA =====
function cotaMax(cx,cz,w,d){
  let max=-Infinity,min=Infinity;
  for(let ix=0;ix<=8;ix++)for(let iz=0;iz<=6;iz++){
    const x=cx-w/2+w*ix/8,z=cz-d/2+d*iz/6,h=obterElevacao(x,z);
    max=Math.max(max,h);min=Math.min(min,h);
  }
  return{max,min};
}
function pisoTransitavel(cx,cz,w,d,y){
  const m=mesh(new THREE.BoxGeometry(w,.16,d),MAT.piso,farmGroup,false);m.position.set(cx,y-.08,cz);
  superficiesAndaveis.push(m);return m;
}
function degrausFrente(cx,zFrente,yPiso,yTerreno,larg=3.2){
  const desn=Math.max(0,yPiso-yTerreno);if(desn<.12)return;
  const n=Math.max(2,Math.ceil(desn/.17)),prof=.34;
  for(let i=0;i<n;i++){
    const topo=yTerreno+desn*(i+1)/n,h=Math.max(.12,topo-yTerreno);
    const m=mesh(new THREE.BoxGeometry(larg,h,prof),MAT.pedra,farmGroup,false);
    m.position.set(cx,yTerreno+h/2,zFrente+(n-i-.5)*prof);
    superficiesAndaveis.push(m);
  }
}

// ===== PAREDES COM VÃOS =====
function paredeZ(cx,z,w,h,yBase,portaCx=null,portaW=0,portaH=0,mat=MAT.reboco){
  const t=FARM_METRICS.sede.parede;
  if(portaCx===null){geoCaixa(w,h,t,cx,yBase+h/2,z,0,mat);box(cx,z,w,t,yBase,yBase+h,'parede-sede');return}
  const esquerda=(portaCx-portaW/2)-(cx-w/2),direita=(cx+w/2)-(portaCx+portaW/2);
  if(esquerda>.02){const x=cx-w/2+esquerda/2;geoCaixa(esquerda,h,t,x,yBase+h/2,z,0,mat);box(x,z,esquerda,t,yBase,yBase+h,'parede-sede')}
  if(direita>.02){const x=portaCx+portaW/2+direita/2;geoCaixa(direita,h,t,x,yBase+h/2,z,0,mat);box(x,z,direita,t,yBase,yBase+h,'parede-sede')}
  const topo=h-portaH;if(topo>.02){geoCaixa(portaW,topo,t,portaCx,yBase+portaH+topo/2,z,0,mat);box(portaCx,z,portaW,t,yBase+portaH,yBase+h,'parede-sede')}
}
function paredeX(x,cz,d,h,yBase,portaCz=null,portaW=0,portaH=0,mat=MAT.reboco){
  const t=FARM_METRICS.sede.parede;
  if(portaCz===null){geoCaixa(t,h,d,x,yBase+h/2,cz,0,mat);box(x,cz,t,d,yBase,yBase+h,'parede-sede');return}
  const a=(portaCz-portaW/2)-(cz-d/2),b=(cz+d/2)-(portaCz+portaW/2);
  if(a>.02){const z=cz-d/2+a/2;geoCaixa(t,h,a,x,yBase+h/2,z,0,mat);box(x,z,t,a,yBase,yBase+h,'parede-sede')}
  if(b>.02){const z=portaCz+portaW/2+b/2;geoCaixa(t,h,b,x,yBase+h/2,z,0,mat);box(x,z,t,b,yBase,yBase+h,'parede-sede')}
  const topo=h-portaH;if(topo>.02){geoCaixa(t,topo,portaW,x,yBase+portaH+topo/2,portaCz,0,mat);box(x,portaCz,t,portaW,yBase+portaH,yBase+h,'parede-sede')}
}
function janelaZ(x,z,w,h,y){
  const m=mesh(new THREE.PlaneGeometry(w,h),MAT.vidro);m.position.set(x,y,z);return m;
}
function janelaX(x,z,w,h,y){
  const m=mesh(new THREE.PlaneGeometry(w,h),MAT.vidro);m.rotation.y=Math.PI/2;m.position.set(x,y,z);return m;
}

// ===== TELHADOS =====
function aguaTelhado(cx,cz,larg,prof,yBeiral,alturaCume,eixo='x'){
  const meia=larg/2,subida=alturaCume-yBeiral,ang=Math.atan2(subida,meia),comp=Math.hypot(meia,subida)+.55;
  for(const lado of[-1,1]){
    const g=eixo==='x'?new THREE.BoxGeometry(comp,.16,prof+.8):new THREE.BoxGeometry(prof+.8,.16,comp);
    const m=mesh(g,MAT.telha);
    if(eixo==='x'){
      m.position.set(cx+lado*Math.cos(ang)*comp/2,yBeiral+subida-Math.sin(ang)*comp/2,cz);
      m.rotation.z=-lado*ang;
    }else{
      m.position.set(cx,yBeiral+subida-Math.sin(ang)*comp/2,cz+lado*Math.cos(ang)*comp/2);
      m.rotation.x=lado*ang;
    }
  }
}

// ===== SEDE =====
function criarSede(){
  const S=FARM_METRICS.sede,cx=FAZENDA.sede.x,cz=FAZENDA.sede.z;
  const cot=cotaMax(cx,cz,S.larg+4,S.prof+4),y=cot.max+.14;
  FAZENDA.sede.y=y;

  // Fundação de pedra + piso.
  const altFund=Math.max(.35,y-cot.min+.18);
  geoCaixa(S.larg+1.1,altFund,S.prof+1.1,cx,y-altFund/2,cz,0,MAT.pedra);
  pisoTransitavel(cx,cz,S.larg-.44,S.prof-.44,y+.02);

  // Planta: porta principal frontal (sul) 1,20 m; porta de serviço leste 1,00 m; interior aberto.
  paredeZ(cx,cz-S.prof/2,S.larg,S.peDireito,y,cx-1.6,S.porta,S.portaAlt);
  paredeZ(cx,cz+S.prof/2,S.larg,S.peDireito,y,null);
  paredeX(cx-S.larg/2,cz,S.prof,S.peDireito,y,null);
  paredeX(cx+S.larg/2,cz,S.prof,S.peDireito,y,cz+2.0,1.0,S.portaAlt);

  // Paredes internas: quarto no fundo esquerdo com vão de 1 m.
  paredeX(cx-3.8,cz+2.15,3.5,S.peDireito,y,cz+1.3,1.0,S.portaAlt);
  paredeZ(cx-6.35,cz+.4,5.1,S.peDireito,y,cx-5.0,1.0,S.portaAlt);

  // Rodapé/pilastras de pedra.
  geoCaixa(S.larg,.72,.28,cx,y+.36,cz-S.prof/2-.03,0,MAT.pedra);
  for(const x of[cx-S.larg/2+.18,cx+S.larg/2-.18])for(const z of[cz-S.prof/2+.18,cz+S.prof/2-.18])
    geoCaixa(.48,S.peDireito+.18,.48,x,y+(S.peDireito+.18)/2,z,0,MAT.pedra);

  // Grandes panos de vidro, sem colisão.
  janelaZ(cx+3.1,cz-S.prof/2-.115,3.6,1.75,y+1.55);
  janelaZ(cx+6.5,cz-S.prof/2-.115,2.0,1.55,y+1.55);
  janelaX(cx-S.larg/2-.115,cz-1.6,2.4,1.55,y+1.55);

  // Porta visual aberta 35°, deixando o vão físico totalmente livre.
  const porta=new THREE.Group();porta.position.set(cx-2.2,y,cz-S.prof/2-.12);farmGroup.add(porta);
  const folha=mesh(new THREE.BoxGeometry(1.16,2.10,.07),MAT.madeiraEscura,porta);folha.position.set(.58,1.05,0);porta.rotation.y=-.61;

  // Varanda frontal e lateral direita.
  const vProf=S.varanda;
  const pisoV=mesh(new THREE.BoxGeometry(S.larg+1.4,.14,vProf),MAT.pedra,farmGroup,false);
  pisoV.position.set(cx,y-.01,cz-S.prof/2-vProf/2);superficiesAndaveis.push(pisoV);
  const pisoVL=mesh(new THREE.BoxGeometry(vProf,.14,S.prof+vProf),MAT.pedra,farmGroup,false);
  pisoVL.position.set(cx+S.larg/2+vProf/2,y-.01,cz-vProf/2);superficiesAndaveis.push(pisoVL);

  // Pilares robustos de madeira na varanda.
  const pilares=[];
  for(const x of[cx-S.larg/2+.8,cx-4.5,cx,cx+4.5,cx+S.larg/2-.8])pilares.push([x,cz-S.prof/2-vProf+.26]);
  for(const z of[cz-S.prof/2+.4,cz,cz+S.prof/2-.5])pilares.push([cx+S.larg/2+vProf-.28,z]);
  for(const[x,z]of pilares){geoCil(.12,2.72,x,y+1.36,z,MAT.madeira,10);colisorPilar(x,z,y,.28,2.75)}

  // Vigas aparentes sob beiral.
  for(const[x,z]of pilares)geoCaixa(.22,.26,1.65,x,y+2.64,z+.62,0,MAT.madeira);
  geoCaixa(S.larg+.8,.24,.22,cx,y+2.66,cz-S.prof/2-vProf+.25,0,MAT.madeira);

  // Telhado principal + ala frontal perpendicular, beirais longos.
  const beiralY=y+S.peDireito+.10,alturaCume=beiralY+2.05;
  aguaTelhado(cx,cz,S.larg+1.4,S.prof+1.2,beiralY,alturaCume,'x');
  aguaTelhado(cx-5.2,cz-S.prof/2+1.8,7.2,6.4,beiralY+.12,beiralY+1.65,'z');
  // Cobertura de varanda com caimento suave.
  const marq=mesh(new THREE.BoxGeometry(S.larg+1.7,.13,vProf+1.0),MAT.telha);
  marq.position.set(cx,y+2.55,cz-S.prof/2-vProf/2+.05);marq.rotation.x=-.12;
  const marq2=mesh(new THREE.BoxGeometry(vProf+1.0,.13,S.prof+vProf+.5),MAT.telha);
  marq2.position.set(cx+S.larg/2+vProf/2-.05,y+2.55,cz-.3);marq2.rotation.z=.12;

  // Claraboias/águas-furtadas na água da frente.
  for(const x of[cx-2.0,cx+.2,cx+2.4]){
    const q=mesh(new THREE.BoxGeometry(1.1,.10,1.55),MAT.metal);q.position.set(x,alturaCume-.74,cz-2.55);q.rotation.x=-.38;
    const v=mesh(new THREE.PlaneGeometry(.82,.72),MAT.vidro);v.position.set(x,alturaCume-.58,cz-3.18);v.rotation.x=-.38;
  }

  // Chaminé de pedra.
  geoCaixa(.95,2.25,.95,cx+4.7,alturaCume-.3,cz+1.0,0,MAT.pedra);
  geoCaixa(1.12,.16,1.12,cx+4.7,alturaCume+.86,cz+1.0,0,MAT.pedra);

  // ===== MOBILIÁRIO FUNCIONAL =====
  // Lareira: volume maciço e colisor.
  geoCaixa(2.0,2.45,.72,cx+5.8,y+1.225,cz+S.prof/2-.48,0,MAT.pedra);
  box(cx+5.8,cz+S.prof/2-.48,2.0,.72,y,y+2.45,'lareira');

  // Mesa 2.40 x 1.05, tampo a 0.75 m; circulação > 1 m ao redor.
  const mesaX=cx+1.2,mesaZ=cz+.3;
  geoCaixa(2.40,.07,1.05,mesaX,y+.715,mesaZ,0,MAT.madeira);
  for(const dx of[-1.02,1.02])for(const dz of[-.37,.37])geoCaixa(.11,.70,.11,mesaX+dx,y+.35,mesaZ+dz,0,MAT.madeira);
  box(mesaX,mesaZ,2.4,1.05,y,y+.78,'mesa-fazenda');

  // Cadeiras: assento 0.45 m, sem colisor para não prender circulação.
  const cadeiraPos=[];
  for(const x of[mesaX-.7,mesaX+.7])cadeiraPos.push([x,mesaZ-1.0,0],[x,mesaZ+1.0,Math.PI]);
  cadeiraPos.push([mesaX-1.65,mesaZ,Math.PI/2],[mesaX+1.65,mesaZ,-Math.PI/2]);
  for(const[x,z,r]of cadeiraPos){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=r;farmGroup.add(g);
    const ass=mesh(new THREE.BoxGeometry(.46,.07,.46),MAT.madeira,g);ass.position.y=.45;
    for(const dx of[-.18,.18])for(const dz of[-.18,.18]){const p=mesh(new THREE.BoxGeometry(.055,.43,.055),MAT.madeira,g);p.position.set(dx,.215,dz)}
    const enc=mesh(new THREE.BoxGeometry(.46,.43,.055),MAT.madeira,g);enc.position.set(0,.665,.20);
  }

  // Cozinha: bancada a 0.90 m.
  geoCaixa(4.2,.90,.65,cx-1.2,y+.45,cz+S.prof/2-.55,0,MAT.madeiraEscura);
  geoCaixa(4.25,.06,.72,cx-1.2,y+.93,cz+S.prof/2-.55,0,MAT.pedra);
  box(cx-1.2,cz+S.prof/2-.55,4.2,.65,y,y+.95,'bancada');

  // Cama rústica no quarto: topo do colchão a 0.50 m.
  geoCaixa(2.05,.26,1.65,cx-6.0,y+.18,cz+2.7,0,MAT.madeira);
  geoCaixa(1.95,.24,1.55,cx-6.0,y+.43,cz+2.7,0,MAT.tecidoClaro);
  box(cx-6.0,cz+2.7,2.05,1.65,y,y+.55,'cama');

  // Tapete puramente visual.
  const tap=mesh(new THREE.PlaneGeometry(3.2,2.2),MAT.tecido,farmGroup,false);tap.rotation.x=-Math.PI/2;tap.position.set(cx+1.2,y+.035,cz+.3);

  // Degraus da frente.
  const terrenoFrente=obterElevacao(cx-1.6,cz-S.prof/2-vProf-1.2);
  degrausFrente(cx-1.6,cz-S.prof/2-vProf-.45,y,terrenoFrente,3.4);
}

// ===== GALPÃO / CURRAL =====
const instancias=[];
function instancedBox(w,h,d,mat,transforms,parent=farmGroup,cast=true){
  const geo=new THREE.BoxGeometry(w,h,d),im=new THREE.InstancedMesh(geo,mat,transforms.length),o=new THREE.Object3D();
  transforms.forEach((t,i)=>{o.position.set(t.x,t.y,t.z);o.rotation.set(t.rx||0,t.ry||0,t.rz||0);o.scale.set(t.sx||1,t.sy||1,t.sz||1);o.updateMatrix();im.setMatrixAt(i,o.matrix)});
  im.instanceMatrix.needsUpdate=true;im.castShadow=cast;im.receiveShadow=true;parent.add(im);instancias.push(im);return im;
}
function criarGalpao(){
  const G=FARM_METRICS.galpao,cx=FAZENDA.celeiro.x,cz=FAZENDA.celeiro.z,cot=cotaMax(cx,cz,G.larg+2,G.prof+2);
  const y=cot.max+.08;FAZENDA.celeiro.y=y;
  // Piso central de terra/cascalho, aberto.
  const piso=mesh(new THREE.BoxGeometry(G.larg,.10,G.prof),MAT.terra,farmGroup,false);piso.position.set(cx,y-.05,cz);superficiesAndaveis.push(piso);

  // Pilares estruturais InstancedMesh, 2.80 m nas laterais.
  const pts=[];
  for(const z of[cz-G.prof/2,cz,cz+G.prof/2])for(const x of[cx-G.larg/2,cx+G.larg/2])pts.push({x,y:y+G.lateral/2,z});
  for(const z of[cz-G.prof/2,cz+G.prof/2])for(const x of[cx-G.larg*.22,cx+G.larg*.22])pts.push({x,y:y+3.0/2,z});
  instancedBox(.28,G.lateral,.28,MAT.madeiraInst,pts);
  for(const p of pts)colisorPilar(p.x,p.z,y,.30,G.lateral,'pilar-galpao');

  // Tesouras expostas.
  const madeira=MAT.madeiraEscura;
  for(const z of[cz-G.prof/2,cz,cz+G.prof/2]){
    geoCaixa(G.larg,.22,.20,cx,y+G.lateral,z,0,madeira);
    const meia=G.larg/2,sub=G.cumeeira-G.lateral,ang=Math.atan2(sub,meia),comp=Math.hypot(meia,sub);
    for(const lado of[-1,1]){
      const g=new THREE.BoxGeometry(comp,.18,.18),m=mesh(g,madeira);
      m.position.set(cx+lado*Math.cos(ang)*comp/2,y+G.cumeeira-Math.sin(ang)*comp/2,z);m.rotation.z=-lado*ang;
    }
  }
  // Telhado 2 águas.
  aguaTelhado(cx,cz,G.larg+.9,G.prof+.9,y+G.lateral,G.cumeeira,'x');

  // Fechamento de empena em tábuas verticais só no fundo; frente permanece aberta.
  const tabuas=[];
  for(let x=cx-G.larg/2+.18;x<=cx+G.larg/2-.18;x+=.32)tabuas.push({x,y:y+G.lateral/2,z:cz+G.prof/2-.08});
  instancedBox(.24,G.lateral,.10,MAT.madeiraInst,tabuas,false);

  // Baias laterais: tábuas horizontais com vãos, InstancedMesh.
  const ripas=[];
  const lados=[cx-G.larg/2+1.65,cx+G.larg/2-1.65];
  for(const bx of lados){
    for(const z of[cz-G.prof/2+.8,cz-1.2,cz+2.4])for(const h of[.48,.88,1.28])
      ripas.push({x:bx,y:y+h,z,ry:0,sx:1,sy:1,sz:1});
  }
  // Cada ripa nasce 3.0 m comprida no eixo Z.
  instancedBox(.12,.13,3.0,MAT.madeiraInst,ripas,false);

  // Bancada de oficina a 0.90 m no fundo esquerdo.
  geoCaixa(3.2,.12,.72,cx-3.7,y+.90,cz+G.prof/2-.65,0,MAT.madeira);
  for(const x of[cx-5.0,cx-2.4])geoCaixa(.12,.88,.12,x,y+.44,cz+G.prof/2-.65,0,MAT.madeira);
  box(cx-3.7,cz+G.prof/2-.65,3.2,.72,y,y+.96,'bancada-galpao');

  // Painel de ferramentas visual.
  geoCaixa(3.0,1.1,.08,cx-3.7,y+1.85,cz+G.prof/2-.20,0,MAT.madeiraEscura);
  for(let i=0;i<7;i++)geoCaixa(.05,.46,.05,cx-4.8+i*.36,y+1.85,cz+G.prof/2-.14,0,MAT.metal);

  // Fardos de feno instanciados nos cantos.
  const fenos=[
    {x:cx+4.8,y:y+.32,z:cz+3.5},{x:cx+5.55,y:y+.32,z:cz+3.5},{x:cx+5.15,y:y+.90,z:cz+3.5},
    {x:cx-5.0,y:y+.32,z:cz-3.6},{x:cx-4.25,y:y+.32,z:cz-3.6}
  ];
  instancedBox(.70,.55,1.05,MAT.palha,fenos,false);
}

// ===== CERCA EXTERNA E PORTEIRA =====
export const porteiraFazenda={
  x:FAZENDA.cx+FAZENDA.meiaLarg,z:FAZENDA.cz,aberta:true,raio:4.2,
  pivos:[],angulo:Math.PI*.5,alvo:Math.PI*.5,caixa:null,fechada:null,colisorAtivo:false
};
const PORTEIRA_ABERTA=Math.PI*.50,VEL_PORTEIRA=.62;
function criarCercaEEntrada(){
  const minX=FAZENDA.cx-FAZENDA.meiaLarg,maxX=FAZENDA.cx+FAZENDA.meiaLarg,minZ=FAZENDA.cz-FAZENDA.meiaProf,maxZ=FAZENDA.cz+FAZENDA.meiaProf;
  const gateHalf=2.1;
  const segmentos=[
    [minX,minZ,maxX,minZ],[maxX,minZ,maxX,FAZENDA.cz-gateHalf],
    [maxX,FAZENDA.cz+gateHalf,maxX,maxZ],[maxX,maxZ,minX,maxZ],[minX,maxZ,minX,minZ]
  ];
  const posts=[],rails=[];
  for(const[a,z0,b,z1]of segmentos){
    const len=Math.hypot(b-a,z1-z0),n=Math.max(1,Math.ceil(len/2.5));
    let px=a,pz=z0;
    for(let i=0;i<=n;i++){
      const t=i/n,x=a+(b-a)*t,z=z0+(z1-z0)*t,y=obterElevacao(x,z);
      posts.push({x,y:y+.68,z});
      if(i>0){
        const mx=(px+x)/2,mz=(pz+z)/2,l=Math.hypot(x-px,z-pz),ry=Math.atan2(x-px,z-pz);
        for(const h of[.42,.82,1.18])rails.push({x:mx,y:obterElevacao(mx,mz)+h,z:mz,ry,sx:1,sy:1,sz:l/2.5});
      }
      px=x;pz=z;
    }
    const yA=obterElevacao(a,z0),yB=obterElevacao(b,z1);
    box((a+b)/2,(z0+z1)/2,Math.abs(b-a)+.18,Math.abs(z1-z0)+.18,Math.min(yA,yB)-.4,Math.max(yA,yB)+1.3,'cerca-fazenda');
  }
  instancedBox(.16,1.35,.16,MAT.madeiraInst,posts);
  instancedBox(.12,.12,2.5,MAT.madeiraInst,rails,false);

  // Porteira dupla alinhada ao lado leste, fechando completamente o perímetro.
  const y=obterElevacao(porteiraFazenda.x,porteiraFazenda.z),folha=gateHalf;
  for(const lado of[-1,1]){
    const p=new THREE.Group();p.position.set(porteiraFazenda.x,y,porteiraFazenda.z+lado*gateHalf);farmGroup.add(p);
    const g=new THREE.Group();g.position.z=-lado*folha/2;p.add(g);
    for(const h of[.38,.76,1.14]){const m=mesh(new THREE.BoxGeometry(.10,.12,folha),MAT.madeiraInst,g);m.position.y=h}
    for(const z of[-folha/2+.07,folha/2-.07]){const m=mesh(new THREE.BoxGeometry(.12,1.30,.12),MAT.madeiraInst,g);m.position.set(0,.65,z)}
    porteiraFazenda.pivos.push({pivo:p,lado});
  }
  porteiraFazenda.fechada=new THREE.Box3(
    new THREE.Vector3(porteiraFazenda.x-.18,y-.35,porteiraFazenda.z-gateHalf),
    new THREE.Vector3(porteiraFazenda.x+.18,y+1.35,porteiraFazenda.z+gateHalf)
  );
  porteiraFazenda.caixa=marcarObstaculoMovel(registrarCaixa(new THREE.Box3(),'porteira-fazenda'));
  aplicarPorteira(true);
}
function aplicarPorteira(imediata=false){
  if(imediata)porteiraFazenda.angulo=porteiraFazenda.aberta?PORTEIRA_ABERTA:0;
  for(const q of porteiraFazenda.pivos)q.pivo.rotation.y=q.lado*porteiraFazenda.angulo;
  const liberar=porteiraFazenda.angulo>PORTEIRA_ABERTA*.64;
  if(liberar){porteiraFazenda.caixa.makeEmpty();porteiraFazenda.colisorAtivo=false}
  else{porteiraFazenda.caixa.copy(porteiraFazenda.fechada);porteiraFazenda.colisorAtivo=true}
}
export function alternarPorteira(){porteiraFazenda.aberta=!porteiraFazenda.aberta;porteiraFazenda.alvo=porteiraFazenda.aberta?PORTEIRA_ABERTA:0;return porteiraFazenda.aberta}
export function pertoDaPorteira(pos){return Math.hypot(pos.x-porteiraFazenda.x,pos.z-porteiraFazenda.z)<porteiraFazenda.raio}
export function atualizarFazenda(dt){
  const alvo=porteiraFazenda.aberta?PORTEIRA_ABERTA:0,delta=alvo-porteiraFazenda.angulo;
  if(Math.abs(delta)>.001)porteiraFazenda.angulo+=Math.sign(delta)*Math.min(Math.abs(delta),VEL_PORTEIRA*dt);
  aplicarPorteira(false);
}

// ===== MONTAGEM =====
criarSede();
criarGalpao();
criarCercaEEntrada();
finalizarFundidos();

console.info('[farm] sede=%dx%d m pe-direito=%.2f m | galpao=%dx%d m cumeeira=%.2f m',
  FARM_METRICS.sede.larg,FARM_METRICS.sede.prof,FARM_METRICS.sede.peDireito,
  FARM_METRICS.galpao.larg,FARM_METRICS.galpao.prof,FARM_METRICS.galpao.cumeeira);
