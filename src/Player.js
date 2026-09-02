// Personagem principal: malha, hitbox cinemática, gravidade/salto e resolução de movimento com colisão.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{obstaculos,superficiesAndaveis,caixaColideComObstaculos,buscarPosicaoLivre}from'./Physics.js';
import{criarSombraContato,coleteMat,coleteFaixaMat,mochilaMat,mochilaFaixaMat}from'./Materials.js';
import{carregarPersonagem,atualizarAnimacaoPersonagem,personagemCarregado,ossoDaMao,ossoDoTronco,medidasTronco,esconderBonecoAntigo,carregarColete,coleteVestido,pendurarMochila,AJUSTE}from'./Personagem.js';

export const EYE_HEIGHT=0.8;
export const PLAYER_HEIGHT=0.9;
export const PLAYER_SCALE=PLAYER_HEIGHT/3.31;

export const player=new THREE.Group();
const skin=new THREE.MeshStandardMaterial({color:0xc79067,roughness:.55}),shirt=new THREE.MeshStandardMaterial({color:0x202b27,roughness:.75}),pants=new THREE.MeshStandardMaterial({color:0x495744,roughness:.85});
const body=new THREE.Mesh(new THREE.BoxGeometry(1.05,1.55,.62),shirt);body.position.y=1.65;body.castShadow=true;body.receiveShadow=true;player.add(body);const head=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.66),skin);head.position.y=2.8;head.castShadow=true;head.receiveShadow=true;player.add(head);const faceMat=new THREE.MeshStandardMaterial({color:0x171712,roughness:.8,flatShading:true});for(const x of [-.13,.13]){const eye=new THREE.Mesh(new THREE.BoxGeometry(.11,.12,.045),faceMat);eye.position.set(x,2.88,.345);eye.castShadow=true;eye.receiveShadow=true;player.add(eye)}const mouth=new THREE.Mesh(new THREE.BoxGeometry(.24,.055,.04),faceMat);mouth.position.set(0,2.68,.348);mouth.castShadow=true;mouth.receiveShadow=true;player.add(mouth);const hair=new THREE.Mesh(new THREE.BoxGeometry(.74,.18,.69),new THREE.MeshStandardMaterial({color:0x171712,roughness:.8,flatShading:true}));hair.position.y=3.22;hair.castShadow=true;hair.receiveShadow=true;player.add(hair);const legs=[],arms=[];for(const x of [-.27,.27]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.25,1.05,.3),pants);leg.position.set(x,.55,0);leg.castShadow=true;leg.receiveShadow=true;player.add(leg);legs.push(leg)}for(const x of [-.7,.7]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.25,1.1,.3),skin);arm.position.set(x,1.72,0);arm.castShadow=true;arm.receiveShadow=true;player.add(arm);arms.push(arm)}// Snapshot ANTES da sombra de contato: neste ponto os filhos do player são exatamente as caixas do
// boneco. A sombra entra logo depois e precisa continuar visível mesmo quando o modelo 3D substituir
// o corpo — por isso a lista é tirada aqui, e não filtrando os filhos mais tarde.
const bonecoCaixas=player.children.filter(o=>o.isMesh);
criarSombraContato(.85,player);player.scale.setScalar(PLAYER_SCALE);player.position.set(0,obterElevacao(0,8),8);scene.add(player);

