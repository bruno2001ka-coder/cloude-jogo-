// ===== ARSENAL: catálogo das 4 armas, as malhas na mão e qual está equipada =====
// Este módulo importa SÓ three, Player e Poles. Importar Economy fecharia o ciclo
// Economy → Weapons → Economy, que em ESM não dá erro de resolução: dá
// "ReferenceError: Cannot access 'inventario' before initialization" no meio da avaliação do módulo,
// com stack apontando pro lugar errado. Por isso a divisão de donos é:
//   Weapons  → o catálogo, as malhas e qual arma está EQUIPADA
//   Economy  → quais armas o jogador POSSUI e quanta munição tem de cada
//   Police   → junta os dois na hora de atirar e de trocar
import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{maoDireita}from'./Player.js';
import{PRECOS}from'./Poles.js';

export const armaMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:.4,metalness:.6});
export const armaMadeira=new THREE.MeshStandardMaterial({color:0x4a3327,roughness:.75});

// Ordem do ciclo do botão de troca e da listagem na loja.
export const ORDEM_ARMAS=['pistola','rifle','escopeta','metralhadora'];

function peca(geo,mat,x,y,z,rx,g){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(rx)m.rotation.x=rx;m.castShadow=true;g.add(m);return m}
// Todas as armas nascem na ORIGEM da âncora da mão. O deslocamento até o ponto de pegada mora no
// Player, junto da âncora: quando o boneco 3D entra, a âncora muda de pai (vai pro osso da mão) e o
// deslocamento certo passa a ser outro — se ele estivesse aqui, a arma ficaria boiando fora da mão.
function novoGrupo(){const g=new THREE.Group();maoDireita.add(g);return g}

function construirPistola(){
  const g=novoGrupo();
  peca(new THREE.BoxGeometry(.1,.13,.34),armaMat,0,0,.05,0,g);
  peca(new THREE.CylinderGeometry(.028,.028,.3,6),armaMat,0,.03,.32,Math.PI/2,g);
  peca(new THREE.BoxGeometry(.085,.17,.1),armaMadeira,0,-.12,-.04,-.22,g);
  peca(new THREE.BoxGeometry(.02,.035,.02),armaMat,0,.1,.2,0,g);
  return g;
}
function construirRifle(){
  const g=novoGrupo();
  // Fallback imediato: o tiro e a âncora da mão funcionam mesmo antes do GLB terminar de baixar.
  peca(new THREE.BoxGeometry(.1,.14,.7),armaMat,0,0,.2,0,g);
  peca(new THREE.CylinderGeometry(.024,.024,.62,6),armaMat,0,.05,.75,Math.PI/2,g);
  peca(new THREE.BoxGeometry(.085,.1,.26),armaMadeira,0,-.01,.5,0,g);
  peca(new THREE.BoxGeometry(.09,.16,.3),armaMadeira,0,-.06,-.28,.1,g);
  peca(new THREE.BoxGeometry(.06,.2,.09),armaMat,0,-.15,.12,.16,g);
  peca(new THREE.BoxGeometry(.02,.055,.02),armaMat,0,.13,.36,0,g);
  peca(new THREE.BoxGeometry(.02,.04,.02),armaMat,0,.12,.98,0,g);
  new GLTFLoader().load('assets/riflekar89.glb',gltf=>{
    const modelo=gltf.scene;
    for(const filho of [...g.children]){g.remove(filho);filho.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.()})}
    modelo.rotation.y=-Math.PI/2;// o GLB está longitudinal no eixo X; o jogo aponta as armas no +Z
    modelo.scale.setScalar(.65);// comprimento final próximo ao rifle procedural que ele substitui
    modelo.position.set(0,-.13,.18);// centraliza altura e mantém a empunhadura próxima à mão
    modelo.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
    g.add(modelo);
    console.info('Quintal 3D: riflekar89.glb carregado.');
  },undefined,err=>console.warn('Quintal 3D: riflekar89.glb não carregou; mantendo o fallback.',err));
  return g;
}
function construirEscopeta(){
  const g=novoGrupo();
  peca(new THREE.BoxGeometry(.15,.15,.34),armaMat,0,0,.14,0,g);
  // Cano DUPLO: é o par que faz a silhueta ler como escopeta de longe.
  for(const lx of[-.038,.038])peca(new THREE.CylinderGeometry(.036,.036,.62,6),armaMat,lx,.05,.62,Math.PI/2,g);
  peca(new THREE.BoxGeometry(.13,.1,.18),armaMadeira,0,-.03,.44,0,g);
  peca(new THREE.BoxGeometry(.1,.17,.28),armaMadeira,0,-.07,-.24,.13,g);
  return g;
}
function construirMetralhadora(){
  const g=novoGrupo();
  peca(new THREE.BoxGeometry(.11,.15,.56),armaMat,0,0,.14,0,g);
  peca(new THREE.CylinderGeometry(.022,.022,.4,6),armaMat,0,.045,.6,Math.PI/2,g);
  // Pente curvo: a peça que identifica a arma à distância.
  peca(new THREE.BoxGeometry(.055,.28,.1),armaMat,0,-.22,.06,.28,g);
  peca(new THREE.BoxGeometry(.08,.15,.09),armaMadeira,0,-.13,-.06,-.2,g);
  peca(new THREE.CylinderGeometry(.02,.02,.26,6),armaMat,0,-.02,-.26,Math.PI/2,g);
  peca(new THREE.BoxGeometry(.02,.04,.02),armaMat,0,.11,.3,0,g);
  return g;
}

