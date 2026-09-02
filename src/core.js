// Núcleo compartilhado: scene/camera/renderer/composer, criados uma única vez.
// Todo módulo que precisa adicionar algo à cena importa daqui (nunca o contrário).
import*as THREE from'three';
import{EffectComposer}from'three/addons/postprocessing/EffectComposer.js';
import{RenderPass}from'three/addons/postprocessing/RenderPass.js';
import{UnrealBloomPass}from'three/addons/postprocessing/UnrealBloomPass.js';
import{OutputPass}from'three/addons/postprocessing/OutputPass.js';

export const scene=new THREE.Scene();
export const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,260);
// CELULAR OU NÃO. A conta é grosseira de propósito (ponteiro grosso + tela estreita), mas é o que
// separa um aparelho com GPU de 5 W de um PC — e é dela que saem o antialias e o tamanho da sombra.
export const noCelular=matchMedia('(pointer:coarse)').matches&&innerWidth<1100;
// `antialias` desligado no celular: a cena é renderizada num render target do EffectComposer, então o
// MSAA do framebuffer padrão é banda de memória gasta sem chegar na tela. No desktop fica, porque lá
// sobra banda e ajuda as bordas do canvas.
export const renderer=new THREE.WebGLRenderer({antialias:!noCelular,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
// 1,07 em vez de 1,05: compensa o brightness(1.01) do filtro CSS que saiu do canvas (ver index.html —
// um `filter` num canvas de tela cheia custa uma passada de composição por quadro no Android).
renderer.toneMappingExposure=1.07;
renderer.shadowMap.enabled=true;
// PCF simples no celular. O PCFSoft faz 4x mais amostras por pixel sombreado, e num shadow map de
// 1024 (ver Environment.js) a diferença some na tela — mas o custo não some na GPU móvel.
renderer.shadowMap.type=noCelular?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Pós-processamento real via EffectComposer — bloom leve só nos pontos bem claros
// (janela acesa, lampião do esconderijo) + passe de saída com tone mapping correto.
export const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
// O UnrealBloomPass é uma pirâmide de blur: 5 níveis de mip, cada um com blur separável, ou seja ~10
// passadas de tela cheia por quadro. No celular ele roda em MEIA RESOLUÇÃO — o brilho é uma mancha
// difusa por definição, então metade da resolução é indistinguível, e o custo cai a um quarto.
const escalaBloom=noCelular?.5:1;
const bloomPass=new UnrealBloomPass(
  new THREE.Vector2(innerWidth*escalaBloom,innerHeight*escalaBloom),.35,.5,.86);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ===== REDIMENSIONAR SEM ENGASGAR =====
// Cada `resize` realoca os dois render targets do composer MAIS os ~5 níveis de mip do bloom. No
// Chrome Android, mostrar e esconder a barra de URL dispara resize em rajada — o gesto mais comum do
// aparelho era também o que mais engasgava. Agora a realocação acontece uma vez, no quadro seguinte
// ao fim da rajada, e só se o tamanho REALMENTE mudou.
let larguraAtual=innerWidth,alturaAtual=innerHeight,resizePendente=0;
function aplicarTamanho(){
  resizePendente=0;
  if(innerWidth===larguraAtual&&innerHeight===alturaAtual)return;
  larguraAtual=innerWidth;alturaAtual=innerHeight;
  camera.aspect=larguraAtual/alturaAtual;camera.updateProjectionMatrix();
  renderer.setSize(larguraAtual,alturaAtual);
  composer.setSize(larguraAtual,alturaAtual);
  bloomPass.setSize(larguraAtual*escalaBloom,alturaAtual*escalaBloom);
}
function agendarResize(){
  if(resizePendente)cancelAnimationFrame(resizePendente);
  resizePendente=requestAnimationFrame(aplicarTamanho);
}
addEventListener('resize',agendarResize);
addEventListener('orientationchange',agendarResize);

// ===== PERDA DE CONTEXTO WEBGL =====
// O Android tira o contexto WebGL de uma aba em segundo plano quando precisa de memória. Sem tratar,
// o que o jogador vê ao voltar pro jogo é TELA PRETA CONGELADA: o laço de quadros continua chamando
// `composer.render()`, cada chamada lança, o contador de erros do main.js chega ao teto e para de
// avisar, e o jogo fica "rodando" sem desenhar nada. É a falha mais grave que um jogo web pode ter no
// celular, porque acontece só ao trocar de app — exatamente o que ninguém testa.
//
// `preventDefault()` é o que autoriza o navegador a RESTAURAR o contexto depois; sem ele a perda é
// definitiva. `contextoPerdido` faz o laço pular o render em vez de lançar.
let contextoPerdido=false;
export function contextoOk(){return !contextoPerdido}
const aviso=document.createElement('div');
aviso.style.cssText='position:fixed;inset:0;z-index:30;display:none;align-items:center;'+
  'justify-content:center;background:rgba(8,14,10,.94);color:#e7c568;font:700 15px system-ui;'+
  'text-align:center;padding:24px;letter-spacing:.04em';
aviso.textContent='Recuperando o vídeo…';
document.body.appendChild(aviso);
renderer.domElement.addEventListener('webglcontextlost',ev=>{
  ev.preventDefault();
  contextoPerdido=true;
  aviso.style.display='flex';
},false);
renderer.domElement.addEventListener('webglcontextrestored',()=>{
  contextoPerdido=false;
  aviso.style.display='none';
  // O composer precisa refazer os render targets contra o contexto NOVO; sem isto o jogo volta
  // desenhando em buffers que não existem mais.
  composer.setSize(innerWidth,innerHeight);
  bloomPass.setSize(innerWidth*escalaBloom,innerHeight*escalaBloom);
},false);
