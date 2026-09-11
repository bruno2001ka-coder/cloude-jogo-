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
exigir(farm.includes('function buildPastureZone('),'fazendas perderam a zona de pasto/curral');
exigir(farm.includes("handle.pasto={"),'buildFarm não expõe o pasto para a lógica dos animais');
exigir(farm.includes('Cumeeira física/visual'),'telhado voltou ao helper antigo sem cumeeira fechada');
exigir(farm.includes('Empenas triangulares fecham frente e fundo'),'telhado perdeu fechamento das empenas');
exigir(farm.includes('skirtH=1.00'),'rodapé de pedra deixou de ter 1m');
exigir(farm.includes('color:0x9e3d1b'),'telha deixou a paleta terracota rural');
exigir(farm.includes('color:0x4a2e18'),'madeira deixou a paleta escura tratada');
exigir(world.includes("pasto:{...HANDLE_FAZENDA_BASE.pasto"),'fazenda-base não repassa a zona C aos animais');
exigir(world.includes("function pontoDoPasto"),'animais voltaram a usar coordenadas absolutas antigas');
for(const antigo of["['vaca',-84,-48]","['galinha',-79,-49]"])
  exigir(!world.includes(antigo),`spawn antigo de animal reapareceu: ${antigo}`);

exigir(physics.includes('export function removerCaixa('),'Physics não oferece remoção real de collider');
exigir(physics.includes('export function removerSuperficieAndavel('),'Physics não oferece remoção de superfície');

if(falhas.length){
  console.error('Regressões do gerador rural:');
  for(const f of falhas)console.error('- '+f);
  process.exit(1);
}
console.log('FarmGenerator: invariantes globais/limpeza/snap verificadas.');
