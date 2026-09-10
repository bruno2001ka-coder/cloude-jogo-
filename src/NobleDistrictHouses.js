// ===== JARDINS DO MORRO — CASAS DENSAS E VARIADAS / 5 QUARTEIROES =====
// Regra: ruas primeiro. Casas tentam posicoes previsiveis por quarteirao e, se necessario,
// afastam-se da via ate encontrar lote livre. Vegetacao publica nunca nasce aqui.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa}from'./Physics.js';
import{matConcreto,matMadeira}from'./Materials.js';
import{vias,corredorTotal,pontoEmCorredorViario,QUARTEIROES}from'./NobleDistrictPlan.js';

const grupo=new THREE.Group();grupo.name='bairro-nobre-casas';scene.add(grupo);
const LOTE_W=4.80,LOTE_D=4.35,MARGEM=.28,MAX_CASAS=36;

function mundoLocal(l,lx,lz){const c=Math.cos(l.giro),s=Math.sin(l.giro);return{x:l.cx+lx*c+lz*s,z:l.cz-lx*s+lz*c}}
function amostrar(l,w=l.w,d=l.d,n=5){let min=Infinity,max=-Infinity;for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){const p=mundoLocal(l,-w/2+w*ix/(n-1),-d/2+d*iz/(n-1)),h=obterElevacao(p.x,p.z);min=Math.min(min,h);max=Math.max(max,h)}return{min,max}}
function cotaFrente(l){let soma=0,n=0;for(let i=0;i<7;i++){const p=mundoLocal(l,-l.w/2+l.w*i/6,l.d/2-.16),h=obterElevacao(p.x,p.z);soma+=h;n++}return soma/n+.08}
function foraDasRuas(l){for(let ix=0;ix<7;ix++)for(let iz=0;iz<7;iz++){const p=mundoLocal(l,-l.w/2+l.w*ix/6,-l.d/2+l.d*iz/6);if(pontoEmCorredorViario(p.x,p.z,.05))return false}return true}
function cantos(l,m=MARGEM){const w=l.w+2*m,d=l.d+2*m;return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>mundoLocal(l,x,z))}
function proj(P,ax,az){let min=Infinity,max=-Infinity;for(const p of P){const v=p.x*ax+p.z*az;min=Math.min(min,v);max=Math.max(max,v)}return{min,max}}
function sobrepoe(a,b){const A=cantos(a),B=cantos(b);for(const P of[A,B])for(let i=0;i<4;i++){const p=P[i],q=P[(i+1)%4],ex=q.x-p.x,ez=q.z-p.z,len=Math.hypot(ex,ez)||1,ax=-ez/len,az=ex/len,pa=proj(A,ax,az),pb=proj(B,ax,az);if(pa.max<pb.min||pb.max<pa.min)return false}return true}
function loteDe(c,extra){const p=c.via.curva.getPointAt(c.u),t=c.via.curva.getTangentAt(c.u).normalize(),nx=-t.z*c.lado,nz=t.x*c.lado;const dist=corredorTotal(c.via)+LOTE_D/2+extra;const l={cx:p.x+nx*dist,cz:p.z+nz*dist,giro:Math.atan2(-nx,-nz),w:LOTE_W,d:LOTE_D,via:c.via,u:c.u,bloco:c.bloco,lado:c.lado};const h=amostrar(l);l.min=h.min;l.max=h.max;l.cota=cotaFrente(l);return l}

const lotes=[];
function tentar(c,obrigatoria=false){
  // Em encosta, afastar o lote e muito mais seguro que apagar a casa inteira.
  for(const extra of[.18,.75,1.35,2.05,2.85]){
    const l=loteDe(c,extra);
    if(!foraDasRuas(l))continue;
    if(lotes.some(o=>sobrepoe(l,o)))continue;
    lotes.push(l);return true;
  }
  if(obrigatoria)console.warn('[bairro-nobre] lote obrigatorio sem espaco',c.bloco,c.via.nome,c.u,c.lado);
  return false;
}

