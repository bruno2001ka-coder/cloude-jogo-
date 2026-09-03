// ===== BONECO 3D DO JOGADOR =====
// Substitui o personagem de caixas por um modelo com esqueleto e animações (assets/personagem.glb).
// Só o JOGADOR usa: polícia e NPCs seguem low-poly de propósito — são dezenas na tela ao mesmo tempo e
// malha com esqueleto custa muito mais por quadro que caixa. É também o que te destaca no meio da rua.
//
// A carga é ASSÍNCRONA e o jogo não pode esperar por ela: o mundo, a economia e o combate já estão de
// pé quando este módulo termina de baixar o arquivo. Então o boneco de caixas continua sendo o
// personagem "de verdade" (hitbox, zonas de acerto, colisão) e este modelo é só a casca visual que
// entra por cima quando chega. Se o arquivo falhar, o jogo segue com o boneco antigo, sem tela de erro.
import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';

// ===== AJUSTES DO MODELO — MEXA AQUI =====
// Tudo que alinha o GLB com a caixa de colisão invisível fica nesta tabela, e em nenhum outro lugar.
// O encaixe é MEDIDO automaticamente (o boneco entra com a altura do jogo e os pés no chão), então
// estes valores são só o retoque fino por cima da medição: o padrão de todos é "não mexe em nada".
// Unidades: metros de jogo e radianos. O personagem tem 0,90 m de altura.
export const AJUSTE={
  escala:1,        // multiplica a altura final. 1 = exatamente a altura do jogo (PLAYER_HEIGHT)
  alturaPes:0,     // sobe (+) ou desce (-) o boneco inteiro, em metros
  // Mochila dos pacotes: tamanho e posição em relação ao centro do tronco (z negativo = costas).
  mochila:{escala:1,x:0,y:.02,z:-.12},
  // Posição e giro da ARMA na mão. Ela já nasce alinhada aos eixos do corpo; isto é o ajuste fino.
  arma:{x:0,y:0,z:0,giroX:0,giroY:0,giroZ:0},
  // COLETE: agora é FOLGA por eixo em cima do tronco medido pelo rig, e nada mais. 1,00 seria colado
  // na pele; 1,12 na largura e 1,20 no fundo é o que dá o volume de placa por cima da roupa, e 1,04
  // na altura deixa ele indo do ombro ao umbigo sem virar cinta. `y` sobe o conjunto no peito.
  colete:{folgaX:1.02,folgaY:1.04,folgaZ:1.14,x:0,y:.015,z:0},
};

// Nomes das animações dentro do GLB. Ficam aqui em cima porque são o contrato com o arquivo: trocar o
// modelo é trocar esta tabela, não caçar string no meio da lógica.
const ANIM={andar:'Walking',correr:'Running',andarAtirando:'Walk_Forward_While_Shooting'};
const TRANSICAO=.16;// segundos de mistura entre uma animação e outra

// Velocidade (em unidades de mundo por segundo) a partir da qual o passo vira corrida. O jogador anda a
// PLAYER_HEIGHT*4.6 ≈ 4,1 e corre a 1,7x isso ≈ 7,0 — o corte no meio separa bem os dois.
const VEL_CORRIDA=5.4;
// Abaixo disto ele está parado de fato. O lerp de velocidade nunca zera exatamente, e sem este piso a
// animação de andar ficaria tremendo pra sempre depois que o jogador solta o controle.
const VEL_PARADO=.35;

let mixer=null,acoes=null,atual=null,raiz=null,maoOsso=null,malhaPele=null,troncoOsso=null;
let aNormalizar=false,alvoAltura=0,playerRef=null,aoProntoCb=null;
// Colete 3D: o arquivo e o encaixe no corpo. Chegam em ordem imprevisível (o GLB do colete pode vir
// antes ou depois do primeiro quadro do boneco), então o encaixe é tentado dos dois lados.
let coleteModelo=null,coleteGrupo=null;
let velocidadeAndar=1;// ritmo nominal da animação de andar, medido na carga

export function personagemCarregado(){return !!mixer}
export function ossoDaMao(){return maoOsso}
export function ossoDoTronco(){return troncoOsso}

