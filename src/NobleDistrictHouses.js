// ===== JARDINS DO MORRO — 5 QUARTEIROES RESIDENCIAIS =====
// Regra estrutural: rua primeiro, casa depois. Cada quarteirao recebe casas-base GARANTIDAS no seu miolo;
// filtros adicionais servem apenas para preencher espacos extras, nunca para apagar o bairro inteiro.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa}from'./Physics.js';
import{matConcreto,matMadeira}from'./Materials.js';
import{vias,corredorTotal,pontoEmCorredorViario,QUARTEIROES}from'./NobleDistrictPlan.js';

const grupo=new THREE.Group();grupo.name='bairro-nobre-5-quarteiroes';scene.add(grupo);
const LOTE_W=5.10,LOTE_D=4.45,MARGEM=.24,MAX_CASAS=24;

function mundoLocal(l,lx,lz){const c=Math.cos(l.giro),s=Math.sin(l.giro);return{x:l.cx+lx*c+lz*s,z:l.cz-lx*s+lz*c}}
function amostrar(l,w=l.w,d=l.d,n=5){let min=Infinity,max=-Infinity;for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){const p=mundoLocal(l,-w/2+w*ix/(n-1),-d/2+d*iz/(n-1)),h=obterElevacao(p.x,p.z);min=Math.min(min,h);max=Math.max(max,h)}return{min,max}}
function cotaCasa(l){let soma=0,n=0;for(let ix=0;ix<5;ix++)for(let iz=0;iz<3;iz++){const p=mundoLocal(l,-l.w/2+l.w*ix/4,-l.d*.25+l.d*.5*iz/2);soma+=obterElevacao(p.x,p.z);n++}return soma/n+.08}
function cantos(l,m=MARGEM){const w=l.w+2*m,d=l.d+2*m;return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>mundoLocal(l,x,z))}
function proj(P,ax,az){let min=Infinity,max=-Infinity;for(const p of P){const v=p.x*ax+p.z*az;min=Math.min(min,v);max=Math.max(max,v)}return{min,max}}
function sobrepoe(a,b){const A=cantos(a),B=cantos(b);for(const P of[A,B])for(let i=0;i<4;i++){const p=P[i],q=P[(i+1)%4],ex=q.x-p.x,ez=q.z-p.z,len=Math.hypot(ex,ez)||1,ax=-ez/len,az=ex/len,pa=proj(A,ax,az),pb=proj(B,ax,az);if(pa.max<pb.min||pb.max<pa.min)return false}return true}
function loteNaVia(via,u,lado,bloco,extra=1.05){
 const p=via.curva.getPointAt(u),t=via.curva.getTangentAt(u).normalize(),nx=-t.z*lado,nz=t.x*lado;
 // Recuo maior que o corredor protegido: mesmo na curva a casa-base nao toca asfalto/calçada.
 const dist=corredorTotal(via)+LOTE_D/2+extra;
 const l={cx:p.x+nx*dist,cz:p.z+nz*dist,giro:Math.atan2(-nx,-nz),w:LOTE_W,d:LOTE_D,via,u,p,t,nx,nz,bloco};
 const h=amostrar(l);l.min=h.min;l.max=h.max;l.cota=cotaCasa(l);return l;
}
function foraDasRuas(l){for(let ix=0;ix<5;ix++)for(let iz=0;iz<5;iz++){const p=mundoLocal(l,-l.w/2+l.w*ix/4,-l.d/2+l.d*iz/4);if(pontoEmCorredorViario(p.x,p.z,.04))return false}return true}

const lotes=[];
// 10 CASAS GARANTIDAS: uma de cada lado, exatamente no centro de cada quarteirao.
// Esses pontos estao entre as transversais, nunca sobre o cruzamento.
for(const q of QUARTEIROES){
 const u=(q.u0+q.u1)/2;
 for(const lado of[-1,1])lotes.push(loteNaVia(vias[0],u,lado,q.id,1.25));
}

// Preenchimento extra nas frentes internas. Se um candidato cruza outra rua ou vizinho, ele e descartado;
// as 10 casas-base acima permanecem de qualquer maneira.
const extras=[];
for(const q of QUARTEIROES){const span=q.u1-q.u0;for(const f of[.27,.73])for(const lado of[-1,1])extras.push({via:vias[0],u:q.u0+span*f,lado,bloco:q.id})}
for(let vi=1;vi<vias.length;vi++)for(const u of[.14,.84])for(const lado of[-1,1])extras.push({via:vias[vi],u,lado,bloco:Math.min(5,vi+1)});
for(const c of extras){if(lotes.length>=MAX_CASAS)break;const l=loteNaVia(c.via,c.u,c.lado,c.bloco,.95);if(!foraDasRuas(l))continue;if(lotes.some(o=>sobrepoe(l,o)))continue;lotes.push(l)}

// ===== RENDER LEVE / INSTANCIADO =====
const box=new THREE.BoxGeometry(1,1,1),painel=new THREE.BoxGeometry(1,1,.04),copa=new THREE.DodecahedronGeometry(1,1),tronco=new THREE.CylinderGeometry(.07,.10,1,7);
const mats={
 parede:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.80,vertexColors:true}),
 acento:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.72,vertexColors:true}),
 concreto:matConcreto(),metal:new THREE.MeshStandardMaterial({color:0x303438,roughness:.48,metalness:.58}),
 vidro:new THREE.MeshStandardMaterial({color:0x73a7b2,roughness:.12,metalness:.08,transparent:true,opacity:.48,depthWrite:false}),
 madeira:matMadeira(0x6b4b33),grama:new THREE.MeshStandardMaterial({color:0x557348,roughness:1}),
 solar:new THREE.MeshStandardMaterial({color:0x18272d,roughness:.20,metalness:.52}),folha:new THREE.MeshStandardMaterial({color:0x4d7046,roughness:1,flatShading:true})};
