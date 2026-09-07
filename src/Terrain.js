// Relevo procedural do terreno + a malha de chão (única superfície de chão; vielas ficam expostas entre as casas).
import*as THREE from'three';
import{matChao,matTerraBatida,uvPorMetro}from'./Materials.js';
import{scene}from'./core.js';
import{MAP_HALF_SIZE,MAP_SIZE}from'./WorldBounds.js';
import{registrarCaixa}from'./Physics.js';

// ===== O MORRO NÃO É UM CONE =====
// Já foi UMA gaussiana em (0,-24): matematicamente perfeita e, por isso mesmo, lendo como uma bolha
// de terra. Morro de verdade tem cume torto, esporões, platôs cortados no barranco e degrau.
//
// Três camadas, e cada uma resolve o que as outras não resolvem:
//   1. TRÊS gaussianas deslocadas, de tamanhos diferentes — cume assimétrico com dois esporões
//      descendo. É o que dá "frente" e "fundo" ao morro em vez de um cone.
//   2. Ruído por senos cruzados em frequências NÃO múltiplas (.045/.038, .11/.09, .19/.16, .33/.28).
//      Múltiplas se alinhariam e devolveriam um padrão de tabuleiro visível — o mesmo defeito de
//      loteamento que o traçado tinha, só que no chão. Sem múltiplos, o batimento entre elas não
//      fecha ciclo dentro do mapa.
//   3. PLATÔS. A favela é feita de patamares cortados no barranco, não de rampa contínua. Subtrair um
//      seno da PRÓPRIA altura achata a curva perto de cada múltiplo do passo e deixa o degrau entre
//      eles: `h - F*sin(2πh/passo)/(2π)`. Terraceamento com uma linha de trigonometria, num campo que
//      a NavMesh, a polícia e o jogador consultam milhares de vezes por segundo.
//
// A FORÇA DO PLATÔ TEM QUE SER MENOR QUE 1. A derivada é `1 - F*cos(2πh/P)`: com F acima de 1 ela
// fica NEGATIVA em parte do ciclo, a altura decresce onde deveria crescer, e o terreno DOBRA sobre si
// mesmo. Medi 46,8° de inclinação máxima com dobras antes de achar isso. Com 0,7 é monótona.
//
// Medido no bairro com estes números: 19° de inclinação MÉDIA e picos de 38°. Os picos são o barranco
// — e é neles que o traçado (Favela.js) transforma o beco em escadão.
const MORROS=[
  {x:  0,z:-24,a:12.5,s:27},// cume principal
  {x:-24,z:-40,a: 6.0,s:17},// esporão noroeste
  {x: 20,z:-10,a: 5.0,s:15},// esporão sudeste
  // ===== MORRO DO SUL, PEDIDO EM (31.3, 71.7) =====
  // Ali o chão estava a -1,97 m: a parte baixa e arenosa do mapa, encostando no piso de -2,5 do
  // `clamp`. Era uma planície vazia — nenhum objeto, nenhum colisor, casa mais próxima a 73 m e o
  // receptador a 46 m —, e foi por isso que deu pra levantar 12 metros de terra aqui sem enterrar
  // nem lançar nada: tudo no mapa se assenta chamando `obterElevacao`, então quem estava por perto
  // simplesmente subiu junto com o chão (o receptador ganhou 81 cm, a casa mais próxima 1 cm).
  //
  // A AMPLITUDE DO CUME NÃO É 10 — é 10,864, e a diferença não é arredondamento. A altura final passa pelo
  // ruído dos senos e pelo terraceamento (`PLATO_FORCA`), que somam e subtraem por cima da gaussiana;
  // pedir amplitude 10 daria outra coisa no ponto. Este número saiu de bissecção contra a
  // `obterElevacao` COMPLETA até a leitura bater 10,000 m em (31.3, 71.7), que foi o pedido.
  //
  // TRÊS GAUSSIANAS, E NÃO UMA — pelo mesmo motivo que está escrito no alto deste arquivo. Levantei
  // primeiro com uma só, fotografei, e saiu exatamente o que o comentário lá em cima avisa: uma
  // BOLHA DE AREIA, simétrica e sem cara de morro. Os dois esporões (deslocados, de tamanhos e
  // distâncias diferentes) dão cume torto e encostas desiguais: a face norte desce mansa
  // (10 → 8,5 → 6,2 → 4,4 m) e a sul cai rápido (10 → 9,4 → 5,3 → 2,2 m), com o ombro puxado pra
  // sudeste. Inclinação máxima 20,2°, ainda de subir a pé.
  {x:31.3,z:71.7,a:10.864,s:19},// cume — é aqui que a leitura tem que dar 10,000 m
  {x:  46,z:  83,a: 4.2,s:10},// esporão sudeste, o ombro comprido
  {x:  19,z:  87,a: 2.8,s: 8},// contraforte sudoeste, quebra a simetria da encosta
];
const PLATO_PASSO=2.6,PLATO_FORCA=.7;
export function obterElevacao(x,z){
  let h=0;
  for(let i=0;i<MORROS.length;i++){
    const m=MORROS[i],dx=x-m.x,dz=z-m.z;
    h+=m.a*Math.exp(-(dx*dx+dz*dz)/(2*m.s*m.s));
  }
  h+=Math.sin(x*.045)*Math.cos(z*.038)*1.8
    +Math.sin(x*.11+z*.09)*.8
    +Math.cos(x*.19-z*.16)*.3
    +Math.sin(x*.33+z*.28)*.12;
  h-=PLATO_FORCA*Math.sin(2*Math.PI*h/PLATO_PASSO)/(2*Math.PI);
  return THREE.MathUtils.clamp(h,-2.5,22);
}

