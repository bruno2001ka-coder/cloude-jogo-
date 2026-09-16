// ===== A RAM PICKUP =====
// Terceiro veículo: mantém carro e moto e usa a mesma física compartilhada de Veiculo.js.
import{criarVeiculo}from'./Veiculo.js';

const pickup=criarVeiculo({
  nome:'pickupRamJogador',
  arquivo:'assets/ram-pickup.glb',
  // O GLB foi medido longitudinal no eixo Z; não aplicar o giro de 90° usado pelo carro antigo,
  // pois isso coloca a pickup atravessada em relação ao rumo do veículo.
  giroDoModelo:0,
  // Medição do GLB: eixo longitudinal Z=1,00, largura X=.41 e altura Y=.36 antes da
  // normalização. Com comprimento final 2,45 m, a largura física coerente fica em 1,01 m
  // e a altura da carroceria em aproximadamente .88 m.
  comprimento:2.45,largura:1.01,alturaColisao:.93,raioDisco:.43,
  maxVel:26,maxRe:4.2,aceleracao:9,aceleracaoRe:4.5,freio:25,atrito:4.2,
  aderenciaPneu:1.02,aderenciaLongitudinal:.98,resistenciaRolamento:.28,
  limiteDeslizamento:.78,freioDeMaoAderenciaTraseira:.20,distribuicaoFreio:.58,
  esterco:.48,estercoPorVelocidade:.48,inclinacaoNaCurva:.045,
  entreEixos:.92,meiaBitola:.43,pesoNaFrente:.015,
  plantarAsQuatroRodas:true,rolagemDoTerrenoDireta:true,
  rodasQueGiram:4,escalaRoda:.88,recuoRoda:.04,
  // Carro rebaixado: roda presa ao cubo, curso curto e amortecimento firme; não é suspensão
  // flutuante. A diferença entre os eixos é mínima para não inclinar a carroceria artificialmente.
  suspensaoCurso:.045,suspensaoMola:18,suspensaoAmortecedor:9.5,
  alturaRoda:-.035,alturaSuspensaoFrente:.03,alturaSuspensaoTraseira:.03,
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
