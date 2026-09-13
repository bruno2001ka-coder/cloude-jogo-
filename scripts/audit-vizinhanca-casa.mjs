import{FAZENDA_CONFIG as F}from'../src/FarmConfig.js';
const C=F.casa;
const box=(nome,cx,cz,w,d,grupo)=>({nome,cx,cz,w,d,grupo,minX:cx-w/2,maxX:cx+w/2,minZ:cz-d/2,maxZ:cz+d/2});
const gap=(a,b)=>Math.hypot(Math.max(0,b.minX-a.maxX,a.minX-b.maxX),Math.max(0,b.minZ-a.maxZ,a.minZ-b.maxZ));
const casa=box('casa',C.x,C.z,C.baseLargura,C.baseProfundidade,'estrutura');
const perto=[
  box('curral-vacas',-85.5,-55.2,7,6.8,'animais'),
  box('cocho',F.servico.cocho.x,F.servico.cocho.z,F.servico.cocho.largura,F.servico.cocho.profundidade,'servico'),
  box('barril',F.servico.barril.x,F.servico.barril.z,F.servico.barril.raio*2,F.servico.barril.raio*2,'servico'),
  box('ponto-servico',F.polo.x,F.polo.z,.8,.8,'interacao'),
  box('plantacao',-94,-45,6,8,'cultivo'),
  box('arvore-oeste',-101,-58,1.5,1.5,'paisagismo'),
  box('arvore-sudeste',-90,-36,1.8,1.8,'paisagismo'),
];
const analise=perto.map(o=>({objeto:o.nome,grupo:o.grupo,distancia:gap(casa,o)})).sort((a,b)=>a.distancia-b.distancia);
console.log(JSON.stringify({casa:{x:C.x,z:C.z,w:C.baseLargura,d:C.baseProfundidade},analise,alertas:analise.filter(x=>x.distancia<3.5)},null,2));
