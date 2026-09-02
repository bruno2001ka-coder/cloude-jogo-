// Relevo procedural do terreno + a malha de chão (única superfície de chão; vielas ficam expostas entre as casas).
import*as THREE from'three';
import{matChao}from'./Materials.js';
import{scene}from'./core.js';

// ===== O MORRO =====
// O campo de senos sozinho dava ondulação de +-3 m: o bairro ficava num terreno levemente ondulado,
// não num morro. A favela é COMUNIDADE EM ENCOSTA, e a verticalidade é o que a define — casa sobre
// casa, laje virando quintal do vizinho de cima, beco que é escada.
//
// POR QUE GAUSSIANA E NÃO MAIS UM SENO: o relevo precisa ser LOCAL. Os quatro polos econômicos de
// Poles.js são coordenadas fixas e projetadas (quadrilátero de perímetro ~311 m, nenhum trecho menor
// que 60 m, pra obrigar a atravessar o bairro patrulhado). Um seno novo levantaria a fazenda em
// (-94,-53) e as lojas em (60,-46) e (50,30) junto, e o traçado inteiro sairia do lugar. A gaussiana
// cai a zero longe do centro: nos quatro polos ela contribui menos de 1,5 m.
//
// A ALTURA E A LARGURA SÃO UMA CONTA, não um chute. A inclinação máxima de uma gaussiana de altura A
// e desvio s é A/(s*raiz(e)). Com A=14 e s=30 dá 0,28, ou ~16 graus — dentro do que o passo do
// jogador (ALTURA_DEGRAU, em Player.js) vence andando, então não existe encosta onde ele fique
// patinando. E a malha do chão tem 84 segmentos em 260 m (3,1 m por segmento), que resolve s=30 sem
// facetar. Subir A ou baixar s quebra uma dessas duas coisas.
//
// O centro é (0,-24), logo abaixo do Mercado em (0,-18): o polo de sementes vira a praça do alto do
// morro, e comprar semente passa a exigir a subida.
const MORRO={x:0,z:-24,altura:14,sigma:30};
const DOIS_SIGMA2=2*MORRO.sigma*MORRO.sigma;
export function obterElevacao(x,z){
  const morroNorte=Math.sin(z*.045)*3.6;
  const morroLeste=Math.cos(x*.035)*2.8;
  const valeDiagonal=Math.sin((x+z)*.028)*1.9;
  const dx=x-MORRO.x,dz=z-MORRO.z;
  const encosta=MORRO.altura*Math.exp(-(dx*dx+dz*dz)/DOIS_SIGMA2);
  return THREE.MathUtils.clamp(morroNorte+morroLeste+valeDiagonal+encosta,-2.5,22);
}

// Textura procedural de terra/grama (sem arquivos externos): mancha de tons sobre o marrom base, repetida pelo terreno.
function criarTexturaChao(){const s=256,cv=document.createElement('canvas');cv.width=cv.height=s;const ctx=cv.getContext('2d');ctx.fillStyle='#8b6f4e';ctx.fillRect(0,0,s,s);for(let i=0;i<950;i++){const x=Math.random()*s,y=Math.random()*s,r=1+Math.random()*2.6,terra=Math.random()<.55;ctx.fillStyle=terra?`rgba(${100+Math.random()*30|0},${75+Math.random()*25|0},${45+Math.random()*20|0},.5)`:`rgba(${60+Math.random()*35|0},${92+Math.random()*30|0},${42+Math.random()*20|0},.32)`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(52,52);tex.colorSpace=THREE.SRGBColorSpace;return tex}

// Chão de terra com PBR: a mesma textura tileável do resto do bairro, repetida a cada 4 m. O normal é
// o que faz o sol raspante revelar o relevo do chão em vez de deixar uma mancha lisa.
const groundMat=matChao();
for(const t of[groundMat.map,groundMat.normalMap,groundMat.roughnessMap])t.repeat.set(260/4,260/4);
const groundGeometry=new THREE.PlaneGeometry(260,260,84,84);
const groundPositions=groundGeometry.attributes.position;
for(let i=0;i<groundPositions.count;i++){const x=groundPositions.getX(i),localY=groundPositions.getY(i),worldZ=-localY;groundPositions.setZ(i,obterElevacao(x,worldZ))}
groundGeometry.computeVertexNormals();
groundGeometry.setAttribute('uv1',groundGeometry.attributes.uv);// aoMap lê o 2º canal de UV
export const ground=new THREE.Mesh(groundGeometry,groundMat);
ground.rotation.x=-Math.PI/2;ground.castShadow=true;ground.receiveShadow=true;scene.add(ground);
