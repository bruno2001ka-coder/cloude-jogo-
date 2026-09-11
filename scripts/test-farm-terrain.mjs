import assert from'node:assert/strict';
import{PROTOTYPE_PAD_LAYOUT,createPrototypePads,flattenPrototypeHeight}from'../src/FarmTerrain.js';

const base=(x,z)=>x*.173-z*.117+4.2,pads=createPrototypePads(base);
assert.equal(pads.length,2,'Esperados dois platos: sede e galpao');

for(const pad of pads){
  for(let ix=-10;ix<=10;ix++)for(let iz=-10;iz<=10;iz++){
    const x=pad.x+pad.hx*ix/10,z=pad.z+pad.hz*iz/10;
    assert.ok(Math.abs(flattenPrototypeHeight(base(x,z),x,z,pads)-pad.level)<1e-9,
      `${pad.id} nao ficou perfeitamente plano em ${x},${z}`);
  }
  const outsideX=pad.x+pad.hx+pad.blend+.01,outsideZ=pad.z;
  assert.equal(flattenPrototypeHeight(base(outsideX,outsideZ),outsideX,outsideZ,pads),base(outsideX,outsideZ),
    `${pad.id} alterou terreno alem da transicao`);
}

const house=PROTOTYPE_PAD_LAYOUT.find(p=>p.id==='house');
assert.ok(house.hx-(16+5)/2>=1.55,'Sede sem folga de um vertice da malha');
assert.ok(house.hz-(11+3)/2>=1.55,'Sede sem folga de um vertice da malha em Z');
const barn=PROTOTYPE_PAD_LAYOUT.find(p=>p.id==='barn');
assert.ok(barn.hx-(14+2.6)/2>=1.49,'Galpao sem folga da malha em X');
assert.ok(barn.hz-(10+2.4)/2>=1.49,'Galpao sem folga da malha em Z');

console.log(JSON.stringify({pads:pads.map(p=>({id:p.id,level:Number(p.level.toFixed(3)),inner:[p.hx*2,p.hz*2],blend:p.blend}))},null,2));