// Ficha de cada arma. `dano`/`cooldown` calibrados contra policial de 100 HP com zonas ×2/×1/×0,6:
// a pistola (3 tiros de tronco, 121 DPS) é a linha de base e não mudou — quem já jogava não sente
// regressão. `alcance` alimenta só o raycast de mira; a bala física morre pelo tempo de vida dela.
// `gasto` existe pra escopeta queimar 1 CARTUCHO e soltar 6 chumbos sem espalhar essa regra no atirar().
export const ARMAS={
  pistola:{id:'pistola',nome:'Pistola',som:'pistola',icone:'🔫',dano:34,cooldown:.28,alcance:120,projeteis:1,dispersao:0,gasto:1,
    boca:new THREE.Vector3(0,.03,.48),grupo:construirPistola(),preco:PRECOS.armas.pistola},
  rifle:{id:'rifle',nome:'Rifle',som:'rifle',icone:'🎯',dano:50,cooldown:.45,alcance:160,projeteis:1,dispersao:.5,gasto:1,
    boca:new THREE.Vector3(0,.05,.88),grupo:construirRifle(),preco:PRECOS.armas.rifle},
  escopeta:{id:'escopeta',nome:'Escopeta',som:'escopeta',icone:'💥',dano:14,cooldown:.85,alcance:40,projeteis:6,dispersao:5,gasto:1,
    boca:new THREE.Vector3(0,.05,.94),grupo:construirEscopeta(),preco:PRECOS.armas.escopeta},
  metralhadora:{id:'metralhadora',nome:'Metralhadora',som:'metralhadora',icone:'⚡',dano:20,cooldown:.11,alcance:90,projeteis:1,dispersao:2.2,gasto:1,
    boca:new THREE.Vector3(0,.045,.8),grupo:construirMetralhadora(),preco:PRECOS.armas.metralhadora},
};

// Estado interno, exposto por getter e não como `export let`: live-binding de `let` exportado engana
// quem faz import (parece cópia, é referência viva) — o getter explícito não tem essa armadilha.
let idEquipado='pistola';
export function idArmaEquipada(){return idEquipado}
export function armaEquipada(){return ARMAS[idEquipado]}
// A arma pode permanecer presa à mão como parte do visual sem estar empunhada para uma abordagem.
// O estado é controlado pelo gatilho/mira do jogador e lido pela IA como crime visível.
let empunhadaParaAbordagem=false;
export function hasWeaponEquipped(){return empunhadaParaAbordagem}
export function definirArmaEmpunhada(v){empunhadaParaAbordagem=!!v}
// Troca só alterna `.visible`: as 4 malhas já existem desde o início. Three pula objeto invisível
// inclusive na passada de sombra, então as 3 guardadas custam zero — e nada de alocar geometria em
// pleno combate, que é o que gera microtravamento.
export function equiparArma(id){
  if(!ARMAS[id])return ARMAS[idEquipado];
  idEquipado=id;
  for(const k of ORDEM_ARMAS)ARMAS[k].grupo.visible=(k===id);
  return ARMAS[id];
}
equiparArma('pistola');

// Ponta do cano DA ARMA ATUAL, em coordenadas de mundo — é daqui que a bala nasce.
const _ponta=new THREE.Vector3();
export function obterBocaDaArma(){
  const a=ARMAS[idEquipado];
  a.grupo.updateWorldMatrix(true,false);
  return _ponta.copy(a.boca).applyMatrix4(a.grupo.matrixWorld).clone();
}

// Cone de dispersão (chumbo da escopeta, tremor da metralhadora).
// Somar ruído componente a componente enviesa o cone conforme a direção aponta pra um eixo; a base
// ortonormal abaixo dá um disco redondo de verdade em qualquer direção de mira.
const _eA=new THREE.Vector3(),_eB=new THREE.Vector3(),_arb=new THREE.Vector3();
export function direcaoComDispersao(dir,grausMax,out){
  if(grausMax<=0)return out.copy(dir);
  // O vetor arbitrário TEM que trocar de eixo na mira quase vertical: com dir≈(0,±1,0) o produto
  // vetorial com (0,1,0) dá zero e o cone colapsa numa linha — atirar pro céu viraria tiro único.
  _arb.set(0,1,0);if(Math.abs(dir.y)>.9)_arb.set(1,0,0);
  _eA.crossVectors(dir,_arb).normalize();_eB.crossVectors(dir,_eA).normalize();
  // sqrt(u) espalha uniforme na ÁREA do disco; sem ele os chumbos se amontoam no centro.
  const raio=Math.tan(grausMax*Math.PI/180)*Math.sqrt(Math.random()),fi=Math.random()*Math.PI*2;
  return out.copy(dir).addScaledVector(_eA,Math.cos(fi)*raio).addScaledVector(_eB,Math.sin(fi)*raio).normalize();
}

export function aplicarRecuoArma(){const g=ARMAS[idEquipado].grupo;g.userData.recuo=Math.min(.16,(g.userData.recuo||0)+.075)}
export function atualizarRecuoArmas(dt){for(const id of ORDEM_ARMAS){const g=ARMAS[id].grupo;const base=g.userData.baseZ??(g.userData.baseZ=g.position.z);g.userData.recuo=Math.max(0,(g.userData.recuo||0)-dt*1.8);g.position.z=base-(g.userData.recuo||0)}}