// ===== COLETE À PROVA DE BALAS (só visual) =====
// Grupo próprio em vez de meshes soltas no player: a visibilidade liga/desliga num único .visible, e o
// colete nunca se mistura com os membros animados (legs/arms) nem com a mão que segura a arma.
// É PURAMENTE cosmético — não entra em ZONAS_JOGADOR nem na hitbox, que continuam derivadas das medidas
// do corpo; o dano/armadura é contabilizado pelo combate, que só chama definirColeteVisivel().
// Medidas em unidades CRUAS (antes do PLAYER_SCALE), como o resto do boneco: um bloco 1.10x.95x.70
// (o corpo é 1.05x1.55x.62) centrado em y=1.95, ou seja, colado por FORA do tronco e terminando exatamente
// na linha dos ombros (topo do corpo = 2.425) — sobra a barriga à mostra, que é como colete tático parece.
const colete=new THREE.Group();colete.visible=false;
{
  const placa=new THREE.Mesh(new THREE.BoxGeometry(1.10,.95,.70),coleteMat);placa.position.y=1.95;colete.add(placa);
  // Ombreiras: dois blocos atravessando o ombro. Puro sinal de leitura à distância — com a câmera no
  // ombro o tronco escuro sobre camisa escura quase não muda de silhueta sem elas.
  for(const x of [-.33,.33]){const om=new THREE.Mesh(new THREE.BoxGeometry(.24,.14,.76),coleteFaixaMat);om.position.set(x,2.44,0);colete.add(om)}
  // Faixa frontal clara na altura do peito, levemente à frente da placa pra não brigar por z-fighting.
  const faixa=new THREE.Mesh(new THREE.BoxGeometry(1.12,.13,.02),coleteFaixaMat);faixa.position.set(0,1.72,.36);colete.add(faixa);
  for(const m of colete.children){m.castShadow=true;m.receiveShadow=true}
}
player.add(colete);
// ===== O MODELO 3D SÓ BAIXA QUANDO FOR APARECER =====
// `carregarColete` e `pendurarMochila` eram chamados AQUI, no topo do módulo, incondicionalmente.
// Medido pela auditoria: 1,79 MB de download e 35 MB de VRAM (a mochila sozinha traz uma textura
// 2048x2048 = 22,4 MB, mais que o bairro inteiro) — para dois objetos que nascem `visible=false` e
// que a maioria das partidas nunca mostra. No celular isso é memória de vídeo e tempo de carregamento
// pagos adiantado por nada.
// Agora o download acontece na primeira vez que a peça é LIGADA. As caixas simples continuam sendo
// o que aparece até o modelo chegar, exatamente como antes.
let coletePedido=false;
function garantirColete(){if(coletePedido)return;coletePedido=true;carregarColete(colete)}
// API mínima pro combate/save: quem decide se o jogador ESTÁ com colete é a economia (inventario.colete),
// não este módulo — daí só expormos o liga/desliga em vez de ler estado de fora.
export function definirColeteVisivel(v){if(v)garantirColete();colete.visible=!!v}
export function coleteEstaVisivel(){return colete.visible}

// ===== MOCHILA DOS PACOTES =====
// É o FLAGRANTE do jogo: enquanto houver pacote no inventário a mochila aparece nas costas, e é vendo
// ela que a polícia decide abordar (Police.js). Sem carga, ela some e o jogador volta a ser um
// morador qualquer. Mesma técnica do colete — grupo próprio, nasce escondido, o jogo só alterna
// `.visible` e nunca constrói malha em pleno jogo.
// Medidas em unidades CRUAS, como o resto do boneco (o corpo é 1.05 x 1.55 x .62).
const mochila=new THREE.Group();mochila.visible=false;
{
  const corpoM=new THREE.Mesh(new THREE.BoxGeometry(.82,.92,.42),mochilaMat);corpoM.position.set(0,1.95,-.48);mochila.add(corpoM);
  // Bolso da frente e alça horizontal: sem eles a mochila lê como um caixote colado nas costas.
  const bolso=new THREE.Mesh(new THREE.BoxGeometry(.56,.40,.14),mochilaFaixaMat);bolso.position.set(0,1.78,-.72);mochila.add(bolso);
  const alcaH=new THREE.Mesh(new THREE.BoxGeometry(.84,.10,.06),mochilaFaixaMat);alcaH.position.set(0,2.18,-.70);mochila.add(alcaH);
  // Alças por cima dos ombros, indo do topo da mochila até o peito.
  for(const x of[-.30,.30]){
    const alca=new THREE.Mesh(new THREE.BoxGeometry(.12,.86,.10),mochilaFaixaMat);
    alca.position.set(x,2.16,-.12);alca.rotation.x=-.22;mochila.add(alca);
  }
  for(const m of mochila.children){m.castShadow=true;m.receiveShadow=true}
}
player.add(mochila);
// Pendura no osso do tronco quando o boneco 3D chega, pra ela acompanhar a animação em vez de ficar
// rígida. Se o modelo não carregar, ela fica onde está e o jogador vê a mochila simples.
let mochilaPedida=false;
function garantirMochila(){if(mochilaPedida)return;mochilaPedida=true;pendurarMochila(mochila)}
export function definirMochilaVisivel(v){if(v)garantirMochila();mochila.visible=!!v}

