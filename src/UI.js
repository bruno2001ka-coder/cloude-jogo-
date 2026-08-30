// Radar (minimapa estilo GTA) e modo debug visual (wireframes das caixas de colisão).
import*as THREE from'three';
import{scene}from'./core.js';
import{player,jogadorBoxDebugTemp}from'./Player.js';
import{obstaculos,superficiesAndaveis}from'./Physics.js';
import{casasPos,refugios}from'./WorldGenerator.js';
import{plantas,lojaPos,receptadorPos}from'./Economy.js';
import{heli,policiais,policia}from'./Police.js';

// ===== RADAR (minimapa estilo GTA): canvas 2D separado, não usa o pipeline WebGL — custo desprezível por frame.
const radarCanvas=document.getElementById('radar'),radarCtx=radarCanvas.getContext('2d');
const RADAR_TAM=130,RADAR_DPR=Math.min(devicePixelRatio||1,2);
radarCanvas.width=RADAR_TAM*RADAR_DPR;radarCanvas.height=RADAR_TAM*RADAR_DPR;radarCtx.scale(RADAR_DPR,RADAR_DPR);
const RADAR_ALCANCE=45;// metros de mundo visíveis do centro até a borda
// sempreVisivel: quando o ponto está fora do alcance, gruda na borda do radar apontando a direção (tipo waypoint de GTA),
// em vez de simplesmente sumir — sem isso o Esconderijo (bem isolado) nunca aparecia se o jogador estivesse longe dele.
function desenharPontoRadar(x,z,cor,raio,sempreVisivel){
  const cx=RADAR_TAM/2,cy=RADAR_TAM/2,escala=(RADAR_TAM/2-6)/RADAR_ALCANCE;
  let dx=(x-player.position.x)*escala,dz=(z-player.position.z)*escala;
  const dist=Math.hypot(dx,dz),limite=RADAR_TAM/2-8;
  if(dist>limite){
    if(!sempreVisivel)return;
    const fator=limite/dist;dx*=fator;dz*=fator;
    radarCtx.strokeStyle=cor;radarCtx.lineWidth=2;radarCtx.beginPath();radarCtx.arc(cx+dx,cy+dz,raio+2,0,Math.PI*2);radarCtx.stroke();
  }
  radarCtx.fillStyle=cor;radarCtx.beginPath();radarCtx.arc(cx+dx,cy+dz,raio,0,Math.PI*2);radarCtx.fill();
}
export function atualizarRadar(){
  radarCtx.clearRect(0,0,RADAR_TAM,RADAR_TAM);
  const cx=RADAR_TAM/2,cy=RADAR_TAM/2,escala=(RADAR_TAM/2-6)/RADAR_ALCANCE;
  radarCtx.save();radarCtx.beginPath();radarCtx.arc(cx,cy,RADAR_TAM/2-3,0,Math.PI*2);radarCtx.clip();
  // traçado das casas próximas (silhueta das quadras), pra dar noção real de rua em vez de só pontos soltos.
  radarCtx.fillStyle='rgba(210,200,170,.32)';
  for(const c of casasPos){
    const dx=(c.x-player.position.x)*escala,dz=(c.z-player.position.z)*escala;
    if(Math.hypot(dx,dz)>RADAR_TAM/2+10)continue;
    radarCtx.fillRect(cx+dx-(c.w/2)*escala,cy+dz-(c.d/2)*escala,c.w*escala,c.d*escala);
  }
  radarCtx.restore();
  desenharPontoRadar(lojaPos.x,lojaPos.z,'#5ec2ff',5,true);
  desenharPontoRadar(receptadorPos.x,receptadorPos.z,'#ff5e5e',5,true);
  for(const r of refugios)desenharPontoRadar(r.x,r.z,'#c23a3a',4,false);
  for(const pl of plantas)if(!pl.colhida)desenharPontoRadar(pl.x,pl.z,'#7cfc00',3.5,false);
  // helicóptero e policiais só ficam "acesos" no radar quando a polícia está de olho em algo — senão
  // some, já que patrulhando bem longe não é uma ameaça que o jogador precise rastrear o tempo todo.
  if(policia.estado!=='patrulha')desenharPontoRadar(heli.position.x,heli.position.z,'#8fd4ff',5,true);
  if(policia.estado==='combate')for(const pol of policiais)if(pol.vivo)desenharPontoRadar(pol.pos.x,pol.pos.z,'#ff3b3b',3,false);
  // seta do jogador: fixa no centro (norte-fixo), só gira pra indicar a direção que o personagem está olhando.
  radarCtx.save();radarCtx.translate(cx,cy);radarCtx.rotate(Math.PI-player.rotation.y);
  radarCtx.fillStyle='#ffe17a';radarCtx.beginPath();radarCtx.moveTo(0,-8);radarCtx.lineTo(6,7);radarCtx.lineTo(0,3);radarCtx.lineTo(-6,7);radarCtx.closePath();radarCtx.fill();
  radarCtx.restore();
}

// ===== MODO DEBUG VISUAL: wireframes das caixas de colisão =====
// Vermelho = obstáculos sólidos (paredes/muretas/postes, bloqueiam X/Z). Verde = superfícies andáveis (lajes/degraus, só eixo Y). Amarelo = hitbox do jogador.
const debugGroup=new THREE.Group();debugGroup.visible=false;scene.add(debugGroup);
let debugConstruido=false;
function construirDebugColisao(){
  if(debugConstruido)return;debugConstruido=true;
  for(const box of obstaculos)debugGroup.add(new THREE.Box3Helper(box,0xff2222));
  for(const surf of superficiesAndaveis)debugGroup.add(new THREE.Box3Helper(new THREE.Box3().setFromObject(surf),0x33ff55));
  debugGroup.add(new THREE.Box3Helper(jogadorBoxDebugTemp,0xffee33));
}
const debugBtn=document.getElementById('debugBtn');
export function alternarDebug(){construirDebugColisao();debugGroup.visible=!debugGroup.visible;debugBtn.classList.toggle('on',debugGroup.visible);debugBtn.textContent=debugGroup.visible?'DEBUG ON':'DEBUG'}
debugBtn.addEventListener('click',alternarDebug);
