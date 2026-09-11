import assert from'node:assert/strict';
import{readFile,access}from'node:fs/promises';
import{FARM_PROTOTYPE,pointInPolygon,validateFarmPrototypeConfig}from'../src/FarmPrototypeConfig.js';

const read=path=>readFile(path,'utf8');
const [prototype,world,rural,physics,main,terrain]=await Promise.all([
  read('src/FarmPrototype.js'),read('src/WorldGenerator.js'),read('src/RuralWorld.js'),
  read('src/Physics.js'),read('src/main.js'),read('src/Terrain.js'),
]);

const config=validateFarmPrototypeConfig();
assert.equal(config.ok,true,config.errors.join('; '));
assert.ok(config.houseBarnDistance>=15,'Sede e galpao precisam de 15 m de separacao');
for(const animal of FARM_PROTOTYPE.animalSpawns)
  assert.ok(pointInPolygon(animal.x,animal.z,FARM_PROTOTYPE.pasture),`${animal.id} nasceu fora do pasto`);
const gateStart=FARM_PROTOTYPE.property[4],gateEnd=FARM_PROTOTYPE.property[5];
assert.equal(gateStart.x,FARM_PROTOTYPE.gate.x,'Inicio do vao nao coincide com a porteira');
assert.equal(gateEnd.x,FARM_PROTOTYPE.gate.x,'Fim do vao nao coincide com a porteira');
assert.ok(Math.abs(gateStart.z-(FARM_PROTOTYPE.gate.z-FARM_PROTOTYPE.gate.width/2))<1e-9,'Cerca invade um lado da porteira');
assert.ok(Math.abs(gateEnd.z-(FARM_PROTOTYPE.gate.z+FARM_PROTOTYPE.gate.width/2))<1e-9,'Cerca invade o outro lado da porteira');

assert.match(prototype,/scene\.getObjectByName\(ROOT_NAME\)/,'Montagem precisa bloquear ID duplicado');
assert.match(prototype,/removerCaixa\(box\)/,'Desmontagem precisa remover os colisores registrados');
assert.match(prototype,/removerSuperficieAndavel\(surface\)/,'Desmontagem precisa remover pisos antigos');
assert.match(prototype,/geometry\.dispose\(\)/,'Desmontagem precisa liberar geometrias');
assert.match(prototype,/material\.dispose\(\)/,'Desmontagem precisa liberar materiais exclusivos');
assert.doesNotMatch(prototype,/export function buildFarm\b/,'Nao criar gerador replicavel antes da aprovacao');
assert.match(prototype,/function requireLevelBuildingPad\(/,'Construcoes precisam validar o plato nivelado');
assert.ok(prototype.indexOf("requireLevelBuildingPad(cx+1.2,cz,w+5,d+3,'Sede'")<prototype.indexOf('wallX(cx+w/2'),
  'Plato da sede precisa existir antes das paredes');
assert.ok(prototype.indexOf("requireLevelBuildingPad(cx,cz,w+2.6,d+2.4,'Galpao'")<prototype.indexOf("'farm-prototype-barn-post'"),
  'Plato do galpao precisa existir antes dos pilares');
assert.doesNotMatch(prototype,/farm-prototype-level-pad/,'Nivelamento nao pode empilhar caixa sobre o terreno');
assert.match(prototype,/closedRoof\(cx,cz,w\+1\.2,d\+1\.2,floor\+3\.10,floor\+4\.72,M\.wall,\.18\)/,
  'Telhado da sede precisa seguir a espessura da arquitetura rural existente');
assert.match(prototype,/function gablePrismGeometry\(/,'Empenas precisam ser solidas, nao triangulos de uma face');
assert.match(prototype,/0,2,1, 3,4,5/,'Empenas precisam ter faces externas nos dois sentidos');
assert.equal((prototype.match(/createDoor[ZX]\(/g)||[]).length,5,
  'Sede precisa declarar dois construtores e criar suas tres portas moveis');
assert.match(prototype,/gate\.leafColliders\[0\]\.setFromObject\(gate\.left\)/,
  'Colisor esquerdo da porteira precisa acompanhar a folha');
assert.match(prototype,/gate\.leafColliders\[1\]\.setFromObject\(gate\.right\)/,
  'Colisor direito da porteira precisa acompanhar a folha');
assert.match(prototype,/if\(i!==4\)fenceSegment/,'Trecho visual da cerca precisa pular exatamente o vao da porteira');
assert.match(prototype,/gateWood:/,'Porteira precisa se distinguir visualmente da cerca');
assert.match(prototype,/-side\*diagonalAngle/,'Porteira sem travessas diagonais reais');
assert.match(prototype,/distance<10\?true:distance>14\?false/,'Porteira precisa abrir antes de o jogador chegar ao vao');
assert.match(terrain,/flattenPrototypeHeight\(h,x,z,PROTOTYPE_PADS\)/,'Terreno precisa aplicar os platos testados');

assert.match(world,/FARM_PROTOTYPE_MODE\?null:criarFazenda/,'Fazenda antiga deve nascer apenas fora do ensaio');
assert.match(rural,/FARM_PROTOTYPE_MODE\?\[\]:LEGACY_RURAL_ZONES/,'Tres fazendas antigas devem ficar fora do ensaio');
assert.match(main,/farmPrototype\.mountFarmPrototype\(\)/,'Main precisa montar exatamente o prototipo');
assert.equal((main.match(/mountFarmPrototype\(\)/g)||[]).length,1,'Prototipo montado mais de uma vez');

assert.match(physics,/categoriasObstaculo\.splice\(j,1\)/,'Fusao nao pode desalinha categorias');
assert.match(physics,/export function removerCaixa/,'Physics sem remocao real de Box3');
assert.match(physics,/caixasMoveis\.delete\(box\)/,'Remocao deixou colisor movel fantasma');

await assert.rejects(access('src/FarmGenerator.js'),'FarmGenerator antigo reapareceu');
for(const source of[prototype,world,rural,main])assert.doesNotMatch(source,/['"]\.\/FarmGenerator\.js['"]/,'Referencia ao gerador removido');

console.log(JSON.stringify({
  farm:FARM_PROTOTYPE.id,animalSpawns:FARM_PROTOTYPE.animalSpawns.length,
  houseBarnDistance:Number(config.houseBarnDistance.toFixed(2)),legacyGeneratorsDisabledInTest:true,
},null,2));
