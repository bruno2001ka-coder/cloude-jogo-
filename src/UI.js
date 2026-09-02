// Radar (minimapa estilo GTA) e modo debug visual (wireframes das caixas de colisão).
import*as THREE from'three';
import{scene}from'./core.js';
import{player,jogadorBoxDebugTemp}from'./Player.js';
import{obstaculos,superficiesAndaveis,contarColisores}from'./Physics.js';
import{casasPos,refugios,BAR,BIQUEIRA,clienteLaje}from'./WorldGenerator.js';
import{plantas,lojaPos,receptadorPos,fazendaPos,armasPos}from'./Economy.js';
import{POLOS}from'./Poles.js';
import{npcs}from'./NPCs.js';
import{ALT_CANO,ALT_TORSO}from'./Combate.js';
import{amostrarCelulasBloqueadas}from'./NavMesh.js';
import{heli,policiais,policia,__estadoDeCombate as estadoDeCombate}from'./Police.js';

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
  // Os 4 polos econômicos, cada um na cor declarada em Poles.js e sempre visível (gruda na borda do
  // radar quando fica fora de alcance, tipo waypoint de GTA): sem isso o jogador nunca acharia a
  // Fazenda nem a Loja de Armas, que ficam fora do bairro.
  desenharPontoRadar(lojaPos.x,lojaPos.z,POLOS.sementes.cor,5,true);
  desenharPontoRadar(receptadorPos.x,receptadorPos.z,POLOS.receptador.cor,5,true);
  desenharPontoRadar(fazendaPos.x,fazendaPos.z,POLOS.fazenda.cor,5,true);
  desenharPontoRadar(armasPos.x,armasPos.z,POLOS.armas.cor,5,true);
  for(const r of refugios)desenharPontoRadar(r.x,r.z,'#c23a3a',4,false);
  // A boca e o bar: são pontos do morro, dentro do alcance do radar quase sempre, então não grudam
  // na borda — encher a borda de marcador tira a leitura dos quatro polos, que são os que ficam fora.
  desenharPontoRadar(BIQUEIRA.x,BIQUEIRA.z,'#c86bff',4.5,false);
  desenharPontoRadar(BAR.x,BAR.z,'#ffc14d',4.5,false);
  // O cliente da laje gruda na borda: ele é um prazo, e o jogador precisa saber pra onde correr.
  if(clienteLaje.ativo)desenharPontoRadar(clienteLaje.x,clienteLaje.z,'#63d16a',5.5,true);
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