const B={parede:{g:box,m:mats.parede,a:[]},acento:{g:box,m:mats.acento,a:[]},concreto:{g:box,m:mats.concreto,a:[]},metal:{g:box,m:mats.metal,a:[]},vidro:{g:painel,m:mats.vidro,a:[]},madeira:{g:box,m:mats.madeira,a:[]},grama:{g:box,m:mats.grama,a:[]},solar:{g:box,m:mats.solar,a:[]},copa:{g:copa,m:mats.folha,a:[]},tronco:{g:tronco,m:mats.madeira,a:[]}};
const EY=new THREE.Vector3(0,1,0),C=new THREE.Color();
function item(k,l,x,y,z,sx,sy,sz,cor=null,giro=0){const p=mundoLocal(l,x,z),q=new THREE.Quaternion().setFromAxisAngle(EY,l.giro+giro);B[k].a.push({p:new THREE.Vector3(p.x,l.cota+y,p.z),q,s:new THREE.Vector3(sx,sy,sz),cor})}
function fechar(k,sombra=true){const b=B[k];if(!b.a.length)return;const im=new THREE.InstancedMesh(b.g,b.m,b.a.length),M=new THREE.Matrix4();im.name=`nobre-${k}`;im.receiveShadow=true;im.castShadow=sombra;for(let i=0;i<b.a.length;i++){const a=b.a[i];M.compose(a.p,a.q,a.s);im.setMatrixAt(i,M);if(a.cor!==null)im.setColorAt(i,C.setHex(a.cor))}im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.frustumCulled=false;grupo.add(im)}
function colisor(l,w,d,h,f){let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const x of[-w/2,w/2])for(const z of[-d/2,d/2]){const p=mundoLocal(l,x,z);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z)}registrarCaixa(new THREE.Box3(new THREE.Vector3(x0,l.cota-f-.05,z0),new THREE.Vector3(x1,l.cota+h+.30,z1)),'casa-bairro-nobre')}

const cores=[0xf1ece2,0xe4e7e3,0xe9e2d8,0xdce3e1,0xeee8de,0xdedbd4,0xe8e8e3],acentos=[0x66584c,0x54636a,0x806b59,0x4d6258,0x765e52,0x59616c];
for(let i=0;i<lotes.length;i++){
 const l=lotes[i],baixo=l.bloco>=5,dois=!baixo&&i%4!==2,w=4.48+(i%3)*.12,d=3.24+(i%2)*.10;
 const t=amostrar(l,w+.22,d+.22),f=Math.min(5.8,Math.max(.30,l.cota-t.min+.20)),h1=2.48,h2=dois?2.08:0,H=h1+h2;
 item('concreto',l,0,-f/2,-.18,w+.22,f,d+.22);
 item('parede',l,0,h1/2,-.18,w,h1,d,cores[i%cores.length]);
 if(dois)item('parede',l,(i%2?.34:-.34),h1+h2/2,-.34,w*.72,h2,d*.80,cores[(i+2)%cores.length]);
 item('acento',l,w/2-.54,H/2,-.18,.56,H+.12,d+.04,acentos[i%acentos.length]);
 item('metal',l,-.80,.79,d/2-.25,1.68,1.56,.07);item('madeira',l,1.10,.92,d/2-.245,.58,1.84,.075);
 item('vidro',l,1.02,1.42,d/2-.205,.72,.66,1);
 if(dois){item('vidro',l,.18,h1+1.02,d*.40,1.38,.78,1);item('concreto',l,.18,h1+.05,d/2+.02,1.72,.09,.60);item('vidro',l,.18,h1+.38,d/2+.34,1.64,.50,1)}
 else item('vidro',l,.50,1.35,d/2-.205,.96,.72,1);
 item('concreto',l,0,H+.08,-.18,w+.14,.16,d+.14);
 if(!baixo&&i%3!==1){item('solar',l,-.52,H+.22,-.30,.88,.04,.52);item('solar',l,.52,H+.22,-.30,.88,.04,.52)}
 item('parede',l,-1.78,.34,l.d/2-.04,.66,.68,.10,cores[i%cores.length]);item('parede',l,1.76,.34,l.d/2-.04,.70,.68,.10,cores[i%cores.length]);item('metal',l,-.28,.32,l.d/2,1.98,.62,.05);
 const ax=i%2?-1.76:1.76,az=1.46,p=mundoLocal(l,ax,az),dy=obterElevacao(p.x,p.z)-l.cota;item('tronco',l,ax,dy+.52,az,1,1.02,1);item('copa',l,ax,dy+1.25,az,.36,.48,.36);
 colisor(l,w,d,H,f);
}
for(const k of Object.keys(B))fechar(k,k!=='vidro'&&k!=='solar');
console.info('[bairro-nobre] quarteiroes=%d casas=%d garantidas=10 extras=%d',QUARTEIROES.length,lotes.length,Math.max(0,lotes.length-10));
export{lotes as lotesNobres};