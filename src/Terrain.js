// Relevo procedural do terreno + a malha de chão (única superfície de chão; vielas ficam expostas entre as casas).
import*as THREE from'three';
import{matChao}from'./Materials.js';
import{scene}from'./core.js';
import{MAP_HALF_SIZE,MAP_SIZE}from'./WorldBounds.js';
import{registrarCaixa}from'./Physics.js';
import{deformarTerrenoLago}from'./LakeConfig.js';

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
  // O lago e uma ESCAVACAO do proprio terreno. Player, veiculos e malha visual leem esta mesma altura.
  h=deformarTerrenoLago(h,x,z);
  return THREE.MathUtils.clamp(h,-2.5,22);
}

// Chão de terra com PBR: a mesma textura tileável do resto do bairro, repetida a cada 4 m. O normal é
// o que faz o sol raspante revelar o relevo do chão em vez de deixar uma mancha lisa.
const groundMat=matChao();
// Mantemos aproximadamente 1,55 m por quadrado, a mesma leitura de platôs do mapa anterior.
const GROUND_SEGMENTS=Math.round(MAP_SIZE/1.55);

// ===== O CHÃO EM PEDAÇOS, PRA PODER DEIXAR DE DESENHAR O QUE NINGUÉM VÊ =====
// "pra deixar o jogo leve deve ser igual o GTA San Andreas: mapa gigante, mas vai aparecer conforme
// vai andando."
//
// O comentário que estava aqui se gabava de ser "UMA malha e UM draw call". Era verdade, e era
// justamente o problema — MEDIDO: 389.428 triângulos por quadro, dos quais 224.450 (58%) eram desta
// única malha de 520 m. Malha única não pode ser cortada por nada: nem pela distância, nem pelo
// tronco de visão. Ela é sempre desenhada inteira, e o mapa tem 520 m de lado.
//
// E quase tudo isso é desenhado PRA NINGUÉM VER. A neblina é `FogExp2(0.013)`, ou seja
// exp(-(d*0.013)²): a 165 m um objeto já aparece com 1% de opacidade e a 200 m com 0,1%. O jogador
// enxerga uns 165 m; o mapa tem 520.
//
// Em pedaços, duas coisas passam a funcionar sozinhas:
//   · o Three.js corta por TRONCO DE VISÃO o que está atrás e ao lado da câmera, de graça;
//   · e o `atualizarChaoVisivel` corta o que está além da neblina.
//
// O CORTE TEM QUE CAIR EM CIMA DA GRADE — o espaçamento de 1,55 m entre vértices não pode mudar.
// Isso não é detalhe: o `alturaDoChaoDesenhado` logo abaixo replica a triangulação desta malha, e é
// nele que carro, moto, fita de asfalto e meio-fio se apoiam. Mexer no espaçamento moveria o chão
// debaixo de todo esse trabalho. (A malha em si ele NÃO lê — é função analítica —, então cortar em
// pedaços não muda nenhum apoio.)
//
// Cada pedaço tem um número INTEIRO de segmentos, e o último de cada fila fica menor com o que
// sobrar: 335 = 9x34 + 29. Assim o corte cai sempre em cima de uma linha da grade sem exigir que o
// tamanho do pedaço divida 335 (que só aceita 5 e 67 — 5 dá pedaços grandes demais pra cortar bem,
// e 67 daria 4.489 pedaços).
//
// MEDIDO com pedaços de 104 m (5x5): 389.428 -> 228.208 triângulos por quadro. Quase todo esse ganho
// veio do corte por TRONCO DE VISÃO, não da distância: do centro do mapa nenhum pedaço de 104 m
// chega a passar dos 190 m. Pedaço menor corta os dois jeitos.
const SEG_CHUNK=48;
const CHUNKS=Math.ceil(GROUND_SEGMENTS/SEG_CHUNK);
// ===== UV EM COORDENADA DE MUNDO =====
// Com pedaços de tamanhos diferentes, UV 0..1 por pedaço exigiria uma repetição diferente em cada um
// — ou seja, um material por tamanho. Escrevendo a UV direto em metros do MUNDO (dividido pelos 4 m
// do ladrilho), todos os pedaços dividem o MESMO material e o desenho atravessa a costura como se a
// malha fosse uma só.
for(const t of[groundMat.map,groundMat.normalMap,groundMat.roughnessMap])t.repeat.set(1,1);

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
// `ground` continua sendo UMA coisa só pra quem usa de fora — virou Grupo em vez de Malha. O único
// uso externo é o raycast da mira de plantio (`Economy.js`), que já é recursivo e atravessa o grupo
// sem precisar de mudança nenhuma.
export const ground=new THREE.Group();
const pedacosDoChao=[];
for(let cz=0;cz<CHUNKS;cz++)for(let cx=0;cx<CHUNKS;cx++){
  // Quantos segmentos cabem neste pedaço: os cheios têm SEG_CHUNK, o último de cada fila leva o resto.
  const segX=Math.min(SEG_CHUNK,GROUND_SEGMENTS-cx*SEG_CHUNK);
  const segZ=Math.min(SEG_CHUNK,GROUND_SEGMENTS-cz*SEG_CHUNK);
  const ladoX=segX*CHAO_PASSO,ladoZ=segZ*CHAO_PASSO;
  const centroX=-MAP_HALF_SIZE+cx*SEG_CHUNK*CHAO_PASSO+ladoX/2;
  const centroZ=-MAP_HALF_SIZE+cz*SEG_CHUNK*CHAO_PASSO+ladoZ/2;
  const geo=new THREE.PlaneGeometry(ladoX,ladoZ,segX,segZ);
  const pos=geo.attributes.position,uv=geo.attributes.uv;
  // A altura vem da MESMA função analítica de sempre, avaliada na coordenada de MUNDO do vértice.
  // É isso que garante que dois pedaços vizinhos fechem sem degrau: a borda de um e a do outro são
  // o mesmo ponto do mundo, então recebem a mesma altura — e o mesmo vale pra UV.
  for(let i=0;i<pos.count;i++){
    const wx=centroX+pos.getX(i),wz=centroZ-pos.getY(i);// worldZ = -localY, como no original
    pos.setZ(i,obterElevacao(wx,wz));
    uv.setXY(i,wx/4,wz/4);// ladrilho de 4 m, contado do mundo
  }
  geo.computeVertexNormals();
  geo.setAttribute('uv1',geo.attributes.uv);// aoMap lê o 2º canal de UV
  const m=new THREE.Mesh(geo,groundMat);
  m.rotation.x=-Math.PI/2;
  m.position.set(centroX,0,centroZ);
  m.castShadow=true;m.receiveShadow=true;
  ground.add(m);
  pedacosDoChao.push({malha:m,cx:centroX,cz:centroZ,meioX:ladoX/2,meioZ:ladoZ/2});
}
scene.add(ground);

