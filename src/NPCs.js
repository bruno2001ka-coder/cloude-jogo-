// Moradores caminhando pelas vielas do bairro, sem entrar nas casas — seguem 4 corredores fixos, dobrando nos cruzamentos.
import*as THREE from'three';
import{obterElevacao}from'./Terrain.js';
import{colidePedestreXZ,buscarPosicaoLivre}from'./Physics.js';
import{distanciaLivreHorizontal}from'./NavMesh.js';
import{bairro}from'./WorldGenerator.js';

function bloco(geo,material,x,y,z,parent){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// Corpo com a largura REAL da silhueta (braços inclusos). Antes era .28, quase metade do corpo — por isso
// os moradores enterravam ombro e braço dentro da parede ao encostar nela.
export const PEDESTRE_MEIA_LARG=.45,PEDESTRE_MEIA_PROF=.22,PEDESTRE_ALTURA=1.6;
// Alcance do raycast horizontal de antecipação: pouco mais que um passo de 1 s na velocidade máxima.
const LOOKAHEAD=2.2;

// Centro da faixa LIVRE da viela, não o centro da viela: as escadarias ocupam o lado colado na casa,
// então andar pelo meio da viela faria o morador atravessar os degraus.
const CORREDOR_X1=-14.3,CORREDOR_X2=12.1,CORREDOR_Z1=-28.8,CORREDOR_Z2=-12;

export const waypointsVielas=[];
for(const vx of[CORREDOR_X1,CORREDOR_X2])for(let vz=-42;vz<=-4;vz+=6)waypointsVielas.push({x:vx,z:vz});
for(const vz of[CORREDOR_Z1,CORREDOR_Z2])for(let vx=-36;vx<=36;vx+=8)waypointsVielas.push({x:vx,z:vz});
// A "rota" segue as vielas de verdade (anda pela rua até o cruzamento, dobra, continua) em vez de andar
// em linha reta e raspar diagonal pelas casas — as vielas formam uma grade de só 4 corredores fixos.
function corredorDoPonto(p){
  if(!p)return null;
  if(Math.abs(p.x-CORREDOR_X1)<.1)return'x1';
  if(Math.abs(p.x-CORREDOR_X2)<.1)return'x2';
  if(Math.abs(p.z-CORREDOR_Z1)<.1)return'z1';
  if(Math.abs(p.z-CORREDOR_Z2)<.1)return'z2';
  return null;
}
const INTERSECOES={
  'x1,z1':{x:CORREDOR_X1,z:CORREDOR_Z1},'x1,z2':{x:CORREDOR_X1,z:CORREDOR_Z2},
  'x2,z1':{x:CORREDOR_X2,z:CORREDOR_Z1},'x2,z2':{x:CORREDOR_X2,z:CORREDOR_Z2}
};
function pontoIntersecao(a,b){return INTERSECOES[a+','+b]||INTERSECOES[b+','+a]||null}
function construirRota(corredorOrigem,destino){
  const corredorDestino=corredorDoPonto(destino);
  if(!corredorOrigem||!corredorDestino||corredorOrigem===corredorDestino)return[destino];
  if(corredorOrigem[0]!==corredorDestino[0])return[pontoIntersecao(corredorOrigem,corredorDestino),destino];
  const cruzado=corredorOrigem[0]==='x'?'z1':'x1';
  return[pontoIntersecao(corredorOrigem,cruzado),pontoIntersecao(corredorDestino,cruzado),destino];
}
export const npcs=[];const CORES_ROUPA_NPC=[0x8b5a3c,0x3c5a8b,0x8b3c5a,0x5a8b3c,0x6b6b6b,0xb08040,0x4a4a5a,0x7a3c3c];
const CORES_PELE_NPC=[0xc79067,0x8a5a3c,0xe0b088,0x6b4a30];
// Corpo com o mesmo padrão do personagem principal (cabeça, cabelo, rosto, braços, pernas) — não é mais uma caixa simplificada.
function criarNPC(corRoupa,corPele){
  const g=new THREE.Group();bairro.add(g);
  const skinNpc=new THREE.MeshStandardMaterial({color:corPele,roughness:.55}),roupaNpc=new THREE.MeshStandardMaterial({color:corRoupa,roughness:.78}),calcaNpc=new THREE.MeshStandardMaterial({color:0x3a3a34,roughness:.85}),cabeloNpc=new THREE.MeshStandardMaterial({color:0x171712,roughness:.9}),faceNpc=new THREE.MeshStandardMaterial({color:0x171712,roughness:.8});
  const body=bloco(new THREE.BoxGeometry(.55,.82,.33),roupaNpc,0,.87,0,g);
  const head=bloco(new THREE.BoxGeometry(.37,.37,.35),skinNpc,0,1.48,0,g);
  for(const x of[-.07,.07])bloco(new THREE.BoxGeometry(.06,.06,.03),faceNpc,x,1.53,.175,g);
  bloco(new THREE.BoxGeometry(.13,.03,.02),faceNpc,0,1.4,.18,g);
  bloco(new THREE.BoxGeometry(.39,.1,.36),cabeloNpc,0,1.7,0,g);
  const escalaEscolhida=.92+Math.random()*.16;
  const pernas=[-.14,.14].map(lx=>bloco(new THREE.BoxGeometry(.13,.55,.16),calcaNpc,lx,.29,0,g));
  const bracos=[-.37,.37].map(lx=>bloco(new THREE.BoxGeometry(.13,.58,.16),skinNpc,lx,.9,0,g));
  g.scale.setScalar(escalaEscolhida);
  return{grupo:g,pernas,bracos,pos:new THREE.Vector3(),alvo:null,rota:[],corredorAtual:null,velocidade:1.4+Math.random()*.6,caminhando:Math.random()*10};
}
for(let i=0;i<8;i++){const wp=waypointsVielas[Math.floor(Math.random()*waypointsVielas.length)];const npc=criarNPC(CORES_ROUPA_NPC[i%CORES_ROUPA_NPC.length],CORES_PELE_NPC[i%CORES_PELE_NPC.length]);npc.pos.set(wp.x,0,wp.z);npc.corredorAtual=corredorDoPonto(wp);npcs.push(npc)}
function escolherProximoAlvo(npc){
  if(npc.rota.length){npc.alvo=npc.rota.shift();return}
  const destino=waypointsVielas[Math.floor(Math.random()*waypointsVielas.length)];
  npc.rota=construirRota(npc.corredorAtual,destino);
  npc.corredorAtual=corredorDoPonto(destino);
  npc.alvo=npc.rota.shift();
}
// Teste de colisão do corpo do pedestre na altura do chão daquele ponto.
export function colidePedestre(x,z){
  return colidePedestreXZ(x,z,obterElevacao(x,z),PEDESTRE_MEIA_LARG,PEDESTRE_MEIA_PROF,PEDESTRE_ALTURA);
}
export function atualizarNPCs(dt){
  for(const npc of npcs){
    if(!npc.alvo||Math.hypot(npc.alvo.x-npc.pos.x,npc.alvo.z-npc.pos.z)<.5)escolherProximoAlvo(npc);
    const dx=npc.alvo.x-npc.pos.x,dz=npc.alvo.z-npc.pos.z,dist=Math.hypot(dx,dz);
    let moveu=false;
    if(dist>.1){
      // RAYCASTING HORIZONTAL (look-ahead): antes o morador só descobria a parede colidindo com ela e
      // ficava raspando no muro até o desencravador agir. Agora ele "enxerga" à frente na altura do
      // peito e desiste da rota ANTES de encostar, escolhendo outro destino como faria alguém andando.
      const alturaPeito=obterElevacao(npc.pos.x,npc.pos.z)+1.1;
      const livre=distanciaLivreHorizontal(npc.pos.x,npc.pos.z,dx/dist,dz/dist,LOOKAHEAD,alturaPeito);
      if(livre<LOOKAHEAD*.45){
        // Parede à frente: abandona a rota e escolhe outro destino no próximo frame. Só o MOVIMENTO é
        // pulado — o desencravador e a atualização de posição abaixo continuam rodando, senão um morador
        // que já tivesse acabado dentro da parede ficaria fora do alcance de quem o resolve.
        npc.rota=[];npc.alvo=null;
      }else{
        const vx=dx/dist*npc.velocidade,vz=dz/dist*npc.velocidade;
        const nx=npc.pos.x+vx*dt,nz=npc.pos.z+vz*dt;
        if(!colidePedestre(nx,npc.pos.z)){npc.pos.x=nx;moveu=true}
        if(!colidePedestre(npc.pos.x,nz)){npc.pos.z=nz;moveu=true}
        if(moveu)npc.grupo.rotation.y=Math.atan2(vx,vz);else{npc.rota=[];npc.alvo=null}
      }
    }
    // Se por qualquer motivo acabou dentro de uma parede (spawn ruim, empurrão, geometria nova),
    // desencrava em vez de ficar preso pra sempre tentando andar contra o obstáculo.
    if(colidePedestre(npc.pos.x,npc.pos.z)){
      const livre=buscarPosicaoLivre(npc.pos.x,npc.pos.z,colidePedestre);
      if(livre){npc.pos.x=livre.x;npc.pos.z=livre.z;npc.rota=[];npc.alvo=null}
    }
    npc.grupo.position.set(npc.pos.x,obterElevacao(npc.pos.x,npc.pos.z),npc.pos.z);
    if(moveu){npc.caminhando+=dt*7;const balanco=Math.sin(npc.caminhando)*.5;npc.pernas[0].rotation.x=balanco;npc.pernas[1].rotation.x=-balanco;npc.bracos[0].rotation.x=-balanco*.7;npc.bracos[1].rotation.x=balanco*.7}else{npc.pernas[0].rotation.x*=.9;npc.pernas[1].rotation.x*=.9;npc.bracos[0].rotation.x*=.9;npc.bracos[1].rotation.x*=.9}
  }
}
