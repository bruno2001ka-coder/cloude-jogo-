// Ponto de entrada: importa todos os módulos (o import já dispara a geração de mundo/NPCs/economia,
// que roda como efeito colateral de topo de módulo, igual à IIFE original) e roda o loop principal.
import*as THREE from'three';
import{camera,renderer,composer}from'./core.js';
import{EYE_HEIGHT,player,atualizarMovimentoJogador,vigiarTravamento,destravarJogador,definirColeteVisivel,definirMochilaVisivel}from'./Player.js';
import{droneState,alternarDrone,atualizarCameraDrone,atualizarCameraSeguidora}from'./Camera.js';
import{atualizarAmbiente,obterBandaFase}from'./Environment.js';
import{atualizarAnimais,atualizarPortas}from'./WorldGenerator.js';
import{atualizarNPCs}from'./NPCs.js';
import{atualizarPlantas,atualizarMiraPlantio,isInventarioAberto,renderizarInventario,contextoAtual,chaveContexto,getUltimoContextoTipo,renderizarAcoes}from'./Economy.js';
import{atualizarRadar,atualizarDebugNavMesh}from'./UI.js';
import{atualizarPolicia,atualizarTiroContinuo,jogadorComColete,jogadorComMochila,ocorrenciaAtual,registrarAvistamentoViatura,desembarcarDaViatura,viaturaEsperando}from'./Police.js';
import{atualizarPortasHospital,atualizarLuzesEmergencia,atualizarHospital}from'./Hospital.js';
import{inputState,keys,initDragLook,atualizarSuavizacaoInput,fatorVelocidadeDesejado}from'./Input.js';
import{atualizarSkyline}from'./Skyline.js';
import{carregar,atualizarSave,instalarSalvamentoAoSair,saveDisponivel,apagarSave}from'./Save.js';
import{personagemCarregado}from'./Personagem.js';
import{atualizarEfeitos}from'./CombatFX.js';
import{atualizarRecuoArmas}from'./Weapons.js';
import{isHUDEditando}from'./HUDEditor.js';
import{definirPosicaoAudio}from'./Audio.js';
import{atualizarMoto,maxVelMoto}from'./Moto.js';
import{valorAcelerador,reSegurada,configurar as configurarAcelerador,modoDirigindo}from'./Acelerador.js';
import{atualizarCarro,maxVelCarro}from'./Carro.js';
import{atualizarViaturas,consumirAvistamentoViatura}from'./Viatura.js';
import{atualizarChaoVisivel}from'./Terrain.js';

camera.position.set(0,EYE_HEIGHT,16);
initDragLook(renderer.domElement);

const droneBtn=document.getElementById('droneBtn');
droneBtn.addEventListener('click',()=>alternarDrone(player.position,inputState));

// ===== O MENU =====
// "crie um menu, para esconder o drone e as configurações de HUD."
// Drone, editor de HUD e DEBUG não são botões de jogo — são ferramentas, e estavam ocupando canto bom
// da tela o tempo todo. Agora moram atrás do ☰. O painel fecha ao escolher qualquer coisa (menu que
// fica aberto por cima do jogo é menu atrapalhando) e ao tocar fora dele.
{
  const menuBtn=document.getElementById('menuBtn'),menuPanel=document.getElementById('menuPanel');
  if(menuBtn&&menuPanel){
    const fechar=()=>{menuPanel.classList.remove('open');menuBtn.classList.remove('on')};
    menuBtn.addEventListener('click',e=>{
      e.stopPropagation();
      const abrindo=!menuPanel.classList.contains('open');
      menuPanel.classList.toggle('open',abrindo);menuBtn.classList.toggle('on',abrindo);
    });
    menuPanel.addEventListener('click',e=>{if(e.target.closest('button'))fechar()});
    // `pointerdown` na captura: fecha antes de o toque virar clique em qualquer outra coisa.
    addEventListener('pointerdown',e=>{
      if(!menuPanel.contains(e.target)&&e.target!==menuBtn)fechar();
    },true);
  }
}
document.getElementById('destravarBtn').addEventListener('click',()=>destravarJogador(true));