// Chão de terra com PBR: a mesma textura tileável do resto do bairro, repetida a cada 4 m. O normal é
// o que faz o sol raspante revelar o relevo do chão em vez de deixar uma mancha lisa.
const groundMat=matChao();
for(const t of[groundMat.map,groundMat.normalMap,groundMat.roughnessMap])t.repeat.set(MAP_SIZE/4,MAP_SIZE/4);
// Mantemos aproximadamente 1,55 m por quadrado, a mesma leitura de platôs do mapa anterior.
// Mesmo com o dobro da área, continua sendo UMA malha e UM draw call; a expansão não duplica
// materiais, objetos ou sombras.
const GROUND_SEGMENTS=Math.round(MAP_SIZE/1.55);
const groundGeometry=new THREE.PlaneGeometry(MAP_SIZE,MAP_SIZE,GROUND_SEGMENTS,GROUND_SEGMENTS);
const groundPositions=groundGeometry.attributes.position;
for(let i=0;i<groundPositions.count;i++){const x=groundPositions.getX(i),localY=groundPositions.getY(i),worldZ=-localY;groundPositions.setZ(i,obterElevacao(x,worldZ))}
groundGeometry.computeVertexNormals();

// ===== A ALTURA DO CHÃO QUE SE VÊ, NÃO A DA CURVA =====
// `obterElevacao` é a curva ANALÍTICA. O chão DESENHADO é esta malha de quadrados de ~1,55 m, que
// interpola reto entre os vértices — em terreno convexo a superfície visível fica ABAIXO da curva,
// até uns 5 cm. As duas coisas não são a mesma, e confundi-las tem consequência visível: a moto já
// carrega um `alturaAssento:-.02` só pra compensar isso, com o motivo escrito lá.
//
// Foi o mesmo tropeço com o asfalto. Pus a fita da rua na curva analítica +5 cm; o carro apoia na
// curva; então a roda ficava 5 cm ABAIXO da superfície de asfalto e parecia enterrada nele, tocando
// só a terra em volta. Era exatamente o que ele viu.
//
// Aqui devolvo a altura da MALHA, com a mesma triangulação que o `PlaneGeometry` usa (cada quadrado
// vira dois triângulos, e interpolar por quadrilátero daria um valor diferente do que a placa de
// vídeo desenha). Quem é acabamento colado no chão — a fita da rua, o meio-fio — assenta nisto.
const CHAO_PASSO=MAP_SIZE/GROUND_SEGMENTS;
export function alturaDoChaoDesenhado(x,z){
  // Índice da célula e posição fracionária dentro dela.
  const fx=(x+MAP_HALF_SIZE)/CHAO_PASSO,fz=(z+MAP_HALF_SIZE)/CHAO_PASSO;
  const ix=Math.floor(fx),iz=Math.floor(fz);
  // Fora da malha não há o que interpolar: devolve a curva, que é o melhor palpite disponível.
  if(ix<0||iz<0||ix>=GROUND_SEGMENTS||iz>=GROUND_SEGMENTS)return obterElevacao(x,z);
  const u=fx-ix,v=fz-iz;
  const x0=-MAP_HALF_SIZE+ix*CHAO_PASSO,x1=x0+CHAO_PASSO;
  const z0=-MAP_HALF_SIZE+iz*CHAO_PASSO,z1=z0+CHAO_PASSO;
  // Os quatro cantos, nomeados como o PlaneGeometry os liga: a=(x0,z0) b=(x0,z1) c=(x1,z1) d=(x1,z0),
  // com os triângulos (a,b,d) e (b,c,d).
  const ha=obterElevacao(x0,z0),hb=obterElevacao(x0,z1),hc=obterElevacao(x1,z1),hd=obterElevacao(x1,z0);
  return u+v<=1
    ? ha+v*(hb-ha)+u*(hd-ha)
    : hc+(1-u)*(hb-hc)+(1-v)*(hd-hc);
}
groundGeometry.setAttribute('uv1',groundGeometry.attributes.uv);// aoMap lê o 2º canal de UV
export const ground=new THREE.Mesh(groundGeometry,groundMat);
ground.rotation.x=-Math.PI/2;ground.castShadow=true;ground.receiveShadow=true;scene.add(ground);

