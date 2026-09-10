// ===== JARDINS DO MORRO — CASAS NO PADRAO ESTRUTURAL DA FAVELA =====
// Esta geracao segue a arquitetura que ja funciona em Favela.js:
// 1) lote e dado; visual e fisica saem dele;
// 2) parede do terreo desce ate o terreno em volta, casa nao boia;
// 3) geometria de casa e FUNDIDA por material — nao InstancedMesh PBR;
// 4) colisores saem do lote, nao de Box3().setFromObject();
// 5) varias familias de fachada/telhado usam os materiais PBR compartilhados do jogo.
import*as THREE from'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa}from'./Physics.js';
import{matReboco,matTelha,matConcreto,matMadeira,uvPorMetro,bmat}from'./Materials.js';
import{vias,corredorTotal,pontoEmCorredorViario,QUARTEIROES}from'./NobleDistrictPlan.js';

const grupo=new THREE.Group();grupo.name='bairro-nobre-casas-fundidas';scene.add(grupo);
const LOTE_W=4.45,LOTE_D=4.25,MARGEM=.18,MAX_CASAS=34;
const pilhas=new Map();
const EY=new THREE.Vector3(0,1,0),EZ=new THREE.Vector3(0,0,1);

function acumular(mat,geo){if(!pilhas.has(mat))pilhas.set(mat,[]);pilhas.get(mat).push(geo)}
function caixa(mat,w,h,d,x,y,z,giro=0,tiltZ=0){
  const g=new THREE.BoxGeometry(w,h,d);uvPorMetro(g);
  const qYaw=new THREE.Quaternion().setFromAxisAngle(EY,giro);
  const qTilt=new THREE.Quaternion().setFromAxisAngle(EZ,tiltZ);
  const q=qYaw.multiply(qTilt),m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(1,1,1));
  g.applyMatrix4(m);acumular(mat,g);return g;
}
function mundoLocal(l,lx,lz){const c=Math.cos(l.giro),s=Math.sin(l.giro);return{x:l.cx+lx*c+lz*s,z:l.cz-lx*s+lz*c}}
function caixaLote(l,mat,w,h,d,lx,y,lz,tiltZ=0){const p=mundoLocal(l,lx,lz);caixa(mat,w,h,d,p.x,y,p.z,l.giro,tiltZ)}
function cantos(l,m=MARGEM){const w=l.w+2*m,d=l.d+2*m;return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>mundoLocal(l,x,z))}
function proj(P,ax,az){let min=Infinity,max=-Infinity;for(const p of P){const v=p.x*ax+p.z*az;min=Math.min(min,v);max=Math.max(max,v)}return{min,max}}
function sobrepoe(a,b){const A=cantos(a),B=cantos(b);for(const P of[A,B])for(let i=0;i<4;i++){const p=P[i],q=P[(i+1)%4],ex=q.x-p.x,ez=q.z-p.z,len=Math.hypot(ex,ez)||1,ax=-ez/len,az=ex/len,pa=proj(A,ax,az),pb=proj(B,ax,az);if(pa.max<pb.min||pb.max<pa.min)return false}return true}
function foraDasRuas(l){for(let ix=0;ix<5;ix++)for(let iz=0;iz<5;iz++){const p=mundoLocal(l,-l.w/2+l.w*ix/4,-l.d/2+l.d*iz/4);if(pontoEmCorredorViario(p.x,p.z,.04))return false}return true}
function cotaDaSoleira(l){let soma=0,n=0;for(let i=0;i<7;i++){const p=mundoLocal(l,-l.w/2+l.w*i/6,l.d/2-.12);soma+=obterElevacao(p.x,p.z);n++}return soma/n+.06}
function menorTerrenoEmVolta(l,w,d){let menor=Infinity;for(const sx of[-1,1])for(const sz of[-1,1])for(const fora of[0,1.2]){const p=mundoLocal(l,sx*(w/2+fora),sz*(d/2+fora));menor=Math.min(menor,obterElevacao(p.x,p.z))}for(const[dx,dz]of[[0,d/2+1.2],[0,-d/2-1.2],[w/2+1.2,0],[-w/2-1.2,0]]){const p=mundoLocal(l,dx,dz);menor=Math.min(menor,obterElevacao(p.x,p.z))}return menor}
function loteDe(via,u,lado,extra,bloco){const p=via.curva.getPointAt(u),t=via.curva.getTangentAt(u).normalize(),nx=-t.z*lado,nz=t.x*lado,dist=corredorTotal(via)+LOTE_D/2+extra;const l={cx:p.x+nx*dist,cz:p.z+nz*dist,giro:Math.atan2(-nx,-nz),w:LOTE_W,d:LOTE_D,via,u,lado,bloco};l.baseY=cotaDaSoleira(l);return l}

const lotes=[];
function tentar(via,u,lado,bloco,obrig=false){
  for(const extra of[.16,.55,1.0,1.55,2.2]){
    const l=loteDe(via,u,lado,extra,bloco);
    if(!foraDasRuas(l))continue;
    if(lotes.some(o=>sobrepoe(l,o)))continue;
    lotes.push(l);return true;
  }
  if(obrig)console.warn('[bairro-nobre] frente sem lote',via.nome,u,lado,bloco);
  return false;
}