// ===== MÃO QUE SEGURA A ARMA =====
// As armas (Weapons.js) são penduradas aqui pra acompanharem a animação de caminhada sem código
// extra. O catálogo mora lá e não aqui pra este módulo não depender de economia/combate.
// Era o próprio braço-caixa. Virou um Group vazio pendurado nele pra poder MUDAR DE PAI quando o
// modelo 3D chega: aí a âncora passa pro osso da mão direita e a arma acompanha a animação de verdade.
// Como o Group nasce na origem do braço, a arma fica exatamente onde estava — o Weapons.js não muda.
export const maoDireita=new THREE.Group();
// O deslocamento até a pegada mora AQUI (e não no Weapons) porque depende de em que pai a âncora está:
// no braço-caixa é este offset; no osso da mão do modelo 3D é zero, que é o próprio punho.
maoDireita.position.set(0,-.52,.16);
arms[1].add(maoDireita);

// ===== TROCA PELO MODELO 3D =====
// Assíncrono de propósito (ver Personagem.js): o jogo roda com o boneco de caixas até o GLB chegar.
let atirandoAgora=false;
export function definirAnimacaoTiro(v){atirandoAgora=!!v}
carregarPersonagem(player,PLAYER_HEIGHT,()=>{
  // A ordem importa: primeiro a arma sai do braço-caixa e vai pro osso da mão, DEPOIS as caixas somem.
  // Ao contrário, esconder o braço levaria a arma junto (ela é filha dele).
  const osso=ossoDaMao();
  if(osso){
    osso.add(maoDireita);
    // As armas foram modeladas nas unidades do boneco de caixas. O osso vem com a escala do GLB, então
    // sem compensar aqui a arma entraria na mão com o tamanho errado.
    const eOsso=new THREE.Vector3(),ePlayer=new THREE.Vector3();
    osso.getWorldScale(eOsso);player.getWorldScale(ePlayer);
    if(eOsso.x>0)maoDireita.scale.setScalar(ePlayer.x/eOsso.x);
    maoDireita.position.set(0,0,0);
    // ORIENTAÇÃO: o osso do punho tem eixos próprios do rig, girados em relação ao corpo. Herdar a
    // rotação dele crua deixava a arma apontando pro lado em vez de pra frente. A âncora é alinhada
    // aos eixos do PERSONAGEM na pose de repouso — que é exatamente como a arma ficava pendurada no
    // braço-caixa. Daí em diante ela acompanha a animação da mão normalmente, porque segue filha do osso.
    const qOsso=new THREE.Quaternion(),qPlayer=new THREE.Quaternion();
    osso.getWorldQuaternion(qOsso);player.getWorldQuaternion(qPlayer);
    maoDireita.quaternion.copy(qOsso.invert().multiply(qPlayer));
    // Retoque fino do programador (ver AJUSTE em Personagem.js). Padrão: zero em tudo.
    maoDireita.rotateX(AJUSTE.arma.giroX);maoDireita.rotateY(AJUSTE.arma.giroY);maoDireita.rotateZ(AJUSTE.arma.giroZ);
    // O deslocamento é dado em METROS DE JOGO; a âncora vive no espaço do osso, daí a conversão.
    if(eOsso.x>0)maoDireita.position.set(AJUSTE.arma.x/eOsso.x,AJUSTE.arma.y/eOsso.x,AJUSTE.arma.z/eOsso.x);
  }
  ajustarColeteAoCorpo();
  esconderBonecoAntigo(bonecoCaixas);
});