// Marca de versão na tela inicial. Existe por um motivo prático: quando uma novidade "não aparece",
// a primeira pergunta é se o navegador está servindo o build novo ou um cache velho — e sem isso não
// há como responder olhando a tela. O segundo campo diz se o boneco 3D entrou.
const VERSAO_JOGO='0.3.31-viatura-ronda-xt660';
{const el=document.getElementById('versaoJogo');
 if(el){el.textContent=`versão ${VERSAO_JOGO} · boneco 3D: carregando…`;
   const marcar=()=>{el.textContent=`versão ${VERSAO_JOGO} · boneco 3D: ${personagemCarregado()?'ok':'não carregou'}`};
   setTimeout(marcar,4000);setTimeout(marcar,12000);}}

// Lembra se o quadro anterior já estava na moto: é o que separa "acabou de montar" (câmera encaixa)
// de "está pilotando" (câmera recentra suave). Ver o bloco da moto em `quadro`.
let dirigindoMotoAntes=false;
// Quanto tempo a câmera fica onde o jogador deixou, depois que ele tira o dedo, antes de voltar pras
// costas do veículo. 1,6 s é o que separa "olhei de relance" de "enquadrei a cena".
const FOLGA_CAMERA=1.6;
let folgaCamera=0;
const startScreen=document.getElementById('startScreen'),playBtn=document.getElementById('playBtn');let gameStarted=false;playBtn.addEventListener('click',()=>{gameStarted=true;startScreen.classList.add('hide');document.body.classList.add('started');
  // O hint cobre a faixa dos botões embaixo. Ele serve pra primeira partida, não pro jogo todo:
  // some sozinho depois de meio minuto em vez de disputar espaço com o PULAR pra sempre.
  setTimeout(()=>{const h=document.getElementById('hint');if(h)h.style.display='none'},30000)});
// O botão DEBUG é ferramenta de desenvolvimento e fica escondido por padrão (ver CSS): ?debug=1 na URL
// traz ele de volta sem precisar mexer no código.
if(new URLSearchParams(location.search).has('debug'))document.body.classList.add('debug');

// ===== CARGA DO SAVE =====
// Depois de TODOS os imports: o mundo, a economia e as armas já existem neste ponto, e é neles que o
// save escreve. Carregar antes seria escrever em cima de estado que o módulo ainda vai inicializar.
// ===== APAGAR TUDO E RECOMEÇAR =====
// Só na tela inicial, e em DOIS toques: o primeiro pergunta, o segundo apaga. Apagar progresso é
// irreversível e o botão fica ao lado do JOGAR — um toque só seria acidente esperando acontecer.
// Recarregar a página em vez de zerar as variáveis na mão: o estado do jogo mora espalhado em vários
// módulos (economia, polícia, plantas, armas), e zerar cada um daria um caminho de reinício que
// ninguém testa e que diverge do início de verdade. Recarregar usa o MESMO caminho de sempre.
{
  const recomecarBtn=document.getElementById('recomecarBtn');
  if(!saveDisponivel())recomecarBtn.hidden=true;
  let armado=false,voltarEm=0;
  recomecarBtn.addEventListener('click',()=>{
    if(!armado){
      armado=true;recomecarBtn.classList.add('confirmar');
      recomecarBtn.textContent='TEM CERTEZA? TOQUE DE NOVO';
      clearTimeout(voltarEm);
      voltarEm=setTimeout(()=>{armado=false;recomecarBtn.classList.remove('confirmar');
        recomecarBtn.textContent='APAGAR TUDO E RECOMEÇAR'},4000);
      return;
    }
    apagarSave();
    location.reload();
  });
}

// Sem save, `carregar()` devolve false e o jogo começa do zero — sem caso especial nenhum.
if(carregar())console.info('Quintal 3D: progresso carregado.');
else if(!saveDisponivel())console.info('Quintal 3D: sem armazenamento — o progresso não será salvo.');
instalarSalvamentoAoSair();

