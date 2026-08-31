// ===== NAVMESH: grade de navegação, A* e raycasting horizontal =====
// Antes, quem andava a pé (moradores e policiais) navegava só por steering: anda na direção do alvo,
// resolve a colisão por eixo e desencrava quando falha. Numa parede em L isso prende o agente até o
// `buscarPosicaoLivre` cuspir ele pra fora. Aqui existe um grafo de navegação de verdade.
//
// A malha é construída RASTERIZANDO os obstáculos na grade — não testando a grade contra os obstáculos.
// Ingênuo:      O(células × obstáculos)          ≈ 53.000 × 650 ≈ 34 milhões de testes (~1-3 s de trava)
// Rasterizado:  O(obstáculos × células cobertas) ≈ 650 × 50     ≈ 32 mil            (< 20 ms)
import*as THREE from'three';
import{obstaculos,obstaculosPedestres,primeiroImpactoNoSegmento}from'./Physics.js';
import{obterElevacao}from'./Terrain.js';

// ===== DIMENSIONAMENTO DA GRADE (a conta que decide se a polícia consegue entrar numa viela) =====
// Pior corredor do mapa: viela de 2,4 m com uma escadaria de 1,0 m colada na casa → 1,4 m de vão livre.
// A rasterização marca a célula INTEIRA quando a AABB dilatada encosta nela, então a folga efetiva já é
// quase uma célula; somar a meia-largura real do pedestre (0,45 m) por cima fecharia todas as vielas e a
// polícia nunca acharia rota — o `colidePedestre` por eixo continua sendo a autoridade final da colisão.
//
// Condição pra sempre sobrar uma célula inteira livre num vão de largura V:
//     V − 2r ≥ 2c − c   ⟺   c ≤ (V − 2r)/2 + folga de alinhamento
// Com V = 1,4 · r = 0,2 · c = 0,45:  vão não tocado = 1,0 m, e um intervalo de 1,0/0,45 = 2,22 índices
// sempre contém um inteiro → há garantidamente uma célula livre, em qualquer alinhamento da grade.
export const NAV_CELULA=.45;
export const NAV_LIMITE=104;       // meia-extensão coberta pela malha, em metros
export const NAV_DIM=Math.ceil(NAV_LIMITE*2/NAV_CELULA);
const NAV_TOTAL=NAV_DIM*NAV_DIM;
// Soma de Minkowski: dilato o obstáculo pelo raio do agente e trato o agente como um PONTO.
// É equivalente a mover um disco de raio r pelo espaço livre, e custa uma soma por eixo.
const RAIO_AGENTE=.2;
const ALTURA_AGENTE=1.6,PISO_MARGEM=.06;
const RAIZ2=Math.SQRT2;

const indiceCelula=(cx,cz)=>cz*NAV_DIM+cx;
export const celulaDeX=x=>Math.floor((x+NAV_LIMITE)/NAV_CELULA);
export const celulaDeZ=z=>Math.floor((z+NAV_LIMITE)/NAV_CELULA);
export const mundoDeCX=cx=>(cx+.5)*NAV_CELULA-NAV_LIMITE;
export const mundoDeCZ=cz=>(cz+.5)*NAV_CELULA-NAV_LIMITE;
const dentroDaGrade=(cx,cz)=>cx>=0&&cz>=0&&cx<NAV_DIM&&cz<NAV_DIM;

let bloqueado=null,alturaCelula=null,construida=false;

// Marca as células cobertas por cada AABB da lista. O filtro VERTICAL é o ponto crítico: as muretas de
// laje ficam em y≈3,2 m e entram em `obstaculos`; marcadas pela projeção XZ, todo telhado do bairro
// viraria parede no chão e ninguém andaria em lugar nenhum. Só bloqueia quem cruza a faixa do corpo do
// pedestre naquele ponto do relevo: box.max.y > p+0,06 ∧ box.min.y < p+1,6.
function rasterizar(lista){
  for(const box of lista){
    const cx0=Math.max(0,celulaDeX(box.min.x-RAIO_AGENTE)),cx1=Math.min(NAV_DIM-1,celulaDeX(box.max.x+RAIO_AGENTE));
    const cz0=Math.max(0,celulaDeZ(box.min.z-RAIO_AGENTE)),cz1=Math.min(NAV_DIM-1,celulaDeZ(box.max.z+RAIO_AGENTE));
    for(let cz=cz0;cz<=cz1;cz++)for(let cx=cx0;cx<=cx1;cx++){
      const i=indiceCelula(cx,cz);
      if(bloqueado[i])continue;
      const p=alturaCelula[i];
      if(box.max.y>p+PISO_MARGEM&&box.min.y<p+ALTURA_AGENTE)bloqueado[i]=1;
    }
  }
}

