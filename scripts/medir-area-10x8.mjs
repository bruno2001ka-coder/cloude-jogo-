const MORROS=[
  {x:0,z:-24,a:12.5,s:27},
  {x:-24,z:-40,a:6,s:17},
  {x:20,z:-10,a:5,s:15},
];
function obterElevacao(x,z){
  let h=0;
  for(const m of MORROS){const dx=x-m.x,dz=z-m.z;h+=m.a*Math.exp(-(dx*dx+dz*dz)/(2*m.s*m.s))}
  h+=Math.sin(x*.045)*Math.cos(z*.038)*1.8
    +Math.sin(x*.11+z*.09)*.8
    +Math.cos(x*.19-z*.16)*.3
    +Math.sin(x*.33+z*.28)*.12;
  h-=.7*Math.sin(2*Math.PI*h/2.6)/(2*Math.PI);
  return Math.max(-2.5,Math.min(22,h));
}
const area={x:65.7,z:-1.8,w:10,d:8};
const grade=[];
for(let ix=0;ix<=20;ix++)for(let iz=0;iz<=16;iz++){
  const x=area.x-area.w/2+ix*area.w/20,z=area.z-area.d/2+iz*area.d/16;
  grade.push({x,z,h:obterElevacao(x,z)});
}
const lado={
  norte:grade.filter(p=>p.z===area.z-area.d/2),
  sul:grade.filter(p=>p.z===area.z+area.d/2),
  oeste:grade.filter(p=>p.x===area.x-area.w/2),
  leste:grade.filter(p=>p.x===area.x+area.w/2),
};
const media=a=>a.reduce((s,p)=>s+p.h,0)/a.length;
const resumo=Object.fromEntries(Object.entries(lado).map(([k,v])=>[k,{media:media(v),min:Math.min(...v.map(p=>p.h)),max:Math.max(...v.map(p=>p.h))}]));
const min=Math.min(...grade.map(p=>p.h)),max=Math.max(...grade.map(p=>p.h));
const baixo=Object.entries(resumo).sort((a,b)=>a[1].media-b[1].media)[0];
console.log(JSON.stringify({area,resumo,min,max,desnivel:max-min,ladoMaisBaixo:baixo[0],alturaEscada:max-baixo[1].media},null,2));
