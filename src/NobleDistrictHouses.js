// ===== JARDINS DO MORRO — CASAS EM LOTES VALIDADOS =====
// As residencias so existem depois que o lote passa por: corredor viario, protecao da CJ,
// sobreposicao com outros lotes, desnivel do terreno e diferenca de cota ate a rua.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa,superficiesAndaveis}from'./Physics.js';
import{matConcreto,matMadeira}from'./Materials.js';
import{vias,corredorTotal,pontoEmCorredorViario,alturaPerfil}from'./NobleDistrictPlan.js';

const grupo=new THREE.Group();grupo.name='bairro-nobre-casas-validadas';scene.add(grupo);
const avenida=vias[0];
const LOTE_W=6.4,LOTE_D=5.6,MARGEM_LOTES=.45;

// Estes cinco pontos foram medidos contra a planta atual. Mesmo assim sao validados novamente em
// runtime: se a via mudar no futuro, uma casa invalida simplesmente deixa de nascer.
const CANDIDATOS=[
  {via:avenida,u:.04,lado:-1,extra:2.0},
  {via:avenida,u:.04,lado: 1,extra:3.5},
  {via:avenida,u:.21333333333333332,lado:1,extra:2.0},
  {via:avenida,u:.32888888888888884,lado:1,extra:2.0},
  {via:avenida,u:.6177777777777778,lado:-1,extra:2.0},
];

function mundoLocal(lote,lx,lz){
  const c=Math.cos(lote.giro),s=Math.sin(lote.giro);
  return{x:lote.cx+lx*c+lz*s,z:lote.cz-lx*s+lz*c};
}
function amostrarLote(lote,n=5){
  let min=Infinity,max=-Infinity;
  for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){
    const lx=-lote.w/2+lote.w*ix/(n-1),lz=-lote.d/2+lote.d*iz/(n-1),p=mundoLocal(lote,lx,lz),h=obterElevacao(p.x,p.z);
    min=Math.min(min,h);max=Math.max(max,h);
  }
  return{min,max};
}
function loteForaDosCorredores(lote){
  // Grade densa 7x7, nao apenas os quatro cantos. Isso pega uma curva de rua atravessando o meio.
  for(let ix=0;ix<7;ix++)for(let iz=0;iz<7;iz++){
    const lx=-lote.w/2+lote.w*ix/6,lz=-lote.d/2+lote.d*iz/6,p=mundoLocal(lote,lx,lz);
    if(pontoEmCorredorViario(p.x,p.z,.30))return false;
  }
  return true;
}
function cantos(lote,m=MARGEM_LOTES){
  const w=lote.w+2*m,d=lote.d+2*m;
  return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>mundoLocal(lote,x,z));
}
function proj(pts,ax,az){let min=Infinity,max=-Infinity;for(const p of pts){const v=p.x*ax+p.z*az;min=Math.min(min,v);max=Math.max(max,v)}return{min,max}}
function sobrepoe(a,b){
  const A=cantos(a),B=cantos(b);
  for(const P of[A,B])for(let i=0;i<4;i++){
    const p=P[i],q=P[(i+1)%4],ex=q.x-p.x,ez=q.z-p.z,len=Math.hypot(ex,ez)||1,ax=-ez/len,az=ex/len;
    const pa=proj(A,ax,az),pb=proj(B,ax,az);if(pa.max<pb.min||pb.max<pa.min)return false;
  }
  return true;
}
function candidatoParaLote(c){
  const p=c.via.curva.getPointAt(c.u),t=c.via.curva.getTangentAt(c.u).normalize();
  const nx=-t.z*c.lado,nz=t.x*c.lado;
  const dist=corredorTotal(c.via)+LOTE_D/2+c.extra;
  const cx=p.x+nx*dist,cz=p.z+nz*dist,giro=Math.atan2(-nx,-nz);
  const lote={cx,cz,giro,w:LOTE_W,d:LOTE_D,via:c.via,u:c.u,p,t,nx,nz};
  const h=amostrarLote(lote,5);lote.min=h.min;lote.max=h.max;lote.cota=h.max+.08;lote.desnivel=h.max-h.min;
  lote.ruaY=alturaPerfil(c.via,c.u)+.035;lote.acesso=lote.cota-lote.ruaY;
  return lote;
}