// ===== ATÉ ONDE VALE DESENHAR O CHÃO =====
// Da neblina: exp(-(d*0.013)²) dá 1% de opacidade a 165 m. 190 m é essa conta com folga — quem
// estiver além disso não aparece, e deixar de desenhar não muda um pixel.
const ALCANCE_CHAO=190;
// Distância do ponto até o QUADRADO do pedaço (não até o centro dele): usar o centro cortaria pedaço
// que ainda tem uma quina dentro do alcance.
export function atualizarChaoVisivel(x,z){
  for(const p of pedacosDoChao){
    const dx=Math.max(0,Math.abs(x-p.cx)-p.meioX);
    const dz=Math.max(0,Math.abs(z-p.cz)-p.meioZ);
    p.malha.visible=dx*dx+dz*dz<=ALCANCE_CHAO*ALCANCE_CHAO;
  }
}
export function __pedacosDoChaoParaTeste(){
  return pedacosDoChao.map(p=>({x:p.cx,z:p.cz,visivel:p.malha.visible}));
}

// ===== FECHAMENTO FÍSICO DO MAPA — A BARREIRA FICA, A PAREDE SAI =====
// "tira essas 4 paredes do final do mapa, não tem nada a ver elas."
//
// Ele estava vendo quatro paredes de terra de 28 m de ALTURA e 520 m de comprimento em pé em volta
// do mapa inteiro. O jogo é uma favela num morro; um muro de terra de dez andares fechando o
// horizonte não é parte de lugar nenhum.
//
// A parede tinha duas coisas grudadas que são independentes: a MALHA (o que se vê) e a CAIXA de
// colisão (o que impede carro, NPC e câmera de sair do mundo). Só a malha sai. A barreira continua
// exatamente onde estava, invisível — sem ela, veículo e polícia andariam pra fora do terreno.
//
// `mapaBordas` continua exportado e agora fica vazio. Conferido antes de mexer: ninguém importa esse
// nome em lugar nenhum do `src/`.
const BORDA_ESPESSURA=1.2,BORDA_ALTURA=28,BORDA_BASE=-4;
const BORDA_CENTRO_Y=BORDA_BASE+BORDA_ALTURA/2;
// (o material da parede saiu junto com a parede: ele carregava um conjunto de texturas de terra
//  batida que agora não pintaria nada — textura carregada à toa é peso no celular.)
const mapaBordas=[];
function criarBorda(largura,profundidade,x,z,categoria){
  // Sem malha: nada é desenhado aqui. Só a caixa, que é o que segura quem tenta sair do mapa.
  registrarCaixa(new THREE.Box3(
    new THREE.Vector3(x-largura/2,BORDA_BASE,z-profundidade/2),
    new THREE.Vector3(x+largura/2,BORDA_BASE+BORDA_ALTURA,z+profundidade/2)),categoria);
}
// A parede começa exatamente depois de ±260 m. Ela fecha o cenário sem se projetar para dentro
// do terreno; o jogador pode chegar praticamente até a última faixa de chão.
const BORDA_FORA=MAP_HALF_SIZE+BORDA_ESPESSURA/2;
criarBorda(BORDA_ESPESSURA,MAP_SIZE,BORDA_FORA,0,'borda-leste');
criarBorda(BORDA_ESPESSURA,MAP_SIZE,-BORDA_FORA,0,'borda-oeste');
criarBorda(MAP_SIZE-2*BORDA_ESPESSURA,BORDA_ESPESSURA,0,BORDA_FORA,'borda-sul');
criarBorda(MAP_SIZE-2*BORDA_ESPESSURA,BORDA_ESPESSURA,0,-BORDA_FORA,'borda-norte');
export{mapaBordas};
