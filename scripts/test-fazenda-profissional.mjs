import fs from'node:fs';
import{FAZENDA_CONFIG as F}from'../src/FarmConfig.js';

const wg=fs.readFileSync(new URL('../src/WorldGenerator.js',import.meta.url),'utf8');
const economy=fs.readFileSync(new URL('../src/Economy.js',import.meta.url),'utf8');
const terrain=fs.readFileSync(new URL('../src/Terrain.js',import.meta.url),'utf8');
const materials=fs.readFileSync(new URL('../src/Materials.js',import.meta.url),'utf8');

const resultados=[];
function check(nome,cond,detalhe=''){
  if(!cond)throw new Error(`[FAZENDA] ${nome}${detalhe?': '+detalhe:''}`);
  resultados.push(nome);
}
const perto=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;
function distSeg(px,pz,a=F.acesso.a,b=F.acesso.b){
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  const t=den?Math.max(0,Math.min(1,((px-a.x)*dx+(pz-a.z)*dz)/den)):0;
  return Math.hypot(px-(a.x+dx*t),pz-(a.z+dz*t));
}
const portaPonto={x:F.casa.x,z:F.casa.portaFrenteZ};
const larguraLateral=(F.casa.largura-F.casa.portaVao)/2;
const folha=F.casa.portaVao/2-.05;
const subidaTelhado=4.55-F.casa.altura;
const compAgua=Math.hypot(F.casa.largura/2,subidaTelhado)+.45;
const animais=[
  [-84,-48],[-82,-47],[-88,-45],[-83,-44],[-79,-45],[-81,-46],[-78,-57]
];

// 01–09 · geometria fixa da casa
check('01 centro da casa preservado',F.casa.x===-94&&F.casa.z===-56);
check('02 footprint da casa preservado',F.casa.largura===6&&F.casa.profundidade===5);
check('03 altura da casa preservada',F.casa.altura===3.2);
check('04 fundação cobre o footprint',F.casa.baseLargura>=F.casa.largura&&F.casa.baseProfundidade>=F.casa.profundidade&&F.casa.baseAltura===.3);
check('05 vão da porta é válido',F.casa.portaVao>1.2&&F.casa.portaVao<F.casa.largura);
check('06 fachada fecha exatamente 6 m',perto(2*larguraLateral+F.casa.portaVao,F.casa.largura));
check('07 folhas não se sobrepõem no centro',folha>0&&perto(F.casa.portaVao-2*folha,.10));
check('08 subida do telhado continua 1,35 m',perto(subidaTelhado,1.35));
check('09 água do telhado mantém a conta geométrica',compAgua>3.7&&compAgua<3.8);

// 10–20 · implantação, acesso e objetos
check('10 posição da porteira preservada',F.porteira.x===-73&&F.porteira.z===-50);
check('11 vão da porteira preservado',F.porteira.vao===3.4);
check('12 platô da porteira cobre os dois batentes',F.nivelamentoPorteira.innerZ>=F.porteira.vao/2);
check('13 platô da casa cobre toda a fundação',F.nivelamentoCasa.innerX>=F.casa.baseLargura/2&&F.nivelamentoCasa.innerZ>=F.casa.baseProfundidade/2);
check('14 transições de terreno têm faixa suave',F.nivelamentoCasa.outerX>F.nivelamentoCasa.innerX&&F.nivelamentoCasa.outerZ>F.nivelamentoCasa.innerZ&&F.nivelamentoPorteira.outerX>F.nivelamentoPorteira.innerX&&F.nivelamentoPorteira.outerZ>F.nivelamentoPorteira.innerZ);
check('15 corredor é mais largo que a porteira',F.acesso.raio*2>=F.porteira.vao+.3);
check('16 corredor liga porteira e porta sem ser degenerado',Math.hypot(F.acesso.b.x-F.acesso.a.x,F.acesso.b.z-F.acesso.a.z)>20);
check('17 antigo balcão realmente invadia o corredor',distSeg(-94,-53)<F.acesso.raio);
check('18 novo polo não disputa com a porta',Math.hypot(F.polo.x-portaPonto.x,F.polo.z-portaPonto.z)>3.2);
check('19 novo polo fica fora do corredor',distSeg(F.polo.x,F.polo.z)>F.acesso.raio+1);
check('20 novo polo continua dentro da fazenda',Math.abs(F.polo.x-F.cx)<F.meiaLarg-1&&Math.abs(F.polo.z-F.cz)<F.meiaProf-1);

// 21–30 · regressões de código/física/interação
check('21 roça filtra o corredor',wg.includes('distanciaAoCorredorFazenda(mx,z)>RAIO_CORREDOR_ACESSO+comp/2'));
check('22 balcão que tampava a porta não voltou',!wg.includes('function criarBalcaoFazenda'));
check('23 animais nascem fora do corredor',animais.every(([x,z])=>distSeg(x,z)>=F.acesso.raio+.55));
check('24 novos alvos de animais evitam o corredor',wg.includes('distanciaAoCorredorFazenda(x,z)<FAZENDA_CONFIG.acesso.raio+.55'));
check('25 fundação é superfície andável',wg.includes('superficiesAndaveis.push(baseCeleiro)'));
check('26 tecla E aciona portas da fazenda',economy.includes("ctx.tipo==='portasCeleiro'")&&economy.includes("alternarPortasCeleiro()"));
check('27 portas usam colisores por folha',wg.includes("registrarCaixa(new THREE.Box3(),'porta-celeiro')")&&wg.includes('atualizarColisoresFolhas(portasCeleiro.pivos)'));
check('28 porteira usa colisores por folha',wg.includes("registrarCaixa(new THREE.Box3(),'porteira')")&&wg.includes('atualizarColisoresFolhas(porteiraFazenda.pivos)'));
check('29 materiais da fazenda são próprios',wg.includes('matParedeRural()')&&wg.includes('matTelhaBarroRural()')&&materials.includes('bumpMap:bumpTelhaRural()'));
check('30 terreno nivela casa e porteira',terrain.includes('FAZENDA_CONFIG.nivelamentoCasa')&&terrain.includes('FAZENDA_CONFIG.nivelamentoPorteira'));

console.log(JSON.stringify({ok:true,total:resultados.length,checks:resultados},null,2));
