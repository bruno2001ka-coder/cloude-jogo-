import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{scene}from'./core.js';
import{player}from'./Player.js';
import{obterElevacao,alturaDoChaoDesenhado}from'./Terrain.js';
import{viaPrincipal,viaBaixa,becos}from'./Favela.js';
import{registrarCaixa,marcarObstaculoMovel,colideParedeXZ}from'./Physics.js';

const COMPRIMENTO=1.90,LARGURA=.86,ALTURA_COLISAO=.85,ENTRE_EIXOS=.70,ALTURA_ASSENTO=-.02;
// Uma viatura por ocorrência: a segunda duplicava a busca global de rota no pior momento.
const CHEGOU=2,PERSEGUICAO_DUAS=6;
// Ronda tem que parecer ronda: baixa velocidade e aceleracao suave. A viatura so abre desempenho
// quando existe perseguicao/ocorrencia ativa.
const VEL_CRUZEIRO=4.2,VEL_ATENDENDO=13.5,VEL_BUSCA=3.6,ACEL_RONDA=1.5,ACEL_ATENDENDO=4.8,FREIO=6.6;
// A viatura tem campo de observacao maior que o policial a pe. So vale para RELOCALIZAR jogador
// ja procurado; nao cria ficha do nada. Parede continua tapando a visao.
const VISAO_VIATURA=42,VISAO_VIATURA_COS=Math.cos(70*Math.PI/180),VISAO_VIATURA_INTERVALO=.22;
const LATERAL_RONDA=4.5,LATERAL_ATENDENDO=8;
const MAO=1,MAO_DESVIANDO=-.6,PERTO_PRA_DESVIAR=9,TROCA_DE_FAIXA=2.5;
const PERSEGUICAO_RECALCULA=1.25,INTERCEPTA_MAX=4.0,ALVO_VEL_MAX=11;
const DESPACHO_INTERVALO=9,REPLANEJAR_ALVO_DESVIO=3;
const DISTANCIA_SEGURA=4.2,RAIO_APROXIMACAO=16,VEL_APROXIMACAO=5.5,GIRO_MAX_RAD_S=2.35;
const DESEMBARQUE_SEM_ACESSO=5.5;
const PASSO_VALIDACAO=.45,FOLGA_ROTA=.18,INCLINACAO_MAX=Math.tan(22*Math.PI/180);
const MAPA_LIMITE=124,GRADE_VEICULO=4,BUSCA_MAX_NOS=5200;
const N_PERFIL=320;

// ===== ANEL DE PATRULHA =====
const U_CRUZAMENTO_PRINCIPAL=.81,U_CRUZAMENTO_BAIXA=.86,PASSO=4;
function amostrar(curva,de,ate){
  const n=Math.max(2,Math.ceil(curva.getLength()*Math.abs(ate-de)/PASSO)),pts=[];
  for(let i=0;i<=n;i++)pts.push(curva.getPointAt(de+(ate-de)*(i/n)));
  return pts;
}
function amostrarRetas(cantos){
  const pts=[];
  for(let k=0;k+1<cantos.length;k++){
    const a=cantos[k],b=cantos[k+1],n=Math.max(1,Math.round(Math.hypot(b.x-a.x,b.z-a.z)/PASSO));
    for(let i=k?1:0;i<=n;i++)pts.push(new THREE.Vector3(a.x+(b.x-a.x)*i/n,0,a.z+(b.z-a.z)*i/n));
  }
  return pts;
}
function filete(A,d1,B,d2,R){
  const den=d1.x*d2.z-d1.z*d2.x,t=((B.x-A.x)*d2.z-(B.z-A.z)*d2.x)/den;
  const I={x:A.x+d1.x*t,z:A.z+d1.z*t};
  const ang=Math.acos(Math.max(-1,Math.min(1,-(d1.x*d2.x+d1.z*d2.z)))),rec=R/Math.tan(ang/2);
  const T1={x:I.x-d1.x*rec,z:I.z-d1.z*rec},T2={x:I.x+d2.x*rec,z:I.z+d2.z*rec};
  let nx=-d1.z,nz=d1.x;if((T2.x-T1.x)*nx+(T2.z-T1.z)*nz<0){nx=-nx;nz=-nz}
  const C={x:T1.x+nx*R,z:T1.z+nz*R},a1=Math.atan2(T1.z-C.z,T1.x-C.x),a2=Math.atan2(T2.z-C.z,T2.x-C.x);
  let d=a2-a1;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
  const n=Math.max(2,Math.ceil(Math.abs(d)*R/PASSO)),pts=[];
  for(let i=0;i<=n;i++){const a=a1+d*i/n;pts.push(new THREE.Vector3(C.x+Math.cos(a)*R,0,C.z+Math.sin(a)*R))}
  return{T1,T2,pts};
}
function uMaisPertoDe(curva,alvo,amostras=400){
  let melhor=0,dist=Infinity;
  for(let i=0;i<=amostras;i++){
    const u=i/amostras,p=curva.getPointAt(u),d=(p.x-alvo.x)**2+(p.z-alvo.z)**2;
    if(d<dist){dist=d;melhor=u}
  }
  return melhor;
}
const PERNA_X=-56,RAIO_ENTRADA=8,_p0=viaPrincipal.getPointAt(0),_t0=viaPrincipal.getTangentAt(0);
const ENTRADA=filete({x:PERNA_X,z:-10},{x:0,z:1},{x:_p0.x,z:_p0.z},{x:_t0.x,z:_t0.z},RAIO_ENTRADA);
const U_ENTRADA=uMaisPertoDe(viaPrincipal,ENTRADA.T2);
const ROTA=new THREE.CatmullRomCurve3([
  ...amostrar(viaPrincipal,U_ENTRADA,U_CRUZAMENTO_PRINCIPAL),
  ...amostrar(viaBaixa,U_CRUZAMENTO_BAIXA,0).slice(1),
  ...amostrarRetas([{x:-53,z:-31},{x:PERNA_X,z:-24},ENTRADA.T1]).slice(1),
  ...ENTRADA.pts.slice(1,-1),
],true,'catmullrom',.5);
const COMPRIMENTO_DA_ROTA=ROTA.getLength();
export function __rota(){return ROTA}

