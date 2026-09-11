// Núcleo compartilhado: scene/camera/renderer/composer, criados uma única vez.
// Todo módulo que precisa adicionar algo à cena importa daqui (nunca o contrário).
import*as THREE from'three';
import{EffectComposer}from'three/addons/postprocessing/EffectComposer.js';
import{RenderPass}from'three/addons/postprocessing/RenderPass.js';
import{UnrealBloomPass}from'three/addons/postprocessing/UnrealBloomPass.js';
import{OutputPass}from'three/addons/postprocessing/OutputPass.js';
import{MAP_SIZE}from'./WorldBounds.js';

export const scene=new THREE.Scene();
export const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,MAP_SIZE*1.1);
export const noCelular=matchMedia('(pointer:coarse)').matches&&innerWidth<1100;

// No celular o gargalo principal é preencher pixels. 1.35x significava ~82% mais pixels que 1x.
// Mantemos 1x em telas touch e a resolução mais alta apenas no desktop.
// Alguns navegadores expõem WebGL2, mas deixam WebGL1 indisponível. Criar o contexto explicitamente
// evita que a detecção automática aborte o módulo principal antes de anexar o canvas do jogo.
const canvasWebGL=document.createElement('canvas');
const contextoWebGL2=canvasWebGL.getContext('webgl2',{antialias:!noCelular,powerPreference:'high-performance'});
export const renderer=new THREE.WebGLRenderer({
  antialias:!noCelular,
  powerPreference:'high-performance',
  ...(contextoWebGL2?{canvas:canvasWebGL,context:contextoWebGL2}: {})
});
renderer.setPixelRatio(noCelular?1:Math.min(devicePixelRatio||1,1.35));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.07;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=noCelular?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// O bloom usa uma pirâmide de blur com várias passadas de tela cheia. Em GPU móvel isso custa muito
// mais do que o ganho visual. No celular mantemos só RenderPass + OutputPass; no desktop o bloom fica.
export const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const escalaBloom=1;
export const bloomPass=noCelular?null:new UnrealBloomPass(
  new THREE.Vector2(innerWidth,innerHeight),.35,.5,.86);
if(bloomPass)composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ===== REDIMENSIONAR SEM ENGASGAR =====
let larguraAtual=innerWidth,alturaAtual=innerHeight,resizePendente=0;
function aplicarTamanho(){
  resizePendente=0;
  if(innerWidth===larguraAtual&&innerHeight===alturaAtual)return;
  larguraAtual=innerWidth;alturaAtual=innerHeight;
  camera.aspect=larguraAtual/alturaAtual;camera.updateProjectionMatrix();
  renderer.setSize(larguraAtual,alturaAtual);
  composer.setSize(larguraAtual,alturaAtual);
  if(bloomPass)bloomPass.setSize(larguraAtual*escalaBloom,alturaAtual*escalaBloom);
}
function agendarResize(){
  if(resizePendente)cancelAnimationFrame(resizePendente);
  resizePendente=requestAnimationFrame(aplicarTamanho);
}
addEventListener('resize',agendarResize);
addEventListener('orientationchange',agendarResize);

// ===== PERDA DE CONTEXTO WEBGL =====
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
  composer.setSize(innerWidth,innerHeight);
  if(bloomPass)bloomPass.setSize(innerWidth*escalaBloom,innerHeight*escalaBloom);
},false);