// BASE GARANTIDA: 2 casas por quarteirao na avenida = 10 casas.
for(const q of QUARTEIROES){const u=(q.u0+q.u1)/2;for(const lado of[-1,1])tentar({via:vias[0],u,lado,bloco:q.id},true)}
// DENSIDADE PRINCIPAL: duas posicoes em cada ponta das quatro transversais = ate +16 casas.
for(let vi=1;vi<vias.length;vi++)for(const u of[.16,.84])for(const lado of[-1,1])tentar({via:vias[vi],u,lado,bloco:Math.min(5,vi+1)},true);
// PREENCHIMENTO: completa fachadas sem ocupar cruzamentos.
for(const q of QUARTEIROES){const span=q.u1-q.u0;for(const f of[.27,.73])for(const lado of[-1,1]){if(lotes.length<MAX_CASAS)tentar({via:vias[0],u:q.u0+span*f,lado,bloco:q.id})}}
for(let vi=1;vi<vias.length;vi++)for(const u of[.28,.72])for(const lado of[-1,1]){if(lotes.length<MAX_CASAS)tentar({via:vias[vi],u,lado,bloco:Math.min(5,vi+1)})}

// ===== RENDER INSTANCIADO: 5 FAMILIAS ARQUITETONICAS =====
const box=new THREE.BoxGeometry(1,1,1),painel=new THREE.BoxGeometry(1,1,.04);
const mats={
 parede:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.80,vertexColors:true}),
 acento:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.68,vertexColors:true}),
 concreto:matConcreto(),metal:new THREE.MeshStandardMaterial({color:0x303438,roughness:.48,metalness:.58}),
 vidro:new THREE.MeshStandardMaterial({color:0x73a7b2,roughness:.12,metalness:.08,transparent:true,opacity:.48,depthWrite:false}),
 madeira:matMadeira(0x6b4b33),telha:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,vertexColors:true}),
 solar:new THREE.MeshStandardMaterial({color:0x18272d,roughness:.2,metalness:.52})};
const B={parede:{g:box,m:mats.parede,a:[]},acento:{g:box,m:mats.acento,a:[]},concreto:{g:box,m:mats.concreto,a:[]},metal:{g:box,m:mats.metal,a:[]},vidro:{g:painel,m:mats.vidro,a:[]},madeira:{g:box,m:mats.madeira,a:[]},telha:{g:box,m:mats.telha,a:[]},solar:{g:box,m:mats.solar,a:[]}};
const EY=new THREE.Vector3(0,1,0),C=new THREE.Color();
function item(k,l,x,y,z,sx,sy,sz,cor=null,giro=0,tiltZ=0){const p=mundoLocal(l,x,z),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,l.giro+giro,tiltZ));B[k].a.push({p:new THREE.Vector3(p.x,l.cota+y,p.z),q,s:new THREE.Vector3(sx,sy,sz),cor})}
function fechar(k,sombra=true){const b=B[k];if(!b.a.length)return;const im=new THREE.InstancedMesh(b.g,b.m,b.a.length),M=new THREE.Matrix4();im.name=`nobre-${k}`;im.receiveShadow=true;im.castShadow=sombra;for(let i=0;i<b.a.length;i++){const a=b.a[i];M.compose(a.p,a.q,a.s);im.setMatrixAt(i,M);if(a.cor!==null)im.setColorAt(i,C.setHex(a.cor))}im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.frustumCulled=false;grupo.add(im)}
function colisor(l,w,d,h,f){let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const x of[-w/2,w/2])for(const z of[-d/2,d/2]){const p=mundoLocal(l,x,z);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z)}registrarCaixa(new THREE.Box3(new THREE.Vector3(x0,l.cota-f-.05,z0),new THREE.Vector3(x1,l.cota+h+.35,z1)),'casa-bairro-nobre')}
const cores=[0xf2eadf,0xd7e3e1,0xe7d7c7,0xd6d9e1,0xe8e4d6,0xcfded2,0xead9d9,0xd8d0c5,0xe4e7ec,0xded4e8,0xe8dfc8,0xcfd8dc];
const acentos=[0x704d3d,0x3f5f68,0x806a54,0x4e5c70,0x786154,0x49685b,0x76505b,0x5f554b];
const telhas=[0x8b4d36,0x9f6245,0x6e4a3b,0x7b5b4b];