// 4 quarteiroes principais: duas frentes na avenida + quatro frentes nas coletoras.
// Os pontos ficam longe dos tres cruzamentos (.24/.48/.72), portanto existe frente edificavel real.
for(const [u,bloco] of [[.32,1],[.40,2],[.56,3],[.64,4]])for(const lado of[-1,1])tentar(vias[0],u,lado,bloco,true);
for(const [vi,blocoA,blocoB] of [[1,1,3],[2,2,4]]){
  for(const u of[.16,.34])for(const lado of[-1,1])tentar(vias[vi],u,lado,blocoA,true);
  for(const u of[.66,.84])for(const lado of[-1,1])tentar(vias[vi],u,lado,blocoB,true);
}
// Quinto quarteirao: alca de transicao, densa mas sem fechar a juncao com a favela.
for(const u of[.18,.36,.62,.80])for(const lado of[-1,1])tentar(vias[6],u,lado,5,true);
// Preenchimento adicional nas pontas das transversais, onde nao ha intersecao com a avenida.
for(const vi of[3,4,5])for(const u of[.12,.88])for(const lado of[-1,1]){if(lotes.length<MAX_CASAS)tentar(vias[vi],u,lado,vi-2)}

const CORES=[0xf0e7dc,0xd7e2df,0xe8d2bf,0xcfd6df,0xe6e0cf,0xd2dfd0,0xe7d6d8,0xd9d0c3,0xe6e7eb,0xddd3e7,0xe7dfc9,0xcbd7db];
const ACENTOS=[0x704d3d,0x3f5f68,0x806a54,0x4e5c70,0x786154,0x49685b,0x76505b,0x5f554b,0x41535f];
const TELHAS=[0x8d4d34,0xa56547,0x765044,0x6e5d53,0x8a6a54];
const vidro=bmat(0x29444d),metal=bmat(0x303438),cimento=matConcreto();
const madeiraEscura=matMadeira(0x5e3e2b),madeiraClara=matMadeira(0x8b6848);

function paredeTerrea(l,mat,w,h,d,lx=0,lz=0){const menor=menorTerrenoEmVolta(l,w,d),af=Math.min(5.2,Math.max(.20,l.baseY-menor+.24)),altura=h+af,cy=l.baseY+h/2-af/2;caixaLote(l,mat,w,altura,d,lx,cy,lz);return af}
function janelaFrente(l,lx,y,lz,w=.84,h=.72){caixaLote(l,vidro,w,h,.055,lx,y,lz)}
function portaFrente(l,lx,y,lz,w=.72,h=1.82,clara=false){caixaLote(l,clara?madeiraClara:madeiraEscura,w,h,.07,lx,y,lz)}
function garagem(l,lx,y,lz,w=1.65,h=1.48){caixaLote(l,metal,w,h,.07,lx,y,lz)}
function laje(l,w,d,y){caixaLote(l,cimento,w,.14,d,0,y,0)}
function telhadoDuasAguas(l,w,d,y,cor){const mat=matTelha(cor),painelW=w*.56;caixaLote(l,mat,painelW,.10,d+.24,-w*.235,y,0,.18);caixaLote(l,mat,painelW,.10,d+.24,w*.235,y,0,-.18)}
function muretaFrente(l,mat){caixaLote(l,mat,.72,.55,.10,-1.58,l.baseY+.275,l.d/2-.04);caixaLote(l,mat,.72,.55,.10,1.58,l.baseY+.275,l.d/2-.04);caixaLote(l,metal,1.78,.50,.05,-.18,l.baseY+.25,l.d/2)}

function colisorFatiado(l,w,d,h,af){
  const fatias=4,fd=d/fatias;
  for(let i=0;i<fatias;i++){
    const lz=-d/2+fd*(i+.5),p=mundoLocal(l,0,lz),c=Math.abs(Math.cos(l.giro)),s=Math.abs(Math.sin(l.giro)),W=w*c+fd*s,D=w*s+fd*c;
    registrarCaixa(new THREE.Box3(new THREE.Vector3(p.x-W/2,l.baseY-af-.05,p.z-D/2),new THREE.Vector3(p.x+W/2,l.baseY+h+.35,p.z+D/2)),'casa-bairro-nobre');
  }
}