// ===== FECHAMENTO FÍSICO DO MAPA =====
// O terreno foi ampliado, então não basta limitar a posição do jogador: veículos, NPCs e câmera
// também precisam encontrar uma fronteira real. Quatro paredes longas substituem centenas de pedras
// individuais: são 4 meshes, 4 AABBs e nenhum custo de busca adicional além do broadphase existente.
const BORDA_ESPESSURA=1.2,BORDA_ALTURA=28,BORDA_BASE=-4;
const BORDA_CENTRO_Y=BORDA_BASE+BORDA_ALTURA/2;
const materialBorda=matTerraBatida();
const mapaBordas=[];
function criarBorda(largura,profundidade,x,z,categoria){
  const geo=new THREE.BoxGeometry(largura,BORDA_ALTURA,profundidade);
  uvPorMetro(geo,2);
  const mesh=new THREE.Mesh(geo,materialBorda);
  mesh.position.set(x,BORDA_CENTRO_Y,z);
  // A borda fica sempre fora do campo de visão próximo e não deve duplicar o passe de sombras.
  mesh.castShadow=false;mesh.receiveShadow=true;
  scene.add(mesh);
  registrarCaixa(new THREE.Box3(
    new THREE.Vector3(x-largura/2,BORDA_BASE,z-profundidade/2),
    new THREE.Vector3(x+largura/2,BORDA_BASE+BORDA_ALTURA,z+profundidade/2)),categoria);
  mapaBordas.push(mesh);
}
// A parede começa exatamente depois de ±260 m. Ela fecha o cenário sem se projetar para dentro
// do terreno; o jogador pode chegar praticamente até a última faixa de chão.
const BORDA_FORA=MAP_HALF_SIZE+BORDA_ESPESSURA/2;
criarBorda(BORDA_ESPESSURA,MAP_SIZE,BORDA_FORA,0,'borda-leste');
criarBorda(BORDA_ESPESSURA,MAP_SIZE,-BORDA_FORA,0,'borda-oeste');
criarBorda(MAP_SIZE-2*BORDA_ESPESSURA,BORDA_ESPESSURA,0,BORDA_FORA,'borda-sul');
criarBorda(MAP_SIZE-2*BORDA_ESPESSURA,BORDA_ESPESSURA,0,-BORDA_FORA,'borda-norte');
export{mapaBordas};