// Mede o TRONCO do modelo em metros de mundo, varrendo os vértices numa faixa de altura do peito.
// Serve pro colete: ele foi desenhado pro boneco de caixas (1,05 de largura) e, sobre um corpo humano
// bem mais estreito, virava um caixote preto engolindo o tronco e os braços.
// ===== O TRONCO MEDIDO PELO RIG, NÃO CHUTADO =====
// A versão anterior varria TODO vértice na faixa do peito e devolvia a caixa dele. O problema é que
// nessa faixa os BRAÇOS estão pendurados ao lado do corpo, então a "largura do tronco" que saía era a
// largura de ombro a ombro COM os braços: 0,306 m, quando o tronco tem 0,142 m. Mais do dobro.
//
// Quem consumia isso sabia que estava errado e contornava adivinhando: a largura do colete vinha de
// `profundidade * 1,5`, um palpite que dá 0,204 m — 44% mais largo que o tronco de verdade. Daí em
// diante só sobrava calibrar no escuro, e foi o que aconteceu: doze commits seguidos de escala 0,65,
// 0,68, 0,70, "mais quatro centímetros", "mais um centímetro". Nenhum deles podia acertar, porque o
// número que todos corrigiam já entrava errado.
//
// A malha é SKINNED: cada vértice carrega os ossos que o movem e o peso de cada um. O rig sabe o que
// é braço e o que não é — basta perguntar.
//
// A regra é por EXCLUSÃO, e as três medições que fiz explicam por quê. Nesta faixa do peito o rig usa
// nove ossos (Hips, Spine01, Spine02, Shoulder, Arm e ForeArm dos dois lados), e a largura muda muito
// conforme quais entram:
//   · TODOS               → 0,306 m — é ombro a ombro COM os braços pendurados. É o que havia antes.
//   · só Spine/Chest      → 0,142 m — perde o peito de fora, que é dominado pelo OMBRO, não pela
//                           coluna. Tentei isto primeiro e o colete saiu estreito: dava pra ver a
//                           camisa dos dois lados dele.
//   · tudo menos os braços → 0,189 m — a superfície do tronco vestido, que é o que um colete cobre.
//                           Num humano de 1,75 m isso dá 37 cm de peito, que é a medida de gente.
const OSSO_BRACO=/arm|hand|finger|thumb/i;
export function medidasTronco(){
  if(!malhaPele||!malhaPele.skeleton)return null;
  const f=alturaDaMalha(malhaPele);
  const yBaixo=f.pes+f.altura*.58,yAlto=f.pes+f.altura*.78;
  const nomes=malhaPele.skeleton.bones.map(b=>b.name||'');
  const idx=malhaPele.geometry.getAttribute('skinIndex');
  const pes=malhaPele.geometry.getAttribute('skinWeight');
  if(!idx||!pes)return null;
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,y0=Infinity,y1=-Infinity,achou=0;
  for(let i=0;i<idx.count;i++){
    malhaPele.getVertexPosition(i,_v);malhaPele.localToWorld(_v);
    if(_v.y<yBaixo||_v.y>yAlto)continue;
    // Osso DOMINANTE: o de maior peso entre os quatro. Um vértice do ombro tem um pouco de coluna
    // misturado, e somar pesos incluiria o braço de volta pela porta dos fundos.
    let melhor=-1,maiorPeso=-1;
    for(let k=0;k<4;k++){
      const w=pes.getComponent(i,k);
      if(w>maiorPeso){maiorPeso=w;melhor=idx.getComponent(i,k)}
    }
    if(OSSO_BRACO.test(nomes[melhor]||''))continue;
    achou++;
    if(_v.x<x0)x0=_v.x;if(_v.x>x1)x1=_v.x;
    if(_v.z<z0)z0=_v.z;if(_v.z>z1)z1=_v.z;
    if(_v.y<y0)y0=_v.y;if(_v.y>y1)y1=_v.y;
  }
  // Menos de 12 vértices significa que este rig chama tudo de "arm" ou não tem pesos. Aí é melhor
  // devolver null (o colete fica nas caixas simples) do que devolver uma medida inventada.
  if(achou<12||!isFinite(x0))return null;
  // LARGURA E FUNDO saem dos vértices; ALTURA sai da FAIXA. Não é inconsistência, são perguntas
  // diferentes: "que grossura tem este corpo" se responde medindo o corpo, e "até onde vai um colete"
  // é uma decisão de vestuário — do ombro ao umbigo, que é a faixa de 58% a 78% que este código já
  // usa pra escolher os vértices.
  // Medir a altura pelos vértices dava 8,7 cm (só a coluna cabe entre ombro e cintura na malha) e o
  // colete saía com 9,6 cm num boneco de 90 cm: uma cinta, não um colete.
  return{largura:x1-x0,altura:yAlto-yBaixo,profundidade:z1-z0,
    centro:new THREE.Vector3((x0+x1)/2,(yBaixo+yAlto)/2,(z0+z1)/2)};
}

