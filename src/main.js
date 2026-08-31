// Ponto de entrada: importa todos os módulos (o import já dispara a geração de mundo/NPCs/economia,
// que roda como efeito colateral de topo de módulo, igual à IIFE original) e roda o loop principal.
import*as THREE from'three';
import{camera,renderer,composer}from'./core.js';
import{EYE_HEIGHT,player,atualizarMovimentoJogador,vigiarTravamento,destravarJogador}from'./Player.js';
import{droneState,alternarDrone,atualizarCameraDrone,atualizarCameraSeguidora,miraState}from'./Camera.js';
import{atualizarAmbiente,obterBandaFase}from'./Environment.js';
import{atualizarAnimais}from'./WorldGenerator.js';
import{atualizarNPCs}from'./NPCs.js';
import{atualizarPlantas,atualizarMiraPlantio,isInventarioAberto,renderizarInventario,contextoAtual,getUltimoContextoTipo,renderizarAcoes}from'./Economy.js';
import{atualizarRadar,atualizarDebugNavMesh}from'./UI.js';
import{atualizarPolicia,atualizarTiroContinuo}from'./Police.js';
import{inputState,keys,initDragLook,atualizarSuavizacaoInput}from'./Input.js';
import{atualizarSkyline}from'./Skyline.js';

camera.position.set(0,EYE_HEIGHT,16);
initDragLook(renderer.domElement);

const droneBtn=document.getElementById('droneBtn');
droneBtn.addEventListener('click',()=>alternarDrone(player.position,inputState));
document.getElementById('destravarBtn').addEventListener('click',()=>destravarJogador(true));

const startScreen=document.getElementById('startScreen'),playBtn=document.getElementById('playBtn');let gameStarted=false;playBtn.addEventListener('click',()=>{gameStarted=true;startScreen.classList.add('hide');document.body.classList.add('started');
  // O hint cobre a faixa dos botões embaixo. Ele serve pra primeira partida, não pro jogo todo:
  // some sozinho depois de meio minuto em vez de disputar espaço com o PULAR pra sempre.
  setTimeout(()=>{const h=document.getElementById('hint');if(h)h.style.display='none'},30000)});
// O botão DEBUG é ferramenta de desenvolvimento e fica escondido por padrão (ver CSS): ?debug=1 na URL
// traz ele de volta sem precisar mexer no código.
if(new URLSearchParams(location.search).has('debug'))document.body.classList.add('debug');

const clock=new THREE.Clock(),pos=document.getElementById('pos');
const faseIcone=document.getElementById('faseIcone');let bandaAnteriorHud=null;const ICONES_FASE={noite:'🌙',nascer:'🌅',dia:'🌞',por:'🌇'};
function tick(){
  const dt=Math.min(clock.getDelta(),.05);
  atualizarSuavizacaoInput(dt);
  if(droneState.ativo){
    atualizarCameraDrone(dt,keys,inputState.joyX,inputState.joyY,inputState.yaw,inputState.pitch);
  }else{
    // Mirando, anda a 45% da velocidade: é o custo que faz a mira ser uma ESCOLHA (precisão x
    // mobilidade) e não um bônus grátis que se deixa ligado o tempo todo.
    atualizarMovimentoJogador(dt,keys,inputState.joyX,inputState.joyY,inputState.yaw,1-.55*miraState.fator);
    // rede de segurança: só conta como "travado" se ele estiver de fato tentando andar
    const querendoAndar=!!(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD)||Math.hypot(inputState.joyX,inputState.joyY)>.2;
    vigiarTravamento(dt,querendoAndar);
    atualizarCameraSeguidora(dt,player.position,inputState.yaw,inputState.pitch,EYE_HEIGHT);
  }
  atualizarAmbiente(dt);atualizarSkyline();
  {const banda=obterBandaFase();if(banda!==bandaAnteriorHud){faseIcone.textContent=ICONES_FASE[banda];bandaAnteriorHud=banda}}
  // O tiro contínuo vem ANTES do atualizarPolicia: a bala criada neste frame já entra no
  // atualizarBalas que roda lá dentro, com os alvos deste frame. Depois, ela ficaria um frame parada
  // no cano. Fica no loop principal, e não dentro da máquina de estados da polícia, porque é leitura
  // de input, não IA.
  atualizarPlantas();atualizarRadar();atualizarNPCs(dt);atualizarAnimais(dt);atualizarTiroContinuo();atualizarPolicia(dt);atualizarDebugNavMesh();
  if(isInventarioAberto()){atualizarMiraPlantio();renderizarInventario()}
  {const ctxA=contextoAtual(),chave=ctxA?ctxA.tipo+(ctxA.planta?ctxA.planta.estagio:''):null;if(chave!==getUltimoContextoTipo())renderizarAcoes()}
  pos.textContent=droneState.ativo?`🚁 x ${droneState.x.toFixed(1)} · z ${droneState.z.toFixed(1)} · alt ${droneState.y.toFixed(0)}m`:`x ${player.position.x.toFixed(1)} · z ${player.position.z.toFixed(1)}`;
  composer.render();
  requestAnimationFrame(tick);
}
tick();
