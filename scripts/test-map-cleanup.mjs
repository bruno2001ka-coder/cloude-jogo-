import fs from'node:fs';

const favela=fs.readFileSync(new URL('../src/Favela.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const police=fs.readFileSync(new URL('../src/Police.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/UI.js',import.meta.url),'utf8');
const npcs=fs.readFileSync(new URL('../src/NPCs.js',import.meta.url),'utf8');
const economy=fs.readFileSync(new URL('../src/Economy.js',import.meta.url),'utf8');

const ok=(cond,msg)=>{if(!cond)throw new Error('[MAP CLEANUP] '+msg)};

ok(favela.includes("favela.name='favela-removida'"),'Favela.js não está no modo removido');
ok(favela.includes('export const lotes=[]')&&favela.includes('export const casasPos=[]')&&favela.includes('export const corredores=[]'),'listas da favela precisam permanecer vazias');
ok(!favela.includes('registrarObstaculo(')&&!favela.includes('registrarCaixa('),'Favela.js não pode registrar colisores');
ok(!favela.includes('scene.add('),'Favela.js não pode adicionar objetos à cena');
ok(!favela.includes('new THREE.Mesh('),'Favela.js não pode criar malhas visíveis');
ok(favela.includes('export const BAR={x:0,y:0,z:0,raio:0}')&&favela.includes('export const BIQUEIRA={x:0,y:0,z:0,raio:0}'),'bar/biqueira da favela devem permanecer desativados');

ok(!main.includes("from'./Favela.js'"),'main.js voltou a importar Favela.js');
ok(!main.includes('atualizarFavelaVisivel('),'main.js voltou a atualizar a favela por quadro');

ok(npcs.includes('if(waypointsVielas.length)for(let i=0;i<3;i++)'),'NPCs precisa proteger a criação quando não há becos');
ok(npcs.includes('if(!waypointsVielas.length){npc.alvo=null;npc.rota=[];return}'),'NPCs precisa tratar lista de waypoints vazia');

ok(police.includes('const HELICOPTERO_ATIVO=false;'),'helicóptero precisa permanecer desativado');
ok(!police.includes('scene.add(heli)'),'helicóptero voltou a ser adicionado à cena');
ok(!police.includes('new THREE.SpotLight('),'holofote do helicóptero voltou');
ok(!police.includes('scene.add(feixe)'),'cone de holofote voltou à cena');
ok(police.includes('if(HELICOPTERO_ATIVO)ESTADOS[policia.estado].aoAtualizar(dt,agora);'),'máquina aérea precisa ficar fora do frame quando helicóptero está desligado');

ok(!ui.includes("from'./Favela.js'"),'UI voltou a importar Favela.js diretamente');
ok(!ui.includes("'HELI'"),'radar voltou a desenhar marcador de helicóptero');

ok(economy.includes('Comprar Semente'),'semente ficou sem ponto de compra depois da remoção da biqueira');

console.log(JSON.stringify({ok:true,checks:18},null,2));
