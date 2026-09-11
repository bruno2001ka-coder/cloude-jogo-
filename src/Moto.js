// ===== A MOTO =====
// A mecânica toda — física, colisão por discos, assentamento no terreno, colisor de veículo parado,
// montar e descer — mora no `Veiculo.js`. Aqui fica só o que é DA MOTO: o tamanho dela, a força, o
// esterço, e a pose do piloto. Foi assim que o carro entrou sem duplicar duzentas linhas, e é o que
// garante que um conserto de veículo vale pros dois.
import{criarVeiculo}from'./Veiculo.js';
import{definirPoseVeiculo,ALTURA_SELIM,personagemCarregado,atualizarAnimacaoPersonagem}from'./Personagem.js';

// Quanto o piloto senta atrás do centro da moto, em metros. Sai do perfil do `moto.glb` LIMITADO
// PELO BRAÇO: o boneco tem 24,9 cm de braço (13,1 do ombro ao cotovelo + 11,8 até a mão, medidos no
// rig), e o guidão está a 0,065 à frente do centro. Medindo o vão do ombro até a barra por recuo:
//     0,12 -> 0,198   0,16 -> 0,236   0,20 -> 0,274   0,28 -> 0,352
// ou seja 0,16 é o limite: em 0,20 ele já não alcança, e a busca só devolveria braço esticado no
// vazio. É pouco pra um selim que vai até 0,52 porque este boneco tem 0,90 m e a moto tem 1,35 —
// ele é curto pra ela.
const RECUO_SELIM=.16;

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
  // XT660: antes estava limitada a 11 m/s (~40 km/h), lenta demais para uma trail 660 no mapa.
  // Sobe para 16 m/s (~58 km/h) com mais retomada, sem exagerar a ponto de quebrar as curvas/colisao do mapa.
  maxVel:16,maxRe:4.2,aceleracao:18,aceleracaoRe:7.5,freio:25,atrito:5.2,
  esterco:1.05,estercoPorVelocidade:1.25,inclinacaoNaCurva:.22,
  // Amostragem do chão: metade da distância entre as rodas, e metade da largura.
  // O 0,47 é MEDIDO no modelo novo: os centros das duas rodas estão em x -0,454 e +0,483, ou seja
  // 0,937 de distância. (Era 0,58, do modelo antigo — com a moto nova ela assentaria torta.)
  entreEixos:.47,meiaBitola:.24,
  // ===== AS DUAS RODAS GIRAM, E A DA FRENTE ESTERÇA =====
  // A moto ANTIGA não podia: a roda dela era um corpo só com o quadro, e eu cheguei a dizer que só
  // trocando o modelo. Esta troca é exatamente isso. Medido no arquivo novo: 322 ilhas de geometria,
  // com as duas rodas saindo limpas como discos finos —
  //     frente  centro x -0,454  0,448 x 0,439 x 0,064  (raio 0,220)
  //     trás    centro x +0,483  0,389 x 0,387 x 0,059  (raio 0,194)
  // Roda da frente maior que a de trás, como manda uma trail bike.
  rodasQueGiram:2,
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
  // Selim alto, piloto no meio da largura e RECUADO: o selim desta moto fica atrás do centro, e sem
  // o recuo o piloto sentava em cima do guidão (ombro a 5 mm da manopla) — ver `definirPoseVeiculo`.
  aoMontar(){definirPoseVeiculo(true,ALTURA_SELIM,0,RECUO_SELIM)},
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
// Onde ele está parado, pro radar (null enquanto não carregou, e null quando o jogador está
// montado nele — ver `marcaNoMapa` em Veiculo.js).
export function marcaMoto(){return moto.marcaNoMapa()}
