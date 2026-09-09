// Desempenho adaptativo + contador de FPS visivel.
import{scene,camera,renderer,noCelular}from'./core.js';

// ===== CONTADOR VISIVEL =====
const fpsEl=document.createElement('div');
fpsEl.id='fpsCounter';
fpsEl.textContent='FPS: --';
fpsEl.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:28;'+
  'pointer-events:none;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.55);'+
  'color:#fff;font:700 12px/1.2 system-ui,sans-serif;letter-spacing:.03em;'+
  'text-shadow:0 1px 2px #000;backdrop-filter:blur(3px)';
document.body.appendChild(fpsEl);

// ===== AJUSTE BASE PARA CELULAR =====
if(noCelular){
  camera.far=Math.min(camera.far,240);
  camera.updateProjectionMatrix();
  scene.traverse(o=>{
    if(o.isDirectionalLight&&o.castShadow){
      o.shadow.mapSize.set(1024,1024);
      o.shadow.map?.dispose?.();
      o.shadow.map=null;
      o.shadow.needsUpdate=true;
    }
  });
}

// ===== QUALIDADE ADAPTATIVA =====
// 0 = normal mobile, 1 = reduzida, 2 = emergencia.
let nivel=0;
let ultimoNivel=-1;
function aplicarNivel(){
  if(!noCelular||nivel===ultimoNivel)return;
  ultimoNivel=nivel;
  const pixel=nivel===0?1:nivel===1?.85:.72;
  const far=nivel===0?240:nivel===1?210:180;
  renderer.setPixelRatio(pixel);
  renderer.setSize(innerWidth,innerHeight,false);
  camera.far=Math.min(camera.far,far);
  camera.updateProjectionMatrix();
  renderer.shadowMap.enabled=nivel<2;
  const fachadas=scene.getObjectByName('favela-fachadas-detalhadas');
  if(fachadas)fachadas.visible=nivel<2;
  fpsEl.dataset.qualidade=String(nivel);
}
aplicarNivel();

// Mede uma janela curta em vez de reagir a um quadro isolado.
let frames=0,inicio=performance.now(),fpsSuave=60;
let baixoPor=0,altoPor=0;
function medir(agora){
  frames++;
  const passou=agora-inicio;
  if(passou>=750){
    const fps=frames*1000/passou;
    fpsSuave=fpsSuave*.55+fps*.45;
    fpsEl.textContent=`FPS: ${Math.round(fpsSuave)}${noCelular?` · Q${3-nivel}`:''}`;

    if(noCelular){
      if(fpsSuave<34){baixoPor+=passou;altoPor=0}
      else if(fpsSuave>52){altoPor+=passou;baixoPor=0}
      else{baixoPor=Math.max(0,baixoPor-passou*.5);altoPor=Math.max(0,altoPor-passou*.5)}

      // Cai rapido quando realmente precisa, sobe devagar para evitar ficar oscilando.
      if(baixoPor>=2200&&nivel<2){nivel++;baixoPor=0;altoPor=0;aplicarNivel()}
      else if(altoPor>=6500&&nivel>0){nivel--;baixoPor=0;altoPor=0;aplicarNivel()}
    }
    frames=0;inicio=agora;
  }
  requestAnimationFrame(medir);
}
requestAnimationFrame(medir);