function montarPerfilDe(curva,comprimento,latMax,vMax,fechado=true){
  const passo=Math.max(.05,comprimento/N_PERFIL),v=new Float32Array(N_PERFIL);
  for(let i=0;i<N_PERFIL;i++){
    const u=i/N_PERFIL,u2=fechado?(u+2/N_PERFIL)%1:Math.min(.999,u+2/N_PERFIL);
    const a=curva.getTangentAt(Math.min(.999,u)),b=curva.getTangentAt(u2);
    const ang=Math.abs(Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z)),raio=ang>1e-6?2*passo/ang:1e9;
    v[i]=Math.min(vMax,Math.sqrt(latMax*raio));
  }
  for(let passada=0;passada<2;passada++)for(let k=N_PERFIL-1;k>=0;k--){
    const prox=fechado?v[(k+1)%N_PERFIL]:(k+1<N_PERFIL?v[k+1]:v[k]);
    v[k]=Math.min(v[k],Math.sqrt(prox*prox+2*FREIO*passo));
  }
  return v;
}
const PERFIL_RONDA=montarPerfilDe(ROTA,COMPRIMENTO_DA_ROTA,LATERAL_RONDA,VEL_CRUZEIRO,true);
const PERFIL_ATENDENDO=montarPerfilDe(ROTA,COMPRIMENTO_DA_ROTA,LATERAL_ATENDENDO,VEL_ATENDENDO,true);
const tetoEm=(perfil,u)=>perfil[Math.min(N_PERFIL-1,Math.floor((((u%1)+1)%1)*N_PERFIL))];
function faltaAte(de,ate){let d=ate-de;if(d<0)d+=1;return d*COMPRIMENTO_DA_ROTA}
function uMaisPerto(alvo){return uMaisPertoDe(ROTA,alvo,360)}