// O colete foi desenhado por cima do boneco de CAIXAS (tronco de 1,05 de largura). No corpo humano,
// bem mais estreito, ele virava um caixote preto cobrindo tronco e braços. Aqui ele é refeito nas
// medidas do tronco de verdade e pendurado no osso do peito, pra acompanhar a animação em vez de ficar
// rígido enquanto o corpo se inclina.
function ajustarColeteAoCorpo(){
  // Com o colete 3D vestido, quem dimensiona é o Personagem — refazer as caixas aqui apagaria o modelo.
  if(coleteVestido())return;
  const osso=ossoDoTronco(),m=medidasTronco();
  if(!osso||!m)return;
  const escalaOsso=new THREE.Vector3();osso.getWorldScale(escalaOsso);
  if(!(escalaOsso.x>0))return;
  // Do mundo pro espaço do osso: é nele que a geometria nova precisa estar.
  const k=1/escalaOsso.x;
  // A largura NÃO vem da medida em X: naquela faixa de altura os braços entram na conta e o colete
  // saía transbordando os ombros. A profundidade do tronco é livre de braços, e peito humano tem por
  // volta de 1,5x a espessura em largura — daí ela ser a referência.
  const prof=m.profundidade*k*1.12;// folga: o colete veste POR FORA da roupa
  const larg=m.profundidade*k*1.55,alt=m.altura*k*.92;
  for(const filho of colete.children.slice()){colete.remove(filho);filho.geometry.dispose()}
  const placa=new THREE.Mesh(new THREE.BoxGeometry(larg,alt,prof),coleteMat);colete.add(placa);
  for(const lado of[-1,1]){
    const om=new THREE.Mesh(new THREE.BoxGeometry(larg*.22,alt*.16,prof*1.04),coleteFaixaMat);
    om.position.set(lado*larg*.42,alt*.52,0);colete.add(om);
  }
  const faixa=new THREE.Mesh(new THREE.BoxGeometry(larg*1.02,alt*.14,prof*.06),coleteFaixaMat);
  faixa.position.set(0,-alt*.16,prof*.53);colete.add(faixa);
  for(const meshColete of colete.children){meshColete.castShadow=true;meshColete.receiveShadow=true}
  osso.add(colete);
  colete.position.copy(osso.worldToLocal(m.centro.clone()));
  colete.rotation.set(0,0,0);colete.scale.setScalar(1);
}

// Vira o boneco pra uma direção horizontal (a da câmera, na hora do tiro). Sem isso, atirar parado ou
// andando pra trás dispara com o personagem virado pro outro lado e a bala sai de lado — a rotação só
// seguia a direção do MOVIMENTO (ver atualizarMovimentoJogador), então quem estava parado nunca
// encarava o alvo. Recebe a direção crua (e não o yaw) porque quem chama é o combate, que já tem o
// vetor da câmera em mãos — pedir o yaw obrigaria a importar o Input, e Input já importa o combate.
export function encararDirecao(dirX,dirZ){
  if(!dirX&&!dirZ)return;
  let da=Math.atan2(dirX,dirZ)-player.rotation.y;
  while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;
  player.rotation.y+=da*.55;
}

