import { readFile } from 'node:fs/promises';

const [world,rural,farm,physics]=await Promise.all([
  readFile('src/WorldGenerator.js','utf8'),
  readFile('src/RuralWorld.js','utf8'),
  readFile('src/FarmGenerator.js','utf8'),
  readFile('src/Physics.js','utf8'),
]);

const falhas=[];
const exigir=(ok,msg)=>{if(!ok)falhas.push(msg)};

exigir(!world.includes('function criarFazenda('),'WorldGenerator voltou a declarar o gerador antigo de fazenda');
exigir(!world.includes('criarFazenda(-86,-50)'),'fazenda-base voltou a instanciar arquitetura antiga');
exigir(world.includes("buildFarm(DEF_FAZENDA_BASE.x,DEF_FAZENDA_BASE.z"),'fazenda-base não usa buildFarm global');

exigir(rural.includes('RURAL_ZONES.forEach(montarFazenda)'),'RuralWorld não itera todas as fazendas rurais');
exigir(rural.includes('buildFarm(zona.x,zona.z'),'RuralWorld não usa buildFarm em cada zona');
for(const morto of['casaRural(','galpao(','cercaArame(','porteiraAutomatica('])
  exigir(!rural.includes(morto),`RuralWorld ainda chama gerador antigo: ${morto}`);

exigir(farm.includes('export function buildFarm('),'FarmGenerator não exporta buildFarm');
exigir(farm.includes('destroyFarm(id);'),'buildFarm não limpa instância anterior antes de reconstruir');
exigir(farm.includes('export function destroyFarm('),'FarmGenerator não exporta destroyFarm');
exigir(farm.includes('removerCaixa(b)'),'destroyFarm não remove Box3 antigos');
exigir(farm.includes('disposeTree(h.group,h.ownedMaterials)'),'destroyFarm não descarta geometrias/materiais');
exigir(farm.includes('ground(p.x,p.z)'),'objetos rurais deixaram de consultar o terreno');

exigir(physics.includes('export function removerCaixa('),'Physics não oferece remoção real de collider');
exigir(physics.includes('export function removerSuperficieAndavel('),'Physics não oferece remoção de superfície');

if(falhas.length){
  console.error('Regressões do gerador rural:');
  for(const f of falhas)console.error('- '+f);
  process.exit(1);
}
console.log('FarmGenerator: invariantes globais/limpeza/snap verificadas.');
