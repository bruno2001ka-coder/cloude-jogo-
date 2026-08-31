// ===== POLÍCIA: helicóptero patrulha o mapa procurando plantações. Se achar uma e o jogador não estiver
// por perto pra defender, ela é confiscada (perdida) sem confronto. Se o jogador estiver perto, policiais
// descem de rapel e começa a troca de tiro — o jogador atira de volta, e esconder-se num refúgio (algumas
// casas marcadas com marquise vermelha) faz a polícia perder o rastro.
import*as THREE from'three';
import{scene,camera}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{primeiroImpactoNoSegmento,buscarPosicaoLivre}from'./Physics.js';
import{player,obterBocaDaArma}from'./Player.js';
import{refugios}from'./WorldGenerator.js';
import{colidePedestre,PEDESTRE_MEIA_LARG,PEDESTRE_MEIA_PROF}from'./NPCs.js';
import{plantas,confiscarPlanta,aplicarMulta}from'./Economy.js';
import{dispararBala,atualizarBalas,limparBalas}from'./Bullets.js';

const HELI_ALTURA=38,HELI_VELOCIDADE=12,MAPA_LIMITE=95;
const DETECCAO_RAIO=10,DETECCAO_RAIO_QT=DETECCAO_RAIO*DETECCAO_RAIO,APROX_RAIO=3;
const RAPEL_DURACAO=1.5,NUM_POLICIAIS=2;
const COMBATE_RAIO_ATIVACAO=16,COMBATE_RAIO_QT=COMBATE_RAIO_ATIVACAO*COMBATE_RAIO_ATIVACAO;
const POLICIAL_HP=3,POLICIAL_VELOCIDADE=2,POLICIAL_ALCANCE_TIRO=13,POLICIAL_APROX_MIN=7;
const POLICIAL_DANO_MIN=10,POLICIAL_DAMO_MAX=18,POLICIAL_COOLDOWN_MIN=1.1,POLICIAL_COOLDOWN_MAX=2.1;
const REFUGIO_RAIO=3.2,REFUGIO_TEMPO=4.5;
const JOGADOR_HP_MAX=100,JOGADOR_REGEN=3;
const TIRO_COOLDOWN=.28;
// Janela generosa: com 2,2 s o jogador quase nunca conseguia chegar a tempo e o confronto virava
// confisco silencioso — dava a impressão de que a troca de tiro nem existia no jogo.
const CONFISCO_DURACAO=9,RECUO_DURACAO=2;
const COOLDOWN_ENTRE_BUSCAS=22,MULTA_RENDICAO=60;
const SPAWN_X=0,SPAWN_Z=8;

// Pool de vetores temporários para evitar alocação no game loop
const _tempVec3Pool=[...Array(16)].map(()=>new THREE.Vector3());
let _poolIdx=0;
function getTempVec3(){const v=_tempVec3Pool[_poolIdx++%_tempVec3Pool.length];v.set(0,0,0);return v}

// Cache de distância para evitar Math.hypot repetido
function distXZ(a,b){const dx=a.x-b.x,dz=a.z-b.z;return dx*dx+dz*dz}
const _distXZTemp={x:0,z:0};
function distXZCache(ax,az,bx,bz){const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz}

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
function criarPolicial(){
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
  return{grupo:g,pernas,bracos,arma,hp:POLICIAL_HP,vivo:true,caindo:false,quedaT:0,pos:new THREE.Vector3(),proximoTiro:0,caminhando:0};
}

// ===== Estado da polícia (máquina de estados) e do jogador (vida) =====
const policia={estado:'patrulha',alvoPlanta:null,tempoEstado:0,cooldownAte:0,tempoEscondidoAcumulado:0};
const policiais=[];
const cordas=[];// rope visual durante o rapel
let saudeJogador=JOGADOR_HP_MAX,jogadorRendido=false;
let proximoTiroJogador=0;

