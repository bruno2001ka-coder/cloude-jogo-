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

/* Layout interno: cultivo e animais não podem se misturar. */
function distSegmento(px,pz){
  const a=F.acesso.a,b=F.acesso.b,dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  const tt=Math.max(0,Math.min(1,((px-a.x)*dx+(pz-a.z)*dz)/den));
  return Math.hypot(px-(a.x+dx*tt),pz-(a.z+dz*tt));
}
const C=F.cultivo,A=F.animais,seg=C.segmento;
let canteiros=0,linhas=0;
for(let z=C.minZ;z<=C.maxZ;z+=C.espacamentoLinha){
  linhas++;
  for(let x0=C.minX;x0<C.maxX-.001;x0+=seg)canteiros++;
}
assert(linhas===4,`esperadas 4 linhas de cultivo, calculadas ${linhas}`);
assert(canteiros===56,`esperados 56 segmentos de canteiro, calculados ${canteiros}`);
assert(A.maxZ<C.minZ,`campo animal e cultivo se sobrepõem em Z: ${A.maxZ} / ${C.minZ}`);
assert(C.minZ-A.maxZ>=7,`separação entre campo e roça menor que 7 m: ${C.minZ-A.maxZ}`);
for(const[x,z]of[[A.minX+A.margem,A.minZ+A.margem],[A.maxX-A.margem,A.maxZ-A.margem]])
  assert(distSegmento(x,z)>F.acesso.raio+.8,'campo dos animais invade corredor principal');
assert(distSegmento(-94,-53)<F.acesso.raio,'o antigo balcão deve continuar proibido no corredor');
console.log(JSON.stringify({largura,profundidade,altura,vao,lateral,subida,agua,
  acessoA:F.acesso.a,acessoB:F.acesso.b,larguraCorredor:F.acesso.raio*2,
  cultivo:{linhas,canteiros,minX:C.minX,maxX:C.maxX,minZ:C.minZ,maxZ:C.maxZ},
  campoAnimais:A,separacaoMetros:C.minZ-A.maxZ},null,2));
