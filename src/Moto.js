// ===== A MOTO =====
// A mecânica toda — física, colisão por discos, assentamento no terreno, colisor de veículo parado,
// montar e descer — mora no `Veiculo.js`. Aqui fica só o que é DA MOTO: o tamanho dela, a força, o
// esterço, e a pose do piloto. Foi assim que o carro entrou sem duplicar duzentas linhas, e é o que
// garante que um conserto de veículo vale pros dois.
import{criarVeiculo}from'./Veiculo.js';
import{definirPoseVeiculo,ALTURA_SELIM,personagemCarregado,atualizarAnimacaoPersonagem}from'./Personagem.js';

const moto=criarVeiculo({
  nome:'motoJogador',
  arquivo:'assets/moto.glb',
  // ===== DE QUE LADO É A FRENTE, MEDIDO NO ARQUIVO =====
  // O comentário original dizia "a frente aponta para +X" e girava +90°. Estava errado, e a moto
  // andava DE RABO — só apareceu quando o Bruno fotografou. Medido nos vértices por dois caminhos:
  // os 10% mais altos da malha (o guidão, que é o ponto mais alto e fica na frente) têm X médio
  // -0,216 contra centro em +0,003; e a altura máxima da metade -X é 1,100 contra 0,875 da metade
  // +X. A frente aponta pra -X, e -90° leva (-1,0,0) pra (0,0,-1), que é a frente do jogo.
  giroDoModelo:-Math.PI/2,
  comprimento:1.35,largura:.47,alturaColisao:.80,raioDisco:.30,
  // Dinâmica arcade previsível. Os limites da ré são separados pra ela não disparar como marcha à
  // frente: 3,8 contra 11.
  maxVel:11,maxRe:3.8,aceleracao:14,aceleracaoRe:7,freio:24,atrito:5.5,
  esterco:1.05,estercoPorVelocidade:1.25,inclinacaoNaCurva:.22,
  // Amostragem do chão: metade da distância entre as rodas, e metade da largura.
  entreEixos:.58,meiaBitola:.24,
  // O bico pesa e desce um tico, como moto parada de verdade.
  pesoNaFrente:.05,
  // NEGATIVO de propósito: afunda 2 cm. `obterElevacao` é a curva analítica, mas o chão DESENHADO é
  // uma malha de quadrados de 1,55 m que interpola reto entre os vértices — entre eles a superfície
  // visível fica ABAIXO da curva em terreno convexo. Assentar exatamente na curva deixava 4,8 cm de
  // folga mediana. Afundar um tico some com a folga; flutuar aparece na hora.
  alturaAssento:-.02,
  raioMontar:4,nascePerto:3,passoPraDescer:1.35,
  botaoId:'motoBtn',rotuloEntrar:'MOTO',rotuloSair:'DESCER',tecla:'KeyM',
  avisoCarregando:'A moto ainda está carregando.',
  avisoLonge:'Chegue perto da moto para montar.',
  avisoMontar:'Moto montada — W acelera, S freia e A/D viram.',
  avisoDescer:'Você desceu da moto.',
  aoMontar(){definirPoseVeiculo(true,ALTURA_SELIM)},// selim alto, piloto no meio
  aoDescer(){definirPoseVeiculo(false)},
  // A animação PRECISA ser chamada aqui: quem chamava era `atualizarMovimentoJogador`, e o main pula
  // ela justamente quando se está na moto. Sem isto a pose de piloto nunca seria aplicada — o mixer
  // reescreve os ossos todo quadro, então a pose tem que ser reposta todo quadro.
  aoQuadro(dt){if(personagemCarregado())atualizarAnimacaoPersonagem(dt,0,false,false)},
});

export function motoMontada(){return moto.montado()}
export function alternarMoto(){moto.alternar()}
export function atualizarMoto(dt,keys,joyX=0,joyY=0,alavanca=0,re=false){return moto.atualizar(dt,keys,joyX,joyY,alavanca,re)}
// Teto em m/s, pra alavanca de acelerador saber até onde vai a escada de km/h.
export function maxVelMoto(){return moto.maxVel()}