// ===== HUD: vida, alerta, esconderijo, mira de combate, botão de atirar, flash de dano =====
const hpEl=document.getElementById('hpJogador'),alertaEl=document.getElementById('alertaPolicia'),
  refugioEl=document.getElementById('refugioIndicador'),miraCombateEl=document.getElementById('miraCombate'),
  fireBtn=document.getElementById('fireBtn'),danoFlash=document.getElementById('danoFlash'),
  avisoPolicia=document.getElementById('avisoPolicia');
function atualizarHudSaude(){hpEl.textContent=`❤️ ${Math.max(0,Math.round(saudeJogador))}`}
function mostrarAviso(texto,ms=2600){avisoPolicia.textContent=texto;avisoPolicia.style.display='block';avisoPolicia.style.opacity='1';clearTimeout(avisoPolicia._t);avisoPolicia._t=setTimeout(()=>{avisoPolicia.style.opacity='0';setTimeout(()=>avisoPolicia.style.display='none',300)},ms)}
function flashDano(){danoFlash.style.opacity='.55';clearTimeout(danoFlash._t);danoFlash._t=setTimeout(()=>danoFlash.style.opacity='0',120)}
atualizarHudSaude();

// distXZ agora usa distância quadrada pra performance (evita Math.hypot no game loop)
// As comparações usam o quadrado do raio também
const REFUGIO_RAIO_QT=REFUGIO_RAIO*REFUGIO_RAIO;
function jogadorEscondido(){return refugios.some(r=>distXZ(player.position,r)<REFUGIO_RAIO_QT)}

// (O efeito de tiro agora é projétil de verdade — ver Bullets.js.)

// ===== Dano ao jogador =====
function receberDanoJogador(dano){
  if(jogadorRendido)return;
  saudeJogador=Math.max(0,saudeJogador-dano);
  flashDano();atualizarHudSaude();
  if(saudeJogador<=0)renderJogador();
}
function renderJogador(){
  jogadorRendido=true;
  mostrarAviso('Você foi rendido pela polícia — plantação perdida e multa aplicada.',3400);
  if(policia.alvoPlanta&&!policia.alvoPlanta.colhida)confiscarPlanta(policia.alvoPlanta);
  aplicarMulta(MULTA_RENDICAO);
  setTimeout(()=>{
    player.position.set(SPAWN_X,obterElevacao(SPAWN_X,SPAWN_Z),SPAWN_Z);
    saudeJogador=JOGADOR_HP_MAX;jogadorRendido=false;atualizarHudSaude();
    encerrarEncontro(false);
  },1400);
}

// ===== Fim do encontro: recolhe policiais/corda, manda o heli embora, volta a patrulhar =====
function encerrarEncontro(){
  policia.estado='recuando';policia.tempoEstado=0;
  for(const c of cordas){scene.remove(c.linha);c.linha.geometry.dispose();c.linha.material.dispose()}
  cordas.length=0;
}

// ===== IA de cada policial em combate: aproxima até uma distância mínima e atira por intervalos =====
// Existe parede entre A e B? Sem isso os policiais atiravam através das casas.
function temLinhaDeVisao(ax,ay,az,bx,by,bz){
  return primeiroImpactoNoSegmento(ax,ay,az,bx,by,bz)===null;
}