// ===== NAVEGAÇÃO VEICULAR GLOBAL =====
function corpoCabe(cx,cz,rumo,folga=FOLGA_ROTA){
  if(Math.abs(cx)>MAPA_LIMITE||Math.abs(cz)>MAPA_LIMITE)return false;
  const y=alturaDoChaoDesenhado(cx,cz)+.1,L=LARGURA/2+folga,C=COMPRIMENTO/2+folga;
  const sx=Math.sin(rumo),cs=Math.cos(rumo);
  for(const[dl,dc]of[[-L,-C],[L,-C],[-L,C],[L,C],[-L,0],[L,0]])
    if(colideParedeXZ(cx+cs*dl+sx*dc,cz-sx*dl+cs*dc,y,.02,.02,.9))return false;
  return true;
}
function segmentoLivre(a,b){
  const dist=Math.hypot(b.x-a.x,b.z-a.z);if(dist<.05)return true;
  const n=Math.max(2,Math.ceil(dist/PASSO_VALIDACAO)),rumo=Math.atan2(b.x-a.x,b.z-a.z);
  let h0=alturaDoChaoDesenhado(a.x,a.z);
  for(let i=1;i<=n;i++){
    const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,h=alturaDoChaoDesenhado(x,z);
    if(Math.abs(h-h0)/(dist/n)>INCLINACAO_MAX||!corpoCabe(x,z,rumo))return false;
    h0=h;
  }
  return true;
}
function curvaLivre(curva){
  const comp=curva.getLength(),n=Math.max(8,Math.ceil(comp/PASSO_VALIDACAO));
  let ant=curva.getPointAt(0),hAnt=alturaDoChaoDesenhado(ant.x,ant.z);
  for(let i=1;i<=n;i++){
    const u=i/n,p=curva.getPointAt(u),t=curva.getTangentAt(Math.min(.999,u)),h=alturaDoChaoDesenhado(p.x,p.z);
    const passo=Math.max(.01,Math.hypot(p.x-ant.x,p.z-ant.z));
    if(Math.abs(h-hAnt)/passo>INCLINACAO_MAX||!corpoCabe(p.x,p.z,Math.atan2(t.x,t.z)))return false;
    ant=p;hAnt=h;
  }
  return true;
}
function curvaPorPontos(pontos){
  if(pontos.length<2)return null;
  if(pontos.length===2)return new THREE.LineCurve3(new THREE.Vector3(pontos[0].x,0,pontos[0].z),new THREE.Vector3(pontos[1].x,0,pontos[1].z));
  const suave=new THREE.CatmullRomCurve3(pontos.map(p=>new THREE.Vector3(p.x,0,p.z)),false,'centripetal',.35);
  if(curvaLivre(suave))return suave;
  const path=new THREE.CurvePath();
  for(let i=0;i+1<pontos.length;i++)path.add(new THREE.LineCurve3(
    new THREE.Vector3(pontos[i].x,0,pontos[i].z),new THREE.Vector3(pontos[i+1].x,0,pontos[i+1].z)));
  return path;
}
function heapPush(heap,item){
  heap.push(item);let i=heap.length-1;
  while(i>0){const p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];i=p}heap[i]=item;
}
function heapPop(heap){
  if(!heap.length)return null;const raiz=heap[0],fim=heap.pop();if(!heap.length)return raiz;
  let i=0;while(true){let l=i*2+1;if(l>=heap.length)break;let r=l+1,c=r<heap.length&&heap[r].f<heap[l].f?r:l;if(heap[c].f>=fim.f)break;heap[i]=heap[c];i=c}heap[i]=fim;return raiz;
}
function buscarRotaGlobal(inicio,fim){
  const passo=GRADE_VEICULO;
  const gx=Math.round(fim.x/passo),gz=Math.round(fim.z/passo),sx=Math.round(inicio.x/passo),sz=Math.round(inicio.z/passo);
  const chave=(x,z)=>`${x},${z}`,ponto=(x,z)=>({x:x*passo,z:z*passo});
  const limite=Math.floor(MAPA_LIMITE/passo),abertos=[],gScore=new Map(),pais=new Map(),fechados=new Set(),arestas=new Map();
  const h=(x,z)=>Math.hypot(x-gx,z-gz)*passo;
  const sk=chave(sx,sz);gScore.set(sk,0);heapPush(abertos,{x:sx,z:sz,f:h(sx,sz)});
  let melhor={x:sx,z:sz,d:h(sx,sz)},final=null,visitados=0;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while(abertos.length&&visitados++<BUSCA_MAX_NOS){
    const atual=heapPop(abertos),ak=chave(atual.x,atual.z);if(fechados.has(ak))continue;fechados.add(ak);
    const ap=ponto(atual.x,atual.z),distFim=Math.hypot(ap.x-fim.x,ap.z-fim.z);
    if(distFim<melhor.d)melhor={x:atual.x,z:atual.z,d:distFim};
    if(distFim<=passo*1.6&&segmentoLivre(ap,fim)){final={x:atual.x,z:atual.z,completo:true};break}
    for(const[dx,dz]of dirs){
      const nx=atual.x+dx,nz=atual.z+dz;if(Math.abs(nx)>limite||Math.abs(nz)>limite)continue;
      const nk=chave(nx,nz);if(fechados.has(nk))continue;
      const np=ponto(nx,nz),ek=ak<nk?`${ak}|${nk}`:`${nk}|${ak}`;
      let livre=arestas.get(ek);if(livre===undefined){livre=segmentoLivre(ap,np);arestas.set(ek,livre)}if(!livre)continue;
      const custo=(gScore.get(ak)??Infinity)+Math.hypot(dx,dz)*passo,ant=gScore.get(nk);
      if(ant!==undefined&&custo>=ant)continue;
      gScore.set(nk,custo);pais.set(nk,ak);heapPush(abertos,{x:nx,z:nz,f:custo+h(nx,nz)});
    }
  }
  if(!final){
    if(melhor.d>=Math.hypot(inicio.x-fim.x,inicio.z-fim.z)-2)return null;
    final={x:melhor.x,z:melhor.z,completo:false};
  }
  const pontosGrade=[],coord=new Map();
  for(const k of gScore.keys()){const[x,z]=k.split(',').map(Number);coord.set(k,{x,z})}
  let k=chave(final.x,final.z);while(k){const c=coord.get(k)??(()=>{const[x,z]=k.split(',').map(Number);return{x,z}})();pontosGrade.push(ponto(c.x,c.z));k=pais.get(k)}
  pontosGrade.reverse();
  const pontos=[{x:inicio.x,z:inicio.z},...pontosGrade.slice(1)];
  if(final.completo)pontos.push({x:fim.x,z:fim.z});
  const limpos=[pontos[0]];let i=0;
  while(i<pontos.length-1){let j=pontos.length-1;for(;j>i+1;j--)if(segmentoLivre(pontos[i],pontos[j]))break;limpos.push(pontos[j]);i=j}
  return{pontos:limpos,completo:final.completo};
}
function montarCaminhoLivre(inicio,fim){
  const d=Math.hypot(fim.x-inicio.x,fim.z-inicio.z);if(d<.25)return null;
  if(segmentoLivre(inicio,fim)){
    const curva=curvaPorPontos([inicio,fim]);
    return{curva,comp:d,perfil:montarPerfilDe(curva,d,LATERAL_ATENDENDO,VEL_ATENDENDO,false),completo:true};
  }
  const dx=(fim.x-inicio.x)/d,dz=(fim.z-inicio.z)/d,nx=-dz,nz=dx;
  for(const desloc of[5,-5,9,-9,14,-14]){
    const m={x:(inicio.x+fim.x)/2+nx*desloc,z:(inicio.z+fim.z)/2+nz*desloc};
    if(!segmentoLivre(inicio,m)||!segmentoLivre(m,fim))continue;
    const curva=curvaPorPontos([inicio,m,fim]);if(!curva)continue;
    const comp=curva.getLength();
    return{curva,comp,perfil:montarPerfilDe(curva,comp,LATERAL_ATENDENDO,VEL_ATENDENDO,false),completo:true};
  }
  const global=buscarRotaGlobal(inicio,fim);if(!global||global.pontos.length<2)return null;
  const curva=curvaPorPontos(global.pontos);if(!curva)return null;const comp=curva.getLength();
  return{curva,comp,perfil:montarPerfilDe(curva,comp,LATERAL_ATENDENDO,VEL_ATENDENDO,false),completo:global.completo};
}

