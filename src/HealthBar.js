// ===== SISTEMA DE BARRA DE VIDA: cálculo e renderização =====
// Duas superfícies distintas, de propósito:
//  · Jogador  → DOM (barra no HUD). Custo zero de GPU, texto legível em qualquer resolução.
//  · Policial → mundo (Sprite com CanvasTexture acima da cabeça), pra o jogador ler o dano que causou.
//
// O canvas do sprite é redesenhado SÓ QUANDO O HP MUDA. Redesenhar por frame significaria um upload de
// textura por frame por policial — é a diferença entre ~2 uploads por combate e 120 por segundo.
import*as THREE from'three';
import{scene}from'./core.js';

// ===== CÁLCULO: dano com armadura em série (absorção parcial) =====
// absorvido = min(armadura, dano · FATOR); armadura -= absorvido; saúde -= (dano − absorvido).
// Com FATOR = 0,6 a armadura estende a vida efetiva em 1/(1−0,6) = 2,5× enquanto dura, sem tornar o
// jogador imortal. Retorna o estado novo, sem efeito colateral — fácil de testar e de reusar.
export const FATOR_ABSORCAO=.6;
export function aplicarDano(saude,armadura,dano){
  const absorvido=Math.min(armadura,dano*FATOR_ABSORCAO);
  return{saude:Math.max(0,saude-(dano-absorvido)),armadura:Math.max(0,armadura-absorvido)};
}
// Matiz contínua verde(120°) → amarelo(60°) → vermelho(0°) proporcional à fração de vida.
export function corDaVida(fracao){return`hsl(${Math.round(120*THREE.MathUtils.clamp(fracao,0,1))},72%,46%)`}

// ===== RENDERIZAÇÃO DO JOGADOR (DOM) =====
const barraVidaEl=document.getElementById('barraVida'),barraArmaduraEl=document.getElementById('barraArmadura'),
  textoVidaEl=document.getElementById('textoVida');
export function renderizarVidaJogador(saude,saudeMax,armadura,armaduraMax){
  const fracao=THREE.MathUtils.clamp(saude/saudeMax,0,1);
  barraVidaEl.style.width=(fracao*100).toFixed(1)+'%';
  barraVidaEl.style.background=corDaVida(fracao);
  const fracaoArmadura=armaduraMax>0?THREE.MathUtils.clamp(armadura/armaduraMax,0,1):0;
  barraArmaduraEl.style.width=(fracaoArmadura*100).toFixed(1)+'%';
  barraArmaduraEl.style.opacity=fracaoArmadura>0?'1':'0';
  textoVidaEl.textContent=armadura>0
    ?`${Math.max(0,Math.round(saude))} ❤ · ${Math.round(armadura)} 🛡`
    :`${Math.max(0,Math.round(saude))} ❤`;
}

// ===== RENDERIZAÇÃO EM MUNDO (sprite acima da cabeça) =====
const LARGURA_TEX=96,ALTURA_TEX=16;
function desenharCanvas(cv,fracao){
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,LARGURA_TEX,ALTURA_TEX);
  ctx.fillStyle='rgba(8,10,8,.82)';ctx.fillRect(0,0,LARGURA_TEX,ALTURA_TEX);
  ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(0,0,LARGURA_TEX,1);
  const largura=Math.max(0,Math.round((LARGURA_TEX-4)*THREE.MathUtils.clamp(fracao,0,1)));
  ctx.fillStyle=corDaVida(fracao);
  ctx.fillRect(2,2,largura,ALTURA_TEX-4);
}
// Barra de um alvo do mundo. `criar` devolve um objeto com `definir(fracao)` e `descartar()`.
export function criarBarraMundo(alturaAcima=2.05,escala=1){
  const cv=document.createElement('canvas');cv.width=LARGURA_TEX;cv.height=ALTURA_TEX;
  desenharCanvas(cv,1);
  const textura=new THREE.CanvasTexture(cv);textura.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:textura,transparent:true,depthTest:false,depthWrite:false,fog:false});
  const sprite=new THREE.Sprite(material);
  sprite.scale.set(.9*escala,.15*escala,1);
  sprite.renderOrder=3;sprite.visible=false;
  scene.add(sprite);
  let ultimaFracao=1;
  return{
    sprite,
    // Só reenvia a textura pra GPU quando a fração muda de verdade (tolerância de 0,5%).
    definir(fracao){
      if(Math.abs(fracao-ultimaFracao)<.005)return;
      ultimaFracao=fracao;desenharCanvas(cv,fracao);textura.needsUpdate=true;
    },
    posicionar(x,y,z){sprite.position.set(x,y+alturaAcima,z)},
    mostrar(v){sprite.visible=v},
    descartar(){scene.remove(sprite);textura.dispose();material.dispose()}
  };
}
