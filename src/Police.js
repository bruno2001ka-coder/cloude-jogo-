// ===== POLÍCIA: helicóptero patrulha o mapa procurando plantações. Se achar uma e o jogador não estiver
// por perto pra defender, ela é confiscada (perdida) sem confronto. Se o jogador estiver perto, policiais
// descem de rapel e começa a troca de tiro — o jogador atira de volta, e esconder-se num refúgio (algumas
// casas marcadas com marquise vermelha) faz a polícia perder o rastro.
//
// A máquina de estados é EXPLÍCITA (tabela `ESTADOS` + função `transitar`): antes eram seis `else if`
// com as transições espalhadas por dentro dos corpos e nenhum ponto único de entrada/saída — o que já
// tinha custado uma chamada `encerrarEncontro(false)` numa função sem parâmetro e três cópias da rotina
// de limpeza do encontro.
//
//                    planta detectada (raio 10 m) ∧ ¬escondido
//     ┌──────────┐ ──────────────────────────────────────────► ┌────────┐
//     │ PATRULHA │ ◄─────────── cooldown 22 s ───┐              │  INDO  │
//     └──────────┘                                │             └────────┘
//                                            ┌──────────┐            │ d(heli,planta) < 3
//          todos abatidos ∨ escondido 4,5 s  │ RECUANDO │            ▼
//          ∨ jogador rendido ───────────────►└──────────┘        ┌────────┐
//                                                 ▲              │ RAPEL  │ (t = 1,5 s)
//                            ┌────────────────────┴──────┐       └────────┘
//                            │                           │            │
//                       ┌─────────┐   o jogador se aproxima   ┌──────────────┐
//                       │ COMBATE │ ◄────────────────────────  │ CONFISCANDO  │ (t = 9 s → confisca)
//                       └─────────┘                            └──────────────┘
import*as THREE from'three';
import{scene,camera}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{primeiroImpactoNoSegmento,intersectarSegmentoCaixa,buscarPosicaoLivre}from'./Physics.js';
import{encontrarCaminho,visaoHorizontalLivre}from'./NavMesh.js';
import{player,obterBocaDaArma,zonasDeAcertoJogador}from'./Player.js';
import{refugios}from'./WorldGenerator.js';
import{colidePedestre}from'./NPCs.js';
import{plantas,confiscarPlanta,aplicarMulta,inventario,atualizarStatusEconomia}from'./Economy.js';
import{dispararBala,atualizarBalas,limparBalas}from'./Bullets.js';
import{aplicarDano,renderizarVidaJogador,criarBarraMundo}from'./HealthBar.js';
import{droneState}from'./Camera.js';

const HELI_ALTURA=38,HELI_VELOCIDADE=12,MAPA_LIMITE=95;
const DETECCAO_RAIO=10,APROX_RAIO=3;
const RAPEL_DURACAO=1.5,NUM_POLICIAIS=2;
const COMBATE_RAIO_ATIVACAO=16;
const POLICIAL_HP=100,POLICIAL_VELOCIDADE=2,POLICIAL_ALCANCE_TIRO=13,POLICIAL_APROX_MIN=7;
const POLICIAL_DANO_MIN=10,POLICIAL_DANO_MAX=18,POLICIAL_COOLDOWN_MIN=1.1,POLICIAL_COOLDOWN_MAX=2.1;
const REFUGIO_RAIO=3.2,REFUGIO_TEMPO=4.5;
const JOGADOR_HP_MAX=100,JOGADOR_ARMADURA_MAX=100,JOGADOR_REGEN=3;
const TIRO_COOLDOWN=.28,DANO_TIRO_JOGADOR=34,ALCANCE_MIRA=120;
// Janela generosa: com 2,2 s o jogador quase nunca conseguia chegar a tempo e o confronto virava
// confisco silencioso — dava a impressão de que a troca de tiro nem existia no jogo.
const CONFISCO_DURACAO=9,RECUO_DURACAO=2;
const COOLDOWN_ENTRE_BUSCAS=22,MULTA_RENDICAO=60;
const SPAWN_X=0,SPAWN_Z=8;
// Perseguição: intervalo de recálculo do caminho e distância que o alvo precisa andar pra invalidar a rota.
const REPLANEJAR_INTERVALO=.7,REPLANEJAR_DESVIO=3,CHEGADA_WAYPOINT=.7;

