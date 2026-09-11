// Favela removida do mapa.
// Este arquivo permanece APENAS como camada de compatibilidade para módulos antigos que ainda importam
// nomes daqui. Nenhuma casa, rua, beco, luz, colisor ou malha de favela é criada.
import*as THREE from'three';
import{alturaDoChaoDesenhado}from'./Terrain.js';

export const VIA_LARGURA=5.2;
export const BECO_MIN=2.0;
export const CHAO_PROFUNDIDADE=4;
export const ESP_PAREDE=.18;
export const PULO_ALCANCE=1.40;
export const PASSO_DA_FITA=.6;

// Grupo vazio de propósito. Manter o objeto evita quebrar módulos antigos que ainda fazem favela.add().
export const favela=new THREE.Group();
favela.name='favela-removida';

// Nenhuma estrutura urbana é criada.
export const lotes=[];
export const becos=[];
export const escadoes=[];
export const corredores=[];
export const casasOcas=[];
export const casasCliente=[];
export const casasPos=[];
export const pontosDeRonda=[];
export const BECOS=pontosDeRonda;
export const malhasFundidas=[];
export const diagnosticoDaPoda=Object.freeze({removida:true,lotes:0,becos:0,malhas:0});

// Curvas neutras mantêm compatibilidade com código de diagnóstico sem criar via visível.
export const viaPrincipal=new THREE.LineCurve3(
  new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,.01));
export const viaBaixa=new THREE.LineCurve3(
  new THREE.Vector3(0,0,0),new THREE.Vector3(.01,0,0));

// Bar/biqueira pertenciam à favela e saem junto dela. Raio zero torna qualquer interação impossível.
export const BAR={x:0,y:0,z:0,raio:0};
export const BIQUEIRA={x:0,y:0,z:0,raio:0};

export function atualizarFavelaVisivel(){/* removida: nada para atualizar */}
export function atualizarPortas(){/* não existem portas de favela */}
export function casaOcaEmQueEsta(){return null}

export function sumirCaixa(b){
  if(!b)return;
  b.min.set(0,-9999,0);b.max.set(.01,-9998.99,.01);
}
export function alternarPorta(r){
  if(!r)return false;
  r.aberta=!r.aberta;
  if(r.caixa&&r.caixaFechada){
    if(r.aberta)sumirCaixa(r.caixa);else r.caixa.copy(r.caixaFechada);
  }
  return r.aberta;
}

export function hashInt(a,b){
  let h=(Math.imul(a|0,73856093)^Math.imul(b|0,19349663))>>>0;
  h^=h>>>13;return h>>>0;
}
export const sorteio=(a,b)=>(hashInt(a,b)%100000)/100000;

export const aabbGirada=(w,d,a)=>{
  const c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
  return{W:w*c+d*s,D:w*s+d*c};
};
const eixosDe=r=>{const c=Math.cos(r.giro||0),s=Math.sin(r.giro||0);return[[c,-s],[s,c]]};
const projeta=(r,ex,ez)=>{
  const c=Math.cos(r.giro||0),s=Math.sin(r.giro||0);
  const w=r.lw??r.larg??0,d=r.ld??r.prof??0;
  return Math.abs(c*ex-s*ez)*w/2+Math.abs(s*ex+c*ez)*d/2;
};
export function retangulosSeTocam(a,b,folga=.15){
  const dx=b.x-a.x,dz=b.z-a.z;
  for(const r of[a,b])for(const[ex,ez]of eixosDe(r))
    if(Math.abs(dx*ex+dz*ez)>projeta(a,ex,ez)+projeta(b,ex,ez)+folga)return false;
  return true;
}

export function alturaDaLaje(l){
  return (l?.baseY||0)+(l?.andares||0)*2.55+.12;
}
export function calcularColisoresCasa(){return[]}

// As vias da favela não existem mais. Chamadas legadas recebem geometrias vazias.
export function fitaDaVia(){return new THREE.BufferGeometry()}
export function meioFioDaVia(){return new THREE.BufferGeometry()}

// O veículo ainda usa esta função como apoio no terreno. Sem asfalto da favela, o valor correto é
// simplesmente a altura real da malha de chão naquele ponto.
export function levanteContraQuina(x,z){
  return alturaDoChaoDesenhado(x,z);
}
