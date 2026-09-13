import{FAZENDA_CONFIG as F}from'../src/FarmConfig.js';

const casa=F.casa;
const box=(nome,cx,cz,w,d,grupo='casa',intentional=false)=>({nome,cx,cz,w,d,grupo,intentional,minX:cx-w/2,maxX:cx+w/2,minZ:cz-d/2,maxZ:cz+d/2});
const overlap=(a,b)=>Math.min(a.maxX,b.maxX)>Math.max(a.minX,b.minX)&&Math.min(a.maxZ,b.maxZ)>Math.max(a.minZ,b.minZ);
const inter=(a,b)=>({x:Math.max(0,Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)),z:Math.max(0,Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ))});
const gap=(a,b)=>Math.hypot(Math.max(0,b.minX-a.maxX,a.minX-b.maxX),Math.max(0,b.minZ-a.maxZ,a.minZ-b.maxZ));
const house=[];
const push=(...args)=>house.push(box(...args));
// Volumes principais: todos os números vêm do FarmConfig/WorldGenerator.
push('fundacao',casa.x,casa.z,casa.baseLargura,casa.baseProfundidade,'estrutura');
push('paredes',casa.x,casa.z,casa.largura,casa.profundidade,'estrutura');
push('telhado-projecao',casa.x,casa.z,2*(Math.hypot(3,1.35)+.45),5.9,'cobertura',true);
push('varanda-piso',casa.x,casa.z+2.95,6.8,1.35,'varanda',true);
push('telheiro-varanda',casa.x,casa.z+3.00,7.15,1.7,'varanda',true);
push('degrau-entrada-1',casa.x,casa.z+3.17,2.8,.46,'acesso',true);
push('degrau-entrada-2',casa.x,casa.z+3.42,2.25,.34,'acesso',true);
for(const x of[casa.x-1.78,casa.x+1.78])push(`janela-frontal-${x< casa.x?'E':'D'}`,x,casa.z+2.53,1.62,.24,'esquadria',true);
push('janela-lateral',casa.x-3.02,casa.z-.55,.24,1.62,'esquadria',true);
push('cocho',F.servico.cocho.x,F.servico.cocho.z,F.servico.cocho.largura,F.servico.cocho.profundidade,'servico');
push('barril',F.servico.barril.x,F.servico.barril.z,F.servico.barril.raio*2,F.servico.barril.raio*2,'servico');
const externos=[];
for(const c of Object.values(F.currais))externos.push(box(`curral-${c.tipo}`,c.cx,c.cz,c.w,c.d,'curral'));
const C=F.cultivo;externos.push(box('cultivo',(C.minX+C.maxX)/2,(C.minZ+C.maxZ)/2,C.maxX-C.minX,C.maxZ-C.minZ,'cultivo'));
const cerca=box('cerca-interna',F.cx,F.cz,F.meiaLarg*2,F.meiaProf*2,'limite',true);
externos.push(cerca);
// A casa e a varanda precisam ficar dentro da cerca; isso é contenção intencional, não erro.
const acidentes=[];
for(const h of house)for(const e of externos)if(!e.intentional&&overlap(h,e))acidentes.push({a:h.nome,b:e.nome,inter:inter(h,e),gap:gap(h,e)});
const casaFoot=house.find(x=>x.nome==='paredes');
console.log(JSON.stringify({
  origem:{x:casa.x,z:casa.z},
  dimensoes:{largura:casa.largura,profundidade:casa.profundidade,altura:casa.altura,baseLargura:casa.baseLargura,baseProfundidade:casa.baseProfundidade,baseAltura:casa.baseAltura,portaVao:casa.portaVao},
  volumes:house.map(({nome,cx,cz,w,d,grupo})=>({nome,cx,cz,w,d,grupo})),
  sobreposicoesIntencionais:house.flatMap(a=>house.filter(b=>a.nome<b.nome&&overlap(a,b)).map(b=>({a:a.nome,b:b.nome,inter:inter(a,b)}))),
  sobreposicoesAcidentais:acidentes,
  folgasExternas:externos.map(e=>({nome:e.nome,distanciaDaCasa:gap(casaFoot,e)})),
  resultado:acidentes.length?'FALHA':'OK'
},null,2));
if(acidentes.length)process.exitCode=1;
