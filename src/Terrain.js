// Relevo procedural do terreno + a malha de chão (única superfície de chão; vielas ficam expostas entre as casas).
import*as THREE from'three';
import{matChao}from'./Materials.js';
import{scene}from'./core.js';

// ===== O MORRO NÃO É UM CONE =====
// Era UMA gaussiana em (0,-24): matematicamente perfeita, e por isso mesmo lia como uma bolha de
// terra. Morro de verdade tem cume torto, esporões, platôs cortados na encosta e barranco.
//
// Três camadas, e cada uma resolve uma coisa que as outras não resolvem:
//   1. TRÊS gaussianas deslocadas, de tamanhos diferentes — dá um cume assimétrico com dois esporões
//      descendo, em vez de um cone. É o que faz o morro ter "frente" e "fundo".
//   2. Ruído por senos cruzados em frequências NÃO múltiplas (.045/.038, .11/.09, .19/.16, .33/.28).
//      Múltiplas se alinhariam e devolveriam um padrão de tabuleiro visível — o mesmo defeito de
//      loteamento que o traçado tinha. Sem múltiplos, o batimento entre elas nunca fecha ciclo dentro
//      do mapa e o chão fica irregular de verdade.
//   3. PLATÔS. A favela é feita de patamares cortados no barranco, não de rampa contínua. Subtrair
//      um seno da própria altura achata a curva perto de cada múltiplo do passo e deixa o degrau
//      entre eles: `h - amp*sin(2πh/passo)/(2π)`. É terraceamento com uma linha de trigonometria, e
//      não custa nada num campo que a NavMesh, a polícia e o jogador consultam milhares de vezes.
//
// TETO DE INCLINAÇÃO: o jogador sobe qualquer rampa (a altura dele é sempre o máximo entre onde está
// e o terreno), então declive não bloqueia ninguém — mas casa em encosta de 40° fica deitada. As
// amplitudes abaixo foram escolhidas medindo o gradiente máximo dentro do bairro (ver verificar.mjs),
// ficam em 19° de MÉDIA com picos de 38° — os picos são o barranco, e é exatamente ali que a
// escadaria do traçado tem que nascer.
const MORROS=[
  {x:  0,z:-24,a:12.5,s:27},// cume principal, onde fica a praça do Mercado
  {x:-24,z:-40,a: 6.0,s:17},// esporão noroeste
  {x: 20,z:-10,a: 5.0,s:15},// esporão sudeste, que empurra o bairro pra baixo
];
// A FORÇA TEM QUE SER MENOR QUE 1. A derivada de `h - F*sin(2πh/P)/(2π)` em relação a h é
// `1 - F*cos(2πh/P)`: com F=1,35 ela fica NEGATIVA em parte do ciclo, ou seja, a altura passa a
// DECRESCER quando deveria crescer — o terreno dobra sobre si mesmo. Foi o que medi na primeira
// tentativa (46,8° de inclinação máxima, com dobras). Com 0,7 a função é monótona e o multiplicador
// de declive fica no máximo 1,7, que é o que dá o barranco entre patamares sem virar parede.
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
  // Platôs: achata perto de cada múltiplo de PLATO_PASSO e deixa o barranco entre eles.
  h-=PLATO_FORCA*Math.sin(2*Math.PI*h/PLATO_PASSO)/(2*Math.PI);
  return THREE.MathUtils.clamp(h,-2.5,22);
}

// Chão de terra com PBR: a mesma textura tileável do resto do bairro, repetida a cada 4 m. O normal é
// o que faz o sol raspante revelar o relevo do chão em vez de deixar uma mancha lisa.
const groundMat=matChao();
for(const t of[groundMat.map,groundMat.normalMap,groundMat.roughnessMap])t.repeat.set(260/4,260/4);
// 84 segmentos em 260 m davam 3,1 m por quadrado — grosso demais pra platô de 2,3 m de passo, que
// simplesmente sumia entre dois vértices. 168 resolve o degrau (1,55 m por quadrado) e continua sendo
// UMA malha, ou seja, um draw call: o custo é de vértices, que é o que GPU móvel tem de sobra.
const groundGeometry=new THREE.PlaneGeometry(260,260,168,168);
const groundPositions=groundGeometry.attributes.position;
for(let i=0;i<groundPositions.count;i++){const x=groundPositions.getX(i),localY=groundPositions.getY(i),worldZ=-localY;groundPositions.setZ(i,obterElevacao(x,worldZ))}
groundGeometry.computeVertexNormals();
groundGeometry.setAttribute('uv1',groundGeometry.attributes.uv);// aoMap lê o 2º canal de UV
export const ground=new THREE.Mesh(groundGeometry,groundMat);
ground.rotation.x=-Math.PI/2;ground.castShadow=true;ground.receiveShadow=true;scene.add(ground);
