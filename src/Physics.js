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

// ===== GRADE ESPACIAL (broadphase) =====
// Toda consulta de segmento varria as ~600 caixas do mapa inteiro, mesmo pra um trecho de 3 m. Medido:
// 26,4 µs por chamada — e `visaoHorizontalLivre` chama isso TODO QUADRO POR POLICIAL, o que dava ~264
// µs por quadro com 10 em campo. Era o maior custo contínuo do jogo, maior que o A* (585 µs, mas no
// máximo a cada 0,7 s por policial).
//
// DUAS DECISÕES QUE VIERAM DE MEDIR, não de intuição. A primeira versão desta grade ficou MAIS LENTA
// que a varredura linear (30,9 µs): ela olhava as 9 células vizinhas de cada amostra e deduplicava com
// um Set, e com só 600 caixas o custo de hash superava o dos testes que a grade evitava. O que
// resolveu:
//   · MARGEM NA INSERÇÃO, não vizinhança na consulta. Cada caixa entra nas células que ela toca mais
//     uma de folga; aí a consulta olha UMA célula por amostra e não pode perder nada por causa de um
//     segmento que raspa a quina de uma célula. O custo sai da consulta (centenas por segundo) e vai
//     pra inserção (uma vez).
//   · CARIMBO em vez de Set. Um Uint32Array com o número da consulta marca o que já entrou: é acesso
//     direto por índice, sem hash e sem lixo pro coletor.
//
// As caixas que MUDAM de conteúdo (as 8 portas de esconderijo e a porteira da fazenda alternam entre a
// caixa fechada e uma caixa enterrada a 10 km) ficam FORA da grade, numa lista varrida linearmente:
// indexá-las daria uma célula errada no instante em que alguém abrisse uma porta. São 9, é irrelevante.
const GRADE_CELULA=2,GRADE_DIM=176,GRADE_OFFSET=88;// cobre ±176 m; o mapa vai a ±130
const gradeBaldes=new Array(GRADE_DIM*GRADE_DIM);
const obstaculosMoveis=[];
const caixasMoveis=new Set();
let gradeMontada=false,carimbos=null,carimboAtual=0;
const celulaDe=v=>Math.min(GRADE_DIM-1,Math.max(0,Math.floor(v/GRADE_CELULA)+GRADE_OFFSET));

function montarGrade(){
  gradeMontada=true;
  gradeBaldes.fill(undefined);
  obstaculosMoveis.length=0;
  carimbos=new Uint32Array(obstaculos.length);carimboAtual=0;
  for(let i=0;i<obstaculos.length;i++){
    const b=obstaculos[i];
    if(caixasMoveis.has(b)){obstaculosMoveis.push(b);continue}
    // A folga de uma célula é o que permite a consulta olhar uma célula só por amostra.
    const x0=celulaDe(b.min.x-GRADE_CELULA),x1=celulaDe(b.max.x+GRADE_CELULA);
    const z0=celulaDe(b.min.z-GRADE_CELULA),z1=celulaDe(b.max.z+GRADE_CELULA);
    for(let cx=x0;cx<=x1;cx++)for(let cz=z0;cz<=z1;cz++){
      const k=cx*GRADE_DIM+cz;
      (gradeBaldes[k]||(gradeBaldes[k]=[])).push(i);
    }
  }
}
// Quem tem uma Box3 cujo CONTEÚDO vai mudar (porta, porteira) registra aqui.
export function marcarObstaculoMovel(box){caixasMoveis.add(box);gradeMontada=false;return box}
// Um obstáculo registrado depois da grade montada entraria invisível pra broadphase — falha silenciosa,
// das piores de achar. Por isso `registrarObstaculo` invalida a grade.
export function invalidarGradeDeObstaculos(){gradeMontada=false}

export function registrarObstaculo(meshParede){
  gradeMontada=false;
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
// Caixas candidatas ao segmento: as das células que ele atravessa, mais as móveis. Reaproveita os
// mesmos arrays entre chamadas — isto roda centenas de vezes por segundo e alocar aqui geraria lixo
// suficiente pra o coletor aparecer como engasgo no celular.
const _candidatas=[];
function candidatasDoSegmento(ax,az,bx,bz){
  if(!gradeMontada)montarGrade();
  _candidatas.length=0;
  for(const b of obstaculosMoveis)_candidatas.push(b);
  carimboAtual++;
  const dx=bx-ax,dz=bz-az;
  // Passo de meia célula. Com a folga da inserção, isto não pode pular uma caixa que o segmento cruza.
  const passos=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(GRADE_CELULA*.5)));
  let ultimaCelula=-1;
  for(let i=0;i<=passos;i++){
    const t=i/passos;
    const k=celulaDe(ax+dx*t)*GRADE_DIM+celulaDe(az+dz*t);
    if(k===ultimaCelula)continue;
    ultimaCelula=k;
    const balde=gradeBaldes[k];if(!balde)continue;
    for(let j=0;j<balde.length;j++){
      const idx=balde[j];
      if(carimbos[idx]===carimboAtual)continue;
      carimbos[idx]=carimboAtual;
      _candidatas.push(obstaculos[idx]);
    }
  }
  return _candidatas;
}
export function primeiroImpactoNoSegmento(ax,ay,az,bx,by,bz){
  const dx=bx-ax,dy=by-ay,dz=bz-az;
  let melhorT=Infinity;
  for(const box of candidatasDoSegmento(ax,az,bx,bz)){
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
