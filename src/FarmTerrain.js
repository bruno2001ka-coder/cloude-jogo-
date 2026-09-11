// Matematica pura dos platos da fazenda prototipo. Separada do Three.js para permitir teste numerico
// da area plana, da folga da triangulacao e da transicao antes de abrir o jogo.
import{FARM_PROTOTYPE}from'./FarmPrototypeConfig.js';

export const PROTOTYPE_PAD_LAYOUT=[
  {id:'house',x:FARM_PROTOTYPE.house.x+1.2,z:FARM_PROTOTYPE.house.z,hx:12.2,hz:8.6,blend:5.2},
  {id:'barn',x:FARM_PROTOTYPE.barn.x,z:FARM_PROTOTYPE.barn.z,hx:9.8,hz:7.7,blend:5.0},
];

export function createPrototypePads(baseHeight){
  return PROTOTYPE_PAD_LAYOUT.map(pad=>({...pad,level:baseHeight(pad.x,pad.z)}));
}

export function flattenPrototypeHeight(height,x,z,pads){
  let result=height;
  for(const pad of pads){
    const ox=Math.max(Math.abs(x-pad.x)-pad.hx,0),oz=Math.max(Math.abs(z-pad.z)-pad.hz,0);
    const distance=Math.hypot(ox,oz);
    if(distance>=pad.blend)continue;
    const t=distance/pad.blend,smooth=t*t*(3-2*t);
    result=pad.level+(result-pad.level)*smooth;
  }
  return result;
}