let DESVIOS=null;
function desvios(){
  if(DESVIOS)return DESVIOS;DESVIOS=[];
  for(const beco of becos){
    const a=beco.getPointAt(0),b=beco.getPointAt(1),ua=uMaisPerto(a),ub=uMaisPerto(b);
    const pa=ROTA.getPointAt(ua),pb=ROTA.getPointAt(ub),da=Math.hypot(pa.x-a.x,pa.z-a.z),db=Math.hypot(pb.x-b.x,pb.z-b.z);
    if(Math.min(da,db)<=4)DESVIOS.push({curva:beco,comp:beco.getLength(),uEntra:da<=db?ua:ub,uSai:da<=db?ua:ub});
  }
  return DESVIOS;
}
export function __desvios(){return desvios().map(d=>({comp:+d.comp.toFixed(1),uEntra:+d.uEntra.toFixed(4),uSai:+d.uSai.toFixed(4)}))}
export function __curvaDesvio(i){return desvios()[i]?.curva??null}

const viaturas=[];let modelo=null,proximaVisaoViatura=0,avistamentoViatura=null;
function linhaLivreViatura(v){
  const dx=player.position.x-v.grupo.position.x,dz=player.position.z-v.grupo.position.z,d=Math.hypot(dx,dz);
  if(d>VISAO_VIATURA||d<.01)return false;
  const fx=-Math.sin(v.grupo.rotation.y),fz=-Math.cos(v.grupo.rotation.y);
  if((fx*dx+fz*dz)/d<VISAO_VIATURA_COS)return false;
  const n=Math.max(2,Math.ceil(d/1.2));
  const y0=alturaDoChaoDesenhado(v.grupo.position.x,v.grupo.position.z)+.72,y1=player.position.y+.55;
  for(let i=1;i<n;i++){
    const t=i/n,x=v.grupo.position.x+dx*t,z=v.grupo.position.z+dz*t,y=y0+(y1-y0)*t;
    if(colideParedeXZ(x,z,y,.04,.04,.20))return false;
  }
  return true;
}
function atualizarVisaoViaturas(agora){
  if(agora<proximaVisaoViatura)return;
  proximaVisaoViatura=agora+VISAO_VIATURA_INTERVALO;
  for(const v of viaturas){
    if(!v.grupo.visible||!linhaLivreViatura(v))continue;
    avistamentoViatura={x:player.position.x,z:player.position.z,t:agora};
    break;
  }
}
export function consumirAvistamentoViatura(){const a=avistamentoViatura;avistamentoViatura=null;return a}

