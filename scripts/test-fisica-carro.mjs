import fs from 'node:fs';
const carro=fs.readFileSync(new URL('../src/Carro.js',import.meta.url),'utf8');
const veiculo=fs.readFileSync(new URL('../src/Veiculo.js',import.meta.url),'utf8');
const audio=fs.readFileSync(new URL('../src/Audio.js',import.meta.url),'utf8');
const checks=[
  ['teto de 120 km/h',/maxVel:33\.333/.test(carro)],
  ['aceleração progressiva por alvo',/const alvo=freioDeMao\?0:/.test(veiculo)&&/Math\.max\(\.15,Math\.abs\(acelerador\)\)/.test(veiculo)],
  ['freio antes da ré',/velocidade<0\?cfg\.freio/.test(veiculo)],
  ['ré limitada',/Math\.min\(cfg\.maxRe,maximo\*\.22\)/.test(veiculo)],
  ['freio de mão',/freioDeMao=cfg\.freioDeMao&&!!keys\.KeyH/.test(veiculo)&&/THREE\.MathUtils\.damp\(velocidade,0/.test(veiculo)],
  ['quatro sondas',/dianteira-esquerda/.test(veiculo)&&/dianteira-direita/.test(veiculo)&&/traseira-esquerda/.test(veiculo)&&/traseira-direita/.test(veiculo)&&/sondas:\(\)=>sondas\.map/.test(veiculo)],
  ['perda de velocidade na batida',/velocidade\*=Math\.max\(\.08,1-severidade\*\.92\)/.test(veiculo)],
  ['dano acumulado conservado',/dano=Math\.min\(cfg\.danoMaximo/.test(veiculo)&&/eficiencia=Math\.max\(\.35,1-dano/.test(veiculo)],
  ['som de colisão',/tocarSomColisaoCarro\(impacto,player\.position\)/.test(veiculo)&&/export function tocarSomColisaoCarro/.test(audio)],
];
const falhas=checks.filter(([,ok])=>!ok);
console.log(JSON.stringify({ok:!falhas.length,total:checks.length,checks:checks.map(([nome,ok])=>({nome,ok})),falhas:falhas.map(([nome])=>nome)},null,2));
if(falhas.length)process.exitCode=1;
