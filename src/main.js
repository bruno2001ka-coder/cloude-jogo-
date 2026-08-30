// Ponto de entrada: importa todos os módulos (o import já dispara a geração de mundo/NPCs/economia,
// que roda como efeito colateral de topo de módulo, igual à IIFE original) e roda o loop principal.
import*as THREE from'three';
import{camera,renderer,composer}from'./core.js';
import{EYE_HEIGHT,player,atualizarMovimentoJogador}from'./Player.js';
import{droneState,alternarDrone,atualizarCameraDrone,atualizarCameraSeguidora}from'./Camera.js';
import{atualizarAmbiente}from'./Environment.js';
import{atualizarAnimais}from'./WorldGenerator.js';
import{atualizarNPCs}from'./NPCs.js';
import{atualizarPlantas,atualizarMiraPlantio,isInventarioAberto,renderizarInventario,contextoAtual,getUltimoContextoTipo,renderizarAcoes}from'./Economy.js';
import{atualizarRadar}from'./UI.js';
import{inputState,keys,initDragLook,atualizarSuavizacaoInput}from'./Input.js';

camera.position.set(0,EYE_HEIGHT,16);
initDragLook(renderer.domElement);

const droneBtn=document.getElementById('droneBtn');
droneBtn.addEventListener('click',()=>alternarDrone(player.position,inputState));

const startScreen=document.getElementById('startScreen'),playBtn=document.getElementById('playBtn');let gameStarted=false;playBtn.addEventListener('click',()=>{gameStarted=true;startScreen.classList.add('hide');document.body.classList.add('started')});

const clock=new THREE.Clock(),pos=document.getElementById('pos');
function tick(){
  const dt=Math.min(clock.getDelta(),.05);
  atualizarSuavizacaoInput(dt);
  if(droneState.ativo){
    atualizarCameraDrone(dt,keys,inputState.joyX,inputState.joyY,inputState.yaw,inputState.pitch);
  }else{
    atualizarMovimentoJogador(dt,keys,inputState.joyX,inputState.joyY,inputState.yaw);
    atualizarCameraSeguidora(dt,player.position,inputState.yaw,inputState.pitch,EYE_HEIGHT);
  }
  atualizarAmbiente(dt);
  atualizarPlantas();atualizarRadar();atualizarNPCs(dt);atualizarAnimais(dt);
  if(isInventarioAberto()){atualizarMiraPlantio();renderizarInventario()}
  {const ctxA=contextoAtual(),chave=ctxA?ctxA.tipo+(ctxA.planta?ctxA.planta.estagio:''):null;if(chave!==getUltimoContextoTipo())renderizarAcoes()}
  pos.textContent=droneState.ativo?`🚁 x ${droneState.x.toFixed(1)} · z ${droneState.z.toFixed(1)} · alt ${droneState.y.toFixed(0)}m`:`x ${player.position.x.toFixed(1)} · z ${player.position.z.toFixed(1)}`;
  composer.render();
  requestAnimationFrame(tick);
}
tick();