function criarViatura(u0){
  const grupo=new THREE.Group();grupo.name='viatura';grupo.rotation.order='YXZ';grupo.visible=false;scene.add(grupo);
  const barra=new THREE.Group();barra.position.set(0,.83,0);grupo.add(barra);
  const lampada=(cor,x)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.16,.07,.16),new THREE.MeshStandardMaterial({color:cor,emissive:cor,emissiveIntensity:.2}));m.position.set(x,0,0);barra.add(m);return m};
  const luzes=[lampada(0x3366ff,-.18),lampada(0xff3322,.18)],caixa=new THREE.Box3(new THREE.Vector3(0,-9999,0),new THREE.Vector3(.01,-9998.99,.01));
  marcarObstaculoMovel(registrarCaixa(caixa,'viatura'));
  return{grupo,u:u0,luzes,caixa,piscaT:0,vel:0,mao:MAO,atendendo:false,desembarcou:false,destino:u0,
    rotaDinamica:null,sRota:0,baseU:u0,semAcesso:false,modoBusca:false,retornando:false,rumoSuave:null,
    proximoPlano:performance.now()/1000+u0*.25,ultimoAlvoPlano:null,papelDespacho:'ronda'};
}
function caminhoAtual(v){
  if(v.rotaDinamica){const t=Math.min(1,Math.max(0,v.sRota/v.rotaDinamica.comp));return{curva:v.rotaDinamica.curva,t,fora:true}}
  return{curva:ROTA,t:v.u,fora:false};
}
function assentar(v,dt=0){
  const atual=caminhoAtual(v),eixo=atual.curva.getPointAt(atual.t),t=atual.curva.getTangentAt(Math.min(.999,atual.t));
  const rumo=Math.atan2(-t.x,-t.z),p={x:eixo.x-t.z*(atual.fora?0:v.mao),z:eixo.z+t.x*(atual.fora?0:v.mao)};
  const yF=alturaDoChaoDesenhado(p.x+t.x*ENTRE_EIXOS,p.z+t.z*ENTRE_EIXOS),yT=alturaDoChaoDesenhado(p.x-t.x*ENTRE_EIXOS,p.z-t.z*ENTRE_EIXOS);
  v.grupo.position.set(p.x,(yF+yT)/2+ALTURA_ASSENTO,p.z);
  if(v.rumoSuave==null||!dt)v.rumoSuave=rumo;
  else{const delta=Math.atan2(Math.sin(rumo-v.rumoSuave),Math.cos(rumo-v.rumoSuave)),lim=GIRO_MAX_RAD_S*dt;v.rumoSuave+=Math.max(-lim,Math.min(lim,delta))}
  v.grupo.rotation.y=v.rumoSuave;v.grupo.rotation.x=Math.atan2(yF-yT,ENTRE_EIXOS*2);
  const rumoCaixa=v.grupo.rotation.y,c=Math.abs(Math.cos(rumoCaixa)),sn=Math.abs(Math.sin(rumoCaixa)),meiaX=(COMPRIMENTO*sn+LARGURA*c)/2,meiaZ=(COMPRIMENTO*c+LARGURA*sn)/2,y=obterElevacao(p.x,p.z);
  v.caixa.min.set(p.x-meiaX,y-.1,p.z-meiaZ);v.caixa.max.set(p.x+meiaX,y+ALTURA_COLISAO,p.z+meiaZ);
}
new GLTFLoader().load('assets/viatura.glb',gltf=>{
  modelo=gltf.scene;modelo.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  const b=new THREE.Box3().setFromObject(modelo),tam=b.getSize(new THREE.Vector3()),maior=Math.max(tam.x,tam.y,tam.z)||1,c=b.getCenter(new THREE.Vector3());
  modelo.scale.setScalar(COMPRIMENTO/maior);modelo.position.sub(c);modelo.position.y+=tam.y*.5/maior*COMPRIMENTO;modelo.rotation.y=-Math.PI/2;
  viaturas.forEach((v,i)=>{v.grupo.add(i?modelo.clone():modelo);v.grupo.visible=true;assentar(v)});
},undefined,err=>console.warn('Quintal 3D: viatura não carregou',err));
viaturas.push(criarViatura(0),criarViatura(.5));

