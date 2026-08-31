// Colisão: obstáculos estáticos (paredes/muretas/postes) e superfícies andáveis (lajes/degraus),
// mais os testes de sobreposição AABB usados por jogador, câmera e NPCs/animais.
import*as THREE from'three';

export const COLLISION_EPSILON=.0001;
export const obstaculos=[];
export const superficiesAndaveis=[];
// Obstáculos que valem SÓ para quem anda a pé pelo bairro (moradores e policiais): principalmente os
// degraus das escadarias. Eles não podem entrar em `obstaculos` porque o jogador precisa subir neles —
// se fossem obstáculo de verdade, o jogador seria barrado no primeiro degrau e a escada ficaria inútil.
export const obstaculosPedestres=[];

export function registrarObstaculo(meshParede){
  // Atualiza a hierarquia antes de converter o espaço local para world space.
  meshParede.updateWorldMatrix(true,false);
  // A AABB é calculada somente da parede recebida, nunca do grupo/telhado.
  const box=new THREE.Box3().setFromObject(meshParede);
  obstaculos.push(box);
  return box;
}

export function registrarObstaculoPedestre(mesh){
  mesh.updateWorldMatrix(true,false);
  const box=new THREE.Box3().setFromObject(mesh);
  obstaculosPedestres.push(box);
  return box;
}

export function caixaColideComObstaculos(box){
  return obstaculos.some(o=>{
    const overlapX=Math.min(o.max.x,box.max.x)-Math.max(o.min.x,box.min.x);
    const overlapY=Math.min(o.max.y,box.max.y)-Math.max(o.min.y,box.min.y);
    const overlapZ=Math.min(o.max.z,box.max.z)-Math.max(o.min.z,box.min.z);
    return overlapX>COLLISION_EPSILON&&overlapY>COLLISION_EPSILON&&overlapZ>COLLISION_EPSILON;
  });
}

function colideNaLista(lista,x,z,y,meiaLarg,meiaProf,altura){
  return lista.some(box=>{
    const overlapX=Math.min(box.max.x,x+meiaLarg)-Math.max(box.min.x,x-meiaLarg);
    const overlapY=Math.min(box.max.y,y+altura)-Math.max(box.min.y,y);
    const overlapZ=Math.min(box.max.z,z+meiaProf)-Math.max(box.min.z,z-meiaProf);
    return overlapX>COLLISION_EPSILON&&overlapY>COLLISION_EPSILON&&overlapZ>COLLISION_EPSILON;
  });
}

export function colideObstaculoXZ(x,z,y,meiaLarg,meiaProf,altura){
  return colideNaLista(obstaculos,x,z,y,meiaLarg,meiaProf,altura);
}

// Colisão de quem anda a pé: paredes E escadarias.
export function colidePedestreXZ(x,z,y,meiaLarg,meiaProf,altura){
  return colideNaLista(obstaculos,x,z,y,meiaLarg,meiaProf,altura)
      ||colideNaLista(obstaculosPedestres,x,z,y,meiaLarg,meiaProf,altura);
}

// Busca em anéis crescentes a posição X/Z livre mais próxima. `colide(x,z)` é o teste do corpo em questão,
// então a mesma função serve pro jogador (hitbox alta) e pra morador/policial (corpo estreito): é o que
// desencrava qualquer um que tenha acabado dentro de uma parede, seja por queda, spawn ruim ou empurrão.
export function buscarPosicaoLivre(x,z,colide,raioMax=7){
  if(!colide(x,z))return null;// já está livre, nada a fazer
  for(let raio=.3;raio<=raioMax;raio+=.3){
    for(let i=0;i<12;i++){
      // o `+raio` desalinha os anéis pra não testar sempre exatamente as mesmas direções
      const ang=(i/12)*Math.PI*2+raio;
      const nx=x+Math.cos(ang)*raio,nz=z+Math.sin(ang)*raio;
      if(!colide(nx,nz))return{x:nx,z:nz};
    }
  }
  return null;
}

// Primeiro ponto onde o segmento A→B encosta num obstáculo (parede). Usado pelas balas e pela checagem
// de linha de visão dos policiais: sem isso, tiro atravessa casa.
const _minT=new THREE.Vector3(),_maxT=new THREE.Vector3();
export function primeiroImpactoNoSegmento(ax,ay,az,bx,by,bz){
  const dx=bx-ax,dy=by-ay,dz=bz-az;
  let melhorT=Infinity;
  for(const box of obstaculos){
    // slab test do segmento contra a AABB, em t normalizado (0 = A, 1 = B)
    let t0=0,t1=1;
    _minT.set(box.min.x,box.min.y,box.min.z);_maxT.set(box.max.x,box.max.y,box.max.z);
    let ok=true;
    for(const eixo of ['x','y','z']){
      const origem=eixo==='x'?ax:eixo==='y'?ay:az;
      const dir=eixo==='x'?dx:eixo==='y'?dy:dz;
      const menor=_minT[eixo],maior=_maxT[eixo];
      if(Math.abs(dir)<1e-9){if(origem<menor||origem>maior){ok=false;break}continue}
      let ta=(menor-origem)/dir,tb=(maior-origem)/dir;
      if(ta>tb){const tmp=ta;ta=tb;tb=tmp}
      if(ta>t0)t0=ta;
      if(tb<t1)t1=tb;
      if(t0>t1){ok=false;break}
    }
    if(ok&&t0>=0&&t0<melhorT)melhorT=t0;
  }
  if(melhorT===Infinity)return null;
  return{t:melhorT,x:ax+dx*melhorT,y:ay+dy*melhorT,z:az+dz*melhorT};
}

// Slab test de um SEGMENTO contra UMA AABB: devolve o t de entrada (0 = A, 1 = B) ou null.
// Fica aqui, e não duplicado em Bullets/Police, porque é o mesmo teste que a bala, a mira da crosshair
// e a linha de visão usam — duas implementações do mesmo slab test divergem na primeira correção.
export function intersectarSegmentoCaixa(caixa,ox,oy,oz,dx,dy,dz){
  let t0=0,t1=1;
  const min=[caixa.min.x,caixa.min.y,caixa.min.z],max=[caixa.max.x,caixa.max.y,caixa.max.z];
  const o=[ox,oy,oz],d=[dx,dy,dz];
  for(let e=0;e<3;e++){
    if(Math.abs(d[e])<1e-9){if(o[e]<min[e]||o[e]>max[e])return null;continue}
    let ta=(min[e]-o[e])/d[e],tb=(max[e]-o[e])/d[e];
    if(ta>tb){const tmp=ta;ta=tb;tb=tmp}
    if(ta>t0)t0=ta;
    if(tb<t1)t1=tb;
    if(t0>t1)return null;
  }
  return t0;
}
