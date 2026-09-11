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

/* Corredor de acesso da fazenda: porteira -> porta. */
function distSegmento(px,pz){
  const a=F.acesso.a,b=F.acesso.b,dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  const tt=Math.max(0,Math.min(1,((px-a.x)*dx+(pz-a.z)*dz)/den));
  return Math.hypot(px-(a.x+dx*tt),pz-(a.z+dz*tt));
}
const xIni=F.cx-F.meiaLarg+7.5,xFim=F.cx+F.meiaLarg-2.2;
const zIni=F.cz-F.meiaProf+2.2,zFim=F.cz+F.meiaProf-8,seg=1.25;
let total=0,removidosCorredor=0,removidosServico=0;
for(let z=zIni;z<=zFim;z+=1.7){
  for(let x0=xIni;x0<xFim-.001;x0+=seg){
    const comp=Math.min(seg,xFim-x0),mx=x0+comp/2;total++;
    if(distSegmento(mx,z)<=F.acesso.raio+comp/2)removidosCorredor++;
    else{
      const l=F.servico.limpeza;
      if(Math.abs(mx-l.x)<=l.meiaX+comp/2&&Math.abs(z-l.z)<=l.meiaZ+.51)removidosServico++;
    }
  }
}
assert(removidosCorredor===42,`esperados 42 segmentos fora do corredor, calculados ${removidosCorredor}`);
assert(removidosServico===8,`esperados 8 segmentos fora do pátio de serviço, calculados ${removidosServico}`);
assert(total===98,`grade original de canteiros mudou: ${total}`);
assert(distSegmento(-94,-53)<F.acesso.raio,'o antigo balcão deve continuar proibido no corredor');
console.log(JSON.stringify({largura,profundidade,altura,vao,lateral,subida,agua,
  acessoA:F.acesso.a,acessoB:F.acesso.b,larguraCorredor:F.acesso.raio*2,
  canteirosTotal:total,canteirosRemovidosCorredor:removidosCorredor,
  canteirosRemovidosServico:removidosServico,canteirosRestantes:total-removidosCorredor-removidosServico},null,2));