// Altura REAL desenhada de uma malha com esqueleto, em metros de mundo, e o Y dos pés.
// Passa vértice a vértice com getVertexPosition, que é quem aplica as matrizes dos ossos — é a mesma
// conta que o three faz pra desenhar, e por isso a única que não mente (ver normalizar). Roda uma vez
// só; varrer 3 mil triângulos uma vez é barato, e amostrar salteado erraria a altura.
const _v=new THREE.Vector3();
export function alturaDaMalha(malha){
  malha.updateWorldMatrix(true,false);
  malha.skeleton?.update?.();
  const n=malha.geometry.getAttribute('position').count;
  let min=Infinity,max=-Infinity;
  for(let i=0;i<n;i++){
    malha.getVertexPosition(i,_v);
    malha.localToWorld(_v);
    if(_v.y<min)min=_v.y;
    if(_v.y>max)max=_v.y;
  }
  return{altura:max-min,pes:min,topo:max};
}

// alturaMundo: altura final em METROS DE JOGO (a mesma PLAYER_HEIGHT usada por bots e polícia).
// Aqui só monta: baixar, pendurar no player, achar o osso da mão e preparar as animações. O encaixe de
// tamanho fica pro primeiro quadro (ver normalizar), quando as matrizes dos ossos já valem.
export function carregarPersonagem(player,alturaMundo,aoCarregar){
  new GLTFLoader().load('assets/personagem.glb',gltf=>{
    const modelo=gltf.scene;
    player.add(modelo);
    player.updateWorldMatrix(true,true);
    let malha=null;modelo.traverse(o=>{if(o.isSkinnedMesh&&!malha)malha=o});

    // A normalização de tamanho NÃO acontece aqui — ver `normalizar()`. Neste instante as matrizes dos
    // ossos ainda não foram calculadas (nenhum quadro foi desenhado), e medir agora dá número errado.
    // O modelo nasce invisível pra ninguém ver um quadro do boneco fora de escala.
    modelo.visible=false;

    modelo.traverse(o=>{
      if(!o.isMesh)return;
      o.castShadow=true;o.receiveShadow=true;
      // frustumCulled fica FALSE em malha com esqueleto: a caixa de corte é calculada na pose de
      // repouso, e numa animação ampla o three descarta o boneco justo quando ele sai da pose — o
      // personagem some da tela em pleno movimento.
      o.frustumCulled=false;
    });
    modelo.traverse(o=>{
      if(!o.isBone)return;
      if(o.name==='RightHand')maoOsso=o;
      // Peito: Spine02 é o mais alto da coluna neste rig; os outros ficam como reserva caso o modelo
      // seja trocado por um com menos ossos de coluna.
      if(o.name==='Spine02'||(!troncoOsso&&(o.name==='Spine01'||o.name==='Spine')))troncoOsso=o;
    });

    raiz=modelo;
    mixer=new THREE.AnimationMixer(modelo);
    acoes={};
    for(const clipe of gltf.animations){
      const a=mixer.clipAction(clipe);
      a.enabled=true;a.setEffectiveWeight(0);a.play();
      acoes[clipe.name]=a;
      if(clipe.name===ANIM.andar&&clipe.duration>0)velocidadeAndar=1/clipe.duration;
    }
    // Nasce parado: a animação de andar congelada no primeiro quadro. O GLB não traz um clipe de
    // "parado", e o primeiro quadro do passo é uma pose neutra de pé — serve como repouso.
    trocar(ANIM.andar,0);
    if(acoes[ANIM.andar]){acoes[ANIM.andar].time=0;acoes[ANIM.andar].paused=true}
    // Fica pendente: o primeiro quadro conclui o encaixe (ver normalizar).
    malhaPele=malha;playerRef=player;alvoAltura=alturaMundo;aoProntoCb=aoCarregar;aNormalizar=true;
  },undefined,err=>{
    // Sem modelo o jogo continua com o boneco de caixas. É degradação, não falha.
    console.warn('Quintal 3D: não deu pra carregar o personagem 3D, seguindo com o boneco simples.',err);
  });
}

