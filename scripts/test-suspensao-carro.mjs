import fs from 'node:fs';
const carro=fs.readFileSync(new URL('../src/Carro.js',import.meta.url),'utf8');
const veiculo=fs.readFileSync(new URL('../src/Veiculo.js',import.meta.url),'utf8');
const checks=[
  ['curso de suspensão configurado',/suspensaoCurso:\.14/.test(carro)],
  ['mola macia configurada',/suspensaoMola:11/.test(carro)],
  ['amortecedor macio configurado',/suspensaoAmortecedor:2\.1/.test(carro)],
  ['transferência de peso configurada',/transferenciaPeso:\.055/.test(carro)],
  ['estado individual das quatro molas',/compressaoSuspensao=\[0,0,0,0\]/.test(veiculo)],
  ['alvo por roda',/alvoSuspensao=\[0,0,0,0\]/.test(veiculo)],
  ['mola e amortecedor aplicados',/suspensaoMola.*suspensaoAmortecedor/.test(veiculo)],
  ['suspensão atualizada durante condução',/atualizarSuspensao\(dt,player\.rotation\.y,aceleracao,direcao\)/.test(veiculo)],
  ['raspagem limitada em lombadas',/raspagemSuspensao/.test(carro)&&/const fundo=/.test(veiculo)],
];
const falhas=checks.filter(([,ok])=>!ok);
console.log(JSON.stringify({ok:!falhas.length,total:checks.length,checks:checks.map(([nome,ok])=>({nome,ok})),falhas:falhas.map(([nome])=>nome)},null,2));
if(falhas.length)process.exitCode=1;
