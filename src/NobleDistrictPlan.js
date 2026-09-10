// ===== PLANTA URBANA — JARDINS DO MORRO / 5 QUARTEIROES =====
// Toda a rede e continuacao da viaBaixa da favela e usa o MESMO sistema de asfalto/terreno.
// Regra: primeiro rua e cruzamento; depois lote. Nenhuma casa decide onde a rua fica.
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
export const RECUO_LOTE_MIN=.72;
export const RAIO_PROTECAO_CJ=9.5;

// A avenida nasce no alto, passa pela CJ e chega NA MESMA RETA/TANGENTE da viaBaixa.
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

// Quatro transversais atravessam a avenida. Elas dividem a subida em CINCO quarteiroes legiveis.
// O eixo central de cada transversal e exatamente um ponto da avenida: T/+/cruzamento nunca nasce
// alguns metros fora do lugar por aproximacao visual.
function transversal(nome,u,meiaEsq,meiaDir,curva=.8){
  const p=avenidaNobre.getPointAt(u),t=avenidaNobre.getTangentAt(u).normalize();
  const nx=-t.z,nz=t.x;
  const P=(d,avan=0)=>new THREE.Vector3(p.x+nx*d+t.x*avan,0,p.z+nz*d+t.z*avan);
  const c=new THREE.CatmullRomCurve3([
    P(-meiaEsq,1.0),P(-meiaEsq*.52,-curva),p.clone(),P(meiaDir*.52,curva),P(meiaDir,-1.0)
  ],false,'catmullrom',.5);
  c.userData={nome,u};return c;
}
export const ruaAlta=transversal('rua-alta',.22,16,15,.7);
export const ruaJardins=transversal('rua-jardins',.39,18,17,1.0);
export const ruaMirante=transversal('rua-mirante',.56,17,19,.8);
export const ruaTransicao=transversal('rua-transicao',.73,16,17,.6);

export const vias=[
  {nome:'avenida',curva:avenidaNobre,largura:VIA_PRINCIPAL_LARGURA,tipo:'principal'},
  {nome:'rua-alta',curva:ruaAlta,largura:ALAMEDA_LARGURA,tipo:'transversal'},
  {nome:'rua-jardins',curva:ruaJardins,largura:ALAMEDA_LARGURA,tipo:'transversal'},
  {nome:'rua-mirante',curva:ruaMirante,largura:ALAMEDA_LARGURA,tipo:'transversal'},
  {nome:'rua-transicao',curva:ruaTransicao,largura:ALAMEDA_LARGURA,tipo:'transversal'}
];

// Metadado usado para debug/expansao: cinco setores entre os quatro cruzamentos.
export const QUARTEIROES=[
  {id:1,nome:'Alto da CJ',u0:.02,u1:.22},
  {id:2,nome:'Jardins Alto',u0:.22,u1:.39},
  {id:3,nome:'Mirante',u0:.39,u1:.56},
  {id:4,nome:'Jardins Baixo',u0:.56,u1:.73},
  {id:5,nome:'Transicao Favela',u0:.73,u1:.92}
];

export const corredorTotal=v=>v.largura/2+CALCADA_LARGURA+FAIXA_TECNICA+RECUO_LOTE_MIN;

export function distanciaAoEixo(curva,x,z,amostras=150){
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
export function loteSeguro(cx,cz,giro,w,d,margem=.20){
  const c=Math.cos(giro),s=Math.sin(giro);
  for(const lx of[-w/2,0,w/2])for(const lz of[-d/2,0,d/2]){
    const x=cx+lx*c+lz*s,z=cz-lx*s+lz*c;if(pontoEmCorredorViario(x,z,margem))return false;
  }
  return true;
}
export function alturaPerfil(via,u){
  const p=via.curva.getPointAt(THREE.MathUtils.clamp(u,0,1));
  return levanteContraQuina(p.x,p.z,PASSO_DA_FITA)+.002;
}
console.info('[bairro-nobre-plan] quarteiroes=%d vias=%d continuidade=favela juncao=(%.2f,%.2f)',QUARTEIROES.length,vias.length,LIGACAO_FAVELA.x,LIGACAO_FAVELA.z);
