import assert from'node:assert/strict';
import{readFile,access}from'node:fs/promises';
import{FARM_PROTOTYPE,pointInPolygon,validateFarmPrototypeConfig}from'../src/FarmPrototypeConfig.js';

const read=path=>readFile(path,'utf8');
const [prototype,world,rural,physics,main]=await Promise.all([
  read('src/FarmPrototype.js'),read('src/WorldGenerator.js'),read('src/RuralWorld.js'),
  read('src/Physics.js'),read('src/main.js'),
]);

const config=validateFarmPrototypeConfig();
assert.equal(config.ok,true,config.errors.join('; '));
assert.ok(config.houseBarnDistance>=15,'Sede e galpao precisam de 15 m de separacao');
for(const animal of FARM_PROTOTYPE.animalSpawns)
  assert.ok(pointInPolygon(animal.x,animal.z,FARM_PROTOTYPE.pasture),`${animal.id} nasceu fora do pasto`);

assert.match(prototype,/scene\.getObjectByName\(ROOT_NAME\)/,'Montagem precisa bloquear ID duplicado');
assert.match(prototype,/removerCaixa\(box\)/,'Desmontagem precisa remover os colisores registrados');
assert.match(prototype,/removerSuperficieAndavel\(surface\)/,'Desmontagem precisa remover pisos antigos');
assert.match(prototype,/geometry\.dispose\(\)/,'Desmontagem precisa liberar geometrias');
assert.match(prototype,/material\.dispose\(\)/,'Desmontagem precisa liberar materiais exclusivos');
assert.doesNotMatch(prototype,/export function buildFarm\b/,'Nao criar gerador replicavel antes da aprovacao');

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
