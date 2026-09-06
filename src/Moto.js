import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{player}from'./Player.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{colideObstaculoXZ}from'./Physics.js';

const moto=new THREE.Group();moto.name='motoJogador';moto.visible=false;scene.add(moto);
let montado=false,modeloCarregado=false,velocidade=0,modelo=null;

// A moto usa uma dinâmica arcade previsível: W acelera, S freia/engata ré e A/D esterçam.
// Os limites são separados para a ré não disparar como se fosse marcha à frente.
const MAX_VEL=11,MAX_RE=3.8,ACELERACAO=14,ACELERACAO_RE=7,FREIO=24,ATRITO=5.5;
const RAIO_MONTAR=4,LIMITE_MUNDO=124;
const ALTURA_COLISAO_MOTO=.80;// a meia-largura e a meia-profundidade saíram: o corpo agora são três discos (ver colideMoto)
const ZONA_MORTA=.12;
const _box=new THREE.Box3(),_size=new THREE.Vector3(),_center=new THREE.Vector3();
const _frente=new THREE.Vector3(),_lado=new THREE.Vector3();

function aviso(txt){const el=document.getElementById('avisoPolicia');if(!el)return;el.textContent=txt;el.style.display='block';el.style.opacity='1';clearTimeout(el._motoT);el._motoT=setTimeout(()=>{el.style.opacity='0';setTimeout(()=>{el.style.display='none'},300)},1800)}
function ajustarModelo(root){
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  _box.setFromObject(root);_box.getSize(_size);const maior=Math.max(_size.x,_size.y,_size.z)||1, TamanhoAlvo=1.35;root.scale.setScalar(TamanhoAlvo/maior);
  _box.setFromObject(root);_box.getCenter(_center);root.position.sub(_center);root.position.y+=_size.y*.5/maior*TamanhoAlvo;
  // ===== DE QUE LADO É A FRENTE DA MOTO (medido, não suposto) =====
  // O comentário que estava aqui dizia "a frente aponta para +X" e girava +90°. As duas coisas
  // estavam erradas, e o efeito era a moto andar DE RABO — o Bruno fotografou.
  //
  // Medido nos vértices do `moto.glb`, por dois caminhos independentes:
  //   · os 10% mais ALTOS da malha (o guidão é o ponto mais alto de uma moto de trilha, e fica na
  //     frente) têm X médio -0,216, contra um centro em +0,003;
  //   · a altura máxima da metade -X é 1,100 e a da metade +X é 0,875.
  // Os dois dizem a mesma coisa: A FRENTE APONTA PARA -X.
  //
  // E a frente DO JOGO é -Z (é a mesma de `_frente` mais abaixo e do resto do Player). Girando Y por
  // θ, o ponto (-1,0,0) vai para (-cos θ · 1, 0, sen θ · 1):
  //   θ = +90°  ->  (0,0,+1) = +Z  = de costas pro rumo. Era isto que estava no arquivo.
  //   θ = -90°  ->  (0,0,-1) = -Z  = certo.
  root.rotation.y=-Math.PI/2;
}
new GLTFLoader().load('assets/moto.glb',gltf=>{
  modelo=gltf.scene;ajustarModelo(modelo);moto.add(modelo);modeloCarregado=true;
  moto.position.set(player.position.x+3,obterElevacao(player.position.x+3,player.position.z+3),player.position.z+3);moto.visible=true;
},undefined,err=>console.warn('Quintal 3D: moto não carregou',err));

