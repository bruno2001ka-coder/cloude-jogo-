// Moradores caminhando pelas vielas do bairro, sem entrar nas casas.
import*as THREE from'three';
import{obterElevacao}from'./Terrain.js';
import{colidePedestreXZ,buscarPosicaoLivre}from'./Physics.js';
import{distanciaLivreHorizontal,encontrarCaminho}from'./NavMesh.js';
import{bairro,BECOS}from'./WorldGenerator.js';
import{PLAYER_HEIGHT,player}from'./Player.js';
import{noCelular}from'./core.js';
import{criarHumanoLowPoly}from'./HumanoidLowPoly.js';

// O humanoide cru mede ~1,75 unidade; esta escala o deixa do tamanho do personagem principal.
const ESCALA_NPC=PLAYER_HEIGHT/1.75;
export const PEDESTRE_MEIA_LARG=.45*ESCALA_NPC,PEDESTRE_MEIA_PROF=.22*ESCALA_NPC,PEDESTRE_ALTURA=PLAYER_HEIGHT;
const LOOKAHEAD=2.2;

// Depois da remoção da favela, WorldGenerator mantém BECOS apenas como objeto de compatibilidade.
// NPC e polícia, porém, precisam de uma LISTA real de pontos. Se a favela não fornece essa lista,
// usamos pontos sobre as estradas rurais já existentes, em vez de tentar indexar um objeto e derrubar
// todo o grafo de módulos antes do primeiro frame (HUD aparecia, mundo 3D ficava preto).
const WAYPOINTS_RURAIS_FALLBACK=[
  {x:34,z:72},{x:13,z:85},{x:-18,z:98},{x:-58,z:104},{x:-101,z:94},
  {x:49,z:84},{x:67,z:96},{x:84,z:104},{x:105,z:110},
  {x:31,z:68},{x:50,z:52},{x:73,z:30},{x:99,z:2},{x:118,z:-28}
];
const becosValidos=Array.isArray(BECOS)?BECOS.filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z)):[];
export const waypointsVielas=becosValidos.length?becosValidos:WAYPOINTS_RURAIS_FALLBACK;
function rotaAteDestino(npc,destino){
  const caminho=encontrarCaminho(npc.pos.x,npc.pos.z,destino.x,destino.z);
  return caminho&&caminho.length?caminho:[destino];
}

export const npcs=[];
const CORES_ROUPA_NPC=[0x8b5a3c,0x3c5a8b,0x8b3c5a,0x5a8b3c,0x6b6b6b,0xb08040,0x4a4a5a,0x7a3c3c];
const CORES_PELE_NPC=[0xc79067,0x8a5a3c,0xe0b088,0x6b4a30];
const CORES_CABELO=[0x171712,0x38251b,0x5a3822,0x1f1b19];
const CORES_CALCA=[0x30343b,0x3b342f,0x263744,0x45443d];

function criarNPC(corRoupa,corPele,indice){
  const largura=.92+(indice%4)*.045;
  const visual=criarHumanoLowPoly({
    parent:bairro,
    roupa:corRoupa,
    pele:corPele,
    calca:CORES_CALCA[indice%CORES_CALCA.length],
    cabelo:CORES_CABELO[indice%CORES_CABELO.length],
    sapato:indice%3===0?0x4b382c:0x222427,
    sombras:!noCelular,
    largura,
  });
  const g=visual.grupo;
  // Pequena variacao de altura evita oito clones com a mesma silhueta.
  const escalaEscolhida=ESCALA_NPC*(.92+Math.random()*.16);
  g.scale.setScalar(escalaEscolhida);
  return{grupo:g,pernas:visual.pernas,bracos:visual.bracos,pos:new THREE.Vector3(),alvo:null,rota:[],velocidade:1.4+Math.random()*.6,caminhando:Math.random()*10,acumPerf:Math.random()*.15};
}

