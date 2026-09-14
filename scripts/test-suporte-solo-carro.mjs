import fs from 'node:fs';
const terrain=fs.readFileSync(new URL('../src/Terrain.js',import.meta.url),'utf8');
const veiculo=fs.readFileSync(new URL('../src/Veiculo.js',import.meta.url),'utf8');
const carro=fs.readFileSync(new URL('../src/Carro.js',import.meta.url),'utf8');
const checks=[
  ['API de suporte visual exportada',/export function alturaDeSuporteVeiculo\(x,z\)/.test(terrain)&&/alturaDoChaoDesenhado\(x,z\)/.test(terrain)],
  ['suporte replica os dois triângulos da malha',/u\+v<=1/.test(terrain)&&/hc\+\(1-u\)\*\(hb-hc\)/.test(terrain)],
  ['carro combina malha visual e quina levantada',/Math\.max\(alturaDeSuporteVeiculo\(x,z\),levanteContraQuina/.test(veiculo)],
  ['contato não usa raio vertical fixo',/raioVertical=r\.raio\*Math\.sqrt/.test(veiculo)&&/apoioAtual\+raioVertical/.test(veiculo)],
  ['folga de contato calibrada',/folgaRodaSolo:\.008/.test(carro)],
  ['correção permanece na mola',/alvoContato/.test(veiculo)&&/compressaoSuspensao\[i\]/.test(veiculo)&&!/position\.y\+=erroContato/.test(veiculo)],
];
const falhas=checks.filter(([,ok])=>!ok);
console.log(JSON.stringify({ok:!falhas.length,total:checks.length,checks:checks.map(([nome,ok])=>({nome,ok})),falhas:falhas.map(([nome])=>nome)},null,2));
if(falhas.length)process.exitCode=1;
