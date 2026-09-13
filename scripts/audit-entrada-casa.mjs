import{FAZENDA_CONFIG as F}from'../src/FarmConfig.js';
const c=F.casa,porta={x:c.x,z:c.z+2.53};
const objetos=[
 ['banco',c.x-1.95,c.z+3.37,1.8,.48],
 ['vaso-esquerdo',c.x-2.35,c.z+3.35,.42,.42],
 ['vaso-direito',c.x+2.35,c.z+3.35,.42,.42],
 ['ponto-servico',F.polo.x,F.polo.z,.8,.8],
 ['cocho',F.servico.cocho.x,F.servico.cocho.z,F.servico.cocho.largura,F.servico.cocho.profundidade],
 ['barril',F.servico.barril.x,F.servico.barril.z,F.servico.barril.raio*2,F.servico.barril.raio*2],
];
const naFaixa=(x,z,w,d)=>Math.abs(x-porta.x)<Math.max(.75,w/2)&&z>porta.z-.35&&z<porta.z+1.5;
const bloqueios=objetos.filter(([,x,z,w,d])=>naFaixa(x,z,w,d));
console.log(JSON.stringify({porta,objetos,bloqueios,resultado:bloqueios.length?'FALHA':'OK'},null,2));
if(bloqueios.length)process.exitCode=1;