for(let i=0;i<lotes.length;i++){
  const l=lotes[i],tipo=(i+l.bloco*2)%6,cor=CORES[(i*5+l.bloco)%CORES.length],ac=ACENTOS[(i*3+l.bloco)%ACENTOS.length],reboco=matReboco(cor),acento=matReboco(ac),telha=TELHAS[(i+l.bloco)%TELHAS.length];
  let w=3.75+(i%3)*.18,d=3.02+(i%2)*.18,h1=2.38,h2=0,H=h1,af=0;
  if(tipo===1||tipo===4){h2=2.02;H=h1+h2}
  if(tipo===3){w=4.18;d=3.18}
  if(tipo===5){w=3.62;d=3.34}
  af=paredeTerrea(l,reboco,w,h1,d,0,-.12);

  if(tipo===0){
    // Terrea moderna horizontal: marquise, pano de vidro e garagem lateral.
    caixaLote(l,acento,.46,h1+.04,d+.02,-w/2+.34,l.baseY+h1/2,-.12);janelaFrente(l,.72,l.baseY+1.34,d/2-.16,1.08,.78);garagem(l,-.84,l.baseY+.76,d/2-.17,1.38,1.50);portaFrente(l,1.30,l.baseY+.91,d/2-.17,.58,1.82,true);caixaLote(l,cimento,2.20,.12,.70,.45,l.baseY+h1+.08,d/2+.14);
    laje(l,w+.14,d+.14,l.baseY+h1+.07);
  }else if(tipo===1){
    // Sobrado recuado: volume superior menor + varanda real.
    caixaLote(l,matReboco(CORES[(i+3)%CORES.length]),w*.70,h2,d*.78,.28,l.baseY+h1+h2/2,-.30);caixaLote(l,acento,.50,H+.10,d+.05,w/2-.34,l.baseY+H/2,-.10);garagem(l,-.82,l.baseY+.78,d/2-.17,1.42,1.54);portaFrente(l,1.20,l.baseY+.91,d/2-.17,.56,1.82);janelaFrente(l,.82,l.baseY+h1+1.00,d*.39,1.25,.78);caixaLote(l,cimento,1.60,.10,.70,.55,l.baseY+h1+.07,d/2+.18);caixaLote(l,metal,1.52,.54,.04,.55,l.baseY+h1+.42,d/2+.53);laje(l,w+.12,d+.12,l.baseY+H+.07);
  }else if(tipo===2){
    // Casa de telha aparente, fachada mais classica.
    caixaLote(l,acento,.34,h1+.02,d+.02,-w/2+.28,l.baseY+h1/2,-.12);garagem(l,-.80,l.baseY+.76,d/2-.17,1.36,1.48);portaFrente(l,1.10,l.baseY+.91,d/2-.17,.62,1.82,true);janelaFrente(l,.48,l.baseY+1.30,d/2-.16,.94,.74);telhadoDuasAguas(l,w+.18,d+.12,l.baseY+h1+.24,telha);
  }else if(tipo===3){
    // Planta em L: corpo principal + ala frontal de garagem.
    const alaW=1.32,alaD=2.30;paredeTerrea(l,acento,alaW,2.18,alaD,-w/2+.52,d*.22);garagem(l,-w/2+.52,l.baseY+.72,d/2+.08,1.08,1.40);portaFrente(l,.72,l.baseY+.91,d/2-.17,.62,1.82);janelaFrente(l,1.18,l.baseY+1.34,d/2-.16,.82,.74);laje(l,w+.12,d+.12,l.baseY+h1+.07);caixaLote(l,cimento,alaW+.12,.12,alaD+.12,-w/2+.52,l.baseY+2.24,d*.22);
  }else if(tipo===4){
    // Sobrado vertical com duas cores e pergolado frontal.
    caixaLote(l,matReboco(CORES[(i+5)%CORES.length]),w*.76,h2,d*.82,-.26,l.baseY+h1+h2/2,-.25);caixaLote(l,acento,.64,H+.08,d+.03,w/2-.42,l.baseY+H/2,-.10);garagem(l,-.86,l.baseY+.78,d/2-.17,1.38,1.54);portaFrente(l,1.16,l.baseY+.91,d/2-.17,.56,1.82,true);janelaFrente(l,-.25,l.baseY+h1+1.02,d*.40,1.02,.88);for(const x of[-.72,0,.72])caixaLote(l,madeiraClara,.08,.08,.92,x,l.baseY+h1+.16,d/2+.24);laje(l,w+.12,d+.12,l.baseY+H+.07);
  }else{
    // Transicao para a favela: mais baixa, telha ceramica e volumes menores, sem virar barraco clone.
    caixaLote(l,acento,.38,h1+.02,d+.02,w/2-.30,l.baseY+h1/2,-.12);portaFrente(l,-1.06,l.baseY+.91,d/2-.17,.66,1.82);janelaFrente(l,.48,l.baseY+1.28,d/2-.16,1.02,.72);janelaFrente(l,1.18,l.baseY+1.28,d/2-.16,.48,.72);telhadoDuasAguas(l,w+.20,d+.16,l.baseY+h1+.24,telha);
  }
  muretaFrente(l,reboco);colisorFatiado(l,w,d,H,af);
}

for(const[mat,geos]of pilhas){
  if(!geos.length)continue;
  const merged=mergeGeometries(geos,false);
  if(!merged){console.error('[bairro-nobre] fusao falhou',mat.name||mat.type,geos.length);continue}
  const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='casas-nobres-fundidas';grupo.add(mesh);
  for(const g of geos)g.dispose();
}
console.info('[bairro-nobre] quarteiroes=%d casas=%d/%d render=fusao-pbr tipos=6',QUARTEIROES.length,lotes.length,MAX_CASAS);
export{lotes as lotesNobres};