// ===== MEMÓRIA DO ALVO + INTERCEPTAÇÃO =====
let amostraAlvo=null,proximoDespacho=0;
function atualizarVelocidadeAlvo(alvo){
  if(!alvo||alvo.quente===false)return{x:0,z:0};
  const agora=performance.now()/1000;
  if(!amostraAlvo){amostraAlvo={x:alvo.x,z:alvo.z,t:agora,vx:0,vz:0};return{x:0,z:0}}
  const dt=agora-amostraAlvo.t;
  if(dt>.08){
    let vx=(alvo.x-amostraAlvo.x)/dt,vz=(alvo.z-amostraAlvo.z)/dt,s=Math.hypot(vx,vz);
    if(s>ALVO_VEL_MAX){vx*=ALVO_VEL_MAX/s;vz*=ALVO_VEL_MAX/s}
    amostraAlvo={x:alvo.x,z:alvo.z,t:agora,vx,vz};
  }
  return{x:amostraAlvo.vx,z:amostraAlvo.vz};
}
function pontoInterceptacao(v,alvo,velAlvo){
  if(!alvo||alvo.quente===false)return{x:alvo.x,z:alvo.z};
  const d=Math.hypot(alvo.x-v.grupo.position.x,alvo.z-v.grupo.position.z);
  const extra=v.papelDespacho==='bloqueio'?1.25:0;
  const lead=Math.min(INTERCEPTA_MAX+extra,d/Math.max(6,VEL_ATENDENDO)+extra);
  return{x:THREE.MathUtils.clamp(alvo.x+velAlvo.x*lead,-MAPA_LIMITE,MAPA_LIMITE),z:THREE.MathUtils.clamp(alvo.z+velAlvo.z*lead,-MAPA_LIMITE,MAPA_LIMITE)};
}
function pontoAbordagem(v,alvo,velAlvo){
  const previsto=pontoInterceptacao(v,alvo,velAlvo);
  if(!alvo||alvo.quente===false)return previsto;
  const dx=previsto.x-v.grupo.position.x,dz=previsto.z-v.grupo.position.z,d=Math.hypot(dx,dz);
  if(d<.01)return{x:v.grupo.position.x,z:v.grupo.position.z};
  const recuo=Math.min(DISTANCIA_SEGURA,d*.45);
  return{x:previsto.x-dx/d*recuo,z:previsto.z-dz/d*recuo};
}
function planejar(v,alvo,velAlvo){
  const distJogador=alvo?Math.hypot(alvo.x-v.grupo.position.x,alvo.z-v.grupo.position.z):Infinity;
  if(alvo&&alvo.quente!==false&&distJogador<=DISTANCIA_SEGURA+.6){
    if(!v.rotaDinamica)v.destino=v.u;
    v.semAcesso=false;v.modoBusca=false;v.retornando=false;return;
  }
  const previsto=pontoAbordagem(v,alvo,velAlvo),inicio={x:v.grupo.position.x,z:v.grupo.position.z};
  const caminho=montarCaminhoLivre(inicio,previsto);
  if(caminho){
    if(!v.rotaDinamica)v.baseU=v.u;
    v.rotaDinamica=caminho;v.sRota=0;v.semAcesso=!caminho.completo;v.modoBusca=alvo.quente===false;v.desembarcou=false;v.retornando=false;
    return;
  }
  if(v.rotaDinamica){v.semAcesso=true;v.modoBusca=alvo.quente===false;return}
  v.sRota=0;v.destino=uMaisPerto(previsto);v.semAcesso=true;v.modoBusca=alvo.quente===false;v.desembarcou=false;
}
function tentarVoltarAoAnel(v){
  if(!v.rotaDinamica)return;
  const alvo=ROTA.getPointAt(v.baseU),inicio={x:v.grupo.position.x,z:v.grupo.position.z},volta=montarCaminhoLivre(inicio,alvo);
  if(volta){v.rotaDinamica=volta;v.sRota=0;v.semAcesso=false;v.modoBusca=false;v.retornando=true}
  else{v.rotaDinamica=null;v.sRota=0;v.u=uMaisPerto(inicio);v.retornando=false}
}