// ===== Helicóptero: fuselagem em cápsula, cauda com rotor, rotor principal girando, luzes de alerta piscando.
const heliMat=new THREE.MeshStandardMaterial({color:0x2b3a2e,roughness:.55,metalness:.35});
const heliVidro=new THREE.MeshPhysicalMaterial({color:0x1a2c33,roughness:.15,metalness:.2,clearcoat:.6,emissive:0x1a2c33,emissiveIntensity:.15});
const rotorMat=new THREE.MeshStandardMaterial({color:0x1c1c1c,roughness:.6,metalness:.4});
const lampVermelha=new THREE.MeshStandardMaterial({color:0xff2a2a,emissive:0xff2a2a,emissiveIntensity:1.6});
const lampAzul=new THREE.MeshStandardMaterial({color:0x2a6bff,emissive:0x2a6bff,emissiveIntensity:1.6});
function blocoHeli(geo,mat,x,y,z,parent){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}

const heli=new THREE.Group();scene.add(heli);
const fuselagem=blocoHeli(new THREE.CapsuleGeometry(.85,2.1,4,8),heliMat,0,0,0,heli);fuselagem.rotation.x=Math.PI/2;
blocoHeli(new THREE.SphereGeometry(.68,10,8),heliVidro,0,-.1,1.5,heli);
const caudaBoom=blocoHeli(new THREE.CylinderGeometry(.14,.22,2.6,6),heliMat,0,.15,-2.35,heli);caudaBoom.rotation.x=Math.PI/2;
const rotorCauda=new THREE.Group();rotorCauda.position.set(.28,.35,-3.55);heli.add(rotorCauda);
blocoHeli(new THREE.BoxGeometry(.04,1,.1),rotorMat,0,0,0,rotorCauda);blocoHeli(new THREE.BoxGeometry(.04,1,.1),rotorMat,0,0,0,rotorCauda).rotation.z=Math.PI/2;
const mastro=blocoHeli(new THREE.CylinderGeometry(.08,.1,.35,6),rotorMat,0,.95,0,heli);
const rotorPrincipal=new THREE.Group();rotorPrincipal.position.set(0,1.15,0);heli.add(rotorPrincipal);
for(const ang of[0,Math.PI/2]){const pa=blocoHeli(new THREE.BoxGeometry(5.2,.05,.22),rotorMat,0,0,0,rotorPrincipal);pa.rotation.y=ang}
for(const xx of[-.55,.55])blocoHeli(new THREE.CylinderGeometry(.05,.06,.9,6),heliMat,xx,-.85,.15,heli).rotation.z=.15*Math.sign(-xx);
const luzBarra=new THREE.Group();luzBarra.position.set(0,.62,0);heli.add(luzBarra);
const luzV=blocoHeli(new THREE.BoxGeometry(.22,.1,.22),lampVermelha,-.3,0,0,luzBarra);
const luzA=blocoHeli(new THREE.BoxGeometry(.22,.1,.22),lampAzul,.3,0,0,luzBarra);
const holofoteSpot=new THREE.SpotLight(0xfff2c8,3.2,60,Math.PI*.11,.45,1.4);holofoteSpot.castShadow=false;heli.add(holofoteSpot);
const holofoteAlvo=new THREE.Object3D();scene.add(holofoteAlvo);holofoteSpot.target=holofoteAlvo;
const feixeMat=new THREE.MeshBasicMaterial({color:0xfff2c8,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide});
const feixe=new THREE.Mesh(new THREE.ConeGeometry(1,1,16,1,true),feixeMat);feixe.renderOrder=1;scene.add(feixe);
heli.position.set(0,HELI_ALTURA,0);
let heliAlvo={x:(Math.random()*2-1)*MAPA_LIMITE,z:(Math.random()*2-1)*MAPA_LIMITE};

// ===== Policiais: mesma técnica de bloco do NPC comum, uniforme escuro + boné + "arma" na mão.
const skinPolicial=[0xc79067,0x8a5a3c,0xe0b088,0x6b4a30];
const uniformeMat=new THREE.MeshStandardMaterial({color:0x232c3d,roughness:.7}),
  coleteMat=new THREE.MeshStandardMaterial({color:0x14181f,roughness:.75}),
  boneMat=new THREE.MeshStandardMaterial({color:0x14181f,roughness:.8}),
  armaMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:.4,metalness:.6});