// Preguiçosa de propósito: a malha depende de `obstaculos` COMPLETO, e os obstáculos são registrados
// como efeito colateral do topo dos módulos de mundo. Construir no topo daqui rodaria antes deles
// existirem — e ainda faria o carregamento do jogo pagar o custo sem necessidade.
export function construirNavMesh(){
  if(construida)return;
  construida=true;
  bloqueado=new Uint8Array(NAV_TOTAL);
  alturaCelula=new Float32Array(NAV_TOTAL);
  for(let cz=0;cz<NAV_DIM;cz++){
    const wz=mundoDeCZ(cz);
    for(let cx=0;cx<NAV_DIM;cx++)alturaCelula[indiceCelula(cx,cz)]=obterElevacao(mundoDeCX(cx),wz);
  }
  rasterizar(obstaculos);
  rasterizar(obstaculosPedestres);
}

export function celulaLivre(cx,cz){
  if(!construida)construirNavMesh();
  return dentroDaGrade(cx,cz)&&!bloqueado[indiceCelula(cx,cz)];
}
export function pontoNavegavel(x,z){return celulaLivre(celulaDeX(x),celulaDeZ(z))}

// Célula livre mais próxima, em anéis crescentes — usada quando origem ou destino caem dentro de parede
// (spawn de rapel em cima de uma casa, jogador em cima do telhado, etc.).
// O raio precisa vencer um quarteirão inteiro: as casas do bairro ficam com as paredes coladas em blocos
// de 4x3, então do centro de um bloco o espaço livre mais próximo está a ~8 m. Com o raio antigo (8
// células = 3,6 m) a busca falhava e o A* devolvia null — a polícia simplesmente parava de perseguir.
function celulaLivreMaisProxima(cx,cz,raioMax=24){
  if(celulaLivre(cx,cz))return{cx,cz};
  for(let r=1;r<=raioMax;r++){
    for(let d=-r;d<=r;d++){
      const candidatos=[[cx+d,cz-r],[cx+d,cz+r],[cx-r,cz+d],[cx+r,cz+d]];
      for(const[nx,nz]of candidatos)if(celulaLivre(nx,nz))return{cx:nx,cz:nz};
    }
  }
  return null;
}

// ===== A* =====
// Buffers reaproveitados entre buscas. `selo` evita limpar 53 mil posições a cada chamada: uma célula
// só conta como visitada se o selo dela é o da busca atual.
const gCusto=new Float32Array(NAV_TOTAL),fCusto=new Float32Array(NAV_TOTAL);
const veioDe=new Int32Array(NAV_TOTAL),selo=new Int32Array(NAV_TOTAL),fechado=new Uint8Array(NAV_TOTAL);
let seloAtual=0;
// Heap binário mínimo sobre índices de célula, ordenado por fCusto. Zero dependência externa.
const heap=new Int32Array(NAV_TOTAL);let heapTam=0;
function heapInserir(no){
  let i=heapTam++;heap[i]=no;
  while(i>0){const pai=(i-1)>>1;if(fCusto[heap[pai]]<=fCusto[heap[i]])break;const t=heap[pai];heap[pai]=heap[i];heap[i]=t;i=pai}
}
function heapRemover(){
  const topo=heap[0];heap[0]=heap[--heapTam];
  let i=0;
  for(;;){
    const e=i*2+1,d=e+1;let menor=i;
    if(e<heapTam&&fCusto[heap[e]]<fCusto[heap[menor]])menor=e;
    if(d<heapTam&&fCusto[heap[d]]<fCusto[heap[menor]])menor=d;
    if(menor===i)break;
    const t=heap[menor];heap[menor]=heap[i];heap[i]=t;i=menor;
  }
  return topo;
}
// Heurística octile: admissível e consistente numa grade de 8 vizinhos com custo 1 / √2.
function heuristica(ax,az,bx,bz){
  const dx=Math.abs(ax-bx),dz=Math.abs(az-bz);
  return(dx+dz)+(RAIZ2-2)*Math.min(dx,dz);
}
const VIZINHOS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,RAIZ2],[1,-1,RAIZ2],[-1,1,RAIZ2],[-1,-1,RAIZ2]];

