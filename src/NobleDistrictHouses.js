// ===== JARDINS DO MORRO — CASAS EM LOTES VALIDADOS =====
// O bairro nasce depois das ruas. Cada lote e testado contra TODOS os corredores, a CJ,
// os outros lotes e o relevo. Nao existe mais rampa longa de garagem nem platô do lote inteiro.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa}from'./Physics.js';
import{matConcreto,matMadeira}from'./Materials.js';
import{vias,corredorTotal,pontoEmCorredorViario}from'./NobleDistrictPlan.js';
import{levanteContraQuina,PASSO_DA_FITA}from'./Favela.js';

const grupo=new THREE.Group();grupo.name='bairro-nobre-casas-validadas';scene.add(grupo);
const LOTE_W=6.15,LOTE_D=5.25,MARGEM_LOTES=.38,MAX_CASAS=14;

// Muitos candidatos, poucos aceitos. A ordem intercala avenida e alamedas para o bairro nao ficar
// todo concentrado numa rua. A geracao e deterministica: o mapa nao muda a cada carregamento.
const CANDIDATOS=[];
const US=[.11,.19,.27,.35,.43,.51,.59,.67,.75,.83,.89];
for(let k=0;k<US.length;k++)for(let vi=0;vi<vias.length;vi++)for(const lado of[-1,1]){
  const u=US[k];
  if(vi===0&&u>.87)continue;// deixa a emenda com a favela completamente livre
  CANDIDATOS.push({via:vias[vi],u,lado,extra:.46+((k+vi+(lado>0?1:0))%3)*.12});
}

function mundoLocal(lote,lx,lz){
  const c=Math.cos(lote.giro),s=Math.sin(lote.giro);
  return{x:lote.cx+lx*c+lz*s,z:lote.cz-lx*s+lz*c};
}
function amostrarRetangulo(lote,w=lote.w,d=lote.d,n=5){
  let min=Infinity,max=-Infinity;
  for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){
    const lx=-w/2+w*ix/(n-1),lz=-d/2+d*iz/(n-1),p=mundoLocal(lote,lx,lz),h=obterElevacao(p.x,p.z);
    min=Math.min(min,h);max=Math.max(max,h);
  }
  return{min,max};
}
function cotaDaFrente(lote){
  // A casa se assenta pela frente/soleira, igual a logica madura das casas do morro.
  // Isso evita levantar a casa inteira porque o fundo do lote sobe alguns metros.
  let cota=-Infinity;
  for(let i=0;i<7;i++)for(const recuo of[0,.42]){
    const lx=-lote.w/2+lote.w*i/6,lz=lote.d/2-recuo,p=mundoLocal(lote,lx,lz);
    cota=Math.max(cota,obterElevacao(p.x,p.z));
  }
  return cota+.055;
}
function loteForaDosCorredores(lote){
  // Grade 7x7: pega inclusive uma curva atravessando o meio do lote.
  for(let ix=0;ix<7;ix++)for(let iz=0;iz<7;iz++){
    const lx=-lote.w/2+lote.w*ix/6,lz=-lote.d/2+lote.d*iz/6,p=mundoLocal(lote,lx,lz);
    if(pontoEmCorredorViario(p.x,p.z,.20))return false;
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
  const h=amostrarRetangulo(lote,LOTE_W,LOTE_D,5);lote.min=h.min;lote.max=h.max;lote.desnivel=h.max-h.min;
  lote.cota=cotaDaFrente(lote);
  // A referencia de acesso e a MESMA superficie de asfalto usada pela favela, na beira da pista.
  const bx=p.x+nx*(c.via.largura/2),bz=p.z+nz*(c.via.largura/2);
  lote.ruaY=levanteContraQuina(bx,bz,PASSO_DA_FITA)+.002;
  lote.acesso=lote.cota-lote.ruaY;
  return lote;
}

const lotes=[];const rejeitados={corredor:0,desnivel:0,acesso:0,sobreposicao:0};
for(const c of CANDIDATOS){
  if(lotes.length>=MAX_CASAS)break;
  const lote=candidatoParaLote(c);
  if(!loteForaDosCorredores(lote)){rejeitados.corredor++;continue}
  if(lote.desnivel>3.45){rejeitados.desnivel++;continue}
  // Sem ponte/rampa artificial: aceita apenas terreno em que a frente da casa ainda conversa com a rua.
  if(Math.abs(lote.acesso)>1.85){rejeitados.acesso++;continue}
  if(lotes.some(o=>sobrepoe(lote,o))){rejeitados.sobreposicao++;continue}
  lotes.push(lote);
}

// ===== RENDER LEVE: PECAS REPETIDAS INSTANCIADAS =====
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
function registrarCasa(lote,w,d,h,fundacao){
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const lx of[-w/2,w/2])for(const lz of[-d/2,d/2]){const p=mundoLocal(lote,lx,lz);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)}
  registrarCaixa(new THREE.Box3(new THREE.Vector3(minX,lote.cota-fundacao-.05,minZ),new THREE.Vector3(maxX,lote.cota+h+.45,maxZ)),'casa-bairro-nobre');
}

