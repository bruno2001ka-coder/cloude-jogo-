// Núcleo compartilhado: scene/camera/renderer/composer, criados uma única vez.
// Todo módulo que precisa adicionar algo à cena importa daqui (nunca o contrário).
import*as THREE from'three';
import{EffectComposer}from'three/addons/postprocessing/EffectComposer.js';
import{RenderPass}from'three/addons/postprocessing/RenderPass.js';
import{UnrealBloomPass}from'three/addons/postprocessing/UnrealBloomPass.js';
import{OutputPass}from'three/addons/postprocessing/OutputPass.js';

export const scene=new THREE.Scene();
export const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,260);
export const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);

// Pós-processamento real via EffectComposer — bloom leve só nos pontos bem claros
// (janela acesa, lampião do esconderijo) + passe de saída com tone mapping correto.
export const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.35,.5,.86);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)});
