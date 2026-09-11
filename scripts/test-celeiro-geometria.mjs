const largura=6;
const profundidade=5;
const altura=3.2;
const vao=2.35;
const espessura=.18;
const lateral=(largura-vao)/2;
const subida=4.55-altura;
const meiaLarg=3;
const beiral=.45;
const agua=Math.hypot(meiaLarg,subida)+beiral;
const assert=(cond,msg)=>{if(!cond)throw new Error(msg)};
assert(lateral>0,'o vão não pode ser maior que a fachada');
assert(Math.abs(2*lateral+vao-largura)<1e-9,'as laterais não fecham a largura da fachada');
assert(altura>0&&profundidade>0,'dimensões inválidas');
assert(Math.abs(agua-(Math.hypot(3,1.35)+.45))<1e-9,'comprimento do telhado inconsistente');
assert(espessura<altura,'parede não pode ser uma laje horizontal');
console.log(JSON.stringify({largura,profundidade,altura,vao,lateral,subida,agua},null,2));

/* Corredor de acesso da fazenda: porteira -> porta.
   A grade antiga colocava canteiros exatamente nesse trecho. Este teste deixa a conta explícita
   para qualquer mudança futura de layout precisar respeitar a passagem. */
const fazenda={cx:-86,cz:-50,meiaLarg:13,meiaProf:11};
const casa={x:fazenda.cx-fazenda.meiaLarg+5,z:fazenda.cz-fazenda.meiaProf+5};
const porteira={x:fazenda.cx+fazenda.meiaLarg,z:fazenda.cz};
const acessoA={x:porteira.x-.8,z:porteira.z};
const acessoB={x:casa.x,z:casa.z+2.75};
const raioCorredor=1.9;
function distSegmento(px,pz){
  const dx=acessoB.x-acessoA.x,dz=acessoB.z-acessoA.z,den=dx*dx+dz*dz;
  const t=Math.max(0,Math.min(1,((px-acessoA.x)*dx+(pz-acessoA.z)*dz)/den));
  return Math.hypot(px-(acessoA.x+dx*t),pz-(acessoA.z+dz*t));
}
const xIni=fazenda.cx-fazenda.meiaLarg+7.5,xFim=fazenda.cx+fazenda.meiaLarg-2.2;
const zIni=fazenda.cz-fazenda.meiaProf+2.2,zFim=fazenda.cz+fazenda.meiaProf-8,seg=1.25;
let total=0,removidos=0;
for(let z=zIni;z<=zFim;z+=1.7){
  for(let x0=xIni;x0<xFim-.001;x0+=seg){
    const comp=Math.min(seg,xFim-x0),mx=x0+comp/2;total++;
    if(distSegmento(mx,z)<=raioCorredor+comp/2)removidos++;
  }
}
assert(removidos===42,`esperados 42 segmentos fora do corredor, calculados ${removidos}`);
assert(total===98,`grade original de canteiros mudou: ${total}`);
const antigoBalcao={x:-94,z:-53};
assert(distSegmento(antigoBalcao.x,antigoBalcao.z)<raioCorredor,
  'o antigo balcão deveria cair dentro do corredor; se não cair, recalcule o layout');
console.log(JSON.stringify({acessoA,acessoB,larguraCorredor:raioCorredor*2,canteirosTotal:total,canteirosRemovidos:removidos},null,2));