const clock=new THREE.Clock(),pos=document.getElementById('pos');
const faseIcone=document.getElementById('faseIcone');let bandaAnteriorHud=null;const ICONES_FASE={noite:'🌙',nascer:'🌅',dia:'🌞',por:'🌇'};
// ===== O LOOP NÃO PODE MORRER =====
// `requestAnimationFrame` era a ÚLTIMA linha do quadro, então qualquer exceção no meio parava a
// corrente pra sempre: tela congelada, sem mensagem, sem nada. Foi exatamente assim que um
// ReferenceError na polícia (uma const usada antes da declaração, que só disparava quando a primeira
// dupla de rua completava 75 s de vida) travou o jogo "depois de alguns minutos".
// Agora o próximo quadro é agendado ANTES do corpo e o corpo roda protegido: um erro vira um quadro
// ruim e uma linha no console, não um jogo morto. O contador impede que um erro por quadro vire
// dezenas de milhares de linhas de log.
let errosDeQuadro=0;
function tick(){
  requestAnimationFrame(tick);
  try{quadro()}
  catch(err){
    errosDeQuadro++;
    if(errosDeQuadro<=5)console.error('Quintal 3D: erro no quadro',err);
    // Avisa na tela DIRETO no elemento, sem chamar função de outro módulo: o erro pode ter vindo
    // justamente de lá, e aí o tratador quebraria junto. Protegido por try porque nem o aviso pode
    // derrubar o loop.
    if(errosDeQuadro===1)try{
      const el=document.getElementById('avisoPolicia');
      if(el){el.textContent='Alguma coisa falhou — o jogo segue rodando.';el.style.display='block';el.style.opacity='1';
        setTimeout(()=>{el.style.opacity='0';setTimeout(()=>{el.style.display='none'},300)},3000);}
    }catch(e){}
  }
}
function quadro(){
  const dt=Math.min(clock.getDelta(),.05);
  atualizarSuavizacaoInput(dt);
  if(isHUDEditando()){composer.render();return}
  // A cena continua renderizando por trás da tela inicial, mas nenhum sistema de jogo deve
  // consumir input, mover NPCs ou alterar a economia antes de o jogador começar. Sem esta guarda,
  // um toque acidental no joystick enquanto o overlay estava aberto podia deslocar o personagem
  // antes mesmo da primeira partida.
  if(!gameStarted){
    // O chão é cortado em pedaços e só os de perto são desenhados (ver `Terrain.js`). Vai pela CÂMERA,
  // não pelo jogador: no drone ela sobe e se afasta, e quem decide o que aparece é de onde se olha.
  atualizarChaoVisivel(camera.position.x,camera.position.z);
  atualizarAmbiente(dt,player.position);atualizarSkyline();
    composer.render();
    return;
  }
  if(droneState.ativo){
    atualizarCameraDrone(dt,keys,inputState.joyX,inputState.joyY,inputState.yaw,inputState.pitch);
  }else{
    // Correr (Shift) e mirar (botão direito) são os dois multiplicadores de velocidade, e quem sabe
    // o estado das duas teclas é o Input — por isso o fator vem de lá pronto.
    // Os dois veículos recebem quadro sempre — parados eles ainda se assentam no terreno e mantêm o
    // colisor em dia. Só UM pode estar sendo dirigido, e é ele quem manda no movimento do jogador.
    // A alavanca de acelerador vale pros DOIS, e o veículo parado ignora ela (o `atualizar` só lê o
    // acelerador quando está montado). O analógico continua indo junto, mas agora só pela DIREÇÃO:
    // `joyY` saiu da conta de velocidade (ver o comentário em `Veiculo.js`).
    const alavanca=valorAcelerador(),re=reSegurada();
    const naMoto=atualizarMoto(dt,keys,inputState.joyX,inputState.joyY,alavanca,re);
    const noCarro=atualizarCarro(dt,keys,inputState.joyX,inputState.joyY,alavanca,re);
    const dirigindoMoto=naMoto||noCarro;
    // A alavanca aparece com o veículo e some com ele, já zerada — é a rede contra ficar engatada de
    // uma pilotagem pra outra. A escala em km/h sai do teto de QUEM está sendo dirigido: 50 no carro,
    // 40 na moto, então a escada de marcas nunca mostra um número que aquele veículo não alcança.
    if(dirigindoMoto!==dirigindoMotoAntes){
      configurarAcelerador(dirigindoMoto?(noCarro?maxVelCarro():maxVelMoto())*3.6:null);
      modoDirigindo(dirigindoMoto);
    }
    if(!dirigindoMoto)atualizarMovimentoJogador(dt,keys,inputState.joyX,inputState.joyY,inputState.yaw,fatorVelocidadeDesejado());
    // ===== NA MOTO, A CÂMERA VAI PRA TRÁS DELA =====
    // A PÉ o movimento é RELATIVO À CÂMERA: `atualizarMovimentoJogador` recebe `inputState.yaw` e
    // monta a frente com ele, então empurrar o analógico pra cima sempre manda o boneco pra dentro
    // da tela, olhando pra onde for. DE MOTO não era assim: `atualizarMoto` anda no rumo DA MOTO e
    // nunca encostava no yaw da câmera. Os dois corriam soltos, e o resultado foi medido:
    //     ao montar                       câmera   0°  ·  moto   0°  ->  0° de diferença
    //     depois de olhar pra trás        câmera 180°  ·  moto   0°  -> 180°
    //     depois de só CURVAR 2 segundos  câmera 180°  ·  moto 124°  ->  56°
    // Ou seja: SÓ DE FAZER CURVA os dois se separam sozinhos, e com a moto vindo na direção da
    // câmera o analógico fica espelhado — empurrar pra cima traz a moto PRA CIMA de você. É a cara
    // de "controle invertido", e é o que sobrou depois de consertar o sinal do acelerador.
    //
    // O conserto é o de todo jogo de dirigir: a câmera se recentra ATRÁS do veículo. Fica aqui, no
    // main, e não dentro do Moto.js, porque juntar dois módulos é o serviço deste arquivo — e o
    // Moto.js não precisa passar a conhecer o Input pra isso.
    // Recentra em vez de cravar: dá pra arrastar a tela e olhar pro lado durante a pilotagem, que a
    // câmera volta pro lugar sozinha em cerca de um segundo.
    if(dirigindoMoto){
      if(!dirigindoMotoAntes){
        // NO INSTANTE DE MONTAR, A CÂMERA ENCAIXA — não vai girando. Montar de costas pra moto deixa
        // os dois a 180°, e enquanto a câmera dava a volta (perto de 1 segundo) o controle ficava
        // espelhado: medido, o pico chegava a 170°. Encaixar mata essa janela; o recentro suave
        // abaixo é pra DEPOIS, quando o que existe é o atraso normal de curva.
        inputState.yaw=inputState.targetYaw=player.rotation.y;
      }else{
        // ===== A CÂMERA DE DIREÇÃO, ESTILO GTA SAN ANDREAS =====
        // "quero uma câmera onde posso dirigir e virar ela prá mostrar melhor igual no GTA San
        //  Andreas, isso tbm vai ajudar na hora de começar as game play."
        //
        // O recentro existia, mas com constante de tempo de 0,29 s (`exp(-3,5*dt)`): ele voltava a
        // câmera pras costas do carro quase na mesma velocidade em que o dedo a girava. Dava pra
        // "olhar pro lado", só que a tela era arrancada de volta antes de dar pra enquadrar
        // qualquer coisa — inútil pra gravar.
        //
        // Duas mudanças, e as duas importam:
        //  · ENQUANTO O DEDO ESTÁ NA TELA, não recentra nada. Recentrar por cima de quem está
        //    girando é a câmera brigando com o jogador, e o jogador sempre perde.
        //  · DEPOIS DE SOLTAR, espera `FOLGA_CAMERA` parado e só então volta, e volta LENTO (~1,1 s
        //    de constante). É o tempo de enquadrar uma casa, um policial, e seguir dirigindo.
        if(inputState.olhando)folgaCamera=FOLGA_CAMERA;
        else folgaCamera=Math.max(0,folgaCamera-dt);
        if(folgaCamera<=0){
          let d=player.rotation.y-inputState.targetYaw;
          while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;// caminho angular mais curto
          inputState.targetYaw+=d*(1-Math.exp(-.9*dt));
        }
      }
    }
    dirigindoMotoAntes=dirigindoMoto;
    // rede de segurança: só conta como "travado" se ele estiver de fato tentando andar
    const querendoAndar=!!(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD)||Math.hypot(inputState.joyX,inputState.joyY)>.2;
    vigiarTravamento(dt,querendoAndar);
    atualizarCameraSeguidora(dt,player.position,inputState.yaw,inputState.pitch,EYE_HEIGHT);
  }
  // O chão é cortado em pedaços e só os de perto são desenhados (ver `Terrain.js`). Vai pela CÂMERA,
  // não pelo jogador: no drone ela sobe e se afasta, e quem decide o que aparece é de onde se olha.
  atualizarChaoVisivel(camera.position.x,camera.position.z);
  atualizarAmbiente(dt,player.position);atualizarSkyline();definirPosicaoAudio(camera.position.x,camera.position.z);
  {const banda=obterBandaFase();if(banda!==bandaAnteriorHud){faseIcone.textContent=ICONES_FASE[banda];bandaAnteriorHud=banda}}
  // O tiro contínuo vem ANTES do atualizarPolicia: a bala criada neste frame já entra no
  // atualizarBalas que roda lá dentro, com os alvos deste frame. Depois, ela ficaria um frame parada
  // no cano. Fica no loop principal, e não dentro da máquina de estados da polícia, porque é leitura
  // de input, não IA.
  atualizarPlantas();atualizarRadar();atualizarNPCs(dt);atualizarAnimais(dt);atualizarPortas(dt);atualizarTiroContinuo();atualizarEfeitos(dt);atualizarRecuoArmas(dt);atualizarPortasHospital(dt);atualizarHospital(dt);atualizarLuzesEmergencia(dt);atualizarPolicia(dt);atualizarDebugNavMesh();
  // As viaturas leem a ocorrência DEPOIS do atualizarPolicia, pra pegar o canteiro deste quadro e não
  // o do anterior. Fora do if/else do drone de propósito: a ronda não pode congelar só porque o
  // jogador subiu a câmera — quem olha de cima tem que ver a rua viva.
  // Ela devolve o ponto onde estacionou numa ocorrência, no quadro da chegada. Quem sabe o que fazer
  // com isso é a polícia, e quem conhece as duas é aqui — o Viatura.js segue só dirigindo.
  desembarcarDaViatura(atualizarViaturas(dt,ocorrenciaAtual(),viaturaEsperando()));\n  registrarAvistamentoViatura(consumirAvistamentoViatura());
  if(isInventarioAberto()){atualizarMiraPlantio();renderizarInventario()}
  {const chave=chaveContexto(contextoAtual());if(chave!==getUltimoContextoTipo())renderizarAcoes()}
  pos.textContent=droneState.ativo?`🚁 x ${droneState.x.toFixed(1)} · z ${droneState.z.toFixed(1)} · alt ${droneState.y.toFixed(0)}m`:`x ${player.position.x.toFixed(1)} · z ${player.position.z.toFixed(1)}`;
  // O colete acompanha o estado de combate (armadura equipada ou coletes no bolso). Escrever .visible
  // por frame é barato; o que não pode é reconstruir a malha, que é justamente por que ela nasce
  // pronta e escondida no Player.
  definirColeteVisivel(jogadorComColete());
  definirMochilaVisivel(jogadorComMochila());
  atualizarSave(dt);
  composer.render();
}
tick();
