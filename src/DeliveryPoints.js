// ===== PONTOS DE ENTREGA NA FAVELA =====
// Os pontos são casas reais do cenário. Cada um tem um vão de porta visualmente aberto, uma zona
// circular de interação e um receptador humanoide completo, parado aguardando a encomenda.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{bairro,casasCliente}from'./WorldGenerator.js';
import{PLAYER_HEIGHT}from'./Player.js';

export const deliveryPoints=[];
const zonaMat=new THREE.MeshBasicMaterial({color:0x55d6a6,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
const aroMat=new THREE.MeshBasicMaterial({color:0x8fffd0,transparent:true,opacity:.75,side:THREE.DoubleSide});
const peleMat=new THREE.MeshStandardMaterial({color:0xc79067,roughness:.6});
const roupaMats=[0x7e3f56,0x315b69,0x6b713d,0x594477].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.8}));
const calcaMat=new THREE.MeshStandardMaterial({color:0x292b31,roughness:.85});
const cabeloMat=new THREE.MeshStandardMaterial({color:0x171712,roughness:.9});
const rostoMat=new THREE.MeshStandardMaterial({color:0x211a18,roughness:.8});
function mesh(geo,mat,parent,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
// ===== O CLIENTE =====
// A versão anterior tinha braço, perna e olho — mas ninguém via nenhum dos três. O tronco era uma
// CÁPSULA de raio 0,25 e os braços estavam a x=±0,16: ou seja, DENTRO do tronco. As pernas ficavam a
// ±0,11, também engolidas. Na tela sobrava um pinguim roxo com uma cabeça em cima, e foi por isso que
// o Bruno pediu "cria isso completo, braços, perna, o olho, tudo".
//
// A régua agora é a do morador (NPCs.js) e a do policial: caixas, na mesma proporção, com o braço
// FORA da silhueta do tronco (tronco 0,55 de largura, braço em ±0,37 — sobra 10 cm de ar de cada
// lado). É isso que faz um boneco ler como gente de longe num jogo low-poly: separação, não detalhe.
function criarReceptador(parent,indice){
  const g=new THREE.Group();parent.add(g);
  const roupa=roupaMats[indice%roupaMats.length];
  mesh(new THREE.BoxGeometry(.55,.82,.33),roupa,g,0,.87,0);
  // Cabeça, cabelo e ROSTO: dois olhos e a boca, virados pra frente (+z local), como no morador.
  mesh(new THREE.BoxGeometry(.37,.37,.35),peleMat,g,0,1.48,0);
  mesh(new THREE.BoxGeometry(.39,.1,.36),cabeloMat,g,0,1.7,0);
  for(const x of[-.07,.07])mesh(new THREE.BoxGeometry(.06,.06,.03),rostoMat,g,x,1.53,.175);
  mesh(new THREE.BoxGeometry(.13,.03,.02),rostoMat,g,0,1.4,.18);
  // Braços por FORA do tronco e pernas separadas: é o que faltava.
  for(const x of[-.37,.37])mesh(new THREE.BoxGeometry(.13,.58,.16),peleMat,g,x,.9,0);
  for(const x of[-.14,.14])mesh(new THREE.BoxGeometry(.13,.55,.16),calcaMat,g,x,.29,0);
  // Mesma altura dos outros bonecos do jogo: 1,75 m de modelo virando PLAYER_HEIGHT.
  g.scale.setScalar(PLAYER_HEIGHT/1.75);
  return g;
}
function criarZona(parent,raio){
  const zona=new THREE.Mesh(new THREE.CircleGeometry(raio,32),zonaMat);zona.rotation.x=-Math.PI/2;zona.position.y=.025;zona.renderOrder=1;parent.add(zona);
  const aro=new THREE.Mesh(new THREE.RingGeometry(raio-.06,raio,32),aroMat);aro.rotation.x=-Math.PI/2;aro.position.y=.04;aro.renderOrder=2;parent.add(aro);
}
// O ponto fica no CENTRO da casa, não na calçada: o jogador abre a porta, entra e entrega lá dentro.
// O raio encolheu de 2,15 pra caber no cômodo — 2,15 vazava pela parede e a entrega valia da rua.
function criarPonto(casa,indice){
  const x=casa.x,z=casa.z;
  // ALTURA DO CHÃO DE DENTRO, não a cota da soleira. A casca oca não tem piso: o interior é o próprio
  // morro, e o morro sobe. Usando `casa.y` (a soleira) o cliente nascia ENTERRADO na terra — a foto
  // mostrava só o anel da zona meio afundado no barro. O jogador anda no terreno lá dentro; o cliente
  // tem que pisar no mesmo lugar que ele.
  const chao=Math.max(casa.y,obterElevacao(x,z));
  const g=new THREE.Group();g.position.set(x,chao,z);bairro.add(g);
  // O raio nunca passa do interior útil da casa (`meiaLarg`/`meiaProf` já descontam parede e corpo).
  const raio=Math.max(1,Math.min(1.9,Math.min(casa.meiaLarg,casa.meiaProf)-.15));
  criarZona(g,raio);
  const npc=criarReceptador(g,indice);
  // No FUNDO do cômodo e virado pra porta: quem entra encara ele, e não esbarra nele no vão.
  const recuo=Math.max(.5,casa.meiaProf-.7);
  const nx=-Math.sin(casa.giro)*recuo,nz=-Math.cos(casa.giro)*recuo;
  // O terreno dentro da casa não é plano: o pé dele acompanha a cota do próprio ponto, senão um
  // canto mais alto o enterra até o joelho e o outro o deixa flutuando.
  npc.position.set(nx,Math.max(casa.y,obterElevacao(x+nx,z+nz))-chao+.02,nz);
  npc.rotation.y=casa.giro;
  const ponto={id:`casa-${indice+1}`,x,y:g.position.y,z,raio,deliveryZone:g,npc,casa,ativo:true};
  deliveryPoints.push(ponto);return ponto;
}
// ===== O CLIENTE MORA DENTRO DA CASA =====
// A escolha das casas não é mais feita aqui. Ela mora em Favela.js, junto com a escolha do refúgio,
// do bar e da biqueira — porque o papel do lote MUDA O QUE SE CONSTRÓI nele: a casa de cliente é uma
// casca oca com porta que abre, não uma casa maciça com alguém plantado na calçada.
//
// O que havia aqui era uma peneira sobre `refugios` (o comentário dizia "evita refúgios" e a linha
// PREFERIA refúgios), e os quatro clientes acabaram a 68 cm da porta de um esconderijo, com zona de
// raio 2,15 m — engolindo a porta. A causa raiz era `casasPos` não trazer `giro`: sem o giro não dá
// pra achar a FRENTE de uma casa girada, e `refugios` era a única lista que tinha esse campo.
for(const casa of casasCliente)criarPonto(casa,deliveryPoints.length);

export function pontoDeEntregaAtual(pos){return deliveryPoints.find(p=>p.ativo&&Math.hypot(pos.x-p.x,pos.z-p.z)<=p.raio&&Math.abs((pos.y??0)-p.y)<1.8)||null}
// `pertoDePontoDeEntrega` e `sinalizarEntregaIlegal` moravam aqui e ninguém nunca as chamou.