function perto(){return Math.hypot(moto.position.x-player.position.x,moto.position.z-player.position.z)<=RAIO_MONTAR}
function limitarEntrada(v){return Math.abs(v)<ZONA_MORTA?0:THREE.MathUtils.clamp(v,-1,1)}
// ===== O CORPO DA MOTO PRECISA GIRAR COM ELA =====
// Era UMA caixa `colideObstaculoXZ(x,z,y,0.34,0.70,...)`. A física do jogo é AABB pura
// (`Physics.js`): essa caixa mede sempre 0,68 m no eixo X e 1,40 m no eixo Z, APONTE A MOTO PRA
// ONDE APONTAR. Com a moto virada pro leste ela tem 1,35 m de comprimento em X contra 0,68 m de
// caixa (o guidão entra na parede) e 0,47 m de largura em Z contra 1,40 m de caixa (93 cm de
// fantasma raspando dos lados).
//
// Medido antes de consertar: na linha do meio das vias e dos 19 becos a caixa fixa NÃO chega a
// trancar a moto (o beco mais apertado tem 2,45 m livres, contra 2,0 m de projeto) — então isto
// não é o que travava. É o corpo estar errado, e aparece como moto que encosta onde não devia.
//
// A solução não é OBB: a física não tem OBB. São TRÊS DISCOS na linha do meio da moto — eixo
// dianteiro, centro e eixo traseiro — cada um testado como uma caixinha quadrada. Quadrado gira
// igual a si mesmo, então o conjunto acompanha o guidão de graça. Custa 3 consultas por eixo em
// vez de 1, e `motocabe.mjs` mediu 0% de pontos bloqueados em toda via e todo beco.
const RAIO_DISCO_MOTO=.30,COMPRIMENTO_MOTO=1.35;
const DISCOS=[-COMPRIMENTO_MOTO/2+RAIO_DISCO_MOTO,0,COMPRIMENTO_MOTO/2-RAIO_DISCO_MOTO];
function colideMoto(x,z,rumo=0){
  const fx=-Math.sin(rumo),fz=-Math.cos(rumo);// mesma frente do jogo: yaw 0 aponta pra -Z
  for(let i=0;i<DISCOS.length;i++){
    const px=x+fx*DISCOS[i],pz=z+fz*DISCOS[i];
    if(colideObstaculoXZ(px,pz,obterElevacao(px,pz)+.03,
                         RAIO_DISCO_MOTO,RAIO_DISCO_MOTO,ALTURA_COLISAO_MOTO))return true;
  }
  return false;
}
function moverComColisao(dx,dz,rumo){
  let x=THREE.MathUtils.clamp(player.position.x+dx,-LIMITE_MUNDO,LIMITE_MUNDO);
  let z=THREE.MathUtils.clamp(player.position.z+dz,-LIMITE_MUNDO,LIMITE_MUNDO);
  // Resolve cada eixo separadamente para a moto conseguir raspar e contornar paredes,
  // em vez de travar completamente quando encosta em um canto.
  if(!colideMoto(x,player.position.z,rumo))player.position.x=x;
  if(!colideMoto(player.position.x,z,rumo))player.position.z=z;
  player.position.y=obterElevacao(player.position.x,player.position.z);
}
function atualizarVelocidade(dt,acelerador){
  if(acelerador>0){
    if(velocidade<0)velocidade=Math.min(0,velocidade+FREIO*dt);
    else velocidade=Math.min(MAX_VEL,velocidade+acelerador*ACELERACAO*dt);
  }else if(acelerador<0){
    if(velocidade>0)velocidade=Math.max(0,velocidade+acelerador*FREIO*dt);
    else velocidade=Math.max(-MAX_RE,velocidade+acelerador*ACELERACAO_RE*dt);
  }else if(Math.abs(velocidade)>0){
    const perda=Math.min(Math.abs(velocidade),ATRITO*dt);velocidade-=Math.sign(velocidade)*perda;
  }
}
export function motoMontada(){return montado}
export function alternarMoto(){
  if(!modeloCarregado){aviso('A moto ainda está carregando.');return}
  if(montado){
    montado=false;velocidade=0;player.visible=true;player.position.y=obterElevacao(player.position.x,player.position.z);moto.visible=true;atualizarBotao();aviso('Você desceu da moto.');return
  }
  if(!perto()){aviso('Chegue perto da moto para montar.');return}
  montado=true;velocidade=0;player.visible=false;moto.visible=true;player.rotation.y=moto.rotation.y;aviso('Moto montada — W acelera, S freia e A/D viram.');atualizarBotao()
}
function atualizarBotao(){const b=document.getElementById('motoBtn');if(b)b.textContent=montado?'DESCER':'MOTO'}
export function atualizarMoto(dt,keys,joyX=0,joyY=0){
  if(!modeloCarregado)return montado;
  if(!montado)return false;

  // ===== O SINAL DO ANALÓGICO, E POR QUE ELE É NEGATIVO =====
  // `Input.js` calcula `joyY=(clientY-centro)/max`, e a coordenada Y da TELA cresce PRA BAIXO.
  // Empurrar o dedo pra FRENTE dá `joyY` NEGATIVO. O andar a pé já sabe disso (`Player.js` soma
  // `joyY` no eixo que aponta pra TRÁS), mas aqui o teclado usava a convenção contrária
  // (`KeyW` = +1 = frente) e o `joyY` entrava cru: uma variável, duas convenções.
  // Medido no jogo antes do conserto: analógico pra frente andava -4,7 m (ré) e pra trás +10,2 m,
  // enquanto o W andava +16,5 m. No celular a moto fazia o contrário do dedo — que é o
  // "a direção dela não tá boa". O `-` abaixo é o conserto, e este comentário existe pra ninguém
  // inverter de novo às cegas: foram quatro commits seguidos tentando adivinhar esse sinal.
  const teclado=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  // Soma em vez de `teclado||joyY`: com o `||`, uma tecla encostada anulava o analógico inteiro.
  const acelerador=limitarEntrada(teclado-joyY);
  const direcao=limitarEntrada((keys.KeyD?1:0)-(keys.KeyA?1:0)+joyX);
  atualizarVelocidade(dt,acelerador);

  const rapidez=Math.min(1,Math.abs(velocidade)/MAX_VEL);
  if(Math.abs(velocidade)>.08&&direcao){
    // A direção fica leve ao manobrar devagar e firme em velocidade, como uma moto arcade;
    // ao dar ré, o sentido do esterço é naturalmente invertido.
    const taxa=1.05+rapidez*1.25;
    // A convenção do jogo usa -Z como frente. Com ela, diminuir o yaw é a curva para a direita.
    player.rotation.y-=direcao*taxa*dt*Math.sign(velocidade);
  }

  // Mesmo eixo usado pelo jogador e pela câmera: yaw zero avança para -Z.
  _frente.set(-Math.sin(player.rotation.y),0,-Math.cos(player.rotation.y));
  const distancia=velocidade*dt;
  // ===== BATEU? MEDE O QUE ANDOU, NÃO O QUE FOI BLOQUEADO =====
  // A primeira versão perguntava "os dois eixos foram bloqueados?" e NUNCA dava verdadeiro. Indo
  // reto contra uma parede no eixo -Z, o passo em X é ZERO — e um passo de zero sempre "cabe", então
  // o eixo X aparecia como livre e a batida nunca era detectada. O teste flagrou: depois de encostar
  // no muro sobravam 9,58 m/s dos 11 possíveis, exatamente como antes do conserto.
  // Comparar o que ela ANDOU com o que ela PEDIU pra andar não tem esse ponto cego, e ainda pega a
  // batida de raspão em qualquer ângulo.
  const antesX=player.position.x,antesZ=player.position.z;
  moverComColisao(_frente.x*distancia,_frente.z*distancia,player.rotation.y);
  const pedido=Math.abs(distancia);
  if(pedido>1e-4){
    const andou=Math.hypot(player.position.x-antesX,player.position.z-antesZ);
    // Perde quase toda a inércia, como bater de verdade. Sobra um resto pra ela não ficar grudada
    // na parede — com zero, um toque de raspão deixaria a moto morta encostada no muro.
    if(andou<pedido*.35)velocidade*=.15;
  }

  moto.position.copy(player.position);moto.position.y+=.02;
  moto.rotation.y=player.rotation.y;
  // Inclinação visual sem alterar a colisão: dá feedback de esterço, mas volta ao centro ao parar.
  const inclinacao=direcao*rapidez*.22;
  moto.rotation.z=THREE.MathUtils.lerp(moto.rotation.z,-inclinacao,1-Math.exp(-10*dt));
  return true;
}
const btn=document.getElementById('motoBtn');btn?.addEventListener('pointerdown',e=>{e.preventDefault();alternarMoto()});
addEventListener('keydown',e=>{if(e.code==='KeyM'&&!e.repeat){e.preventDefault();alternarMoto()}});
atualizarBotao();
