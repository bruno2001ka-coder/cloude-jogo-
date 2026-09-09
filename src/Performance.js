// Ajustes de custo para GPU móvel. Só reduz o que a neblina/tela pequena já esconde.
import{scene,camera,noCelular}from'./core.js';

if(noCelular){
  // A neblina já apaga quase tudo antes de 190 m; 240 m deixa folga para skyline/horizonte
  // e evita mandar objetos muito distantes para a GPU.
  camera.far=Math.min(camera.far,240);
  camera.updateProjectionMatrix();

  // O sol era 2048² também no celular. 1024² usa 1/4 dos pixels e da memória do shadow map.
  // O PCF simples e a tela menor mascaram a perda de definição.
  scene.traverse(o=>{
    if(o.isDirectionalLight&&o.castShadow){
      o.shadow.mapSize.set(1024,1024);
      o.shadow.map?.dispose?.();
      o.shadow.map=null;
      o.shadow.needsUpdate=true;
    }
  });
}