// ===== MODO DEBUG VISUAL: wireframes das caixas de colisão + malha de navegação =====
// Vermelho = obstáculos sólidos (paredes/muretas/postes, bloqueiam X/Z). Verde = superfícies andáveis (lajes/degraus, só eixo Y). Amarelo = hitbox do jogador.
// Roxo = células BLOQUEADAS da NavMesh em volta do jogador: é o que a polícia enxerga como parede ao
// traçar rota. Sem essa camada, depurar "por que o policial deu a volta por ali" é adivinhação.
const debugGroup=new THREE.Group();debugGroup.visible=false;scene.add(debugGroup);
let debugConstruido=false,navPontos=null;
const navMat=new THREE.PointsMaterial({color:0xb066ff,size:.22,sizeAttenuation:true});
// ===== A CONTA DOS COLISORES, NA TELA =====
// "Tem colisor demais" só vira trabalho quando dá pra ver ONDE eles estão. Cada caixa carrega uma
// categoria desde que é registrada (Physics.js), então o painel mostra a origem, não só o total —
// é o que transformou "363 colisores" em "174 são mureta, e 60 delas estão num telhado onde ninguém
// consegue subir". Ligar e desligar não mexe na física: o debug só DESENHA.
function textoDoPainel(){
  const c=contarColisores();
  const linhas=Object.entries(c.por).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${String(n).padStart(4)}  ${k}`);
  return[`COLISORES: ${c.total}`,'',
    ...linhas,'',
    `${String(c.pedestres).padStart(4)}  degraus (só NPC)`,
    `${String(c.andaveis).padStart(4)}  superfícies andáveis`,
    '',`${String(policiais.length).padStart(4)}  policiais em campo`,
    `${String(npcs.length).padStart(4)}  moradores`,
    ...linhasDeCombate()].join('\n');
}
// ===== DEBUG DA TROCAÇÃO =====
// A troca é um sistema de tempo real com sorteio dentro: olhar o código não diz se um policial está
// mirando, avançando ou escondido. Aqui cada um mostra o papel, a distância, o erro de mira do último
// tiro, se achou cobertura e quanto falta pro próximo disparo — que é o suficiente pra explicar
// qualquer comportamento estranho sem adivinhação.
function linhasDeCombate(){
  const est=estadoDeCombate();
  if(!est.length)return[];
  const l=['','TROCAÇÃO  papel      dist   erro   tiros  cob'];
  for(const p of est)l.push(
    `          ${String(p.papel||'-').padEnd(10)}${String(p.dist).padStart(5)}m`+
    `${String(p.espalhamento.toFixed(3)).padStart(7)}${String(p.tiros).padStart(7)}   ${p.temCobertura?'S':'-'}`);
  return l;
}
function construirDebugColisao(){
  if(debugConstruido)return;debugConstruido=true;
  for(const box of obstaculos)debugGroup.add(new THREE.Box3Helper(box,0xff2222));
  // A superfície andável virou MALHA FUNDIDA (todas as lajes do morro numa geometria só), e a caixa
  // de contorno dela é o bairro inteiro: o debug desenhava uma gaiola verde de 100 m atravessando o
  // céu, que não informa nada e ainda escondia o resto. Malha fundida se desenha em ARAME, que mostra
  // onde cada laje realmente está; malha solta (a laje de refúgio) continua com a caixa.
  for(const surf of superficiesAndaveis){
    const geo=surf.geometry;
    if(geo&&geo.getAttribute('position')?.count>200){
      const arame=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x33ff55,wireframe:true}));
      arame.position.copy(surf.position);arame.quaternion.copy(surf.quaternion);arame.scale.copy(surf.scale);
      debugGroup.add(arame);
    }else debugGroup.add(new THREE.Box3Helper(new THREE.Box3().setFromObject(surf),0x33ff55));
  }
  debugGroup.add(new THREE.Box3Helper(jogadorBoxDebugTemp,0xffee33));
  navPontos=new THREE.Points(new THREE.BufferGeometry(),navMat);navPontos.frustumCulled=false;debugGroup.add(navPontos);
}
// Só amostra as células perto do jogador, só enquanto o debug está ligado e no máximo 4x por segundo:
// a grade inteira tem 214 mil células e reconstruir a nuvem de pontos por frame custaria mais que o jogo.
let proximaAmostraNav=0;
export function atualizarDebugNavMesh(){
  if(!debugGroup.visible||!navPontos)return;
  const agora=performance.now()/1000;
  if(agora<proximaAmostraNav)return;
  proximaAmostraNav=agora+.25;
  // 4x por segundo, não por quadro: o painel é texto e o DOM é caro no celular.
  painelColisores.textContent=textoDoPainel();
  desenharLinhasDeCombate();
  navPontos.geometry.dispose();
  navPontos.geometry=new THREE.BufferGeometry().setFromPoints(amostrarCelulasBloqueadas(player.position.x,player.position.z,20));
}
// Linhas da trocação: uma por policial vivo, do cano dele até para onde ele está mirando. Amarela =
// vendo o jogador; laranja = indo pra última posição conhecida. É o jeito mais direto de ver "ele
// ainda acha que estou ali".
const linhasCombate=new THREE.Group();scene.add(linhasCombate);
const matVendo=new THREE.LineBasicMaterial({color:0xffe17a});
const matRastro=new THREE.LineBasicMaterial({color:0xff8a3a});
function desenharLinhasDeCombate(){
  for(const o of linhasCombate.children)o.geometry.dispose();
  linhasCombate.clear();
  linhasCombate.visible=debugGroup.visible;
  if(!debugGroup.visible)return;
  for(const pol of policiais){
    if(!pol.vivo)continue;
    const a=new THREE.Vector3(pol.pos.x,pol.grupo.position.y+ALT_CANO,pol.pos.z);
    const b=new THREE.Vector3(player.position.x,player.position.y+ALT_TORSO,player.position.z);
    linhasCombate.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),
      pol.viu?matVendo:matRastro));
  }
}
const debugBtn=document.getElementById('debugBtn');
const painelColisores=document.createElement('pre');
painelColisores.style.cssText='position:fixed;left:8px;bottom:8px;margin:0;padding:8px 10px;'+
  'background:rgba(12,14,18,.82);color:#9ff;font:11px/1.35 ui-monospace,monospace;'+
  'border-radius:8px;pointer-events:none;z-index:60;display:none;white-space:pre';
document.body.appendChild(painelColisores);
export function alternarDebug(){
  construirDebugColisao();debugGroup.visible=!debugGroup.visible;
  debugBtn.classList.toggle('on',debugGroup.visible);
  debugBtn.textContent=debugGroup.visible?'DEBUG ON':'DEBUG';
  painelColisores.style.display=debugGroup.visible?'block':'none';
  if(debugGroup.visible)painelColisores.textContent=textoDoPainel();
}
debugBtn.addEventListener('click',alternarDebug);
