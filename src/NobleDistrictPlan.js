// ===== PLANTA URBANA VALIDADA — JARDINS DO MORRO =====
// A rede nova nasce COMO CONTINUACAO da viaBaixa da favela. Nao existe sistema paralelo de rua.
// A largura, a tangente da emenda e a altura visual usam exatamente os mesmos contratos da favela.
import*as THREE from'three';
import{viaBaixa,VIA_LARGURA,levanteContraQuina,PASSO_DA_FITA}from'./Favela.js';

export const CJ={x:31.3,z:71.7};
const JUNCAO=viaBaixa.getPointAt(1).clone();
const TANGENTE_JUNCAO=viaBaixa.getTangentAt(1).normalize();
export const LIGACAO_FAVELA={x:JUNCAO.x,z:JUNCAO.z};
export const VIA_PRINCIPAL_LARGURA=VIA_LARGURA;
export const ALAMEDA_LARGURA=VIA_LARGURA;
export const CALCADA_LARGURA=1.2;
export const FAIXA_TECNICA=.65;
export const RECUO_LOTE_MIN=1.8;
export const RAIO_PROTECAO_CJ=9.5;

// O penultimo ponto e calculado A PARTIR DA TANGENTE REAL da viaBaixa. Como esta curva e percorrida
// da CJ para a favela, ela chega na juncao pelo sentido oposto da viaBaixa, mas sobre a MESMA reta
// tangente. Resultado: centro, largura e direcao fecham sem cotovelo nem faixa solta na emenda.
const ENTRADA=JUNCAO.clone().addScaledVector(TANGENTE_JUNCAO,5.2);
export const avenidaNobre=new THREE.CatmullRomCurve3([
  new THREE.Vector3(31.3,0,68.0),
  new THREE.Vector3(32.0,0,60.0),
  new THREE.Vector3(29.8,0,51.0),
  new THREE.Vector3(30.5,0,42.0),
  new THREE.Vector3(27.5,0,33.0),
  new THREE.Vector3(21.0,0,26.0),
  new THREE.Vector3(17.5,0,20.5),
  new THREE.Vector3(20.5,0,14.5),
  new THREE.Vector3(25.7,0,7.7),
  ENTRADA,
  JUNCAO
],false,'catmullrom',.5);

const pO=avenidaNobre.getPointAt(.34);
export const alamedaOeste=new THREE.CatmullRomCurve3([
  pO,
  new THREE.Vector3(pO.x-5.5,0,pO.z+1.5),
  new THREE.Vector3(pO.x-11.0,0,pO.z+3.0),
  new THREE.Vector3(pO.x-17.0,0,pO.z+.8)
],false,'catmullrom',.5);
const pL=avenidaNobre.getPointAt(.60);
export const alamedaLeste=new THREE.CatmullRomCurve3([
  pL,
  new THREE.Vector3(pL.x+6.0,0,pL.z+1.8),
  new THREE.Vector3(pL.x+12.5,0,pL.z+3.5),
  new THREE.Vector3(pL.x+18.0,0,pL.z+1.6)
],false,'catmullrom',.5);

export const vias=[
  {nome:'avenida',curva:avenidaNobre,largura:VIA_PRINCIPAL_LARGURA},
  {nome:'alameda-oeste',curva:alamedaOeste,largura:ALAMEDA_LARGURA},
  {nome:'alameda-leste',curva:alamedaLeste,largura:ALAMEDA_LARGURA},
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
  for(const v of vias){
    if(distanciaAoEixo(v.curva,x,z).distancia<corredorTotal(v)+margem)return true;
  }
  return false;
}

export function loteSeguro(cx,cz,giro,w,d,margem=.25){
  const c=Math.cos(giro),s=Math.sin(giro);
  const pts=[];
  for(const lx of[-w/2,0,w/2])for(const lz of[-d/2,0,d/2]){
    const x=cx+lx*c+lz*s,z=cz-lx*s+lz*c;pts.push([x,z]);
  }
  return pts.every(([x,z])=>!pontoEmCorredorViario(x,z,margem));
}

// Compatibilidade com as casas: esta e a COTA DA MESMA FITA que a favela desenha, nao um perfil
// suavizado inventado. Assim rampa de garagem, asfalto e roda consultam a mesma referencia visual.
export function alturaPerfil(via,u){
  const p=via.curva.getPointAt(THREE.MathUtils.clamp(u,0,1));
  return levanteContraQuina(p.x,p.z,PASSO_DA_FITA)+.002;
}

console.info('[bairro-nobre-plan] continuidade=favela | largura=%.1fm | juncao=(%.2f,%.2f) | corredor=%.2fm',VIA_PRINCIPAL_LARGURA,LIGACAO_FAVELA.x,LIGACAO_FAVELA.z,corredorTotal(vias[0])*2);
