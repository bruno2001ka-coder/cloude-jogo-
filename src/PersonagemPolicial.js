// ===== O CORPO DO POLICIAL =====
//
// A polícia era um boneco de CAIXAS: tronco, cabeça, boné, duas pernas que balançavam por rotação e
// uma barra escura no quadril fazendo as vezes de arma. Isso resolvia o "tem alguém ali", e não muito
// mais — de perto, numa troca de tiros, quem atira em você ser um amontoado de caixas é o que mais
// quebra a cena.
//
// Agora é o mesmo tipo de modelo do jogador: malha com esqueleto e animações de verdade. O rig é o
// MESMO do `personagem.glb` (24 ossos, mesmos nomes, e os clipes 'Walking' e 'Running' se chamam
// igual), então a lógica de andar/correr é a mesma pros dois.
//
// ===== DUAS DECISÕES QUE VALEM COMENTÁRIO =====
//
// 1. UM ARQUIVO, VÁRIOS POLICIAIS. `SkeletonUtils.clone` é o que permite copiar uma malha COM
//    esqueleto: um `.clone()` comum copia a malha mas todos os clones continuam apontando pro mesmo
//    esqueleto, e aí os dez policiais fazem exatamente o mesmo movimento no mesmo instante, grudados
//    na mesma pose. A geometria e a textura seguem COMPARTILHADAS entre os clones (é o `clone` do
//    three que garante isso), então dez policiais custam dez esqueletos, não dez modelos.
//
// 2. O ARQUIVO SÓ É PEDIDO QUANDO O PRIMEIRO POLICIAL NASCE. São 20 MB (a textura é um PNG de
//    4096x4096; a malha em si tem só 2.140 triângulos), e a primeira dupla de rua só aparece depois
//    de 70 a 140 segundos de jogo. Baixar isso no boot atrasaria a abertura pra todo mundo, inclusive
//    pra quem nunca cruzar com a polícia. Enquanto não chega, o policial é as caixas — degradação, não
//    falha, igual ao colete e ao personagem.
import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{clone as clonarComEsqueleto}from'three/addons/utils/SkeletonUtils.js';
import{PLAYER_HEIGHT}from'./Player.js';

const ANIM_POL={andar:'Walking',correr:'Running'};
const TRANSICAO=.18;
// Acima disto o policial corre. Ele anda a RUA_VELOCIDADE (1,7) e persegue mais rápido; o corte fica
// no meio da faixa de perseguição pra a corrida aparecer quando ele está de fato indo atrás de alguém.
const VEL_CORRIDA_POL=2.6;

let modelo=null,carregando=false,falhou=false;
const pendentes=[];
const vestidos=[];// {mixer, acoes, atual, raiz}

// ===== MEDIR MALHA COM ESQUELETO NÃO É `Box3.setFromObject` =====
// Foi o que eu usei primeiro, e o policial entrou GIGANTE na cena — enquanto a caixa que eu media
// dizia 0,900 m, exatamente o alvo. `setFromObject` monta a caixa a partir do `boundingBox` da
// GEOMETRIA, que está no espaço de bind, e ignora completamente o que os ossos fizeram com ela. Num
// modelo em centímetros posado por um esqueleto, esse número não tem relação com o que aparece.
//
// `SkinnedMesh.getVertexPosition` aplica o skinning e devolve o vértice onde ele realmente está. É
// o que o `alturaDaMalha` do personagem do jogador já fazia, pelo mesmo motivo.
const _v=new THREE.Vector3();
function extremosY(raiz){
  let min=Infinity,max=-Infinity;
  raiz.traverse(o=>{
    if(!o.isSkinnedMesh)return;
    o.updateWorldMatrix(true,false);o.skeleton?.update?.();
    const n=o.geometry.getAttribute('position').count;
    for(let i=0;i<n;i++){
      o.getVertexPosition(i,_v);o.localToWorld(_v);
      if(_v.y<min)min=_v.y;
      if(_v.y>max)max=_v.y;
    }
  });
  return{min,max,altura:max-min};
}

function pedirModelo(){
  if(modelo||carregando||falhou)return;
  carregando=true;
  new GLTFLoader().load('assets/policial.glb',gltf=>{
    modelo=gltf;carregando=false;
    while(pendentes.length)vestir(pendentes.shift());
  },undefined,err=>{
    // Sem modelo o jogo continua com o boneco de caixas. É degradação, não falha.
    falhou=true;carregando=false;pendentes.length=0;
    console.warn('Quintal 3D: policial 3D não carregou, seguindo com o boneco de caixas.',err);
  });
}

