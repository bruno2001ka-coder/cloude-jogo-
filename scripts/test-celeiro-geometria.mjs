import{FAZENDA_CONFIG as F}from'../src/FarmConfig.js';

const largura=F.casa.largura;
const profundidade=F.casa.profundidade;
const altura=F.casa.altura;
const vao=F.casa.portaVao;
const espessura=.18;
const lateral=(largura-vao)/2;
const subida=4.55-altura;
const meiaLarg=largura/2;
const beiral=.45;
const agua=Math.hypot(meiaLarg,subida)+beiral;
const assert=(cond,msg)=>{if(!cond)throw new Error(msg)};
assert(lateral>0,'o vão não pode ser maior que a fachada');
assert(Math.abs(2*lateral+vao-largura)<1e-9,'as laterais não fecham a largura da fachada');
assert(altura>0&&profundidade>0,'dimensões inválidas');
assert(Math.abs(agua-(Math.hypot(3,1.35)+.45))<1e-9,'comprimento do telhado inconsistente');
assert(espessura<altura,'parede não pode ser uma laje horizontal');

function boundsCurral(c){
  return{minX:c.cx-c.w/2,maxX:c.cx+c.w/2,minZ:c.cz-c.d/2,maxZ:c.cz+c.d/2};
}
function overlap(a,b){
  return Math.min(a.maxX,b.maxX)>Math.max(a.minX,b.minX)&&
         Math.min(a.maxZ,b.maxZ)>Math.max(a.minZ,b.minZ);
}
function gapRet(a,b){
  const gx=Math.max(0,b.minX-a.maxX,a.minX-b.maxX);
  const gz=Math.max(0,b.minZ-a.maxZ,a.minZ-b.maxZ);
  return Math.hypot(gx,gz);
}
function distPontoRet(px,pz,r){
  const dx=Math.max(r.minX-px,0,px-r.maxX);
  const dz=Math.max(r.minZ-pz,0,pz-r.maxZ);
  return Math.hypot(dx,dz);
}
function distSegmentoRet(a,b,r){
  let min=Infinity;
  for(let i=0;i<=240;i++){
    const t=i/240;
    const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
    min=Math.min(min,distPontoRet(x,z,r));
  }
  return min;
}

const C=F.cultivo;
const cultivo={minX:C.minX,maxX:C.maxX,minZ:C.minZ,maxZ:C.maxZ};
const currais=Object.values(F.currais).map(c=>({tipo:c.tipo,...boundsCurral(c)}));

// Campo dedicado: 6 x 8 m, 6 linhas, 5 segmentos por linha = 30 segmentos.
let canteiros=0,linhas=0;
for(let z=C.minZ;z<=C.maxZ;z+=C.espacamentoLinha){
  linhas++;
  for(let x0=C.minX;x0<C.maxX-.001;x0+=C.segmento)canteiros++;
}
assert(C.maxX-C.minX===6&&C.maxZ-C.minZ===8,'campo de plantio deve medir 6 x 8 m');
assert(linhas===6,`esperadas 6 linhas de cultivo, calculadas ${linhas}`);
assert(canteiros===30,`esperados 30 segmentos de canteiro, calculados ${canteiros}`);

// Nenhum curral pode se sobrepor a outro ou ao campo.
for(let i=0;i<currais.length;i++)for(let j=i+1;j<currais.length;j++)
  assert(!overlap(currais[i],currais[j]),`currais ${currais[i].tipo}/${currais[j].tipo} se sobrepõem`);
for(const c of currais)
  assert(!overlap(c,cultivo),`cultivo invade curral ${c.tipo}`);

// O caso crítico do print: porcos x plantio. São 2 m de folga lateral.
const porco=currais.find(c=>c.tipo==='porco');
assert(Math.abs(gapRet(porco,cultivo)-2)<1e-9,`folga plantio/porcos deveria ser 2 m, veio ${gapRet(porco,cultivo)}`);

// Recuos estruturais do campo.
const fazenda={minX:F.cx-F.meiaLarg,maxX:F.cx+F.meiaLarg,minZ:F.cz-F.meiaProf,maxZ:F.cz+F.meiaProf};
assert(C.minX-fazenda.minX>=2,'campo ficou perto demais da cerca oeste');
assert(fazenda.maxZ-C.maxZ>=2,'campo ficou perto demais da cerca norte');
const casa={minX:F.casa.x-F.casa.baseLargura/2,maxX:F.casa.x+F.casa.baseLargura/2,
  minZ:F.casa.z-F.casa.baseProfundidade/2,maxZ:F.casa.z+F.casa.baseProfundidade/2};
assert(gapRet(casa,cultivo)>=4.3,`campo ficou perto demais da casa: ${gapRet(casa,cultivo).toFixed(2)} m`);

const distCorredor=distSegmentoRet(F.acesso.a,F.acesso.b,cultivo);
assert(distCorredor-F.acesso.raio>=1.6,
  `campo invade folga do corredor principal: só ${(distCorredor-F.acesso.raio).toFixed(2)} m livres`);

console.log(JSON.stringify({
  largura,profundidade,altura,vao,lateral,subida,agua,
  cultivo:{...cultivo,largura:C.maxX-C.minX,profundidade:C.maxZ-C.minZ,linhas,canteiros},
  currais,
  folgaPlantioPorcos:gapRet(porco,cultivo),
  folgaPlantioCasa:gapRet(casa,cultivo),
  folgaExtraCorredor:distCorredor-F.acesso.raio
},null,2));
