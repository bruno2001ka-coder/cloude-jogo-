// Ponto de entrada: importa todos os módulos (o import já dispara a geração de mundo/NPCs/economia,
// que roda como efeito colateral de topo de módulo, igual à IIFE original) e roda o loop principal.
import*as THREE from'three';
import{camera,renderer,composer}from'./core.js';
import{EYE_HEIGHT,player,atualizarMovimentoJogador,vigiarTravamento,destravarJogador,definirColeteVisivel,definirMochilaVisivel}from'./Player.js';
import{droneState,alternarDrone,atualizarCameraDrone,atualizarCameraSeguidora}from'./Camera.js';
import{atualizarAmbiente,obterBandaFase}from'./Environment.js';
import{atualizarAnimais,atualizarRefugios,atualizarClienteLaje}from'./WorldGenerator.js';
import{atualizarNPCs}from'./NPCs.js';
import{atualizarPlantas,atualizarMiraPlantio,isInventarioAberto,renderizarInventario,contextoAtual,chaveContexto,getUltimoContextoTipo,renderizarAcoes}from'./Economy.js';
import{atualizarRadar,atualizarDebugNavMesh}from'./UI.js';
import{atualizarPolicia,atualizarTiroContinuo,jogadorComColete,jogadorComMochila}from'./Police.js';
import{inputState,keys,initDragLook,atualizarSuavizacaoInput,fatorVelocidadeDesejado}from'./Input.js';
import{atualizarSkyline}from'./Skyline.js';
import{carregar,atualizarSave,instalarSalvamentoAoSair,saveDisponivel,apagarSave}from'./Save.js';
import{personagemCarregado}from'./Personagem.js';

camera.position.set(0,EYE_HEIGHT,16);
initDragLook(renderer.domElement);

const droneBtn=document.getElementById('droneBtn');
droneBtn.addEventListener('click',()=>alternarDrone(player.position,inputState));
document.getElementById('destravarBtn').addEventListener('click',()=>destravarJogador(true));

// Marca de versão na tela inicial. Existe por um motivo prático: quando uma novidade "não aparece",
// a primeira pergunta é se o navegador está servindo o build novo ou um cache velho — e sem isso não
// há como responder olhando a tela. O segundo campo diz se o boneco 3D entrou.
const VERSAO_JOGO='2026-09-03';
{const el=document.getElementById('versaoJogo');
 if(el){el.textContent=`versão ${VERSAO_JOGO} · boneco 3D: carregando…`;
   const marcar=()=>{el.textContent=`versão ${VERSAO_JOGO} · boneco 3D: ${personagemCarregado()?'ok':'não carregou'}`};
   setTimeout(marcar,4000);setTimeout(marcar,12000);}}

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
  if(droneState.ativo){
    atualizarCameraDrone(dt,keys,inputState.joyX,inputState.joyY,inputState.yaw,inputState.pitch);
  }else{
    // Correr (Shift) e mirar (botão direito) são os dois multiplicadores de velocidade, e quem sabe
    // o estado das duas teclas é o Input — por isso o fator vem de lá pronto.
    atualizarMovimentoJogador(dt,keys,inputState.joyX,inputState.joyY,inputState.yaw,fatorVelocidadeDesejado());
    // rede de segurança: só conta como "travado" se ele estiver de fato tentando andar
    const querendoAndar=!!(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD)||Math.hypot(inputState.joyX,inputState.joyY)>.2;
    vigiarTravamento(dt,querendoAndar);
    atualizarCameraSeguidora(dt,player.position,inputState.yaw,inputState.pitch,EYE_HEIGHT);
  }
  atualizarAmbiente(dt,player.position);atualizarSkyline();
  {const banda=obterBandaFase();if(banda!==bandaAnteriorHud){faseIcone.textContent=ICONES_FASE[banda];bandaAnteriorHud=banda}}
  // O tiro contínuo vem ANTES do atualizarPolicia: a bala criada neste frame já entra no
  // atualizarBalas que roda lá dentro, com os alvos deste frame. Depois, ela ficaria um frame parada
  // no cano. Fica no loop principal, e não dentro da máquina de estados da polícia, porque é leitura
  // de input, não IA.
  atualizarPlantas();atualizarRadar();atualizarNPCs(dt);atualizarAnimais(dt);atualizarRefugios(dt);atualizarClienteLaje(dt,player.position);atualizarTiroContinuo();atualizarPolicia(dt);atualizarDebugNavMesh();
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