function vestir(pedido){
  const{grupo,caixas}=pedido;
  const raiz=clonarComEsqueleto(modelo.scene);
  raiz.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});

  // Um mixer POR POLICIAL, apontando pro clone dele. Um mixer só pra todos aplicaria a mesma pose em
  // todo mundo — é o mesmo defeito do esqueleto compartilhado, um andar acima.
  // SÓ OS CLIPES QUE ESTE JOGO USA VIRAM AÇÃO. O arquivo traz cinco, e dois deles são takes de mocap
  // com nome de UUID que NÃO são in-place: medi o deslocamento do quadril do primeiro ao último quadro
  // e um deles anda 140 unidades em X e 156 em Y. Tocar aquilo mandaria o policial embora do próprio
  // corpo lógico. 'Walking' e 'Running' têm deslocamento zero nos dois eixos — são os certos, e são
  // os mesmos nomes que o personagem do jogador usa.
  const mixer=new THREE.AnimationMixer(raiz);
  const acoes={};
  for(const clipe of modelo.animations){
    if(clipe.name!==ANIM_POL.andar&&clipe.name!==ANIM_POL.correr)continue;
    const a=mixer.clipAction(clipe);
    a.enabled=true;a.setEffectiveWeight(0);a.play();
    acoes[clipe.name]=a;
  }

  // A POSE ANTES DA MEDIDA, e dentro do grupo. Os ossos ainda estão na pose de repouso do arquivo,
  // que não é a que aparece na tela; medir antes de aplicar a animação dá uma altura que nunca é
  // desenhada — foi esse o erro que deixou a pistola do jogador 31° torta no braço dele. E o resto: tudo aqui é medido em MUNDO, então o clone já precisa
  // estar pendurado onde vai viver — o grupo carrega ESCALA_POLICIAL, que existe por causa das caixas.
  grupo.add(raiz);
  grupo.updateWorldMatrix(true,true);
  mixer.update(0);raiz.updateMatrixWorld(true);

  const antes=extremosY(raiz);
  // Escalar o clone por k multiplica o tamanho em mundo por k, qualquer que seja a escala do pai —
  // então não é preciso desfazer ESCALA_POLICIAL na mão, e não há como errar o fator duas vezes.
  if(antes.altura>0)raiz.scale.multiplyScalar(PLAYER_HEIGHT/antes.altura);
  raiz.updateMatrixWorld(true);

  // PÉS NA ORIGEM DO GRUPO, que é onde as caixas apoiavam — e o resto do Police.js conta com isso
  // (`assentarPolicial` põe `grupo.position.y` na altura do chão, sem folga nenhuma). O desconto é um
  // número de MUNDO entrando numa `position` LOCAL, então divide pela escala do pai.
  const escalaMundo=new THREE.Vector3();grupo.getWorldScale(escalaMundo);
  const posMundo=new THREE.Vector3();grupo.getWorldPosition(posMundo);
  const depois=extremosY(raiz);
  if(escalaMundo.y>0)raiz.position.y-=(depois.min-posMundo.y)/escalaMundo.y;
  for(const m of caixas)if(m)m.visible=false;

  // ===== A ARMA VAI PRA MÃO =====
  // Sem isto o corpo 3D seria uma REGRESSÃO: a arma do policial é uma das caixas, e escondê-las todas
  // deixaria a polícia desarmada na tela enquanto atira em você. Ela é a única caixa que sobrevive —
  // pendurada no osso da mão direita, como a do jogador, pra acompanhar a animação em vez de flutuar.
  //
  // O osso vive na escala do MODELO (centímetros) e a arma foi feita na escala do GRUPO, então entrar
  // na mão sem compensar a deixaria do tamanho de um poste. A razão entre as duas escalas de mundo é
  // exatamente o fator que desfaz isso.
  if(pedido.arma){
    let mao=null;
    raiz.traverse(o=>{if(o.isBone&&!mao&&/^RightHand$/i.test(o.name||''))mao=o});
    if(mao){
      const eMao=new THREE.Vector3(),eArma=new THREE.Vector3();
      mao.getWorldScale(eMao);pedido.arma.getWorldScale(eArma);
      mao.add(pedido.arma);
      pedido.arma.visible=true;
      if(eMao.x>0)pedido.arma.scale.setScalar(eArma.x/eMao.x);
      // Encostada na palma e apontando pro rumo do braço: a âncora é o osso, então a arma segue a mão.
      pedido.arma.position.set(0,0,0);
      pedido.arma.rotation.set(0,0,0);
    }
  }
  const estado={mixer,acoes,atual:null,raiz};
  vestidos.push(estado);
  pedido.aoVestir?.(estado);
  return estado;
}

// Chamado por `criarPolicial`. Devolve nada: o corpo entra quando o arquivo chegar, e até lá as
// caixas seguem visíveis.
export function vestirPolicial(grupo,caixas,arma,aoVestir){
  if(falhou)return;
  const pedido={grupo,caixas,arma,aoVestir};
  if(modelo)vestir(pedido);
  else{pendentes.push(pedido);pedirModelo()}
}

// Tira o policial da lista quando ele é removido da cena, senão o mixer de um morto continua sendo
// atualizado pra sempre — é o mesmo vazamento que as geometrias por policial já causaram uma vez.
export function despirPolicial(estado){
  const i=vestidos.indexOf(estado);
  if(i>=0)vestidos.splice(i,1);
  estado?.mixer?.stopAllAction?.();
}

function trocar(estado,nome){
  const proxima=estado.acoes[nome];
  if(!proxima||estado.atual===proxima)return;
  if(estado.atual)estado.atual.fadeOut(TRANSICAO);
  proxima.reset().fadeIn(TRANSICAO).play();
  estado.atual=proxima;
}

// Um quadro de animação de UM policial. `velocidade` é o módulo horizontal em metros por segundo.
export function atualizarCorpoPolicial(estado,dt,velocidade){
  if(!estado)return;
  const parado=velocidade<.25;
  trocar(estado,velocidade>=VEL_CORRIDA_POL?ANIM_POL.correr:ANIM_POL.andar);
  if(estado.atual){
    // Parado congela no primeiro quadro em vez de marchar no lugar — o mesmo tratamento do jogador.
    estado.atual.paused=parado;
    if(parado)estado.atual.time=0;
    estado.atual.setEffectiveWeight(1);
  }
  estado.mixer.update(dt);
}
export function temCorpo3D(){return !!modelo}
