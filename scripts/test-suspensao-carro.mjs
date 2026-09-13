import fs from 'node:fs';
const carro=fs.readFileSync(new URL('../src/Carro.js',import.meta.url),'utf8');
const veiculo=fs.readFileSync(new URL('../src/Veiculo.js',import.meta.url),'utf8');
const rural=fs.readFileSync(new URL('../src/RuralWorld.js',import.meta.url),'utf8');
const checks=[
  ['curso contido de suspensão',/suspensaoCurso:\.09/.test(carro)],
  ['mola macia configurada',/suspensaoMola:13\.5/.test(carro)],
  ['amortecedor controla o retorno',/suspensaoAmortecedor:7\.2/.test(carro)&&/bombeando/.test(carro)],
  ['transferência de peso configurada',/transferenciaPeso:\.055/.test(carro)],
  ['estado individual das quatro molas',/compressaoSuspensao=\[0,0,0,0\]/.test(veiculo)],
  ['alvo por roda',/alvoSuspensao=\[0,0,0,0\]/.test(veiculo)],
  ['altura dianteira e traseira reguláveis',/alturaSuspensaoFrente:\.10,alturaSuspensaoTraseira:\.10/.test(carro)&&/regularAlturaCarro/.test(carro)&&/regularAltura/.test(veiculo)],
  ['carroceria usa referência baixa',/const menorApoio=Math\.min\(\.\.\._alt\)/.test(veiculo)&&/py=menorApoio/.test(veiculo)],
  ['cubo original preservado',/alturaNeutra=cen\.y/.test(fs.readFileSync(new URL('../src/Rodas.js',import.meta.url),'utf8'))&&/r\.alturaNeutra\+\(cfg\.alturaRoda\|\|0\)/.test(veiculo)],
  ['offset de rebaixamento relativo',/alturaRoda:-\.045/.test(carro)],
  ['contato roda-solo inclinado',/folgaRodaSolo:\.006/.test(carro)&&/subidaVertical/.test(veiculo)&&/erroContato/.test(veiculo)&&/alvoContato/.test(veiculo)],
  ['mola e amortecedor aplicados',/suspensaoMola.*suspensaoAmortecedor/.test(veiculo)],
  ['roda no ar entra em extensão',/-cursoSuspensao\*\.75/.test(veiculo)&&/alvoSuspensao\[i\]-mediaAlvo/.test(veiculo)],
  ['contato não teleporta a roda',/alvoContato=/.test(veiculo)&&/alvoFinal=/.test(veiculo)&&!/r\.suspensao\.position\.y\+=erroContato/.test(veiculo)],
  ['retorno monotônico sem overshoot',/Integração exponencial monotônica/.test(veiculo)&&/1-Math\.exp\(-resposta\*Math\.min\(dt,\.05\)\)/.test(veiculo)&&!/velSuspensao\[i\]\+=/.test(veiculo)],
  ['extensão não dispara raspagem',/Math\.max\(0,compressaoSuspensao\[i\]\)/.test(veiculo)],
  ['suspensão atualizada durante condução',/atualizarSuspensao\(dt,player\.rotation\.y,aceleracao,direcao\)/.test(veiculo)],
  ['raspagem limitada em lombadas',/raspagemSuspensao/.test(carro)&&/const fundo=/.test(veiculo)],
  ['chassi protegido em terreno torcido',/tetoAfundar:\.045/.test(carro)&&/cfg\.tetoAfundar\?\?TETO_AFUNDAR/.test(veiculo)],
  ['faíscas visuais habilitadas',/faiscas:true/.test(carro)&&/emitirFaiscas/.test(veiculo)],
  ['pista de teste grossa e única',/pista-teste-carro-malha-unica/.test(rural)&&/passo=\.62/.test(rural)&&/espessura=\.38/.test(rural)&&/geo\.computeVertexNormals/.test(rural)],
  ['topo alinhado à malha visível',/alturaDoChaoDesenhado\(x,z\)\+\.10\+perfil\(z\)/.test(rural)&&!/new THREE\.BoxGeometry\(\.08/.test(rural)],
  ['rampa quebra-molas e torção',/rampa\(-106,-98,\.82\)/.test(rural)&&/d<4/.test(rural)&&/z>-51&&z<-37/.test(rural)],
  ['carro enxerga a rampa sem ampliar o jogador',/alturaApoioExtra\|\|0/.test(veiculo)&&/alturaApoioExtra:\.75/.test(carro)],
  ['pista registrada como superfície andável',/superficiesAndaveis\.push\(m\)/.test(rural)],
  ['roda contida no para-lama',/escalaRoda:\.86/.test(carro)&&/recuoRoda:\.035/.test(carro)&&/separarRodas\(gltf\.scene,cfg\.rodasQueGiram,cfg\.escalaRoda\|\|1,cfg\.recuoRoda/.test(veiculo)],
  ['pivô central no pneu',/const cen=pneu\.cen\.clone\(\)/.test(fs.readFileSync(new URL('../src/Rodas.js',import.meta.url),'utf8'))&&/recortar\(geo,tris,cen\)/.test(fs.readFileSync(new URL('../src/Rodas.js',import.meta.url),'utf8'))],
];
const falhas=checks.filter(([,ok])=>!ok);
console.log(JSON.stringify({ok:!falhas.length,total:checks.length,checks:checks.map(([nome,ok])=>({nome,ok})),falhas:falhas.map(([nome])=>nome)},null,2));
if(falhas.length)process.exitCode=1;
