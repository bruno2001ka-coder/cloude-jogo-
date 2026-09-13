import fs from'node:fs';
import{FAZENDA_CONFIG as F}from'../src/FarmConfig.js';

const wg=fs.readFileSync(new URL('../src/WorldGenerator.js',import.meta.url),'utf8');
const economy=fs.readFileSync(new URL('../src/Economy.js',import.meta.url),'utf8');
const terrain=fs.readFileSync(new URL('../src/Terrain.js',import.meta.url),'utf8');
const materials=fs.readFileSync(new URL('../src/Materials.js',import.meta.url),'utf8');
const animalPens=fs.readFileSync(new URL('../src/AnimalPens.js',import.meta.url),'utf8');

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
const boundsCurral=c=>({minX:c.cx-c.w/2,maxX:c.cx+c.w/2,minZ:c.cz-c.d/2,maxZ:c.cz+c.d/2});
const sobrepoe=(a,b)=>Math.min(a.maxX,b.maxX)>Math.max(a.minX,b.minX)&&Math.min(a.maxZ,b.maxZ)>Math.max(a.minZ,b.minZ);
const cultivoBox={minX:F.cultivo.minX,maxX:F.cultivo.maxX,minZ:F.cultivo.minZ,maxZ:F.cultivo.maxZ};
const currais=Object.values(F.currais).map(boundsCurral);

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
{
  const c=F.servico.cocho,foraCocho=Math.abs(F.polo.x-c.x)>c.largura/2+.25||Math.abs(F.polo.z-c.z)>c.profundidade/2+.25;
  const l=F.servico.limpeza,dentroServico=Math.abs(F.polo.x-l.x)<=l.meiaX&&Math.abs(F.polo.z-l.z)<=l.meiaZ;
  const b=F.servico.barril,foraBarril=Math.hypot(F.polo.x-b.x,F.polo.z-b.z)>b.raio+.45;
  const foraCurrais=Object.values(F.currais).every(q=>Math.abs(F.polo.x-q.cx)>q.w/2+.15||Math.abs(F.polo.z-q.cz)>q.d/2+.15);
  check('20 polo fica acessível no pátio de serviço',Math.abs(F.polo.x-F.cx)<F.meiaLarg-1&&Math.abs(F.polo.z-F.cz)<F.meiaProf-1&&foraCocho&&foraBarril&&foraCurrais&&dentroServico);
}

// 21–30 · regressões de código/física/interação
check('21 roça nasce só no campo configurado e recusa qualquer curral',
  wg.includes('const cultivo=FAZENDA_CONFIG.cultivo')&&
  wg.includes('const invadeCurral=')&&
  wg.includes('!invadeCurral(mx,z,comp/2,.51)'));
check('22 vão do celeiro não pode ser fundido pelo otimizador',
  wg.includes("marcarSemFusao(registrarObstaculo(paredeFrenteE,'celeiro'))")&&
  wg.includes("marcarSemFusao(registrarObstaculo(paredeFrenteD,'celeiro'))")&&
  wg.includes("marcarSemFusao(registrarObstaculo(vergaParede,'celeiro'))"));
check('23 AnimalPens usa os mesmos currais do FarmConfig',
  animalPens.includes('Object.values(FAZENDA_CONFIG.currais)')&&!animalPens.includes("cx:-85.5,cz:-55.2"));
check('24 campo de plantio não sobrepõe nenhum curral real',
  currais.every(c=>!sobrepoe(c,cultivoBox)));
check('25 fundação é superfície andável',wg.includes('superficiesAndaveis.push(baseCeleiro)'));
check('26 tecla E aciona portas da fazenda',economy.includes("ctx.tipo==='portasCeleiro'")&&economy.includes("alternarPortasCeleiro()"));
check('27 portas usam colisores segmentados por folha',wg.includes("criarSegmentosFolha(folha,'x',LARGURA_FOLHA,2.45,.12,'porta-celeiro')")&&wg.includes('atualizarColisoresFolhas(portasCeleiro.pivos)'));
check('28 porteira usa colisores segmentados por folha',wg.includes("criarSegmentosFolha(folha,'z',folhaLarg,ALTURA_PORTEIRA,.12,'porteira')")&&wg.includes('atualizarColisoresFolhas(porteiraFazenda.pivos)'));
check('29 materiais da fazenda são próprios',wg.includes('matParedeRural()')&&wg.includes('matTelhaBarroRural()')&&materials.includes('bumpMap:bumpTelhaRural()'));
check('30 terreno continua nivelado e campo fica dentro da cerca externa',
  terrain.includes('FAZENDA_CONFIG.nivelamentoCasa')&&terrain.includes('FAZENDA_CONFIG.nivelamentoPorteira')&&
  F.cultivo.minX>=F.cx-F.meiaLarg+2&&F.cultivo.maxX<=F.cx+F.meiaLarg-2&&
  F.cultivo.minZ>=F.cz-F.meiaProf+2&&F.cultivo.maxZ<=F.cz+F.meiaProf-2);

console.log(JSON.stringify({ok:true,total:resultados.length,checks:resultados},null,2));