const lotes=[];
for(const c of CANDIDATOS){
  const lote=candidatoParaLote(c);
  if(!loteForaDosCorredores(lote))continue;
  if(lote.desnivel>2.9)continue;
  // Garagem nao pode nascer varios metros acima ou abaixo da rua.
  if(Math.abs(lote.acesso)>1.10)continue;
  if(lotes.some(o=>sobrepoe(lote,o)))continue;
  lotes.push(lote);
}

// ===== RENDER EM LOTES: PECAS REPETIDAS SAO INSTANCIADAS =====
const box=new THREE.BoxGeometry(1,1,1),painelGeo=new THREE.BoxGeometry(1,1,.045),copaGeo=new THREE.DodecahedronGeometry(1,1),troncoGeo=new THREE.CylinderGeometry(.07,.10,1,7);
const branco=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.78,metalness:0});
const acentoMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.72,metalness:0});
const concreto=matConcreto();
const escuro=new THREE.MeshStandardMaterial({color:0x303537,roughness:.46,metalness:.62});
const vidro=new THREE.MeshStandardMaterial({color:0x6fa2ad,roughness:.10,metalness:.10,transparent:true,opacity:.50,depthWrite:false});
const madeira=matMadeira(0x69492f);
const grama=new THREE.MeshStandardMaterial({color:0x557348,roughness:1,metalness:0});
const solar=new THREE.MeshStandardMaterial({color:0x17262b,roughness:.18,metalness:.55});
const folha=new THREE.MeshStandardMaterial({color:0x4f7046,roughness:1,flatShading:true});
const batches={
  parede:{geo:box,mat:branco,it:[]},acento:{geo:box,mat:acentoMat,it:[]},concreto:{geo:box,mat:concreto,it:[]},
  metal:{geo:box,mat:escuro,it:[]},vidro:{geo:painelGeo,mat:vidro,it:[]},madeira:{geo:box,mat:madeira,it:[]},
  grama:{geo:box,mat:grama,it:[]},solar:{geo:box,mat:solar,it:[]},copa:{geo:copaGeo,mat:folha,it:[]},tronco:{geo:troncoGeo,mat:madeira,it:[]}
};
const eixoY=new THREE.Vector3(0,1,0),tmpColor=new THREE.Color();
function item(tipo,lote,lx,ly,lz,sx,sy,sz,cor=null,giroExtra=0){
  const p=mundoLocal(lote,lx,lz),q=new THREE.Quaternion().setFromAxisAngle(eixoY,lote.giro+giroExtra);
  batches[tipo].it.push({p:new THREE.Vector3(p.x,lote.cota+ly,p.z),q,s:new THREE.Vector3(sx,sy,sz),cor});
}
function finalizar(tipo,sombra=true){
  const b=batches[tipo];if(!b.it.length)return;
  const inst=new THREE.InstancedMesh(b.geo,b.mat,b.it.length),m=new THREE.Matrix4();
  inst.name=`bairro-nobre-${tipo}`;inst.castShadow=sombra;inst.receiveShadow=true;
  for(let i=0;i<b.it.length;i++){
    const a=b.it[i];m.compose(a.p,a.q,a.s);inst.setMatrixAt(i,m);if(a.cor!==null)inst.setColorAt(i,tmpColor.setHex(a.cor));
  }
  inst.instanceMatrix.needsUpdate=true;if(inst.instanceColor)inst.instanceColor.needsUpdate=true;grupo.add(inst);
}
function registrarCasa(lote,w,d,h){
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const lx of[-w/2,w/2])for(const lz of[-d/2,d/2]){const p=mundoLocal(lote,lx,lz);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)}
  registrarCaixa(new THREE.Box3(new THREE.Vector3(minX,lote.cota-.2,minZ),new THREE.Vector3(maxX,lote.cota+h+.45,maxZ)),'casa-bairro-nobre');
}
function rampaGaragem(lote){
  const frente=mundoLocal(lote,-1.05,lote.d/2-.03);
  const borda={x:lote.p.x+lote.nx*(lote.via.largura/2+.18),z:lote.p.z+lote.nz*(lote.via.largura/2+.18)};
  const tx=lote.t.x,tz=lote.t.z,meia=1.12;
  const verts=[
    frente.x-tx*meia,lote.cota+.045,frente.z-tz*meia,
    frente.x+tx*meia,lote.cota+.045,frente.z+tz*meia,
    borda.x+tx*meia,lote.ruaY+.055,borda.z+tz*meia,
    borda.x-tx*meia,lote.ruaY+.055,borda.z-tz*meia
  ];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex([0,1,3,1,2,3]);g.computeVertexNormals();
  const m=new THREE.Mesh(g,concreto);m.name='acesso-garagem-nobre';m.receiveShadow=true;grupo.add(m);superficiesAndaveis.push(m);
}