// Hitbox alinhada à malha visual, sem margens artificiais e sem excesso.
const PLAYER_HITBOX_WIDTH=2*(.70+.25/2)*PLAYER_SCALE*.82;// um pouco mais estreita que a envergadura dos braços, pra sobrar folga das paredes
const PLAYER_HITBOX_DEPTH=2*Math.max(.66/2,.69/2,.348+.04/2)*PLAYER_SCALE;
const PLAYER_HITBOX_HALF_WIDTH=PLAYER_HITBOX_WIDTH/2;
const PLAYER_HITBOX_HALF_DEPTH=PLAYER_HITBOX_DEPTH/2;
const jogadorBoxTemp=new THREE.Box3();
export const jogadorBoxDebugTemp=new THREE.Box3();
export function preencherHitboxJogador(box,x,z){
  box.min.set(x-PLAYER_HITBOX_HALF_WIDTH,player.position.y,z-PLAYER_HITBOX_HALF_DEPTH);
  box.max.set(x+PLAYER_HITBOX_HALF_WIDTH,player.position.y+PLAYER_HEIGHT,z+PLAYER_HITBOX_HALF_DEPTH);
  return box;
}
export function jogadorColideNaPosicao(x,z){
  preencherHitboxJogador(jogadorBoxTemp,x,z);
  return caixaColideComObstaculos(jogadorBoxTemp);
}
// ===== STEP-UP =====
// Altura máxima que o jogador transpõe sozinho (degrau, meio-fio, borda de laje). Fração da altura
// do corpo, e não um número solto: o personagem já mudou de tamanho uma vez, e um valor fixo
// silenciosamente viraria "escada intransponível" ou "sobe em qualquer parede".
export const ALTURA_DEGRAU=PLAYER_HEIGHT*.24;
// A colisão horizontal ignora a faixa dos pés até ALTURA_DEGRAU — a técnica de "step offset" que
// toda engine usa. O que estiver inteiramente abaixo dessa linha é DEGRAU, e quem resolve é a física
// vertical, que já sobe ou desce o jogador pra superfície encontrada. O que passa dela é PAREDE.
//
// A primeira tentativa foi outra: testar o corpo inteiro e, quando barrado, empurrar pra cima do
// topo do obstáculo. Isso funciona subindo e QUEBRA descendo — a hitbox tem 20 cm de profundidade e
// o degrau tem 17, então o corpo sempre encosta também no degrau de TRÁS; ao descer, esse degrau de
// trás barrava o passo e o empurrão pra cima devolvia o jogador pro degrau que ele acabara de
// deixar. Na simulação da escada mais íngreme do mapa isso dava 71 frames travados na descida.
// Ignorar a faixa baixa resolve os dois sentidos de uma vez, e sem caso especial.
function jogadorColideAcimaDoDegrau(x,z,y){
  jogadorBoxTemp.min.set(x-PLAYER_HITBOX_HALF_WIDTH,y+ALTURA_DEGRAU,z-PLAYER_HITBOX_HALF_DEPTH);
  jogadorBoxTemp.max.set(x+PLAYER_HITBOX_HALF_WIDTH,y+PLAYER_HEIGHT,z+PLAYER_HITBOX_HALF_DEPTH);
  return caixaColideComObstaculos(jogadorBoxTemp);
}

// ===== ZONAS DE ACERTO DO JOGADOR =====
// Uma AABB única do corpo inteiro é grosseira demais pra um sistema de combate: um tiro no pé vale o
// mesmo que um na cabeça. As três zonas abaixo são derivadas de PLAYER_HEIGHT (antes o código de
// combate usava +1.5 fixo, sendo o personagem 1,4 m — a caixa passava da cabeça).
const ZONAS_JOGADOR=[
  {nome:'cabeca',de:.78,ate:1,meia:.14,multiplicador:2},
  {nome:'tronco',de:.42,ate:.78,meia:.17,multiplicador:1},
  {nome:'pernas',de:0,ate:.42,meia:.12,multiplicador:.6},
];
const caixasJogador=ZONAS_JOGADOR.map(()=>new THREE.Box3());
// Reaproveita as mesmas Box3 a cada chamada: montado uma vez por frame por quem consulta (ver Police.js),
// nunca por bala — alocar Box3 por bala/por frame vai direto pro coletor de lixo e microtrava o combate.
export function zonasDeAcertoJogador(){
  const{x,y,z}=player.position;
  return ZONAS_JOGADOR.map((zona,i)=>{
    const caixa=caixasJogador[i];
    caixa.min.set(x-zona.meia,y+zona.de*PLAYER_HEIGHT,z-zona.meia);
    caixa.max.set(x+zona.meia,y+zona.ate*PLAYER_HEIGHT,z+zona.meia);
    return{caixa,multiplicador:zona.multiplicador,nome:zona.nome};
  });
}

// Encontra a superfície andável (laje/degrau) ou o terreno mais alto logo abaixo de um ponto X/Z.
const raycasterVertical=new THREE.Raycaster();const direcaoBaixo=new THREE.Vector3(0,-1,0);const origemVertical=new THREE.Vector3();
function encontrarSuperficieAbaixo(x,z,yOrigem){origemVertical.set(x,yOrigem,z);raycasterVertical.set(origemVertical,direcaoBaixo);const terrenoY=obterElevacao(x,z);const hits=raycasterVertical.intersectObjects(superficiesAndaveis,true);const suporte=hits.find(hit=>hit.point.y>=terrenoY-.35);let alvo=suporte?Math.max(suporte.point.y,terrenoY):terrenoY;
  // Trava também contra o topo de paredes/muretas sólidas sob o jogador: sem isso, caindo perto da
  // borda de um telhado (fora do alcance de qualquer laje/degrau registrado) o jogador atravessava
  // reto o volume da parede e aparecia "dentro" da casa em vez de pousar em cima dela.
  for(const box of obstaculos){
    if(box.max.y<=yOrigem&&box.max.y>alvo&&x>=box.min.x&&x<=box.max.x&&z>=box.min.z&&z<=box.max.z)alvo=box.max.y;
  }
  return alvo}

