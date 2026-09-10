// ===== PLANTA URBANA VALIDADA — JARDINS DO MORRO =====
// Fase 1: somente rede viaria + zonas de exclusao. Nenhuma casa nasce aqui.
// Objetivo: impedir lote no meio da rua antes de voltar a construir as residencias.
import*as THREE from'three';
import{obterElevacao}from'./Terrain.js';

export const CJ={x:31.3,z:71.7};
export const LIGACAO_FAVELA={x:31,z:1.2};
export const VIA_PRINCIPAL_LARGURA=6.4;
export const ALAMEDA_LARGURA=5.1;
export const CALCADA_LARGURA=1.2;
export const FAIXA_TECNICA=.65;
export const RECUO_LOTE_MIN=1.8;
export const RAIO_PROTECAO_CJ=9.5;

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
  new THREE.Vector3(31.0,0,1.2)
],false,'centripetal');

const pO=avenidaNobre.getPointAt(.34);
export const alamedaOeste=new THREE.CatmullRomCurve3([
  pO,
  new THREE.Vector3(pO.x-5.5,0,pO.z+1.5),
  new THREE.Vector3(pO.x-11.0,0,pO.z+3.0),
  new THREE.Vector3(pO.x-17.0,0,pO.z+.8)
],false,'centripetal');
const pL=avenidaNobre.getPointAt(.60);
export const alamedaLeste=new THREE.CatmullRomCurve3([
  pL,
  new THREE.Vector3(pL.x+6.0,0,pL.z+1.8),
  new THREE.Vector3(pL.x+12.5,0,pL.z+3.5),
  new THREE.Vector3(pL.x+18.0,0,pL.z+1.6)
],false,'centripetal');

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
  // 9 pontos: 4 cantos, 4 meios e centro. O lote so passa se TODOS ficarem fora dos corredores.
  const pts=[];
  for(const lx of[-w/2,0,w/2])for(const lz of[-d/2,0,d/2]){
    const x=cx+lx*c+lz*s,z=cz-lx*s+lz*c;pts.push([x,z]);
  }
  return pts.every(([x,z])=>!pontoEmCorredorViario(x,z,margem));
}

// Perfil longitudinal filtrado: limita variacao brusca de cota entre amostras.
// Isso nao deforma o terreno ainda; e a referencia da pista da fase 1.
const perfis=new WeakMap();
export function perfilDaVia(via){
  if(perfis.has(via.curva))return perfis.get(via.curva);
  const n=Math.max(24,Math.ceil(via.curva.getLength()/2)),arr=[];
  for(let i=0;i<=n;i++){
    const u=i/n,p=via.curva.getPointAt(u);arr.push({u,y:obterElevacao(p.x,p.z)});
  }
  // duas passadas de media curta eliminam pequenos caroços sem criar degrau.
  for(let pass=0;pass<2;pass++)for(let i=1;i<arr.length-1;i++)arr[i].y=(arr[i-1].y+arr[i].y*2+arr[i+1].y)/4;
  perfis.set(via.curva,arr);return arr;
}

export function alturaPerfil(via,u){
  const a=perfilDaVia(via),f=THREE.MathUtils.clamp(u,0,1)*(a.length-1),i=Math.floor(f),j=Math.min(a.length-1,i+1),t=f-i;
  return THREE.MathUtils.lerp(a[i].y,a[j].y,t);
}

console.info('[bairro-nobre-plan] vias=%d | corredor avenida=%.2fm | protecao CJ=%.1fm',vias.length,corredorTotal(vias[0])*2,RAIO_PROTECAO_CJ);