const cores=[0xeee9df,0xe2e4df,0xefe8db,0xdadfdc,0xeee6dc];
const acentos=[0x6b5a4d,0x57646a,0x8a715d,0x4f6258,0x786257];
for(let i=0;i<lotes.length;i++){
  const l=lotes[i],dois=i!==2,baseH=Math.max(.25,l.cota-l.min+.12),w=5.25+(i%2)*.18,d=3.72;
  // Terraco nivelado: cobre o lote inteiro e transforma o corte/aterro em muro de arrimo legivel.
  item('concreto',l,0,-baseH/2,0,l.w,baseH,l.d);
  item('grama',l,.65,.035,.22,l.w-1.55,.055,l.d-.42);
  // Entrada da garagem em piso duro.
  item('concreto',l,-1.05,.065,1.62,2.28,.09,2.25);
  const h1=2.55,h2=dois?2.22:0,H=h1+h2;
  item('parede',l,0,h1/2,-.34,w,h1,d,cores[i%cores.length]);
  if(dois)item('parede',l,.46,h1+h2/2,-.48,w*.70,h2,d*.82,cores[(i+1)%cores.length]);
  // Volume vertical de pedra/reboco escuro.
  item('acento',l,w/2-.64,H/2,-.30,.72,H+.16,d+.08,acentos[i%acentos.length]);
  // Portao, porta e janelas frontais.
  item('metal',l,-1.05,.86,d/2-.30,2.20,1.70,.07);
  item('madeira',l,1.35,.98,d/2-.295,.66,1.96,.075);
  item('vidro',l,1.34,1.55,d/2-.245,.78,.76,1);
  if(dois){
    item('vidro',l,.35,h1+1.13,d*.41,1.72,.92,1);
    item('concreto',l,.35,h1+.06,d/2+.03,2.12,.10,.76);
    item('vidro',l,.35,h1+.43,d/2+.43,2.02,.58,1);
  }else item('vidro',l,.78,1.46,d/2-.245,1.18,.88,1);
  // Platibanda e dois paineis solares em casas alternadas.
  item('concreto',l,0,H+.09,-.34,w+.18,.18,d+.18);
  if(i%2===0){item('solar',l,-.67,H+.25,-.40,1.10,.05,.66);item('solar',l,.67,H+.25,-.40,1.10,.05,.66)}
  // Muro frontal baixo deixa fachada visivel, sem virar fortaleza.
  item('parede',l,-2.30,.42,l.d/2-.05,1.10,.84,.12,cores[i%cores.length]);
  item('parede',l,2.12,.42,l.d/2-.05,1.38,.84,.12,cores[i%cores.length]);
  item('metal',l,-.45,.40,l.d/2,2.50,.78,.055);
  // Paisagismo: duas arvores pequenas e macicos verdes na frente.
  for(const sx of[-2.18,2.20]){
    item('tronco',l,sx,.60,1.75,1,1.18,1);
    item('copa',l,sx,1.48,1.75,.44,.58,.44);
  }
  registrarCasa(l,w,d,H);rampaGaragem(l);
}
for(const k of Object.keys(batches))finalizar(k,k!=='vidro'&&k!=='solar');

console.info('[bairro-nobre-casas] candidatos=%d aprovados=%d | todos fora da via e com acesso validado',CANDIDATOS.length,lotes.length);
export{lotes as lotesNobres};
