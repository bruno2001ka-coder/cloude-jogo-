// ===== BALAS COM TRAJETÓRIA REAL =====
// Antes o tiro era um raycast instantâneo que só testava as caixas dos policiais — ou seja, atravessava
// casa inteira e acertava alguém do outro lado. Agora cada tiro é um projétil que viaja, e o trecho
// percorrido em cada frame é testado contra as PAREDES e contra os alvos: o que vier primeiro ganha.
import*as THREE from'three';
import{scene}from'./core.js';
import{primeiroImpactoNoSegmento,intersectarSegmentoCaixa}from'./Physics.js';

const VELOCIDADE=95,VIDA_MAX=1.6,RAIO_BALA=.045;
// A polícia precisa do número pra ANTECIPAR o tiro (mirar onde o alvo vai estar). Exportado daqui, e
// não copiado lá, porque duas cópias da velocidade da bala divergem na primeira vez que alguém
// ajustar o balanceamento — e a divergência apareceria como pontaria misteriosamente pior.
export const VELOCIDADE_BALA=VELOCIDADE;

const balaGeo=new THREE.SphereGeometry(RAIO_BALA,6,5);
const balaMatJogador=new THREE.MeshBasicMaterial({color:0x9be6ff});
const balaMatPolicia=new THREE.MeshBasicMaterial({color:0xffcf6b});
// Rastro curto atrás da bala, pra leitura do tiro em movimento (a bala sozinha é pequena demais pra ver).
const rastroMatJogador=new THREE.LineBasicMaterial({color:0x9be6ff,transparent:true,opacity:.65});
const rastroMatPolicia=new THREE.LineBasicMaterial({color:0xffcf6b,transparent:true,opacity:.65});

const balas=[];
const impactos=[];
const impactoGeo=new THREE.SphereGeometry(.07,6,5);
const impactoMat=new THREE.MeshBasicMaterial({color:0xffe9b0,transparent:true,opacity:.9});

// deDoJogador: define quem pode ser atingido (o tiro do jogador não acerta o próprio jogador e vice-versa).
export function dispararBala(origem,direcao,deDoJogador){
  const mesh=new THREE.Mesh(balaGeo,deDoJogador?balaMatJogador:balaMatPolicia);
  mesh.position.copy(origem);scene.add(mesh);
  const rastro=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([origem.clone(),origem.clone()]),
    deDoJogador?rastroMatJogador:rastroMatPolicia);
  scene.add(rastro);
  balas.push({mesh,rastro,pos:origem.clone(),dir:direcao.clone().normalize(),vida:0,deDoJogador});
}

function criarImpacto(x,y,z){
  const m=new THREE.Mesh(impactoGeo,impactoMat.clone());
  m.position.set(x,y,z);scene.add(m);
  impactos.push({mesh:m,vida:0});
}

function removerBala(i){
  const b=balas[i];
  scene.remove(b.mesh);scene.remove(b.rastro);
  b.rastro.geometry.dispose();
  balas.splice(i,1);
}

// alvos: [{caixa:Box3, aoAtingir:fn}] — montado por quem chama, já filtrado por lado (jogador x polícia).
export function atualizarBalas(dt,obterAlvos){
  for(let i=balas.length-1;i>=0;i--){
    const b=balas[i];
    b.vida+=dt;
    if(b.vida>VIDA_MAX){removerBala(i);continue}

    const ax=b.pos.x,ay=b.pos.y,az=b.pos.z;
    const passo=VELOCIDADE*dt;
    const bx=ax+b.dir.x*passo,by=ay+b.dir.y*passo,bz=az+b.dir.z*passo;

    // 1) onde esse trecho bate numa parede?
    const parede=primeiroImpactoNoSegmento(ax,ay,az,bx,by,bz);
    let melhorT=parede?parede.t:Infinity;
    let alvoAtingido=null;

    // 2) algum alvo é atingido ANTES da parede? (se a parede vier primeiro, o tiro morre nela)
    for(const alvo of obterAlvos(b.deDoJogador)){
      const hit=intersectarSegmentoCaixa(alvo.caixa,ax,ay,az,bx-ax,by-ay,bz-az);
      if(hit!==null&&hit<melhorT){melhorT=hit;alvoAtingido=alvo}
    }

    if(melhorT<=1){
      const hx=ax+(bx-ax)*melhorT,hy=ay+(by-ay)*melhorT,hz=az+(bz-az)*melhorT;
      criarImpacto(hx,hy,hz);
      if(alvoAtingido)alvoAtingido.aoAtingir();
      removerBala(i);continue;
    }

    b.pos.set(bx,by,bz);
    b.mesh.position.copy(b.pos);
    const cauda=b.pos.clone().addScaledVector(b.dir,-Math.min(2.2,passo));
    b.rastro.geometry.setFromPoints([cauda,b.pos.clone()]);
  }

  for(let i=impactos.length-1;i>=0;i--){
    const im=impactos[i];
    im.vida+=dt;
    im.mesh.material.opacity=Math.max(0,.9-im.vida*4);
    im.mesh.scale.setScalar(1+im.vida*5);
    if(im.vida>.22){scene.remove(im.mesh);im.mesh.material.dispose();impactos.splice(i,1)}
  }
}

export function limparBalas(){
  for(let i=balas.length-1;i>=0;i--)removerBala(i);
}