// Gravidade real + salto: velocidadeY acumula por frame, noChao habilita o próximo pulo.
const GRAVIDADE=-24,VELOCIDADE_PULO=8.2;let velocidadeY=0,noChao=true;
export function pularJogador(){if(noChao){velocidadeY=VELOCIDADE_PULO;noChao=false}}
export function atualizarFisicaVertical(dt){velocidadeY+=GRAVIDADE*dt;const proximoY=player.position.y+velocidadeY*dt;const origemY=Math.max(player.position.y,proximoY)+1.2;const superficieY=encontrarSuperficieAbaixo(player.position.x,player.position.z,origemY);if(proximoY<=superficieY){player.position.y=superficieY;velocidadeY=0;noChao=true}else{player.position.y=proximoY;noChao=false}}

// ===== REDE DE SEGURANÇA ANTI-TRAVAMENTO =====
// Em vez de caçar um por um os cantos de geometria onde dá pra encravar, o jogo detecta que o jogador
// ficou preso e resolve sozinho. São três camadas: (1) se a hitbox já está DENTRO de um obstáculo,
// empurra pra posição livre mais próxima; (2) se ele está mandando andar e não sai do lugar por alguns
// segundos, força a mesma resolução; (3) botão DESTRAVAR como garantia final.
const SPAWN=new THREE.Vector3(0,0,8);
const PARADO_LIMITE=.05,PARADO_TEMPO=1.2;
let tempoParado=0;const ultimaPos=new THREE.Vector3();

// Encurralado = TODAS as direções bloqueadas. É o que separa "estou preso" de "estou empurrando a
// parede": encostar num muro trava uma direção, mas as outras continuam livres, e isso é jogo normal —
// não pode teleportar ninguém por isso.
function estaEncurralado(){
  for(let i=0;i<12;i++){
    const ang=(i/12)*Math.PI*2;
    if(!jogadorColideNaPosicao(player.position.x+Math.cos(ang)*.45,player.position.z+Math.sin(ang)*.45))return false;
  }
  return true;
}

// manual=true é o botão DESTRAVAR: o jogador pediu explicitamente, então vale até voltar pro spawn.
export function destravarJogador(manual=false){
  const encravado=jogadorColideNaPosicao(player.position.x,player.position.z);
  if(encravado||estaEncurralado()){
    const livre=buscarPosicaoLivre(player.position.x,player.position.z,jogadorColideNaPosicao)
      ||(encravado?null:{x:player.position.x,z:player.position.z});
    if(livre){player.position.x=livre.x;player.position.z=livre.z}
    else if(manual||encravado){player.position.set(SPAWN.x,obterElevacao(SPAWN.x,SPAWN.z),SPAWN.z)}
  }else if(manual){
    // não detectamos travamento, mas ele apertou o botão: sobe pra superfície e zera a queda.
    player.position.y=Math.max(player.position.y,obterElevacao(player.position.x,player.position.z));
  }else return false;
  player.position.y=Math.max(player.position.y,obterElevacao(player.position.x,player.position.z));
  velocidadeY=0;tempoParado=0;
  return true;
}

// Chamada todo frame pelo main: resolve encravamento e vigia o "andando mas parado".
export function vigiarTravamento(dt,querendoAndar){
  // (1) encravado dentro de um obstáculo agora
  if(jogadorColideNaPosicao(player.position.x,player.position.z)){destravarJogador();return}
  // (2) caiu pra fora do mundo
  const chao=obterElevacao(player.position.x,player.position.z);
  if(player.position.y<chao-3){player.position.y=chao;velocidadeY=0;return}
  // (3) manda andar e não sai do lugar — só age se estiver realmente encurralado
  if(querendoAndar&&noChao){
    if(player.position.distanceTo(ultimaPos)<PARADO_LIMITE){
      tempoParado+=dt;
      if(tempoParado>=PARADO_TEMPO){if(estaEncurralado())destravarJogador();tempoParado=0}
    }else tempoParado=0;
  }else tempoParado=0;
  ultimaPos.copy(player.position);
}

