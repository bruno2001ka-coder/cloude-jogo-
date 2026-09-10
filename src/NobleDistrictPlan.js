// ===== PLANTA URBANA — JARDINS DO MORRO / 5 QUARTEIROES REAIS =====
// Regra herdada da Favela.js: primeiro a rede viaria, depois o lote.
// A versao anterior dividia 74 m de avenida em cinco fatias de ~13 m; somando os corredores
// dos cruzamentos, quase nao sobrava frente edificavel. Agora a cidade cresce PARA OS LADOS:
// quatro quarteiroes grandes em torno da avenida e um quinto de transicao para a favela.
import*as THREE from'three';
import{viaBaixa,VIA_LARGURA,levanteContraQuina,PASSO_DA_FITA}from'./Favela.js';

export const CJ={x:31.3,z:71.7};
const JUNCAO=viaBaixa.getPointAt(1).clone();
const TANGENTE_JUNCAO=viaBaixa.getTangentAt(1).normalize();
export const LIGACAO_FAVELA={x:JUNCAO.x,z:JUNCAO.z};
export const VIA_PRINCIPAL_LARGURA=VIA_LARGURA;
export const ALAMEDA_LARGURA=VIA_LARGURA;
export const CALCADA_LARGURA=.92;
export const FAIXA_TECNICA=.38;
export const RECUO_LOTE_MIN=.62;
export const RAIO_PROTECAO_CJ=9.5;

// Eixo principal preservado: termina exatamente no ponto/tangente da viaBaixa da favela.
const ENTRADA=JUNCAO.clone().addScaledVector(TANGENTE_JUNCAO,5.2);
export const avenidaNobre=new THREE.CatmullRomCurve3([
  new THREE.Vector3(31.3,0,68.0),
  new THREE.Vector3(32.0,0,61.0),
  new THREE.Vector3(30.2,0,54.0),
  new THREE.Vector3(30.8,0,47.0),
  new THREE.Vector3(28.5,0,40.0),
  new THREE.Vector3(26.0,0,33.5),
  new THREE.Vector3(21.0,0,27.0),
  new THREE.Vector3(18.2,0,21.0),
  new THREE.Vector3(20.8,0,15.0),
  new THREE.Vector3(25.7,0,7.7),
  ENTRADA,JUNCAO
],false,'catmullrom',.5);

function lateral(u,lado,dist){
  const p=avenidaNobre.getPointAt(u),t=avenidaNobre.getTangentAt(u).normalize();
  return p.clone().add(new THREE.Vector3(-t.z*lado*dist,0,t.x*lado*dist));
}
const DIST=17.5;

// Duas coletoras acompanham a subida a ~17,5 m do eixo. A distancia foi escolhida para sobrar
// faixa edificavel real entre dois corredores viarios de ~4,5 m de raio.
const O24=lateral(.24,-1,DIST),O36=lateral(.36,-1,18.2),O48=lateral(.48,-1,DIST),O60=lateral(.60,-1,17.2),O72=lateral(.72,-1,DIST);
const L24=lateral(.24, 1,DIST),L36=lateral(.36, 1,18.0),L48=lateral(.48, 1,DIST),L60=lateral(.60, 1,17.0),L72=lateral(.72, 1,DIST);
export const coletoraOeste=new THREE.CatmullRomCurve3([O24,O36,O48,O60,O72],false,'catmullrom',.5);
export const coletoraLeste=new THREE.CatmullRomCurve3([L24,L36,L48,L60,L72],false,'catmullrom',.5);

function transversal(nome,u,o,l){
  const p=avenidaNobre.getPointAt(u),t=avenidaNobre.getTangentAt(u).normalize();
  const a=o.clone().lerp(p,.48),b=l.clone().lerp(p,.48);
  const c=new THREE.CatmullRomCurve3([o.clone(),a,p.clone(),b,l.clone()],false,'catmullrom',.5);
  c.userData={nome,u};return c;
}
export const ruaAlta=transversal('rua-alta',.24,O24,L24);
export const ruaMedia=transversal('rua-media',.48,O48,L48);
export const ruaBaixa=transversal('rua-baixa',.72,O72,L72);