for(let i=0;i<lotes.length;i++){
 const l=lotes[i],tipo=i%5,cor=cores[(i*3+l.bloco)%cores.length],ac=acentos[(i+l.bloco)%acentos.length];
 let w=4.05+(i%3)*.16,d=3.05+(i%2)*.14,h1=2.35,h2=0,H=h1;
 if(tipo===1||tipo===3){h2=2.00;H=h1+h2}
 if(tipo===4){w=3.72;d=3.36;h2=2.18;H=h1+h2}
 const t=amostrar(l,w+.26,d+.26),f=Math.min(5.8,Math.max(.30,l.cota-t.min+.22));
 item('concreto',l,0,-f/2,-.12,w+.24,f,d+.24);
 item('parede',l,0,h1/2,-.12,w,h1,d,cor);
 if(h2){const dx=tipo===3?.55:(tipo===4?-.35:.18);item('parede',l,dx,h1+h2/2,-.28,w*(tipo===4?.78:.70),h2,d*.80,cores[(i*5+2)%cores.length])}
 // Cinco silhuetas/fachadas diferentes.
 if(tipo===0){ // terrea horizontal, marquise larga
   item('acento',l,-1.18,1.18,d/2-.22,.48,2.34,.08,ac);item('concreto',l,.45,2.43,d/2+.12,2.35,.13,.72);item('vidro',l,.78,1.34,d/2-.18,1.18,.82,1);item('metal',l,-.78,.76,d/2-.19,1.45,1.50,.07);
 }else if(tipo===1){ // sobrado moderno assimetrico
   item('acento',l,w/2-.46,H/2,-.1,.54,H+.08,d+.03,ac);item('vidro',l,.15,h1+1.02,d*.39,1.38,.78,1);item('vidro',l,.92,1.38,d/2-.18,.72,.72,1);item('metal',l,-.82,.78,d/2-.2,1.48,1.54,.07);
 }else if(tipo===2){ // casa de telhado aparente
   item('acento',l,-1.25,1.12,d/2-.2,.38,2.22,.07,ac);item('vidro',l,.62,1.30,d/2-.18,1.10,.76,1);item('metal',l,-.78,.76,d/2-.19,1.42,1.50,.07);item('telha',l,-w*.24,h1+.28,-.12,w*.56,.10,d+.28,telhas[i%telhas.length],0,.16);item('telha',l,w*.24,h1+.28,-.12,w*.56,.10,d+.28,telhas[i%telhas.length],0,-.16);
 }else if(tipo===3){ // sobrado com varanda
   item('acento',l,-w/2+.48,H/2,-.12,.52,H+.08,d+.02,ac);item('concreto',l,.44,h1+.04,d/2+.18,2.00,.10,.78);item('vidro',l,.44,h1+.48,d/2+.54,1.86,.62,1);item('vidro',l,.86,1.35,d/2-.18,.82,.74,1);item('metal',l,-.80,.78,d/2-.2,1.45,1.54,.07);
 }else{ // vertical contemporanea estreita
   item('acento',l,.98,H/2,-.10,.72,H+.10,d+.02,ac);item('vidro',l,-.50,h1+1.05,d*.40,1.05,.92,1);item('vidro',l,.35,1.38,d/2-.18,.66,.82,1);item('metal',l,-.88,.78,d/2-.20,1.36,1.54,.07);
 }
 item('madeira',l,1.25,.92,d/2-.18,.54,1.84,.075);
 item('concreto',l,0,H+.08,-.12,w+.14,.16,d+.14);
 if(tipo!==2&&i%3===0){item('solar',l,-.48,H+.20,-.34,.78,.04,.48);item('solar',l,.48,H+.20,-.34,.78,.04,.48)}
 // Frente compacta, sem arvore dentro do lote.
 item('parede',l,-1.72,.31,l.d/2-.03,.62,.62,.10,cor);item('parede',l,1.70,.31,l.d/2-.03,.66,.62,.10,cor);item('metal',l,-.25,.29,l.d/2,1.90,.56,.05);
 colisor(l,w,d,H,f);
}
for(const k of Object.keys(B))fechar(k,k!=='vidro'&&k!=='solar');
console.info('[bairro-nobre] quarteiroes=%d casas=%d/%d tipos=5 vegetacao-em-lote=0',QUARTEIROES.length,lotes.length,MAX_CASAS);
export{lotes as lotesNobres};