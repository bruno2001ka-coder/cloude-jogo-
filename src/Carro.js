// ===== O CARRO =====
// Mesma mecânica da moto (`Veiculo.js`), com a ficha de um carro. O que muda de verdade:
//   · é mais LARGO (0,95 contra 0,47) e mais COMPRIDO (1,97 contra 1,35), então o corpo de colisão
//     ganha mais discos e a caixa de veículo parado é maior;
//   · acelera menos e corre mais, freia melhor e vira MUITO mais aberto — moto pivota, carro não;
//   · quase não tomba na curva: 0,06 contra 0,22 da moto;
//   · e o motorista NÃO APARECE. Ele chegou a sentar dentro, com banco baixo e do lado do volante
//     pra a cabeça não atravessar o teto de 0,80 m — mas o Bruno pediu pra tirar: dentro de uma
//     lataria fechada quase não se vê o boneco, e o que sobra é uma cabeça no para-brisa.
import{criarVeiculo}from'./Veiculo.js';

const carro=criarVeiculo({
  nome:'carroJogador',
  arquivo:'assets/carro.glb',
  // A FRENTE APONTA PRA -X, medido nas duas fotos do visualizador: da câmera em +X aparece a
  // traseira e as lanternas; de -X aparece a grade e os faróis. Mesmo caso da moto, e -90° é o que
  // leva (-1,0,0) pra (0,0,-1), a frente do jogo.
  giroDoModelo:-Math.PI/2,
  // O arquivo já veio na escala do jogo: 1,97 x 0,80 x 0,95 (o Bruno baixou com 80 cm de altura,
  // que é o tamanho certo pra um personagem de 0,90 m). `comprimento` bate com o que já existe, então
  // a normalização do Veiculo.js não mexe em nada.
  comprimento:1.97,largura:.95,alturaColisao:.85,
  // Disco de 0,42: o carro tem 0,95 de largura, e o beco mais apertado do mapa tem 2,45 m livres.
  // 0,84 de corpo deixa 1,6 m de folga — passa, e sem fantasma dos lados.
  raioDisco:.42,
  maxVel:14,maxRe:4.5,aceleracao:9,aceleracaoRe:5,freio:20,atrito:4,
  // Esterço bem mais lento que o da moto (1,05 + 1,25): carro não pivota no lugar.
  esterco:.55,estercoPorVelocidade:.55,inclinacaoNaCurva:.06,
  entreEixos:.72,meiaBitola:.40,
  pesoNaFrente:.01,// carro assenta quase plano; o bico caído da moto aqui pareceria pneu murcho
  // ===== AS QUATRO RODAS NO CHÃO =====
  // Carro tem quatro rodas em retângulo, e é isso que estas duas bandeiras assumem:
  //  · `plantarAsQuatroRodas` desce o corpo até nenhuma delas sobrar no ar (ver `assentar`);
  //  · `rolagemDoTerrenoDireta` tira o amortecimento da rolagem que vem do CHÃO, deixando amortecida
  //    só a de curva.
  // A moto não recebe nenhuma das duas: ela tem duas rodas em linha (não há quatro folgas pra
  // plantar) e a rolagem dela é o piloto deitando, que PRECISA do atraso pra ler como peso.
  plantarAsQuatroRodas:true,
  // O modelo do carro traz os quatro pneus e as quatro calotas como ILHAS de geometria separadas
  // (medido: 8 ilhas nas quinas, simétricas), então dá pra recortá-las e girar. O número é QUANTAS
  // rodas procurar: a moto passa 2, e o `Rodas.js` muda o recorte por causa disso (num carro as rodas
  // ficam fora da linha central, numa moto ficam EM CIMA dela).
  rodasQueGiram:4,
  rolagemDoTerrenoDireta:true,
  alturaAssento:-.02,
  raioMontar:4,
  // Nasce do lado OPOSTO ao da moto (que nasce em +3): sem isso os dois apareceriam um dentro do
  // outro no primeiro quadro, e o colisor de um empurraria o outro.
  nascePerto:-4,
  passoPraDescer:1.5,// mais largo que a moto: sair de um carro exige limpar 0,95 m de lataria
  botaoId:'carroBtn',rotuloEntrar:'CARRO',rotuloSair:'SAIR',tecla:'KeyV',
  avisoCarregando:'O carro ainda está carregando.',
  avisoLonge:'Chegue perto do carro para entrar.',
  avisoMontar:'No carro — W acelera, S freia e A/D viram.',
  avisoDescer:'Você saiu do carro.',
  // Escondido: sem boneco, não há pose nem animação pra manter por quadro.
  motoristaVisivel:false,
});

export function carroMontado(){return carro.montado()}
export function alternarCarro(){carro.alternar()}
export function atualizarCarro(dt,keys,joyX=0,joyY=0,alavanca=0,re=false){return carro.atualizar(dt,keys,joyX,joyY,alavanca,re)}
// Teto em m/s, pra alavanca de acelerador saber até onde vai a escada de km/h.
export function maxVelCarro(){return carro.maxVel()}
// Onde ele está parado, pro radar (null enquanto não carregou, e null quando o jogador está
// montado nele — ver `marcaNoMapa` em Veiculo.js).
export function marcaCarro(){return carro.marcaNoMapa()}
