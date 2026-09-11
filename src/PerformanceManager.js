import{renderer,composer,noCelular,bloomPass}from'./core.js';

// Um unico dono da qualidade em celular e desktop; nao altera fisica, IA ou mapa.
const PERFIS=[
  {nome:'baixo',pixelRatio:.75,sombras:false,bloom:false},
  {nome:'medio',pixelRatio:.9,sombras:true,bloom:false},
  {nome:'alto',pixelRatio:noCelular?1:Math.min(devicePixelRatio||1,1.35),sombras:true,bloom:true},
];
let nivel=1,ultimoAjuste=performance.now(),frames=0,inicio=ultimoAjuste,boas=0,fps=0;
const fpsEl=document.createElement('div');
fpsEl.id='fpsCounter';
fpsEl.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:28;pointer-events:none;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.55);color:#fff;font:700 12px system-ui';
document.body.appendChild(fpsEl);
function aplicar(){
  const p=PERFIS[nivel];
  // Cada setPixelRatio ja atualiza os buffers; evita redimensionamento duplicado.
  renderer.setPixelRatio(p.pixelRatio);
  composer.setPixelRatio(p.pixelRatio);
  renderer.shadowMap.enabled=p.sombras;
  renderer.shadowMap.needsUpdate=true;
  if(bloomPass)bloomPass.enabled=p.bloom;
  ultimoAjuste=performance.now();
  console.info('[performance] qualidade=%s pixelRatio=%s sombras=%s',p.nome,p.pixelRatio,p.sombras);
}
aplicar();
window.__quintalQualidade=()=>({nivel,...PERFIS[nivel],fps});
function medir(agora){
  requestAnimationFrame(medir);
  if(document.hidden){frames=0;inicio=agora;boas=0;return}
  frames++;
  const decorrido=agora-inicio;
  if(decorrido<2000)return;
  fps=frames*1000/decorrido;frames=0;inicio=agora;
  fpsEl.textContent=`FPS: ${Math.round(fps)} · ${PERFIS[nivel].nome}`;
  fpsEl.dataset.qualidade=String(nivel);
  if(agora-ultimoAjuste<6000)return;
  if(fps<40&&nivel>0){nivel--;boas=0;aplicar()}
  else if(fps>57&&nivel<2){if(++boas>=6){nivel++;boas=0;aplicar()}}
  else boas=0;
}
document.addEventListener('visibilitychange',()=>{frames=0;inicio=performance.now();boas=0});
requestAnimationFrame(medir);