function trocar(nome,transicao=TRANSICAO){
  const proxima=acoes?.[nome];
  if(!proxima||atual===proxima)return;
  proxima.paused=false;
  proxima.reset();
  proxima.setEffectiveWeight(1);
  if(atual){atual.crossFadeTo(proxima,transicao,false)}
  else proxima.fadeIn(transicao);
  atual=proxima;
}

// Encaixe final do modelo: tamanho e altura dos pés. Roda no PRIMEIRO QUADRO, e não na carga, porque
// só aqui as matrizes dos ossos já foram calculadas — e num SkinnedMesh quem posiciona o vértice é o
// osso. Medindo cedo demais o boneco entrou com escala 716 em vez de 1,94: tão grande que a câmera
// ficava dentro do corpo e, com face única, não se via nada na tela.
// Uma passada basta: a medida é linear na escala da raiz, então corrigir uma vez crava o valor (medido:
// 332,8 m → 0,900 m, e as passadas seguintes não mexem mais em nada).
function normalizar(){
  aNormalizar=false;
  // Aplica a pose da ANIMAÇÃO antes de medir. Sem isto os ossos ainda estão na pose de repouso do
  // arquivo, que não é a que aparece na tela — e quem se pendura num osso (a arma) sai alinhado com
  // uma pose que nunca é desenhada: a pistola nascia 31° torta em relação ao corpo.
  mixer.update(0);
  raiz.updateMatrixWorld(true);
  const f=alturaDaMalha(malhaPele);
  if(f.altura>0){
    raiz.scale.multiplyScalar(alvoAltura*AJUSTE.escala/f.altura);
    raiz.updateMatrixWorld(true);
  }
  // Pés na base do personagem (a origem do player), que é onde o boneco de caixas apoia.
  const escalaPlayer=new THREE.Vector3();playerRef.getWorldScale(escalaPlayer);
  if(escalaPlayer.y>0){
    raiz.position.y+=(playerRef.position.y+AJUSTE.alturaPes-alturaDaMalha(malhaPele).pes)/escalaPlayer.y;
    raiz.updateMatrixWorld(true);
  }
  raiz.visible=true;
  aoProntoCb?.(raiz);aoProntoCb=null;
  tentarVestirColete();// o arquivo do colete pode já ter chegado antes deste primeiro quadro
  tentarPendurarMochilas();// a mochila não depende de arquivo, só da medida do tronco
}

// Chamado uma vez por quadro pelo Player. `velocidade` é o módulo da velocidade horizontal em unidades
// de mundo por segundo; `atirando` vem do gatilho.
export function atualizarAnimacaoPersonagem(dt,velocidade,atirando){
  if(!mixer)return;
  if(aNormalizar)normalizar();
  const parado=velocidade<VEL_PARADO;
  const correndo=velocidade>=VEL_CORRIDA;
  const alvo=parado?ANIM.andar:(atirando?ANIM.andarAtirando:(correndo?ANIM.correr:ANIM.andar));
  trocar(alvo);
  if(atual){
    if(parado){
      // Congela no primeiro quadro em vez de deixar o passo rodando no lugar.
      atual.paused=true;atual.time=0;
    }else{
      atual.paused=false;
      // Ritmo proporcional à velocidade: sem isso o pé patina no chão quando o jogador corre, que é o
      // que mais denuncia animação colada em jogo de terceira pessoa.
      atual.timeScale=THREE.MathUtils.clamp(velocidade/4.1,.6,2.2);
    }
  }
  mixer.update(dt);
}