// Quinto quarteirao: uma alca menor de transicao. Ela nasce e volta na avenida antes da juncao
// da favela; nao cria outra tecnologia de rua, apenas outro eixo que fitaDaVia vai revestir.
const T0=avenidaNobre.getPointAt(.74),T1=lateral(.78,1,9.5),T2=lateral(.84,1,14.5),T3=lateral(.90,1,8.0),T4=avenidaNobre.getPointAt(.92);
export const ruaTransicao=new THREE.CatmullRomCurve3([T0,T1,T2,T3,T4],false,'catmullrom',.5);

export const vias=[
  {nome:'avenida',curva:avenidaNobre,largura:VIA_PRINCIPAL_LARGURA,tipo:'principal'},
  {nome:'coletora-oeste',curva:coletoraOeste,largura:ALAMEDA_LARGURA,tipo:'coletora'},
  {nome:'coletora-leste',curva:coletoraLeste,largura:ALAMEDA_LARGURA,tipo:'coletora'},
  {nome:'rua-alta',curva:ruaAlta,largura:ALAMEDA_LARGURA,tipo:'transversal'},
  {nome:'rua-media',curva:ruaMedia,largura:ALAMEDA_LARGURA,tipo:'transversal'},
  {nome:'rua-baixa',curva:ruaBaixa,largura:ALAMEDA_LARGURA,tipo:'transversal'},
  {nome:'rua-transicao',curva:ruaTransicao,largura:ALAMEDA_LARGURA,tipo:'transicao'}
];

// Metadado legivel: 2 colunas x 2 faixas + alca de transicao = cinco quarteiroes.
export const QUARTEIROES=[
  {id:1,nome:'Jardins Oeste Alto',zona:'oeste',faixa:'alta'},
  {id:2,nome:'Jardins Leste Alto',zona:'leste',faixa:'alta'},
  {id:3,nome:'Jardins Oeste Baixo',zona:'oeste',faixa:'baixa'},
  {id:4,nome:'Jardins Leste Baixo',zona:'leste',faixa:'baixa'},
  {id:5,nome:'Transicao Favela',zona:'transicao',faixa:'baixa'}
];

export const corredorTotal=v=>v.largura/2+CALCADA_LARGURA+FAIXA_TECNICA+RECUO_LOTE_MIN;
export function distanciaAoEixo(curva,x,z,amostras=180){
  let melhor=Infinity,uMelhor=0;
  for(let i=0;i<=amostras;i++){
    const u=i/amostras,p=curva.getPointAt(u),d=Math.hypot(x-p.x,z-p.z);
    if(d<melhor){melhor=d;uMelhor=u}
  }
  return{distancia:melhor,u:uMelhor};
}
export function pontoEmCorredorViario(x,z,margem=0){
  if(Math.hypot(x-CJ.x,z-CJ.z)<RAIO_PROTECAO_CJ+margem)return true;
  for(const v of vias)if(distanciaAoEixo(v.curva,x,z).distancia<corredorTotal(v)+margem)return true;
  return false;
}
export function loteSeguro(cx,cz,giro,w,d,margem=.18){
  const c=Math.cos(giro),s=Math.sin(giro);
  for(const lx of[-w/2,0,w/2])for(const lz of[-d/2,0,d/2]){
    const x=cx+lx*c+lz*s,z=cz-lx*s+lz*c;
    if(pontoEmCorredorViario(x,z,margem))return false;
  }
  return true;
}
export function alturaPerfil(via,u){
  const p=via.curva.getPointAt(THREE.MathUtils.clamp(u,0,1));
  return levanteContraQuina(p.x,p.z,PASSO_DA_FITA)+.002;
}
console.info('[bairro-nobre-plan] quarteiroes=%d vias=%d layout=2x2+transicao continuidade=favela juncao=(%.2f,%.2f)',QUARTEIROES.length,vias.length,LIGACAO_FAVELA.x,LIGACAO_FAVELA.z);