const despachadas=[];
export function atualizarViaturas(dt,alvo,segurar){
  if(!modelo)return null;
  let desembarque=null;const agora=performance.now()/1000;
  atualizarVisaoViaturas(agora);
  const querem=alvo&&alvo.perseguicao&&(alvo.nivel??0)>=PERSEGUICAO_DUAS?2:1;
  if(!alvo&&!segurar){
    amostraAlvo=null;proximoDespacho=0;
    for(const v of despachadas){if(v.rotaDinamica&&!v.retornando)tentarVoltarAoAnel(v);v.atendendo=false;v.ultimoAlvoPlano=null;v.papelDespacho='ronda'}
    despachadas.length=0;
  }
  // Não manda duas viaturas no mesmo segundo. A primeira responde; a segunda, só em ficha alta e
  // depois de um intervalo, entra como bloqueio/interceptação em vez de formar um comboio colado.
  if(alvo&&despachadas.length<querem&&agora>=proximoDespacho){
    const destino=uMaisPerto(alvo);let escolhida=null,melhor=Infinity;
    for(const v of viaturas){if(despachadas.includes(v))continue;const d=v.rotaDinamica?Math.hypot(v.grupo.position.x-alvo.x,v.grupo.position.z-alvo.z):faltaAte(v.u,destino);if(d<melhor){melhor=d;escolhida=v}}
    if(escolhida){
      escolhida.destino=destino;escolhida.baseU=escolhida.u;escolhida.retornando=false;
      escolhida.papelDespacho=despachadas.length?'bloqueio':'principal';
      escolhida.proximoPlano=0;escolhida.ultimoAlvoPlano=null;
      despachadas.push(escolhida);proximoDespacho=agora+DESPACHO_INTERVALO;
    }
  }
  const velAlvo=atualizarVelocidadeAlvo(alvo);
  if(alvo&&despachadas.length){
    // No máximo UMA busca pesada de rota por quadro. Cada carro tem relógio e memória próprios; se o
    // alvo mal saiu do lugar, mantém a rota atual em vez de refazer A* por rotina.
    let planejou=false;
    for(const v of despachadas){
      if(planejou||agora<v.proximoPlano)continue;
      const limiar=alvo.quente===false?3.5:REPLANEJAR_ALVO_DESVIO;
      const mudou=!v.ultimoAlvoPlano||Math.hypot(v.ultimoAlvoPlano.x-alvo.x,v.ultimoAlvoPlano.z-alvo.z)>=limiar;
      if(!mudou&&v.rotaDinamica&&!v.semAcesso)continue;
      planejar(v,alvo,alvo.perseguicao?velAlvo:{x:0,z:0});
      v.ultimoAlvoPlano={x:alvo.x,z:alvo.z};
      v.proximoPlano=agora+(alvo.perseguicao?PERSEGUICAO_RECALCULA:.95);
      planejou=true;
    }
  }
  for(const v of viaturas){
    const atendendo=despachadas.includes(v);v.atendendo=atendendo;
    if(v.rotaDinamica){
      const r=v.rotaDinamica,idx=Math.min(N_PERFIL-1,Math.floor(Math.min(.999,v.sRota/r.comp)*N_PERFIL));
      let teto=r.perfil[idx]??VEL_ATENDENDO;const falta=Math.max(0,r.comp-v.sRota),vaiParar=atendendo&&!v.retornando;
      const distJogador=atendendo&&alvo&&alvo.quente!==false?Math.hypot(alvo.x-v.grupo.position.x,alvo.z-v.grupo.position.z):Infinity;
      if(v.modoBusca)teto=Math.min(teto,VEL_BUSCA);
      if(vaiParar)teto=Math.min(teto,Math.sqrt(Math.max(0,2*FREIO*Math.max(0,falta-CHEGOU))));
      if(distJogador<RAIO_APROXIMACAO){
        const freioJogador=Math.sqrt(Math.max(0,2*FREIO*Math.max(0,distJogador-DISTANCIA_SEGURA)));
        teto=Math.min(teto,VEL_APROXIMACAO,freioJogador);
      }
      if(distJogador<=DISTANCIA_SEGURA)teto=0;
      const acel=atendendo?ACEL_ATENDENDO:ACEL_RONDA;const lim=teto>v.vel?acel*dt:FREIO*dt;v.vel+=Math.max(-lim,Math.min(lim,teto-v.vel));if(v.vel<0)v.vel=0;
      const avancoJogador=Number.isFinite(distJogador)?Math.max(0,distJogador-DISTANCIA_SEGURA):Infinity;
      v.sRota+=Math.min(v.vel*dt,vaiParar?Math.max(0,falta-CHEGOU):Infinity,avancoJogador);
      if(v.retornando&&v.sRota>=r.comp-.1){v.rotaDinamica=null;v.sRota=0;v.u=v.baseU;v.retornando=false}
      if(vaiParar&&!v.desembarcou&&falta<=CHEGOU+.15&&v.vel<.4){v.desembarcou=true;desembarque={x:v.grupo.position.x,z:v.grupo.position.z}}
    }else{
      let teto=tetoEm(atendendo?PERFIL_ATENDENDO:PERFIL_RONDA,v.u),falta=Infinity,distJogador=Infinity;
      if(atendendo){
        falta=faltaAte(v.u,v.destino);const precisaParar=v.semAcesso||!alvo||alvo.quente!==false;
        if(alvo&&alvo.quente!==false)distJogador=Math.hypot(alvo.x-v.grupo.position.x,alvo.z-v.grupo.position.z);
        if(precisaParar)teto=Math.min(teto,Math.sqrt(Math.max(0,2*FREIO*Math.max(0,falta-CHEGOU))));
        else if(falta<22||falta>COMPRIMENTO_DA_ROTA-22)teto=Math.min(teto,VEL_BUSCA);
        if(distJogador<RAIO_APROXIMACAO){
          const freioJogador=Math.sqrt(Math.max(0,2*FREIO*Math.max(0,distJogador-DISTANCIA_SEGURA)));
          teto=Math.min(teto,VEL_APROXIMACAO,freioJogador);
        }
        if(distJogador<=DISTANCIA_SEGURA)teto=0;
      }
      const acel=atendendo?ACEL_ATENDENDO:ACEL_RONDA;const lim=teto>v.vel?acel*dt:FREIO*dt;v.vel+=Math.max(-lim,Math.min(lim,teto-v.vel));if(v.vel<0)v.vel=0;
      const parar=atendendo&&(v.semAcesso||!alvo||alvo.quente!==false),anda=Math.min(v.vel*dt,parar?Math.max(0,falta-CHEGOU):Infinity,Number.isFinite(distJogador)?Math.max(0,distJogador-DISTANCIA_SEGURA):Infinity);
      v.u=(v.u+anda/COMPRIMENTO_DA_ROTA)%1;
      if(atendendo&&v.semAcesso&&!v.desembarcou&&falta<=DESEMBARQUE_SEM_ACESSO&&v.vel<.4){v.desembarcou=true;desembarque={x:v.grupo.position.x,z:v.grupo.position.z}}
    }
    let maoAlvo=MAO;
    if(!atendendo&&!v.rotaDinamica)for(const outra of viaturas){if(outra===v||outra.vel>.3)continue;const d=Math.min(faltaAte(v.u,outra.u),faltaAte(outra.u,v.u));if(d<PERTO_PRA_DESVIAR){maoAlvo=MAO_DESVIANDO;break}}
    v.mao+=Math.max(-TROCA_DE_FAIXA*dt,Math.min(TROCA_DE_FAIXA*dt,maoAlvo-v.mao));
    if(atendendo){v.piscaT+=dt;const liga=Math.floor(v.piscaT*4)%2;v.luzes[0].material.emissiveIntensity=liga?2.4:.15;v.luzes[1].material.emissiveIntensity=liga?.15:2.4}
    else{v.piscaT=0;for(const l of v.luzes)l.material.emissiveIntensity=.2}
    assentar(v,dt);
  }
  return desembarque;
}

export function __viaturas(){
  return viaturas.map(v=>({x:+v.grupo.position.x.toFixed(2),z:+v.grupo.position.z.toFixed(2),rumo:+v.grupo.rotation.y.toFixed(3),u:+v.u.toFixed(4),vel:+v.vel.toFixed(2),atendendo:v.atendendo,mao:+v.mao.toFixed(2),desvio:null,sDesvio:0,rotaDinamica:!!v.rotaDinamica,semAcesso:v.semAcesso,busca:v.modoBusca,piscando:v.luzes[0].material.emissiveIntensity>1||v.luzes[1].material.emissiveIntensity>1,caixa:{minX:v.caixa.min.x,minY:v.caixa.min.y,minZ:v.caixa.min.z,maxX:v.caixa.max.x,maxY:v.caixa.max.y,maxZ:v.caixa.max.z}}));
}