// Movimento horizontal relativo à câmera (yaw), com colisão resolvida por eixo, e animação de andar.
// Velocidade proporcional à altura do corpo (4,6 alturas por segundo): com o número solto de antes,
// encolher o personagem transformava a mesma caminhada numa corrida desproporcional.
const VELOCIDADE=PLAYER_HEIGHT*4.6;
let walk=0;const velocity=new THREE.Vector3(),desired=new THREE.Vector3();
const _frente=new THREE.Vector3(),_lado=new THREE.Vector3();
export function atualizarMovimentoJogador(dt,keys,joyX,joyY,yaw,fatorVelocidade=1){
  const smooth=1-Math.exp(-18*dt);
  let x=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joyX,z=(keys.KeyS?1:0)-(keys.KeyW?1:0)+joyY;
  const m=Math.hypot(x,z);
  desired.set(0,0,0);
  // ZONA MORTA. O joystick da tela mede a posição ABSOLUTA do dedo em relação ao centro fixo do
  // círculo, então um polegar apoiado a 2 mm do centro já produzia joyX de 0,02 e o personagem
  // escorregava sozinho — a sensação de "ele anda sem eu mandar". 0,14 é o suficiente pra matar o
  // tremor do dedo sem tirar o andar devagar (a normalização abaixo mantém a analogia acima disso).
  // O detector de travamento (main.js) já usava 0,2 como limiar de "querendo andar"; o movimento em
  // si não usava nenhum, e essa incoerência é que deixava o jogador "escorregando" parado.
  if(m>0&&m<.14){desired.set(0,0,0);}
  else if(m){
    // Normaliza só quando passa de 1: o joystick analógico tem que conseguir andar devagar, e
    // dividir sempre pela magnitude transformava qualquer inclinação do dedo em velocidade máxima.
    const escala=(m>1?1/m:1)*VELOCIDADE*fatorVelocidade;
    _frente.set(-Math.sin(yaw),0,-Math.cos(yaw));_lado.set(Math.cos(yaw),0,-Math.sin(yaw));
    desired.set((_lado.x*x-_frente.x*z)*escala,0,(_lado.z*x-_frente.z*z)*escala);
  }
  velocity.lerp(desired,smooth);
  // Resolvido por eixo (escorrega na parede em vez de grudar), cada eixo com o step offset.
  const py=player.position.y;
  if(jogadorColideAcimaDoDegrau(player.position.x+velocity.x*dt,player.position.z,py))velocity.x=0;else player.position.x+=velocity.x*dt;
  if(jogadorColideAcimaDoDegrau(player.position.x,player.position.z+velocity.z*dt,py))velocity.z=0;else player.position.z+=velocity.z*dt;
  player.position.x=THREE.MathUtils.clamp(player.position.x,-100,92);
  player.position.z=THREE.MathUtils.clamp(player.position.z,-100,100);
  atualizarFisicaVertical(dt);
  preencherHitboxJogador(jogadorBoxDebugTemp,player.position.x,player.position.z);
  const speed=Math.hypot(velocity.x,velocity.z);
  // Virar o corpo pra direção do movimento vale pros DOIS bonecos — é rotação do grupo, não animação.
  if(speed>.08){
    const wanted=Math.atan2(velocity.x,velocity.z);
    let da=wanted-player.rotation.y;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;
    player.rotation.y+=da*(1-Math.exp(-14*dt));
  }
  if(personagemCarregado()){
    // Com o modelo 3D quem move braços e pernas é o esqueleto; o balanço manual abaixo fica de fora.
    atualizarAnimacaoPersonagem(dt,speed,atirandoAgora);
  }else if(speed>.08){
    walk+=dt*(6+speed*1.3);
    const swing=Math.sin(walk)*Math.min(.55,speed*.24);
    legs[0].rotation.x=swing;legs[1].rotation.x=-swing;arms[0].rotation.x=-swing*.45;arms[1].rotation.x=swing*.45;
  }else{for(const limb of [...legs,...arms])limb.rotation.x*=Math.exp(-12*dt)}
}