// Caminho em células entre dois pontos de mundo, ou null. `maxNos` protege o frame: um A* sem teto
// numa grade de 53 mil células pode expandir tudo antes de concluir que não há caminho.
function buscarCaminhoCelulas(ax,az,bx,bz,maxNos){
  const origem=celulaLivreMaisProxima(celulaDeX(ax),celulaDeZ(az));
  const destino=celulaLivreMaisProxima(celulaDeX(bx),celulaDeZ(bz));
  if(!origem||!destino)return null;
  const iOrigem=indiceCelula(origem.cx,origem.cz),iDestino=indiceCelula(destino.cx,destino.cz);
  if(iOrigem===iDestino)return[destino];
  seloAtual++;heapTam=0;
  selo[iOrigem]=seloAtual;fechado[iOrigem]=0;gCusto[iOrigem]=0;
  fCusto[iOrigem]=heuristica(origem.cx,origem.cz,destino.cx,destino.cz);veioDe[iOrigem]=-1;
  heapInserir(iOrigem);
  let expandidos=0;
  while(heapTam>0){
    const atual=heapRemover();
    if(fechado[atual]===1&&selo[atual]===seloAtual)continue;
    fechado[atual]=1;
    if(atual===iDestino)break;
    if(++expandidos>maxNos)return null;
    const cx=atual%NAV_DIM,cz=(atual-cx)/NAV_DIM;
    for(const[dx,dz,custo]of VIZINHOS){
      const nx=cx+dx,nz=cz+dz;
      if(!celulaLivre(nx,nz))continue;
      // Anti-corner-cutting: a diagonal só vale se OS DOIS ortogonais estiverem livres. Sem isso o
      // caminho raspa a quina e a resolução por eixo do Physics trava o agente exatamente ali.
      if(dx&&dz&&(!celulaLivre(cx+dx,cz)||!celulaLivre(cx,cz+dz)))continue;
      const iViz=indiceCelula(nx,nz);
      if(selo[iViz]===seloAtual&&fechado[iViz]===1)continue;
      const g=gCusto[atual]+custo;
      if(selo[iViz]===seloAtual&&g>=gCusto[iViz])continue;
      selo[iViz]=seloAtual;fechado[iViz]=0;gCusto[iViz]=g;veioDe[iViz]=atual;
      fCusto[iViz]=g+heuristica(nx,nz,destino.cx,destino.cz);
      heapInserir(iViz);
    }
  }
  if(selo[iDestino]!==seloAtual||fechado[iDestino]!==1)return null;
  const caminho=[];
  for(let no=iDestino;no!==-1;no=veioDe[no]){const cx=no%NAV_DIM;caminho.push({cx,cz:(no-cx)/NAV_DIM})}
  caminho.reverse();
  return caminho;
}

// ===== RAYCASTING HORIZONTAL (nível grade) =====
// Amostra o segmento a passo CELULA/2 e exige toda célula livre. É o teste do string-pulling: converte
// a escada de células do A* em 2-4 waypoints retos, que é o que faz o agente andar como gente.
export function linhaLivreNav(ax,az,bx,bz){
  const dx=bx-ax,dz=bz-az,dist=Math.hypot(dx,dz);
  const passos=Math.max(1,Math.ceil(dist/(NAV_CELULA*.5)));
  for(let i=0;i<=passos;i++){
    const t=i/passos;
    if(!pontoNavegavel(ax+dx*t,az+dz*t))return false;
  }
  return true;
}

// ===== RAYCASTING HORIZONTAL (nível física) =====
// Segmento real contra as AABBs, na altura do peito: é o "eu enxergo o alvo?" que dispensa o caminho
// inteiro quando a reta já está limpa.
export function visaoHorizontalLivre(ax,az,bx,bz,y){
  return primeiroImpactoNoSegmento(ax,y,az,bx,y,bz)===null;
}
// Distância livre à frente numa direção horizontal (0 = encostado). Usada pelo look-ahead dos moradores.
export function distanciaLivreHorizontal(ax,az,dirX,dirZ,alcance,y){
  const impacto=primeiroImpactoNoSegmento(ax,y,az,ax+dirX*alcance,y,az+dirZ*alcance);
  return impacto?impacto.t*alcance:alcance;
}

// ===== API principal =====
// Caminho já suavizado, em pontos de mundo. Retorna null quando não existe rota.
export function encontrarCaminho(ax,az,bx,bz,maxNos=12000){
  if(!construida)construirNavMesh();
  const celulas=buscarCaminhoCelulas(ax,az,bx,bz,maxNos);
  if(!celulas)return null;
  const pontos=celulas.map(c=>({x:mundoDeCX(c.cx),z:mundoDeCZ(c.cz)}));
  pontos[pontos.length-1]={x:bx,z:bz};
  // String-pulling: do ponto atual, avança até o waypoint mais distante ainda visível em linha reta.
  const suave=[];
  let i=0;
  let px=ax,pz=az;
  while(i<pontos.length){
    let melhor=i;
    for(let j=pontos.length-1;j>i;j--){if(linhaLivreNav(px,pz,pontos[j].x,pontos[j].z)){melhor=j;break}}
    suave.push(pontos[melhor]);
    px=pontos[melhor].x;pz=pontos[melhor].z;
    i=melhor+1;
  }
  return suave;
}

// Diagnóstico do modo DEBUG: nuvem de pontos das células bloqueadas (só as próximas do jogador).
export function amostrarCelulasBloqueadas(centroX,centroZ,raio=26){
  if(!construida)construirNavMesh();
  const pontos=[];
  const cx0=Math.max(0,celulaDeX(centroX-raio)),cx1=Math.min(NAV_DIM-1,celulaDeX(centroX+raio));
  const cz0=Math.max(0,celulaDeZ(centroZ-raio)),cz1=Math.min(NAV_DIM-1,celulaDeZ(centroZ+raio));
  for(let cz=cz0;cz<=cz1;cz++)for(let cx=cx0;cx<=cx1;cx++){
    const i=indiceCelula(cx,cz);
    if(bloqueado[i])pontos.push(new THREE.Vector3(mundoDeCX(cx),alturaCelula[i]+.08,mundoDeCZ(cz)));
  }
  return pontos;
}