const cores=[0xeee9df,0xe2e4df,0xefe8db,0xdadfdc,0xeee6dc,0xe7e2d8];
const acentos=[0x6b5a4d,0x57646a,0x8a715d,0x4f6258,0x786257,0x59606a];
for(let i=0;i<lotes.length;i++){
  const l=lotes[i],dois=(i%4)!==2,w=5.12+(i%3)*.16,d=3.62+(i%2)*.10;
  const terrenoCasa=amostrarRetangulo(l,w+.28,d+.28,5);
  const fundacao=Math.max(.22,l.cota-terrenoCasa.min+.16);
  // FUNDACAO SOMENTE SOB A CASA. O bloco antigo cobria o lote inteiro e parecia uma plataforma/rampa.
  item('concreto',l,0,-fundacao/2,-.28,w+.30,fundacao,d+.30);
  // Pequeno piso de garagem dentro do proprio lote; nao cruza terreno ate a rua.
  item('concreto',l,-1.02,.045,1.55,2.18,.07,1.18);
  // Jardim pequeno na cota da frente, sem tapar a encosta inteira.
  item('grama',l,1.34,.028,1.50,2.05,.045,1.22);

  const h1=2.55,h2=dois?2.22:0,H=h1+h2;
  item('parede',l,0,h1/2,-.28,w,h1,d,cores[i%cores.length]);
  if(dois)item('parede',l,.42,h1+h2/2,-.42,w*.70,h2,d*.82,cores[(i+1)%cores.length]);
  item('acento',l,w/2-.61,H/2,-.25,.68,H+.16,d+.08,acentos[i%acentos.length]);

  // Portao, porta e vidro — variacoes pequenas evitam fileira clonada.
  item('metal',l,-1.02,.86,d/2-.29,2.12,1.70,.07);
  item('madeira',l,1.30,.98,d/2-.285,.66,1.96,.075);
  item('vidro',l,1.29,1.55,d/2-.24,.78,.76,0xffffff);
  if(dois){
    item('vidro',l,.32,h1+1.13,d*.41,1.66,.92,0xffffff);
    item('concreto',l,.32,h1+.06,d/2+.03,2.04,.10,.72);
    item('vidro',l,.32,h1+.43,d/2+.41,1.94,.58,0xffffff);
  }else item('vidro',l,.74,1.46,d/2-.24,1.12,.88,0xffffff);

  item('concreto',l,0,H+.09,-.28,w+.18,.18,d+.18);
  if(i%3!==1){item('solar',l,-.63,H+.25,-.34,1.02,.05,.62);item('solar',l,.63,H+.25,-.34,1.02,.05,.62)}

  // Muros baixos respeitam a frente do lote e deixam a arquitetura visivel.
  item('parede',l,-2.24,.39,l.d/2-.06,1.00,.78,.12,cores[i%cores.length]);
  item('parede',l,2.08,.39,l.d/2-.06,1.20,.78,.12,cores[i%cores.length]);
  item('metal',l,-.42,.37,l.d/2,2.44,.72,.055);

  // Uma arvore por lote, alternando o lado. Ela apoia no terreno real, nao na plataforma da casa.
  const ax=(i%2?-2.05:2.05),az=1.70,ap=mundoLocal(l,ax,az),ay=obterElevacao(ap.x,ap.z)-l.cota;
  item('tronco',l,ax,ay+.58,az,1,1.15,1);
  item('copa',l,ax,ay+1.45,az,.43,.56,.43);

  registrarCasa(l,w,d,H,fundacao);
}
for(const k of Object.keys(batches))finalizar(k,k!=='vidro'&&k!=='solar');

console.info('[bairro-nobre-casas] candidatos=%d aprovados=%d/%d | rejeitados=%o | rampas=0',CANDIDATOS.length,lotes.length,MAX_CASAS,rejeitados);
export{lotes as lotesNobres};