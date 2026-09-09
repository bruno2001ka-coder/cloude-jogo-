import * as THREE from 'three';
import {favela,lotes} from './Favela.js';
import {bmat,ferroMat,pvcMat,janelaAcesa} from './Materials.js';

// Camada visual adicional de fachada.
// Nao registra colisores, nao toca nos lotes e nao altera NavMesh.
const grupo=new THREE.Group();
grupo.name='favela-fachadas-detalhadas';
favela.add(grupo);

const matCaixa=bmat(0xb9b4a8);
const matCaixaEscura=bmat(0x4a4740);
const matMoldura=bmat(0x8b8174);
const matVent=bmat(0x2c2925);
const matLamp=bmat(0x5b554b);

const dados=new Map();
function empilhar(chave,geo,material,matriz){
  if(!dados.has(chave))dados.set(chave,{geo,material,matrizes:[]});
  dados.get(chave).matrizes.push(matriz.clone());
}
const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler(),P=new THREE.Vector3(),S=new THREE.Vector3();
function matriz(x,y,z,giro,sx=1,sy=1,sz=1){
  E.set(0,giro,0);Q.setFromEuler(E);P.set(x,y,z);S.set(sx,sy,sz);
  return M.compose(P,Q,S);
}
function noLote(l,dx,dz){
  const c=Math.cos(l.giro),s=Math.sin(l.giro);
  return{x:l.x+dx*c+dz*s,z:l.z-dx*s+dz*c};
}

// Geometrias unitarias compartilhadas; a escala vem pela matriz de instancia.
const GEO_BOX=new THREE.BoxGeometry(1,1,1);
const GEO_CIL=new THREE.CylinderGeometry(.5,.5,1,6,1,true);
const GEO_LAMP=new THREE.SphereGeometry(.5,6,4);

function instBox(chave,material,x,y,z,giro,w,h,d){
  empilhar(chave,GEO_BOX,material,matriz(x,y,z,giro,w,h,d));
}
function instCil(chave,material,x,y,z,giro,raio,altura){
  empilhar(chave,GEO_CIL,material,matriz(x,y,z,giro,raio*2,altura,raio*2));
}

let casasDetalhadas=0;
for(const l of lotes){
  // Comercio, cliente, bar e biqueira ja tem linguagem propria.
  if(l.papel)continue;
  if(!Number.isFinite(l.baseY))continue;

  const s=l.sem>>>0;
  const frente=l.prof/2;
  const lado=((s>>>4)&1)?1:-1;

  // ===== ENTRADA COM ESPESSURA =====
  // A porta ja existe no Favela.js. Aqui entra apenas batente/verga.
  const dado=(s>>>7)%100;
  const tipo=dado<34?'madeira':dado<58?'enrolar':dado<80?'chapa':'portao';
  if(tipo!=='enrolar'){
    const largura=tipo==='portao'?1.18:(tipo==='chapa'?1.12:1.10);
    const h=2.15,esp=.10,prof=.10;
    for(const sx of[-1,1]){
      const p=noLote(l,sx*largura/2,frente+.105);
      instBox('batente-lateral',matMoldura,p.x,l.baseY+h/2,p.z,l.giro,esp,h,prof);
    }
    const t=noLote(l,0,frente+.105);
    instBox('batente-superior',matMoldura,t.x,l.baseY+h+.02,t.z,l.giro,largura+.10,.12,prof);
  }

  // ===== PADRAO DE ENERGIA / RELOGIO =====
  // Caixa, visor e eletroduto aparente, deslocados da porta.
  if(((s>>>10)%100)<78){
    const dx=lado*Math.min(l.larg*.34,1.35);
    const p=noLote(l,dx,frente+.115);
    const y=l.baseY+.98+((s>>>16)%20)/100;
    instBox('medidor-corpo',matCaixa,p.x,y,p.z,l.giro,.30,.46,.12);
    const v=noLote(l,dx,frente+.185);
    instBox('medidor-visor',matCaixaEscura,v.x,y+.055,v.z,l.giro,.19,.20,.025);
    const alt=1.25+((s>>>20)%55)/100;
    const c=noLote(l,dx,frente+.145);
    instCil('eletroduto',ferroMat,c.x,y+.23+alt/2,c.z,l.giro,.018,alt);
  }

  // ===== RESPIRO / COBOGO =====
  // Acabamento superficial: nao abre buraco na parede fisica.
  if(((s>>>13)%100)<42){
    const dx=-lado*Math.min(l.larg*.31,1.15);
    const p=noLote(l,dx,frente+.112);
    const y=l.baseY+2.08;
    instBox('respiro-fundo',matVent,p.x,y,p.z,l.giro,.56,.28,.035);
    for(let i=0;i<3;i++){
      const q=noLote(l,dx+(i-1)*.16,frente+.135);
      instBox('respiro-divisoria',matCaixa,q.x,y,q.z,l.giro,.035,.24,.035);
    }
  }

  // ===== CANO CURTO EXPOSTO NA FACHADA =====
  // Complementa o PVC do telhado sem duplicar a queda-d'agua longa existente.
  if(((s>>>18)%100)<36){
    const dx=lado*Math.min(l.larg*.42,1.55);
    const p=noLote(l,dx,frente+.12);
    const base=l.baseY+.32,alt=.70+((s>>>24)%30)/100;
    instCil('cano-fachada',pvcMat,p.x,base+alt/2,p.z,l.giro,.022,alt);
    const q=noLote(l,dx-lado*.16,frente+.12);
    instCil('cano-fachada-curto',pvcMat,q.x,base+alt,p.z,l.giro,.022,.32);
  }

  // ===== LUZ DE PORTA =====
  // Sem PointLight: emissao pequena, sem multiplicar shadow passes no celular.
  if(((s>>>21)%100)<34){
    const p=noLote(l,0,frente+.18);
    instBox('arandela-base',matLamp,p.x,l.baseY+2.40,p.z,l.giro,.24,.10,.10);
    const q=noLote(l,0,frente+.235);
    empilhar('arandela-luz',GEO_LAMP,janelaAcesa,matriz(q.x,l.baseY+2.37,q.z,l.giro,.11,.08,.07));
  }

  casasDetalhadas++;
}

for(const[chave,{geo,material,matrizes}]of dados){
  if(!matrizes.length)continue;
  const im=new THREE.InstancedMesh(geo,material,matrizes.length);
  im.name='fachada-'+chave;
  for(let i=0;i<matrizes.length;i++)im.setMatrixAt(i,matrizes[i]);
  im.instanceMatrix.needsUpdate=true;
  im.frustumCulled=false;
  im.castShadow=false;
  im.receiveShadow=true;
  grupo.add(im);
}

console.info('[favela visual] fachadas detalhadas=%d tiposInstanciados=%d',casasDetalhadas,dados.size);
