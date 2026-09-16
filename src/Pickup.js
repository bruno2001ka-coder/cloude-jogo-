// ===== A RAM PICKUP =====
// Terceiro veículo: mantém carro e moto e usa a mesma física compartilhada de Veiculo.js.
import{criarVeiculo}from'./Veiculo.js';

const pickup=criarVeiculo({
  nome:'pickupRamJogador',
  arquivo:'assets/ram-pickup.glb',
  giroDoModelo:-Math.PI/2,
  // Pickup maior e mais alta que o carro, com quatro rodas independentes.
  comprimento:2.45,largura:1.10,alturaColisao:1.18,raioDisco:.50,
  maxVel:26,maxRe:4.2,aceleracao:9,aceleracaoRe:4.5,freio:25,atrito:4.2,
  aderenciaPneu:1.02,aderenciaLongitudinal:.98,resistenciaRolamento:.28,
  limiteDeslizamento:.78,freioDeMaoAderenciaTraseira:.20,distribuicaoFreio:.58,
  esterco:.48,estercoPorVelocidade:.48,inclinacaoNaCurva:.045,
  entreEixos:.92,meiaBitola:.47,pesoNaFrente:.015,
  plantarAsQuatroRodas:true,rolagemDoTerrenoDireta:true,
  rodasQueGiram:4,escalaRoda:.88,recuoRoda:.04,
  // Suspensão de pickup: curso maior e retorno firme, sem comportamento de carro rebaixado.
  suspensaoCurso:.14,suspensaoMola:16,suspensaoAmortecedor:8.5,
  alturaRoda:-.015,alturaSuspensaoFrente:.08,alturaSuspensaoTraseira:.10,
  folgaRodaSolo:.008,transferenciaPeso:.045,raspagemSuspensao:.018,tetoAfundar:.055,
  alturaApoioExtra:.75,faiscas:true,alturaAssento:0,
  raioMontar:4.5,nascePerto:-7,passoPraDescer:1.7,
  botaoId:'pickupBtn',rotuloEntrar:'RAM',rotuloSair:'SAIR',tecla:'KeyB',
  avisoCarregando:'A RAM ainda está carregando.',
  avisoLonge:'Chegue perto da RAM para entrar.',
  avisoMontar:'Na RAM — W acelera, S freia, H freio de mão e A/D viram.',
  avisoDescer:'Você saiu da RAM.',
  motoristaVisivel:false,freioDeMao:true,danoMaximo:130,resistenciaImpacto:1.7,somColisao:true,
});

export function pickupMontada(){return pickup.montado()}
export function alternarPickup(){pickup.alternar()}
export function atualizarPickup(dt,keys,joyX=0,joyY=0,alavanca=0,re=false){return pickup.atualizar(dt,keys,joyX,joyY,alavanca,re)}
export function maxVelPickup(){return pickup.maxVel()}
export function marcaPickup(){return pickup.marcaNoMapa()}