// Some com o boneco de caixas quando o modelo chega. Recebe a lista porque quem sabe quais malhas
// formam o boneco antigo é o Player, não este módulo.
export function esconderBonecoAntigo(meshes){for(const m of meshes)if(m)m.visible=false}

// ===== COLETE 3D =====
// Recebe o GRUPO do colete que já existe no Player (com as caixas dentro) e, quando o arquivo chega,
// troca as caixas pelo modelo e veste no osso do peito. Se o arquivo falhar, as caixas continuam lá —
// o jogador vê o colete simples em vez de nada.
export function carregarColete(grupo){
  coleteGrupo=grupo;
  new GLTFLoader().load('assets/colete.glb',gltf=>{coleteModelo=gltf.scene;tentarVestirColete()},undefined,err=>{
    console.warn('Quintal 3D: colete 3D não carregou, seguindo com o colete simples.',err);
  });
}
export function coleteVestido(){return !!(coleteModelo&&coleteModelo.parent)}

function tentarVestirColete(){
  // Precisa das duas pontas: o arquivo baixado E o boneco já normalizado (é dele que sai a medida do
  // tronco). Quem chegar por último dispara o encaixe.
  if(!coleteModelo||!coleteGrupo||!troncoOsso||aNormalizar)return;
  const m=medidasTronco();
  if(!m)return;

  troncoOsso.add(coleteGrupo);
  coleteGrupo.position.set(0,0,0);coleteGrupo.rotation.set(0,0,0);coleteGrupo.scale.setScalar(1);
  // Fora as caixas: o modelo entra no lugar delas, no mesmo grupo, pra o liga/desliga de visibilidade
  // continuar sendo um `.visible` só (é ele que o combate chama a cada quadro).
  for(const filho of coleteGrupo.children.slice()){
    coleteGrupo.remove(filho);
    filho.geometry?.dispose?.();
  }
  coleteGrupo.add(coleteModelo);
  coleteModelo.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});

  // ===== VESTE EIXO A EIXO, NÃO POR UMA ESCALA SÓ =====
  // Era uma escala uniforme derivada da largura, e depois dois multiplicadores em cima (`largura` e
  // `altura` do AJUSTE) pra corrigir o que a uniforme errava. Três números disputando o mesmo colete.
  //
  // O defeito que sobrava dessa conta era a PROFUNDIDADE: escalando tudo pela largura, o Z do colete
  // fica na proporção do MODELO, não na do corpo. Medido no jogo: colete com 0,184 m de fundo num
  // tronco de 0,131 — dois centímetros e meio sobrando na frente e outros dois atrás, num boneco de
  // 90 cm. Não é colete, é barril.
  //
  // Colete é uma casca, então esticar cada eixo pro que ele veste é legítimo e é o que resolve de
  // uma vez: X pra largura do tronco, Z pra profundidade, Y pra faixa do peito. As folgas são o
  // "vestir por cima da roupa" e são a ÚNICA coisa que sobrou pra ajustar — cada uma num eixo só,
  // sem uma mexer na outra.
  coleteGrupo.updateWorldMatrix(true,true);
  const caixa=new THREE.Box3().setFromObject(coleteModelo);
  const tam=new THREE.Vector3();caixa.getSize(tam);
  if(tam.x>0&&tam.y>0&&tam.z>0){
    coleteModelo.scale.set(
      coleteModelo.scale.x*(m.largura     *AJUSTE.colete.folgaX)/tam.x,
      coleteModelo.scale.y*(m.altura      *AJUSTE.colete.folgaY)/tam.y,
      coleteModelo.scale.z*(m.profundidade*AJUSTE.colete.folgaZ)/tam.z);
  }

  // Centra no tronco. O deslocamento é medido em MUNDO e `position` vive no espaço do PAI, então quem
  // converte é a escala do pai — dividir pela escala do próprio modelo (o erro anterior) deixava o
  // colete 5 cm acima do peito.
  coleteGrupo.updateWorldMatrix(true,true);
  caixa.setFromObject(coleteModelo);
  const centro=new THREE.Vector3();caixa.getCenter(centro);
  const destino=m.centro.clone().add(new THREE.Vector3(AJUSTE.colete.x,AJUSTE.colete.y,AJUSTE.colete.z));
  coleteModelo.position.add(destino.sub(centro).divideScalar(escalaDe(coleteGrupo)));
}
// ===== MOCHILA =====
// Diferente do colete, a mochila não tem arquivo: as caixas que o Player montou continuam sendo as
// caixas. O que este módulo faz é pendurá-las no osso do tronco e redimensionar pela medida REAL do
// tronco do modelo — sem isso ficariam do tamanho do boneco de caixas (tronco de 1,05 de largura) e
// engoliriam o humanoide, que foi exatamente o que aconteceu com o colete antes de ser ajustado.
let mochilaModelo=null;
const mochilasPendentes=[];
export function pendurarMochila(grupo){
  mochilasPendentes.push(grupo);
  // Pede o modelo 3D. Se chegar, troca as caixas por ele DENTRO do mesmo grupo — o liga/desliga
  // continua sendo um `.visible` só. Se falhar, as caixas ficam e o jogador vê a mochila simples.
  if(!mochilaModelo)new GLTFLoader().load('assets/mochila.glb',gltf=>{
    mochilaModelo=gltf.scene;tentarPendurarMochilas();
  },undefined,err=>{
    console.warn('Quintal 3D: mochila 3D não carregou, seguindo com a mochila simples.',err);
    tentarPendurarMochilas();
  });
  tentarPendurarMochilas();
}
function tentarPendurarMochilas(){
  if(!mochilasPendentes.length||!troncoOsso||aNormalizar)return;
  const m=medidasTronco();if(!m)return;
  for(const grupo of mochilasPendentes.splice(0)){
    troncoOsso.add(grupo);
    grupo.position.set(0,0,0);grupo.rotation.set(0,0,0);grupo.scale.setScalar(1);
    if(mochilaModelo){
      for(const filho of grupo.children.slice()){grupo.remove(filho);filho.geometry?.dispose?.()}
      grupo.add(mochilaModelo);
      // Alguns exportadores GLB preservam nós ocultos do arquivo original. O modelo precisa ser visível
      // quando o grupo for ligado pelo inventário, então normalizamos essa flag em toda a hierarquia.
      mochilaModelo.traverse(o=>{o.visible=true});
      // De costas pro observador: o modelo vem virado pra frente, e uma mochila com o bolso pro lado
      // das costas do jogador fica com a alça pra fora.
      mochilaModelo.rotation.y=Math.PI;
    }
    grupo.updateWorldMatrix(true,true);
    const caixa=new THREE.Box3().setFromObject(grupo);
    const larg=caixa.max.x-caixa.min.x;
    // Mochila um pouco mais estreita que as costas: do tamanho do tronco ela lê como armário.
    const alvo=m.profundidade*1.35*AJUSTE.mochila.escala;
    if(larg>0)grupo.scale.multiplyScalar(alvo/larg);
    // Centra no tronco e empurra pras COSTAS. O deslocamento é medido em mundo e `position` vive no
    // espaço do pai, então quem converte é a escala do PAI — mesma armadilha do colete, que dividido
    // pela escala do próprio modelo ficou 5 cm acima do peito.
    grupo.updateWorldMatrix(true,true);
    caixa.setFromObject(grupo);
    const centro=new THREE.Vector3();caixa.getCenter(centro);
    const destino=m.centro.clone().add(new THREE.Vector3(AJUSTE.mochila.x,AJUSTE.mochila.y,AJUSTE.mochila.z));
    grupo.position.add(destino.sub(centro).divideScalar(escalaDe(troncoOsso)));
    grupo.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  }
}

// Escala de mundo acumulada num objeto: converter um deslocamento de mundo pra local pede dividir por ela.
function escalaDe(obj){const e=new THREE.Vector3();obj.getWorldScale(e);return e.x||1}
export function raizPersonagem(){return raiz}