function blocoP(geo,mat,x,y,z,parent){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// ===== ZONAS DE ACERTO DO POLICIAL =====
// Uma AABB única de ±0,35 × 1,8 m trata um tiro no pé igual a um na cabeça — grosseiro demais pra um
// sistema de combate. Faixas verticais em coordenadas locais do corpo, com multiplicador de dano.
// Com HP = 100 e dano-base 34, três tiros no tronco continuam matando (idêntico ao HP = 3 anterior),
// mas dois na cabeça resolvem: nenhuma regressão de sensação, ganho de precisão.
const ZONAS_POLICIAL=[
  {nome:'cabeca',de:1.3,ate:1.78,meia:.26,multiplicador:2},
  {nome:'tronco',de:.62,ate:1.3,meia:.34,multiplicador:1},
  {nome:'pernas',de:0,ate:.62,meia:.22,multiplicador:.6},
];

function criarPolicial(indice){
  const g=new THREE.Group();
  const skinMat=new THREE.MeshStandardMaterial({color:skinPolicial[Math.floor(Math.random()*skinPolicial.length)],roughness:.55});
  blocoP(new THREE.BoxGeometry(.55,.82,.33),uniformeMat,0,.87,0,g);
  blocoP(new THREE.BoxGeometry(.58,.4,.36),coleteMat,0,1.02,0,g);
  blocoP(new THREE.BoxGeometry(.37,.37,.35),skinMat,0,1.48,0,g);
  blocoP(new THREE.BoxGeometry(.4,.14,.38),boneMat,0,1.7,0,g);
  const pernas=[-.14,.14].map(lx=>blocoP(new THREE.BoxGeometry(.13,.55,.16),uniformeMat,lx,.29,0,g));
  const bracos=[-.37,.37].map(lx=>blocoP(new THREE.BoxGeometry(.13,.58,.16),skinMat,lx,.9,0,g));
  const arma=blocoP(new THREE.BoxGeometry(.08,.1,.42),armaMat,.37,.68,.18,g);
  scene.add(g);
  return{
    grupo:g,pernas,bracos,arma,hp:POLICIAL_HP,vivo:true,caindo:false,quedaT:0,
    pos:new THREE.Vector3(),proximoTiro:0,caminhando:0,
    // Perseguição: rota do A*, waypoint atual e o relógio de replanejamento — defasado por policial
    // (i·0,35 s) pra os dois não recalcularem no mesmo frame e dobrarem o custo num pico só.
    rota:null,indiceRota:0,destinoRota:null,proximoReplan:indice*.35,
    // As caixas de acerto são criadas UMA vez e só têm os valores reescritos por frame.
    caixas:ZONAS_POLICIAL.map(()=>new THREE.Box3()),
    barra:criarBarraMundo(2.05,1),
  };
}
// Reescreve as caixas de acerto do policial na posição atual (sem alocar) e devolve a lista.
function zonasDoPolicial(pol){
  const baseY=pol.grupo.position.y;
  return ZONAS_POLICIAL.map((zona,i)=>{
    const caixa=pol.caixas[i];
    caixa.min.set(pol.pos.x-zona.meia,baseY+zona.de,pol.pos.z-zona.meia);
    caixa.max.set(pol.pos.x+zona.meia,baseY+zona.ate,pol.pos.z+zona.meia);
    return{caixa,multiplicador:zona.multiplicador};
  });
}

// ===== Estado da polícia e do jogador =====
const policia={estado:'patrulha',alvoPlanta:null,tempoEstado:0,cooldownAte:0,tempoEscondidoAcumulado:0};
const policiais=[];
const cordas=[];// rope visual durante o rapel
let saudeJogador=JOGADOR_HP_MAX,armaduraJogador=0,jogadorRendido=false;
let proximoTiroJogador=0;

// ===== HUD: vida, alerta, esconderijo, mira de combate, botão de atirar, flash de dano =====
const alertaEl=document.getElementById('alertaPolicia'),
  refugioEl=document.getElementById('refugioIndicador'),miraCombateEl=document.getElementById('miraCombate'),
  fireBtn=document.getElementById('fireBtn'),danoFlash=document.getElementById('danoFlash'),
  avisoPolicia=document.getElementById('avisoPolicia'),municaoEl=document.getElementById('municaoHud');
function atualizarHudSaude(){renderizarVidaJogador(saudeJogador,JOGADOR_HP_MAX,armaduraJogador,JOGADOR_ARMADURA_MAX)}
// A munição também muda por COMPRA (na Economy, que não conhece este módulo). Em vez de acoplar os dois,
// o HUD observa o valor e só redesenha quando ele muda de fato — nada de escrever no DOM por frame.
let municaoHudCache=-1;
function atualizarHudMunicao(){
  if(municaoEl&&inventario.municao!==municaoHudCache){municaoHudCache=inventario.municao;municaoEl.textContent=`🔫 ${inventario.municao}`}
}
function mostrarAviso(texto,ms=2600){avisoPolicia.textContent=texto;avisoPolicia.style.display='block';avisoPolicia.style.opacity='1';clearTimeout(avisoPolicia._t);avisoPolicia._t=setTimeout(()=>{avisoPolicia.style.opacity='0';setTimeout(()=>avisoPolicia.style.display='none',300)},ms)}
function flashDano(){danoFlash.style.opacity='.55';clearTimeout(danoFlash._t);danoFlash._t=setTimeout(()=>danoFlash.style.opacity='0',120)}
atualizarHudSaude();atualizarHudMunicao();

function distXZ(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function jogadorEscondido(){return refugios.some(r=>distXZ(player.position,r)<REFUGIO_RAIO)}

// ===== Dano ao jogador (armadura em série — ver HealthBar.aplicarDano) =====
function receberDanoJogador(dano){
  if(jogadorRendido)return;
  const novo=aplicarDano(saudeJogador,armaduraJogador,dano);
  saudeJogador=novo.saude;armaduraJogador=novo.armadura;
  flashDano();atualizarHudSaude();
  if(saudeJogador<=0)renderJogador();
}
function renderJogador(){
  jogadorRendido=true;
  mostrarAviso('Você foi rendido pela polícia — plantação perdida e multa aplicada.',3400);
  if(policia.alvoPlanta&&!policia.alvoPlanta.colhida)confiscarPlanta(policia.alvoPlanta);
  aplicarMulta(MULTA_RENDICAO);
  transitar('recuando');
  setTimeout(()=>{
    player.position.set(SPAWN_X,obterElevacao(SPAWN_X,SPAWN_Z),SPAWN_Z);
    saudeJogador=JOGADOR_HP_MAX;jogadorRendido=false;atualizarHudSaude();
  },1400);
}
// O colete comprado na loja de armas entra em uso sozinho quando o anterior acaba. É verificado aqui, e
// não na Economy, porque Economy → Police seria dependência circular (Police já importa Economy).
function conferirColete(){
  if(armaduraJogador<=0&&inventario.colete>0){
    inventario.colete--;armaduraJogador=JOGADOR_ARMADURA_MAX;
    atualizarStatusEconomia();atualizarHudSaude();
    mostrarAviso('Colete equipado — a armadura absorve parte do dano.',2200);
  }
}

function limparCordas(){
  for(const c of cordas){scene.remove(c.linha);c.linha.geometry.dispose();c.linha.material.dispose()}
  cordas.length=0;
}

// ===== IA de cada policial em combate =====
// Existe parede entre A e B? Sem isso os policiais atiravam através das casas.
function temLinhaDeVisao(ax,ay,az,bx,by,bz){
  return primeiroImpactoNoSegmento(ax,ay,az,bx,by,bz)===null;
}

// Perseguição híbrida: reta quando a visão horizontal está limpa (custo zero), A* quando não está.
// Sem isso o policial anda contra a quina da casa até o desencravador cuspir ele pra fora.
function alvoDeMovimento(pol,agora){
  const alturaPeito=pol.grupo.position.y+1.1;
  if(visaoHorizontalLivre(pol.pos.x,pol.pos.z,player.position.x,player.position.z,alturaPeito)){
    pol.rota=null;pol.destinoRota=null;
    return{x:player.position.x,z:player.position.z};
  }
  const rotaInvalida=!pol.rota||pol.indiceRota>=pol.rota.length
    ||!pol.destinoRota||distXZ(pol.destinoRota,player.position)>REPLANEJAR_DESVIO;
  if(rotaInvalida||agora>=pol.proximoReplan){
    pol.proximoReplan=agora+REPLANEJAR_INTERVALO;
    if(rotaInvalida){
      const caminho=encontrarCaminho(pol.pos.x,pol.pos.z,player.position.x,player.position.z);
      if(caminho&&caminho.length){pol.rota=caminho;pol.indiceRota=0;pol.destinoRota={x:player.position.x,z:player.position.z}}
      else{pol.rota=null;pol.destinoRota=null}
    }
  }
  if(!pol.rota)return{x:player.position.x,z:player.position.z};// sem rota: tenta a reta, o desencravador cobre
  let wp=pol.rota[pol.indiceRota];
  while(wp&&Math.hypot(wp.x-pol.pos.x,wp.z-pol.pos.z)<CHEGADA_WAYPOINT){wp=pol.rota[++pol.indiceRota]}
  return wp||{x:player.position.x,z:player.position.z};
}

function atualizarPolicialCombate(pol,dt,agora){
  if(!pol.vivo){
    if(pol.caindo){
      pol.quedaT+=dt;pol.grupo.rotation.x=Math.min(Math.PI/2,pol.quedaT*4);
      if(pol.quedaT>1.1)pol.grupo.visible=false;
    }
    pol.barra.mostrar(false);
    return;
  }
  const dist=distXZ(pol.pos,player.position);
  if(dist>POLICIAL_APROX_MIN){
    const alvo=alvoDeMovimento(pol,agora);
    const dx=alvo.x-pol.pos.x,dz=alvo.z-pol.pos.z,d=Math.hypot(dx,dz)||1;
    const vx=dx/d*POLICIAL_VELOCIDADE,vz=dz/d*POLICIAL_VELOCIDADE;
    const nx=pol.pos.x+vx*dt,nz=pol.pos.z+vz*dt;let moveu=false;
    if(!colidePedestre(nx,pol.pos.z)){pol.pos.x=nx;moveu=true}
    if(!colidePedestre(pol.pos.x,nz)){pol.pos.z=nz;moveu=true}
    // Bateu no waypoint sem conseguir andar: a rota envelheceu, força replanejamento no próximo frame.
    if(!moveu){pol.rota=null;pol.destinoRota=null;pol.proximoReplan=0}
    if(moveu){pol.grupo.rotation.y=Math.atan2(vx,vz);pol.caminhando+=dt*7;const balanco=Math.sin(pol.caminhando)*.4;pol.pernas[0].rotation.x=balanco;pol.pernas[1].rotation.x=-balanco}
  }else{pol.grupo.rotation.y=Math.atan2(player.position.x-pol.pos.x,player.position.z-pol.pos.z)}
  // Desencrava se acabou dentro de uma parede.
  if(colidePedestre(pol.pos.x,pol.pos.z)){
    const livre=buscarPosicaoLivre(pol.pos.x,pol.pos.z,colidePedestre);
    if(livre){pol.pos.x=livre.x;pol.pos.z=livre.z;pol.rota=null;pol.destinoRota=null}
  }
  pol.grupo.position.set(pol.pos.x,obterElevacao(pol.pos.x,pol.pos.z),pol.pos.z);
  pol.barra.posicionar(pol.pos.x,pol.grupo.position.y,pol.pos.z);
  pol.barra.mostrar(pol.hp<POLICIAL_HP);
  if(dist<=POLICIAL_ALCANCE_TIRO&&agora>=pol.proximoTiro&&!jogadorEscondido()){
    const ox=pol.pos.x,oy=pol.grupo.position.y+1.15,oz=pol.pos.z;
    const ax=player.position.x,ay=player.position.y+1.1,az=player.position.z;
    // só atira se realmente enxerga o jogador — nada de tiro atravessando casa
    if(temLinhaDeVisao(ox,oy,oz,ax,ay,az)){
      pol.proximoTiro=agora+POLICIAL_COOLDOWN_MIN+Math.random()*(POLICIAL_COOLDOWN_MAX-POLICIAL_COOLDOWN_MIN);
      // erro de pontaria cresce com a distância: a bala sai torta, e é a física dela que decide o acerto
      const espalhamento=THREE.MathUtils.clamp(dist/POLICIAL_ALCANCE_TIRO,.05,1)*.13;
      const dir=new THREE.Vector3(ax-ox,ay-oy,az-oz).normalize();
      dir.x+=(Math.random()*2-1)*espalhamento;
      dir.y+=(Math.random()*2-1)*espalhamento*.5;
      dir.z+=(Math.random()*2-1)*espalhamento;
      dispararBala(new THREE.Vector3(ox,oy,oz),dir,false);
    }
  }
}

// ===== Tiro do jogador =====
// A mira é a do centro da tela (câmera), mas a bala nasce no cano da arma — que fica ~1 m à frente e ao
// lado da câmera. Mirar num ponto FIXO a 60 m como antes tinha dois defeitos: esse ponto pode cair
// dentro/atrás de uma parede, e em alvo próximo o erro de paralaxe chega a atan(0,5/3) ≈ 9,5°, que é
// exatamente a sensação de "errei o que estava na mira".
// Correção: resolver o ponto visado de verdade, pelo mesmo slab test do resto da física.
const _dirCamera=new THREE.Vector3(),_visado=new THREE.Vector3();
function resolverPontoVisado(){
  camera.getWorldDirection(_dirCamera);
  const ox=camera.position.x,oy=camera.position.y,oz=camera.position.z;
  const dx=_dirCamera.x*ALCANCE_MIRA,dy=_dirCamera.y*ALCANCE_MIRA,dz=_dirCamera.z*ALCANCE_MIRA;
  let melhorT=1;
  const parede=primeiroImpactoNoSegmento(ox,oy,oz,ox+dx,oy+dy,oz+dz);
  if(parede)melhorT=parede.t;
  // A mira gruda no CORPO, não na parede atrás dele: se o alvo vier antes, é ele que define o ponto.
  for(const pol of policiais){
    if(!pol.vivo||pol.caindo)continue;
    for(const zona of zonasDoPolicial(pol)){
      const t=intersectarSegmentoCaixa(zona.caixa,ox,oy,oz,dx,dy,dz);
      if(t!==null&&t<melhorT)melhorT=t;
    }
  }
  // Piso de 2 m: com o jogador de nariz na parede, um t minúsculo inverteria a direção da bala.
  const distancia=Math.max(2,melhorT*ALCANCE_MIRA);
  return _visado.set(ox+_dirCamera.x*distancia,oy+_dirCamera.y*distancia,oz+_dirCamera.z*distancia);
}
export function atirar(){
  const agora=performance.now()/1000;
  // No modo drone a câmera não é a do jogador — mirar por ela lançaria a bala de qualquer lugar do mapa.
  if(agora<proximoTiroJogador||jogadorRendido||droneState.ativo)return;
  if(inventario.municao<=0){mostrarAviso('Sem munição — compre na Loja de Armas (nordeste do mapa).',2400);proximoTiroJogador=agora+.9;return}
  proximoTiroJogador=agora+TIRO_COOLDOWN;
  inventario.municao--;atualizarHudMunicao();atualizarStatusEconomia();
  const boca=obterBocaDaArma();
  const visado=resolverPontoVisado();
  dispararBala(boca,visado.clone().sub(boca).normalize(),true);
}

// ===== Alvos das balas, montados UMA VEZ POR FRAME =====
// Antes esta lista era reconstruída por bala E por frame, alocando Box3 + Vector3 novos toda vez: com 6
// balas em voo e 2 policiais dava ~2.160 objetos por segundo direto no coletor de lixo — o padrão exato
// que produz microtravamento no meio do combate.
let alvosJogador=[],alvosPolicia=[];
function montarAlvosDoFrame(){
  alvosJogador.length=0;alvosPolicia.length=0;
  for(const pol of policiais){
    if(!pol.vivo||pol.caindo)continue;
    for(const zona of zonasDoPolicial(pol)){
      alvosJogador.push({caixa:zona.caixa,aoAtingir:()=>atingirPolicial(pol,DANO_TIRO_JOGADOR*zona.multiplicador)});
    }
  }
  if(!jogadorRendido){
    for(const zona of zonasDeAcertoJogador()){
      alvosPolicia.push({caixa:zona.caixa,aoAtingir:()=>receberDanoJogador((POLICIAL_DANO_MIN+Math.random()*(POLICIAL_DANO_MAX-POLICIAL_DANO_MIN))*zona.multiplicador)});
    }
  }
}
function alvosDaBala(deDoJogador){return deDoJogador?alvosJogador:alvosPolicia}

function atingirPolicial(pol,dano){
  if(!pol.vivo)return;
  pol.hp=Math.max(0,pol.hp-dano);
  pol.barra.definir(pol.hp/POLICIAL_HP);
  pol.barra.mostrar(pol.hp>0);
  if(pol.hp<=0){pol.vivo=false;pol.caindo=true;pol.quedaT=0;pol.barra.mostrar(false)}
  if(policiais.every(p=>!p.vivo)){
    mostrarAviso('Você despistou a polícia! A plantação está a salvo.',3000);
    transitar('recuando');
  }
}

// ===== MÁQUINA DE ESTADOS =====
// `aoEntrar` roda uma vez na transição; `aoAtualizar` roda por frame. Toda mudança de estado passa por
// `transitar()` — é o que garante o invariante de que a limpeza do encontro acontece num lugar só.
function transitar(novoEstado){
  if(policia.estado===novoEstado)return;
  policia.estado=novoEstado;policia.tempoEstado=0;
  ESTADOS[novoEstado].aoEntrar?.();
}

const ESTADOS={
  patrulha:{
    aoEntrar(){
      policia.alvoPlanta=null;
      policia.cooldownAte=performance.now()/1000+COOLDOWN_ENTRE_BUSCAS;
      policia.tempoEscondidoAcumulado=0;
      heliAlvo={x:(Math.random()*2-1)*MAPA_LIMITE,z:(Math.random()*2-1)*MAPA_LIMITE};
    },
    aoAtualizar(dt,agora){
      // CAÇA ATIVA: com o heli indo pra pontos aleatórios num mapa de 190 m e raio de detecção de 10 m,
      // a chance de ele topar com a plantação por acaso era mínima — na prática a polícia nunca aparecia.
      // Agora, havendo plantação e o cooldown vencido, ele vai direto atrás dela.
      if(agora>=policia.cooldownAte&&!jogadorEscondido()){
        let maisProxima=null,menorDist=Infinity;
        for(const p of plantas){
          if(p.colhida)continue;
          const d2=distXZ(heli.position,p);
          if(d2<menorDist){menorDist=d2;maisProxima=p}
        }
        if(maisProxima)heliAlvo={x:maisProxima.x,z:maisProxima.z};
      }
      const dx=heliAlvo.x-heli.position.x,dz=heliAlvo.z-heli.position.z,d=Math.hypot(dx,dz);
      if(d<3){heliAlvo={x:(Math.random()*2-1)*MAPA_LIMITE,z:(Math.random()*2-1)*MAPA_LIMITE}}
      else{heli.position.x+=dx/d*HELI_VELOCIDADE*dt;heli.position.z+=dz/d*HELI_VELOCIDADE*dt;heli.rotation.z=THREE.MathUtils.clamp(-dz/d*.35,-.35,.35);heli.rotation.y=Math.atan2(dx,dz)}
      heli.position.y=THREE.MathUtils.lerp(heli.position.y,HELI_ALTURA,dt*2);
      if(agora<policia.cooldownAte||jogadorEscondido())return;
      for(const p of plantas){
        if(!p.colhida&&distXZ(heli.position,p)<DETECCAO_RAIO){
          policia.alvoPlanta=p;
          transitar('indo');
          mostrarAviso('🚁 A polícia achou sua plantação — corre pra defender!',3400);
          return;
        }
      }
    }
  },
  indo:{
    aoAtualizar(dt){
      const alvo=policia.alvoPlanta;
      if(!alvo||alvo.colhida){transitar('recuando');return}
      const dx=alvo.x-heli.position.x,dz=alvo.z-heli.position.z,d=Math.hypot(dx,dz);
      if(d<APROX_RAIO){transitar('rapel');return}
      heli.position.x+=dx/d*HELI_VELOCIDADE*1.3*dt;heli.position.z+=dz/d*HELI_VELOCIDADE*1.3*dt;
      heli.rotation.y=Math.atan2(dx,dz);
    }
  },
  rapel:{
    aoEntrar(){
      const alvo=policia.alvoPlanta;
      for(let i=0;i<NUM_POLICIAIS;i++){
        const pol=criarPolicial(i);
        const ang=(i/NUM_POLICIAIS)*Math.PI*2,raio=2.4;
        // Vector3.set com DOIS argumentos jogava o z no y e deixava z=0: os policiais desciam sempre na
        // faixa z≈0, longe da plantação. É o que fazia a batida parecer que não existia.
        pol.pos.set(alvo.x+Math.cos(ang)*raio,0,alvo.z+Math.sin(ang)*raio);
        pol.grupo.position.set(pol.pos.x,heli.position.y,pol.pos.z);
        policiais.push(pol);
        const corda=new THREE.Line(new THREE.BufferGeometry().setFromPoints([heli.position.clone(),pol.grupo.position.clone()]),new THREE.LineBasicMaterial({color:0x333333}));
        scene.add(corda);cordas.push({linha:corda,pol});
      }
    },
    aoAtualizar(dt){
      policia.tempoEstado+=dt;
      const t=Math.min(1,policia.tempoEstado/RAPEL_DURACAO);
      for(const c of cordas){
        c.pol.grupo.position.y=THREE.MathUtils.lerp(heli.position.y,obterElevacao(c.pol.pos.x,c.pol.pos.z),t);
        c.linha.geometry.setFromPoints([heli.position.clone(),c.pol.grupo.position.clone()]);
      }
      if(t<1)return;
      limparCordas();
      const perto=distXZ(player.position,policia.alvoPlanta)<=COMBATE_RAIO_ATIVACAO&&!jogadorEscondido();
      transitar(perto?'combate':'confiscando');
      if(perto)mostrarAviso('A polícia achou sua plantação — defenda com o botão de atirar!',3200);
    }
  },
  confiscando:{
    aoAtualizar(dt){
      policia.tempoEstado+=dt;
      if(distXZ(player.position,policia.alvoPlanta)<=COMBATE_RAIO_ATIVACAO&&!jogadorEscondido()){
        transitar('combate');mostrarAviso('A polícia te viu — defenda a plantação!',2800);
      }else if(policia.tempoEstado>=CONFISCO_DURACAO){
        if(policia.alvoPlanta&&!policia.alvoPlanta.colhida){confiscarPlanta(policia.alvoPlanta);mostrarAviso('A polícia confiscou sua plantação.',2600)}
        transitar('recuando');
      }
    }
  },
  combate:{
    aoEntrar(){policia.tempoEscondidoAcumulado=0},
    aoAtualizar(dt,agora){
      for(const pol of policiais)atualizarPolicialCombate(pol,dt,agora);
      if(jogadorEscondido()){
        policia.tempoEscondidoAcumulado+=dt;
        if(policia.tempoEscondidoAcumulado>=REFUGIO_TEMPO){
          mostrarAviso('Você se escondeu a tempo — a polícia perdeu o rastro.',2800);
          transitar('recuando');
        }
      }else policia.tempoEscondidoAcumulado=0;
    }
  },
  // Único ponto de limpeza do encontro do jogo inteiro: recolhe corda, policiais e balas.
  recuando:{
    aoEntrar(){limparCordas()},
    aoAtualizar(dt,agora){
      policia.tempoEstado+=dt;
      heli.position.y+=dt*10;heli.position.x+=dt*4;
      for(const pol of policiais){pol.grupo.visible=policia.tempoEstado<RECUO_DURACAO*.4;pol.barra.mostrar(false)}
      if(policia.tempoEstado<RECUO_DURACAO)return;
      for(const pol of policiais){scene.remove(pol.grupo);pol.barra.descartar()}
      policiais.length=0;limparBalas();
      transitar('patrulha');
    }
  },
};

// ===== Atualização principal, chamada a cada frame pelo main.js =====
export function atualizarPolicia(dt){
  const agora=performance.now()/1000;
  // Rotor sempre girando e luzes piscando, em qualquer estado — o helicóptero nunca "desliga".
  rotorPrincipal.rotation.y+=dt*26;rotorCauda.rotation.x+=dt*40;
  const pisca=Math.floor(agora*3)%2===0;luzV.material.emissiveIntensity=pisca?1.6:.1;luzA.material.emissiveIntensity=pisca?.1:1.6;

  ESTADOS[policia.estado].aoAtualizar(dt,agora);

  montarAlvosDoFrame();
  atualizarBalas(dt,alvosDaBala);

  // Holofote sempre mirando o chão logo abaixo do helicóptero, e o feixe cônico acompanhando.
  const chaoAbaixo=obterElevacao(heli.position.x,heli.position.z);
  holofoteAlvo.position.set(heli.position.x,chaoAbaixo,heli.position.z);
  const alturaFeixe=heli.position.y-chaoAbaixo;
  feixe.position.set(heli.position.x,(heli.position.y+chaoAbaixo)/2,heli.position.z);
  feixe.scale.set(alturaFeixe*.32,alturaFeixe,alturaFeixe*.32);

  // Vida regenera devagar fora de combate; HUD de alerta/esconderijo, munição e mira de combate.
  conferirColete();atualizarHudMunicao();
  if(policia.estado==='patrulha'&&saudeJogador<JOGADOR_HP_MAX&&!jogadorRendido){saudeJogador=Math.min(JOGADOR_HP_MAX,saudeJogador+dt*JOGADOR_REGEN);atualizarHudSaude()}
  const emAlerta=policia.estado!=='patrulha';
  alertaEl.style.display=emAlerta?'block':'none';
  refugioEl.style.display=jogadorEscondido()?'block':'none';
  const emCombate=policia.estado==='combate';
  miraCombateEl.style.display=emCombate?'block':'none';
  // O botão aparece quando há munição pra gastar OU polícia em campo: senão o jogador nunca via que
  // existe arma no jogo. Fora do combate ele fica esmaecido, indicando que não há em quem atirar.
  const temArma=inventario.municao>0;
  fireBtn.style.display=(emAlerta||temArma)?'flex':'none';
  fireBtn.style.opacity=emCombate&&temArma?'1':'.45';
}

fireBtn?.addEventListener('pointerdown',e=>{e.preventDefault();atirar()});

export{heli,policiais,policia};