for(let i=0;i<3;i++){
  const wp=waypointsVielas[Math.floor(Math.random()*waypointsVielas.length)];
  const npc=criarNPC(CORES_ROUPA_NPC[i%CORES_ROUPA_NPC.length],CORES_PELE_NPC[i%CORES_PELE_NPC.length],i);
  npc.pos.set(wp.x,0,wp.z);npcs.push(npc);
}
function escolherProximoAlvo(npc){
  if(npc.rota.length){npc.alvo=npc.rota.shift();return}
  const destino=waypointsVielas[Math.floor(Math.random()*waypointsVielas.length)];
  npc.rota=rotaAteDestino(npc,destino);
  npc.alvo=npc.rota.shift();
}
export function colidePedestre(x,z){
  return colidePedestreXZ(x,z,obterElevacao(x,z),PEDESTRE_MEIA_LARG,PEDESTRE_MEIA_PROF,PEDESTRE_ALTURA);
}
export function atualizarNPCs(dt){
  for(const npc of npcs){
    let dtNpc=dt;
    if(noCelular){
      const dJog=Math.hypot(player.position.x-npc.pos.x,player.position.z-npc.pos.z);
      npc.grupo.visible=dJog<120;
      const intervalo=dJog>120?.75:dJog>85?.42:dJog>45?.18:0;
      if(intervalo){
        npc.acumPerf+=dt;
        if(npc.acumPerf<intervalo)continue;
        dtNpc=Math.min(npc.acumPerf,.8);npc.acumPerf=0;
      }else npc.acumPerf=0;
    }

    if(!npc.alvo||Math.hypot(npc.alvo.x-npc.pos.x,npc.alvo.z-npc.pos.z)<.5)escolherProximoAlvo(npc);
    const dx=npc.alvo.x-npc.pos.x,dz=npc.alvo.z-npc.pos.z,dist=Math.hypot(dx,dz);
    let moveu=false;
    if(dist>.1){
      const alturaPeito=obterElevacao(npc.pos.x,npc.pos.z)+PLAYER_HEIGHT*.62;
      const livre=distanciaLivreHorizontal(npc.pos.x,npc.pos.z,dx/dist,dz/dist,LOOKAHEAD,alturaPeito);
      if(livre<LOOKAHEAD*.45){
        npc.rota=[];npc.alvo=null;
      }else{
        const vx=dx/dist*npc.velocidade,vz=dz/dist*npc.velocidade;
        const nx=npc.pos.x+vx*dtNpc,nz=npc.pos.z+vz*dtNpc;
        if(!colidePedestre(nx,npc.pos.z)){npc.pos.x=nx;moveu=true}
        if(!colidePedestre(npc.pos.x,nz)){npc.pos.z=nz;moveu=true}
        if(moveu)npc.grupo.rotation.y=Math.atan2(vx,vz);else{npc.rota=[];npc.alvo=null}
      }
    }
    if(colidePedestre(npc.pos.x,npc.pos.z)){
      const livre=buscarPosicaoLivre(npc.pos.x,npc.pos.z,colidePedestre);
      if(livre){npc.pos.x=livre.x;npc.pos.z=livre.z;npc.rota=[];npc.alvo=null}
    }
    npc.grupo.position.set(npc.pos.x,obterElevacao(npc.pos.x,npc.pos.z),npc.pos.z);
    if(moveu){
      npc.caminhando+=dtNpc*7;
      const balanco=Math.sin(npc.caminhando)*.52;
      npc.pernas[0].rotation.x=balanco;npc.pernas[1].rotation.x=-balanco;
      npc.bracos[0].rotation.x=-balanco*.72;npc.bracos[1].rotation.x=balanco*.72;
    }else{
      npc.pernas[0].rotation.x*=.84;npc.pernas[1].rotation.x*=.84;
      npc.bracos[0].rotation.x*=.84;npc.bracos[1].rotation.x*=.84;
    }
  }
}