function atualizarPolicialCombate(pol,dt){
  if(!pol.vivo)return;
  if(pol.caindo){
    pol.quedaT+=dt;pol.grupo.rotation.x=Math.min(Math.PI/2,pol.quedaT*4);
    if(pol.quedaT>1.1)pol.grupo.visible=false;
    return;
  }
  const distSq=distXZ(pol.pos,player.position);
  if(distSq>POLICIAL_APROX_MIN*POLICIAL_APROX_MIN){
    const dx=player.position.x-pol.pos.x,dz=player.position.z-pol.pos.z,d=Math.sqrt(distSq),vx=dx/d*POLICIAL_VELOCIDADE,vz=dz/d*POLICIAL_VELOCIDADE;
    const nx=pol.pos.x+vx*dt,nz=pol.pos.z+vz*dt;let moveu=false;
    if(!colidePedestre(nx,pol.pos.z)){pol.pos.x=nx;moveu=true}
    if(!colidePedestre(pol.pos.x,nz)){pol.pos.z=nz;moveu=true}
    if(moveu){pol.grupo.rotation.y=Math.atan2(vx,vz);pol.caminhando+=dt*7;const balanco=Math.sin(pol.caminhando)*.4;pol.pernas[0].rotation.x=balanco;pol.pernas[1].rotation.x=-balanco}
  }else{pol.grupo.rotation.y=Math.atan2(player.position.x-pol.pos.x,player.position.z-pol.pos.z)}
  // Desencrava se acabou dentro de uma parede.
  if(colidePedestre(pol.pos.x,pol.pos.z)){
    const livre=buscarPosicaoLivre(pol.pos.x,pol.pos.z,colidePedestre);
    if(livre){pol.pos.x=livre.x;pol.pos.z=livre.z}
  }
  pol.grupo.position.set(pol.pos.x,obterElevacao(pol.pos.x,pol.pos.z),pol.pos.z);
  const agora=performance.now()/1000;
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

// ===== Tiro do jogador: a bala sai do cano da arma e viaja de verdade =====
// A mira continua sendo a da câmera (é o que o jogador vê no centro da tela), mas a bala nasce na arma
// e é a física dela que decide se acerta — inclusive parando na parede se tiver uma no caminho.
export function atirar(){
  const agora=performance.now()/1000;
  if(agora<proximoTiroJogador||policia.estado!=='combate'||jogadorRendido)return;
  proximoTiroJogador=agora+TIRO_COOLDOWN;
  const dirCamera=new THREE.Vector3();camera.getWorldDirection(dirCamera);
  const boca=obterBocaDaArma();
  // ponto visado: bem à frente da câmera; a bala é lançada da arma NA DIREÇÃO desse ponto, senão ela
  // sairia paralela à mira e erraria tudo que estivesse perto.
  const visado=camera.position.clone().addScaledVector(dirCamera,60);
  const dir=visado.sub(boca).normalize();
  dispararBala(boca,dir,true);
}

// Caixas atingíveis por cada lado, consultadas pelas balas a cada frame.
function alvosDaBala(deDoJogador){
  const lista=[];
  if(deDoJogador){
    for(const pol of policiais){
      if(!pol.vivo||pol.caindo)continue;
      lista.push({
        caixa:new THREE.Box3(
          new THREE.Vector3(pol.pos.x-.35,pol.grupo.position.y,pol.pos.z-.35),
          new THREE.Vector3(pol.pos.x+.35,pol.grupo.position.y+1.8,pol.pos.z+.35)),
        aoAtingir:()=>atingirPolicial(pol)
      });
    }
  }else if(!jogadorRendido){
    lista.push({
      caixa:new THREE.Box3(
        new THREE.Vector3(player.position.x-.35,player.position.y,player.position.z-.35),
        new THREE.Vector3(player.position.x+.35,player.position.y+1.5,player.position.z+.35)),
      aoAtingir:()=>receberDanoJogador(POLICIAL_DANO_MIN+Math.random()*(POLICIAL_DANO_MAX-POLICIAL_DANO_MIN))
    });
  }
  return lista;
}

function atingirPolicial(pol){
  if(!pol.vivo)return;
  pol.hp--;
  if(pol.hp<=0){pol.vivo=false;pol.caindo=true;pol.quedaT=0}
  if(policiais.every(p=>!p.vivo)){
    mostrarAviso('Você despistou a polícia! A plantação está a salvo.',3000);
    encerrarEncontro();
  }
}

// ===== Atualização principal, chamada a cada frame pelo main.js =====
export function atualizarPolicia(dt){
  const agora=performance.now()/1000;
  // Rotor sempre girando e luzes piscando, em qualquer estado — o helicóptero nunca "desliga".
  rotorPrincipal.rotation.y+=dt*26;rotorCauda.rotation.x+=dt*40;
  const pisca=Math.floor(agora*3)%2===0;luzV.material.emissiveIntensity=pisca?1.6:.1;luzA.material.emissiveIntensity=pisca?.1:1.6;

  if(policia.estado==='patrulha'){
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
      if(maisProxima){heliAlvo={x:maisProxima.x,z:maisProxima.z}}
    }
    const dx=heliAlvo.x-heli.position.x,dz=heliAlvo.z-heli.position.z,dSq=dx*dx+dz*dz;
    if(dSq<9){heliAlvo={x:(Math.random()*2-1)*MAPA_LIMITE,z:(Math.random()*2-1)*MAPA_LIMITE}}
    else{const d=Math.sqrt(dSq);heli.position.x+=dx/d*HELI_VELOCIDADE*dt;heli.position.z+=dz/d*HELI_VELOCIDADE*dt;heli.rotation.z=THREE.MathUtils.clamp(-dz/d*.35,-.35,.35);heli.rotation.y=Math.atan2(dx,dz)}
    heli.position.y=THREE.MathUtils.lerp(heli.position.y,HELI_ALTURA,dt*2);
    if(agora>=policia.cooldownAte){
      let alvoEncontrado=null;
      for(const p of plantas){if(!p.colhida&&distXZ(heli.position,p)<DETECCAO_RAIO_QT){alvoEncontrado=p;break}}
      if(alvoEncontrado&&!jogadorEscondido()){
        policia.estado='indo';policia.alvoPlanta=alvoEncontrado;
        mostrarAviso('🚁 A polícia achou sua plantação — corre pra defender!',3400);
      }
    }
  }else if(policia.estado==='indo'){
    const alvo=policia.alvoPlanta;
    const dx=alvo.x-heli.position.x,dz=alvo.z-heli.position.z,dSq=dx*dx+dz*dz;
    if(dSq<APROX_RAIO*APROX_RAIO){
      policia.estado='rapel';policia.tempoEstado=0;
      for(let i=0;i<NUM_POLICIAIS;i++){
        const pol=criarPolicial();
        const ang=(i/NUM_POLICIAIS)*Math.PI*2,raio=2.4;
        // Vector3.set com DOIS argumentos jogava o z no y e deixava z=0: os policiais desciam sempre na
        // faixa z≈0, longe da plantação. É o que fazia a batida parecer que não existia.
        pol.pos.set(alvo.x+Math.cos(ang)*raio,0,alvo.z+Math.sin(ang)*raio);
        pol.grupo.position.set(pol.pos.x,heli.position.y,pol.pos.z);
        policiais.push(pol);
        const corda=new THREE.Line(new THREE.BufferGeometry().setFromPoints([heli.position.clone(),pol.grupo.position.clone()]),new THREE.LineBasicMaterial({color:0x333333}));
        scene.add(corda);cordas.push({linha:corda,pol});
      }
    }else{const d=Math.sqrt(dSq);heli.position.x+=dx/d*HELI_VELOCIDADE*1.3*dt;heli.position.z+=dz/d*HELI_VELOCIDADE*1.3*dt;heli.rotation.y=Math.atan2(dx,dz)}
  }else if(policia.estado==='rapel'){
    policia.tempoEstado+=dt;
    const t=Math.min(1,policia.tempoEstado/RAPEL_DURACAO);
    for(const c of cordas){
      const yAtual=THREE.MathUtils.lerp(heli.position.y,obterElevacao(c.pol.pos.x,c.pol.pos.z),t);
      c.pol.grupo.position.y=yAtual;
      c.linha.geometry.setFromPoints([heli.position.clone(),c.pol.grupo.position.clone()]);
    }
    if(t>=1){
      for(const c of cordas){scene.remove(c.linha);c.linha.geometry.dispose();c.linha.material.dispose()}
      cordas.length=0;
      const perto=distXZ(player.position,policia.alvoPlanta)<=COMBATE_RAIO_QT&&!jogadorEscondido();
      policia.estado=perto?'combate':'confiscando';policia.tempoEstado=0;
      if(policia.estado==='combate')mostrarAviso('A polícia achou sua plantação — defenda com o botão de atirar!',3200);
    }
  }else if(policia.estado==='confiscando'){
    policia.tempoEstado+=dt;
    if(distXZ(player.position,policia.alvoPlanta)<=COMBATE_RAIO_QT&&!jogadorEscondido()){
      policia.estado='combate';mostrarAviso('A polícia te viu — defenda a plantação!',2800);
    }else if(policia.tempoEstado>=CONFISCO_DURACAO){
      if(policia.alvoPlanta&&!policia.alvoPlanta.colhida){confiscarPlanta(policia.alvoPlanta);mostrarAviso('A polícia confiscou sua plantação.',2600)}
      encerrarEncontro();
    }
  }else if(policia.estado==='combate'){
    for(const pol of policiais)atualizarPolicialCombate(pol,dt);
    if(jogadorEscondido()){
      policia.tempoEscondidoAcumulado+=dt;
      if(policia.tempoEscondidoAcumulado>=REFUGIO_TEMPO){
        mostrarAviso('Você se escondeu a tempo — a polícia perdeu o rastro.',2800);
        encerrarEncontro();
      }
    }else policia.tempoEscondidoAcumulado=0;
  }else if(policia.estado==='recuando'){
    policia.tempoEstado+=dt;
    heli.position.y+=dt*10;heli.position.x+=dt*4;
    for(const pol of policiais)pol.grupo.visible=policia.tempoEstado<RECUO_DURACAO*.4;
    if(policia.tempoEstado>=RECUO_DURACAO){
      for(const pol of policiais)scene.remove(pol.grupo);
      policiais.length=0;limparBalas();
      policia.estado='patrulha';policia.alvoPlanta=null;policia.cooldownAte=agora+COOLDOWN_ENTRE_BUSCAS;
      heliAlvo={x:(Math.random()*2-1)*MAPA_LIMITE,z:(Math.random()*2-1)*MAPA_LIMITE};
    }
  }

  atualizarBalas(dt,alvosDaBala);

  // Holofote sempre mirando o chão logo abaixo do helicóptero, e o feixe cônico acompanhando.
  const chaoAbaixo=obterElevacao(heli.position.x,heli.position.z);
  holofoteAlvo.position.set(heli.position.x,chaoAbaixo,heli.position.z);
  const alturaFeixe=heli.position.y-chaoAbaixo;
  feixe.position.set(heli.position.x,(heli.position.y+chaoAbaixo)/2,heli.position.z);
  feixe.scale.set(alturaFeixe*.32,alturaFeixe,alturaFeixe*.32);

  // Vida regenera devagar fora de combate; HUD de alerta/esconderijo e mira de combate.
  if(policia.estado==='patrulha'&&saudeJogador<JOGADOR_HP_MAX&&!jogadorRendido){saudeJogador=Math.min(JOGADOR_HP_MAX,saudeJogador+dt*JOGADOR_REGEN);atualizarHudSaude()}
  const emAlerta=policia.estado!=='patrulha';
  alertaEl.style.display=emAlerta?'block':'none';
  const escondido=jogadorEscondido();
  refugioEl.style.display=escondido?'block':'none';
  const emCombate=policia.estado==='combate';
  miraCombateEl.style.display=emCombate?'block':'none';
  // O botão aparece assim que há polícia em campo (não só no combate): senão o jogador nunca via que
  // existe arma no jogo. Fora do combate ele fica esmaecido, indicando que ainda não há em quem atirar.
  fireBtn.style.display=emAlerta?'flex':'none';
  fireBtn.style.opacity=emCombate?'1':'.45';
}

fireBtn?.addEventListener('pointerdown',e=>{e.preventDefault();atirar()});

export{heli,policiais,policia};
