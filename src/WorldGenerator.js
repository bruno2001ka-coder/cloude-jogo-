// Geração do bairro: casas/sobrados, escadarias de viela, postes/fios, árvores, mercado, fazenda e animais.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,superficiesAndaveis,obstaculos}from'./Physics.js';
import{bmat,tijolo,concreto,janela,janelaAcesa,molduraJanela,porta,agua,posteMat,folhaMat,folhaClara,criarSombraContato}from'./Materials.js';
import{POLOS}from'./Poles.js';
// O degrau da escadaria é derivado do step-up do jogador: um número solto aqui viraria escada
// intransponível na primeira vez que a altura do personagem mudasse.
import{ALTURA_DEGRAU}from'./Player.js';

export const bairro=new THREE.Group();scene.add(bairro);
const coresBairro=[0xb5651d,0x8b4513,0xc77845,0x9b8068,0x6f7773,0xd09a58,0x7d5c46];
// Largura da escadaria e a margem de encaixe na parede — compartilhadas entre a escadaria e a mureta da
// casa (ver casaBairro) pra garantir que a mureta sempre cubra o vão da escadaria, sem depender de dois
// números iguais mantidos em lugares separados.
const ESCADA_LARGURA=1,ESCADA_MARGEM=.03;

function bloco(geo,material,x,y,z,parent=bairro){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// ===== ESCADARIA DE VIELA =====
// Escada exterior colada na parede lateral (eixo X local da casa), filha do grupo da casa.
// lado=+1 encosta no lado +X local, lado=-1 no lado -X local; a subida acompanha o eixo Z local.
//
// Cada degrau é UM bloco maciço, do subsolo até o próprio piso, e é registrado como obstáculo de
// verdade. Isso só é possível porque o jogador tem step-up (ver ALTURA_DEGRAU em Player.js): sem
// ele, uma AABB pura barraria o jogador no primeiro degrau, que é exatamente por que a versão
// anterior deixava a escada inteira SEM colisor — e aí dava pra atravessar tudo.
//
// Três defeitos da versão anterior, todos corrigidos aqui:
//   · degrau cujo topo caísse abaixo do terreno era PULADO (`continue`) — o buraco no meio da escada;
//   · os "corrimãos" iam do subsolo até acima do telhado, ou seja, eram dois muros fechando a escada;
//   · nenhum degrau entrava em `obstaculos`, então nada tinha colisão pro jogador.
function criarEscadariaViela(casaGrupo,alturaTotal,w=6,d=4.8,lado=1){
  const largura=ESCADA_LARGURA,prof=.17;
  // O degrau é dimensionado a 65% do que o jogador consegue subir. A folga não é preciosismo: a
  // subida real depende do desnível do TERRENO entre a base da escada e a casa, que empurra o degrau
  // pra cima do alvo. Medido no mapa inteiro, o pior degrau fica em 75% do limite — com a folga
  // menor de antes ele batia em 89%, a um tropeço de virar escada intransponível.
  const alturaDegrauAlvo=ALTURA_DEGRAU*.65;
  casaGrupo.updateWorldMatrix(true,false);
  const casaMundo=new THREE.Vector3();casaGrupo.getWorldPosition(casaMundo);
  const rotY=casaGrupo.rotation.y,cosR=Math.cos(rotY),sinR=Math.sin(rotY);
  const localParaMundo=(lx,lz)=>({x:casaMundo.x+lx*cosR+lz*sinR,z:casaMundo.z-lx*sinR+lz*cosR});
  const lx=lado*(w/2+largura/2+ESCADA_MARGEM);// encosta na parede, com leve sobreposição pra não flutuar
  const lajeY=casaMundo.y+alturaTotal;
  // O comprimento nunca pode passar da profundidade da casa: senão a escada invade a fachada da frente.
  const margemPonta=.2,maxRun=Math.max(prof*4,d-2*margemPonta),maxDegraus=Math.max(3,Math.floor(maxRun/prof));
  const centroMundo=localParaMundo(lx,0),subidaAprox=lajeY-obterElevacao(centroMundo.x,centroMundo.z);
  if(subidaAprox<=0)return null;
  const numDegraus=Math.min(Math.max(3,Math.ceil(subidaAprox/alturaDegrauAlvo)),maxDegraus);
  const comprimentoAcesso=numDegraus*prof,lzInicio=-comprimentoAcesso/2;
  const inicio=localParaMundo(lx,lzInicio);
  const yBaseEscada=obterElevacao(inicio.x,inicio.z);
  const subidaTotal=lajeY-yBaseEscada;
  if(subidaTotal<=0)return null;
  const alturaDegrau=subidaTotal/numDegraus;// distribui a subida pra terminar exatamente nivelada com a laje
  const grupoEscada=new THREE.Group();grupoEscada.userData.escadariaViela=true;casaGrupo.add(grupoEscada);
  const material=bmat(0x9a9a95);
  for(let i=0;i<numDegraus;i++){
    const lz=lzInicio+i*prof,mundo=localParaMundo(lx,lz);
    const chaoAtual=obterElevacao(mundo.x,mundo.z),yTopoMundo=yBaseEscada+(i+1)*alturaDegrau;
    // O bloco desce ENTERRADO abaixo do ponto mais baixo entre o terreno local e a base da escada.
    // É o que garante degrau completo em terreno inclinado: a versão anterior media do chão daquele
    // ponto pra cima e descartava o degrau quando a conta dava negativa, abrindo o vão.
    const yFundo=Math.min(chaoAtual,yBaseEscada)-.4;
    const alturaBloco=Math.max(.02,yTopoMundo-yFundo);
    const geometria=new THREE.BoxGeometry(largura,alturaBloco,prof);
    geometria.translate(0,-alturaBloco/2,0);// origem no TOPO do bloco: posiciono pelo piso do degrau
    const degrau=new THREE.Mesh(geometria,material);
    degrau.position.set(lx,yTopoMundo-casaMundo.y,lz);
    degrau.castShadow=true;degrau.receiveShadow=true;degrau.userData.superficieEscada=true;
    grupoEscada.add(degrau);
    superficiesAndaveis.push(degrau);// pouso por raycast
    registrarObstaculo(degrau);// colisão de verdade — o step-up do jogador é quem deixa subir
  }
  // Patamar: liga o topo do último degrau à borda da laje. Fica NIVELADO com o telhado (topo em
  // alturaTotal), então nunca vira degrau nem obstáculo — é só piso, e é o que impede o buraco
  // entre a escada e a laje pra quem sobe reto em vez de curvar na direção da casa.
  const ultimoLz=lzInicio+(numDegraus-1)*prof,paredeLocalX=lado*(w/2+.06);
  const patamarMinX=Math.min(lx-largura/2,paredeLocalX),patamarMaxX=Math.max(lx+largura/2,paredeLocalX);
  const patamarGeo=new THREE.BoxGeometry(patamarMaxX-patamarMinX,.12,prof*1.6);
  const patamar=new THREE.Mesh(patamarGeo,material);
  patamar.position.set((patamarMinX+patamarMaxX)/2,alturaTotal-.06,ultimoLz+prof*.8);
  patamar.castShadow=true;patamar.receiveShadow=true;patamar.userData.superficieEscada=true;
  grupoEscada.add(patamar);
  superficiesAndaveis.push(patamar);
  grupoEscada.updateMatrixWorld(true);
  return grupoEscada
}
export const casasPos=[];// footprints pro radar mostrar o traçado das ruas, não só pontos soltos
// ===== CASA-REFÚGIO: casca com vão de porta, em vez do bloco maciço =====
// O esconderijo agora é DENTRO da casa, então a casa precisa ter dentro. Só as marcadas viram casca:
// as outras seguem como um único bloco maciço, que é muito mais barato (1 malha e 1 colisor por casa
// contra 6) — 96 casas ocas seria desperdício de draw call e de teste de colisão por frame.
const ESP_PAREDE=.18,PORTA_ALTURA=2.1,VAO_PORTA=1.2;
function construirCascaCasa(g,w,h,d,fachada){
  const paredes=[],meia=ESP_PAREDE/2;
  paredes.push(bloco(new THREE.BoxGeometry(w,h,ESP_PAREDE),fachada,0,h/2,-d/2+meia,g));
  for(const s of[-1,1])paredes.push(bloco(new THREE.BoxGeometry(ESP_PAREDE,h,d-ESP_PAREDE*2),fachada,s*(w/2-meia),h/2,0,g));
  // Frente: duas faixas ao lado do vão + verga por cima, deixando a porta ABERTA (sem a folha, que
  // nas casas normais é uma placa colada na fachada e aqui tamparia justamente a entrada).
  const ladoLarg=(w-VAO_PORTA)/2;
  for(const s of[-1,1])paredes.push(bloco(new THREE.BoxGeometry(ladoLarg,h,ESP_PAREDE),fachada,s*(VAO_PORTA+ladoLarg)/2,h/2,d/2-meia,g));
  const alturaVerga=h-PORTA_ALTURA;
  if(alturaVerga>.05)paredes.push(bloco(new THREE.BoxGeometry(VAO_PORTA,alturaVerga,ESP_PAREDE),fachada,0,PORTA_ALTURA+alturaVerga/2,d/2-meia,g));
  return paredes;
}
// Folha de porta num pivô na borda do vão. É o coração do esconderijo: entrar não basta, o jogador
// tem que FECHAR. Abre pra dentro (+1,9 rad ≈ 109°) porque pra fora ela bateria na casa de trás nas
// fileiras coladas.
const PORTA_ABERTA_RAD=1.9;
function construirPortaRefugio(g,d){
  const pivo=new THREE.Group();
  pivo.position.set(-VAO_PORTA/2,0,d/2-ESP_PAREDE/2);
  g.add(pivo);
  const larg=VAO_PORTA-.04;
  const folha=bloco(new THREE.BoxGeometry(larg,PORTA_ALTURA,.07),porta,larg/2,PORTA_ALTURA/2,0,pivo);
  bloco(new THREE.SphereGeometry(.05,6,5),posteMat,larg-.14,PORTA_ALTURA*.5,.06,pivo);// maçaneta: lê como porta de longe
  return{pivo,folha};
}
function casaBairro(x,z,w=6,d=6,h=3,cor=0xd87957,tipo=0,registrar=true,ladoEscada=0,corTelhado=0x888888,refugio=false){const g=new THREE.Group();const terrenoY=obterElevacao(x,z);g.position.set(x,terrenoY,z);g.rotation.y=z>0?Math.PI:0;g.userData={bairroCasa:true,cor,tipo};bairro.add(g);const fachada=bmat(cor);const casca=refugio?construirCascaCasa(g,w,h,d,fachada):null;if(refugio)g.userData.pecaPorta=construirPortaRefugio(g,d);const paredeMesh=casca?null:bloco(new THREE.BoxGeometry(w,h,d),fachada,0,h/2,0,g);const frente=new THREE.Mesh(new THREE.BoxGeometry(w*.7,.1,.04),concreto);frente.position.set(0,.08,d/2+.025);frente.castShadow=true;frente.receiveShadow=true;g.add(frente);const doorHeight=PORTA_ALTURA;if(!refugio)bloco(new THREE.BoxGeometry(.95,doorHeight,.08),porta,0,doorHeight/2,d/2+.07,g);for(const xx of [-w*.27,w*.27]){bloco(new THREE.BoxGeometry(1.22,1.02,.05),molduraJanela,xx,h*.56,d/2+.05,g);bloco(new THREE.BoxGeometry(1.05,.85,.06),Math.random()<.22?janelaAcesa:janela,xx,h*.56,d/2+.12,g);bloco(new THREE.BoxGeometry(1.18,.07,.08),concreto,xx,h*.56,d/2+.20,g)}const laje=bloco(new THREE.BoxGeometry(w+.12,.12,d+.12),bmat(corTelhado),0,h+.06,0,g);superficiesAndaveis.push(laje);const muretaY=h+.12+.25;
// A escadaria (quando existe) fica FORA da largura w da casa (ver criarEscadariaViela). Sem estender a
// mureta frontal/traseira até lá, sobra um canto sem parapeito bem onde a escadaria termina — o jogador
// caminha por cima do telhado, passa reto por esse canto aberto e cai direto no vão entre as casas.
const alcanceEscada=w/2+ESCADA_LARGURA+ESCADA_MARGEM;
const muretaMinX=ladoEscada===-1?-alcanceEscada:-(w/2+.06),muretaMaxX=ladoEscada===1?alcanceEscada:(w/2+.06);
const muretaLargura=muretaMaxX-muretaMinX,muretaCentroX=(muretaMaxX+muretaMinX)/2;
const muretas=[bloco(new THREE.BoxGeometry(muretaLargura,.5,.12),bmat(corTelhado),muretaCentroX,muretaY,d/2,g),bloco(new THREE.BoxGeometry(muretaLargura,.5,.12),bmat(corTelhado),muretaCentroX,muretaY,-d/2,g)];if(ladoEscada!==1)muretas.push(bloco(new THREE.BoxGeometry(.12,.5,d+.12),bmat(corTelhado),w/2,muretaY,0,g));if(ladoEscada!==-1)muretas.push(bloco(new THREE.BoxGeometry(.12,.5,d+.12),bmat(corTelhado),-w/2,muretaY,0,g));g.userData.muretas=muretas;casasPos.push({x,z,w,d});if(tipo===2){const sacada=bloco(new THREE.BoxGeometry(w*.62,.12,.75),concreto,0,h*.62,d/2+.42,g);for(const xx of [-w*.3,-w*.1,w*.1,w*.3])bloco(new THREE.BoxGeometry(.05,.8,.05),posteMat,xx,h*.62+.38,d/2+.73,g)}if(tipo!==1){const tank=bloco(new THREE.CylinderGeometry(.38,.38,.62,10),agua,w*.22,h+.55,-d*.12,g);tank.castShadow=true}g.userData.paredeMesh=paredeMesh;if(registrar){if(casca)casca.forEach(registrarObstaculo);else registrarObstaculo(paredeMesh);muretas.forEach(registrarObstaculo)}return g}
function sobrado(x,z,w,d,h,cor,ladoEscada=0,corTelhado=0x888888){const g=casaBairro(x,z,w,d,h,cor,2,true,ladoEscada,corTelhado);const up=casaBairro(x,z,w*.86,d*.82,h*.72,cor===tijolo.color?.getHex?.()?0xd87957:0xe8c45d,1,false,0,corTelhado);up.position.y=obterElevacao(x,z)+h+.18;registrarObstaculo(up.userData.paredeMesh);up.userData.muretas.forEach(registrarObstaculo);return g}
function arvore(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);bairro.add(g);bloco(new THREE.CylinderGeometry(.16*s,.22*s,1.5*s,6),posteMat,0,.75*s,0,g);
  const clusters=[[0,1.8,0],[-.45,1.55,0],[.45,1.55,0],[0,1.55,.45],[0,1.55,-.42]];
  clusters.forEach((p,i)=>{const folha=bloco(new THREE.DodecahedronGeometry(.62*s*(.85+Math.random()*.3),0),i%2===0?folhaMat:folhaClara,p[0],p[1]*s,p[2],g);folha.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI)});
  criarSombraContato(.85*s,g);
  return g}
// ===== REFÚGIO: casa comum da favela, oca, com porta que abre e fecha =====
// A regra é ENTRAR e FECHAR: enquanto a porta estiver fechada e o jogador dentro, a polícia e o
// helicóptero não acham ele (ver Police.js). Antes bastava chegar a 2,8 m da casa, o que fazia o
// esconderijo valer também na viela e na calçada — "esconderijo em qualquer lugar".
export const refugios=[];
const refugioMat=new THREE.MeshStandardMaterial({color:0xb5342a,roughness:.7,emissive:0x5a1712,emissiveIntensity:.35});
function marcarRefugio(g,d){
  bloco(new THREE.BoxGeometry(1.5,.12,.5),refugioMat,0,2.15,d/2+.32,g);
  for(const xx of[-.62,.62])bloco(new THREE.CylinderGeometry(.03,.03,.4,6),posteMat,xx,1.95,d/2+.5,g);
}
// A caixa da porta aberta não pode ser uma Box3 vazia: vazio em three é ±Infinity, e Infinity entra
// na rasterização da NavMesh e no slab test das balas virando NaN. Uma caixa minúscula enterrada a
// 10 km de profundidade é finita e nunca encosta em nada.
function sumirCaixa(b){b.min.set(0,-9999,0);b.max.set(.01,-9998.99,.01)}
function registrarRefugio(g,x,z,w,d,pecaPorta){
  const{pivo,folha}=pecaPorta;
  // A AABB fechada é medida UMA vez, com a folha na posição fechada. Medir na hora de fechar pegaria
  // a folha no meio da animação e o colisor sairia torto.
  pivo.rotation.y=0;folha.updateWorldMatrix(true,false);
  const caixaFechada=new THREE.Box3().setFromObject(folha);
  pivo.rotation.y=PORTA_ABERTA_RAD;// a casa nasce com a porta aberta
  const caixa=new THREE.Box3();sumirCaixa(caixa);
  obstaculos.push(caixa);// a MESMA Box3 fica na lista pra sempre; o que muda é o conteúdo dela
  // O recuo precisa cobrir a parede MAIS a meia-largura do corpo (≈0,19 m): com o recuo justo da
  // parede, um ponto do "interior" colado na lateral já deixava a hitbox dentro do tijolo, e fechar
  // a porta ali prendia o jogador no próprio colisor. Medido: 42 pontos do interior davam colisão.
  const recuo=ESP_PAREDE+.25;
  const r={x,z,pivo,folha,caixa,caixaFechada,aberta:true,
    // Interior em coordenadas de MUNDO. A casa só gira 0 ou π (ver casaBairro) e as duas rotações
    // mapeiam a caixa nela mesma, então a AABB local serve como mundial sem transformar nada.
    minX:x-(w/2-recuo),maxX:x+(w/2-recuo),minZ:z-(d/2-recuo),maxZ:z+(d/2-recuo)};
  refugios.push(r);
  return r;
}
export function alternarPortaRefugio(r){
  r.aberta=!r.aberta;
  if(r.aberta)sumirCaixa(r.caixa);else r.caixa.copy(r.caixaFechada);
  return r.aberta;
}
// Em qual refúgio o ponto está (ou null). É o teste do INTERIOR, não de proximidade.
export function refugioEmQueEsta(pos){
  for(const r of refugios)if(pos.x>=r.minX&&pos.x<=r.maxX&&pos.z>=r.minZ&&pos.z<=r.maxZ)return r;
  return null;
}
// Escondido = dentro da casa E com a porta fechada. As duas condições, sempre.
export function estaEscondido(pos){const r=refugioEmQueEsta(pos);return !!r&&!r.aberta}
export function atualizarRefugios(dt){
  const k=1-Math.exp(-9*dt);
  for(const r of refugios){
    const alvo=r.aberta?PORTA_ABERTA_RAD:0;
    if(Math.abs(r.pivo.rotation.y-alvo)>.001)r.pivo.rotation.y+=(alvo-r.pivo.rotation.y)*k;
  }
}
function poste(x,z){const g=new THREE.Group();g.position.set(x,0,z);bairro.add(g);bloco(new THREE.CylinderGeometry(.09,.13,6.3,6),posteMat,0,3.15,0,g);bloco(new THREE.BoxGeometry(1.2,.08,.08),posteMat,0,6.1,0,g);registrarObstaculo(g)}
function fio(a,b){const pts=[new THREE.Vector3(a[0],6.05,a[1]),new THREE.Vector3((a[0]+b[0])/2,5.35,(a[1]+b[1])/2),new THREE.Vector3(b[0],6.05,b[1])];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x252321}));bairro.add(line)}
// Comunidade compacta: paredes coladas em blocos de quatro, com vielas de 2,4 m.
const CELL_W=6,CELL_D=4.8,BECO=2.4,BLOCK_COLS=12,BLOCK_ROWS=8;let casaIndex=0;
const telhados=[0x8a8a82,0x9c958a,0x7f8a7d,0x8f7f6e,0x87877f,0x9a8f7c];
for(let row=0;row<BLOCK_ROWS;row++){for(let col=0;col<BLOCK_COLS;col++){const i=casaIndex++;const x=-36+col*CELL_W+Math.floor(col/4)*BECO;const z=-42+row*CELL_D+Math.floor(row/3)*BECO;const h=i%7===0?3.6:i%3===0?3.2:2.8;const tipo=i%5===0?1:i%4===0?2:i%3;const cor=coresBairro[i%coresBairro.length];const corTelhado=telhados[i%telhados.length];
// Escada só nasce onde existe viela real ao lado (limite de bloco de 4 casas), nunca encostada em outra casa.
const ladoEscada=(col%4===0&&col>0&&Math.random()<.6)?-1:0;
// Refúgio só onde a PORTA dá pra ser alcançada: as fileiras são coladas fundo-com-frente, e só há
// vão livre à frente no fim de cada bloco de 3 (row%3===2) ou na última fileira. Marcar uma casa
// do meio faria um esconderijo com a entrada emparedada pela casa de trás. Sobrado fica de fora
// (são duas casas empilhadas, a de cima não tem como ser oca sem retrabalho).
const frenteLivre=(row%3===2||row===BLOCK_ROWS-1);
const ehRefugio=frenteLivre&&col%4===2&&i%7!==0;
const grupoCasa=i%7===0?sobrado(x,z,CELL_W,CELL_D,h,cor,ladoEscada,corTelhado):casaBairro(x,z,CELL_W,CELL_D,h,cor,tipo,true,ladoEscada,corTelhado,ehRefugio);
if(ladoEscada)criarEscadariaViela(grupoCasa,h+.12,CELL_W,CELL_D,ladoEscada);
if(ehRefugio){marcarRefugio(grupoCasa,CELL_D);registrarRefugio(grupoCasa,x,z,CELL_W,CELL_D,grupoCasa.userData.pecaPorta)}
}}// Comércio de esquina e ponto de encontro visual.
const mercado=casaBairro(0,-18,9,7,3.1,0xd98545,0);bloco(new THREE.BoxGeometry(7.2,1.1,.12),bmat(0xe9d16a),-0,2.15,3.56,mercado);bloco(new THREE.BoxGeometry(5.9,.5,.08),bmat(0x7b3f2b),0,2.15,3.65,mercado);
[-35,35].forEach(x=>[-55,-28,14,56].forEach(z=>poste(x,z)));for(const a of [[-35,-55],[-35,-28],[-35,14],[-35,56],[35,-55],[35,-28],[35,14]])fio(a,[a[0],a[1]+12]);
[[-62,-62],[-62,36],[62,-34],[62,64],[-18,72],[18,-70]].forEach((p,i)=>arvore(p[0],p[1],.9+(i%2)*.18));

// ===== FAZENDA: área rural afastada da cidade, além do limite oeste do bairro.
function criarFazenda(cx,cz){
  const meiaLarg=13,meiaProf=11;
  const bx=cx-meiaLarg+5,bz=cz-meiaProf+5,by=obterElevacao(bx,bz);
  const celeiroMat=bmat(0x8a3b2b),telhadoMat=bmat(0x4a3327);
  const paredeCeleiro=bloco(new THREE.BoxGeometry(6,3.2,5),celeiroMat,bx,by+1.6,bz);
  registrarObstaculo(paredeCeleiro);
  const aguaEsq=new THREE.Mesh(new THREE.BoxGeometry(3.7,.15,5.6),telhadoMat);aguaEsq.position.set(bx-1.55,by+3.55,bz);aguaEsq.rotation.z=.55;aguaEsq.castShadow=true;aguaEsq.receiveShadow=true;bairro.add(aguaEsq);
  const aguaDir=aguaEsq.clone();aguaDir.position.x=bx+1.55;aguaDir.rotation.z=-.55;bairro.add(aguaDir);
  bloco(new THREE.BoxGeometry(1.6,2.1,.08),bmat(0x2e2018),bx,by+1.05,bz+2.52);
  bloco(new THREE.CylinderGeometry(.35,.4,.7,10),bmat(0x666660),bx-2.6,by+.35,bz-2.3);
  // cerca perimetral e roças em InstancedMesh (1 draw call cada, em vez de ~150 meshes separados) —
  // puramente visual/demarcação, sem travar o jogador.
  const cercaMat=bmat(0x6b4a2f);
  const cantos=[[cx-meiaLarg,cz-meiaProf],[cx+meiaLarg,cz-meiaProf],[cx+meiaLarg,cz+meiaProf],[cx-meiaLarg,cz+meiaProf]];
  const postesPos=[];
  for(let lado=0;lado<4;lado++){
    const a=cantos[lado],b=cantos[(lado+1)%4],passos=Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/2.4);
    for(let i=0;i<=passos;i++){const t=i/passos;postesPos.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}
  }
  const cercaMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.06,1,6),cercaMat,postesPos.length);
  cercaMesh.castShadow=false;cercaMesh.receiveShadow=false;
  const m4=new THREE.Matrix4();
  postesPos.forEach(([px,pz],i)=>{const py=obterElevacao(px,pz);m4.makeTranslation(px,py+.5,pz);cercaMesh.setMatrixAt(i,m4)});
  cercaMesh.instanceMatrix.needsUpdate=true;bairro.add(cercaMesh);
  const cultivoMat=bmat(0x5c8a3e);
  const cultivoPos=[];
  for(let lx=-meiaLarg+8;lx<meiaLarg-2;lx+=1.5)for(let lz=-meiaProf+2;lz<meiaProf-8;lz+=1.2)cultivoPos.push([cx+lx,cz+lz]);
  const cultivoMesh=new THREE.InstancedMesh(new THREE.ConeGeometry(.15,.4,5),cultivoMat,cultivoPos.length);
  cultivoMesh.castShadow=false;cultivoMesh.receiveShadow=true;
  const posV=new THREE.Vector3(),quatV=new THREE.Quaternion(),eixoY=new THREE.Vector3(0,1,0),escalaV=new THREE.Vector3();
  cultivoPos.forEach(([px,pz],i)=>{
    const py=obterElevacao(px,pz),e=.85+Math.random()*.4;
    posV.set(px,py+.2,pz);quatV.setFromAxisAngle(eixoY,Math.random()*Math.PI);escalaV.set(e,e*(.85+Math.random()*.3),e);
    m4.compose(posV,quatV,escalaV);cultivoMesh.setMatrixAt(i,m4);
  });
  cultivoMesh.instanceMatrix.needsUpdate=true;bairro.add(cultivoMesh);
  return{cx,cz,meiaLarg,meiaProf,celeiro:{x:bx,z:bz,meiaLarg:3.3,meiaProf:2.8}};
}
export const FAZENDA=criarFazenda(-86,-50);

// ===== BALCÃO DO DEPÓSITO RURAL (polo Fazenda) =====
// Marca visual de que o celeiro atende: sem isso o jogador chega no ponto de interação e não entende por
// que apareceu um painel de compra. Puramente decorativo — nada aqui vira obstáculo, o celeiro já é um.
function criarBalcaoFazenda(x,z){
  const g=new THREE.Group();const y=obterElevacao(x,z);g.position.set(x,y,z);bairro.add(g);
  bloco(new THREE.BoxGeometry(2.6,.12,1),bmat(0x7a5a3a),0,.95,0,g);
  for(const lx of[-1.1,1.1])bloco(new THREE.BoxGeometry(.12,.95,.12),bmat(0x6b4a2f),lx,.48,0,g);
  bloco(new THREE.BoxGeometry(2.9,.1,1.3),bmat(0x4a3327),0,2.05,-.1,g);
  for(const lx of[-1.3,1.3])bloco(new THREE.CylinderGeometry(.05,.05,1.05,6),posteMat,lx,1.55,.5,g);
  // Sacaria empilhada: sinaliza "terra e vaso vendidos aqui" sem precisar de texto no mundo.
  for(const[sx,sy,sz]of[[-.7,1.14,.05],[-.35,1.14,-.05],[-.52,1.42,0],[.75,1.14,0]])
    bloco(new THREE.BoxGeometry(.34,.26,.3),bmat(0xc7b184),sx,sy,sz,g);
  bloco(new THREE.CylinderGeometry(.2,.16,.26,8),bmat(0x8a5a3a),.35,1.14,.1,g);
  criarSombraContato(1.9,g);
  return g;
}
criarBalcaoFazenda(POLOS.fazenda.x,POLOS.fazenda.z);

// ===== LOJA DE ARMAS (polo Armas, nordeste) =====
// Barracão de chapa com balcão gradeado e caixotes de munição. A parede é o único obstáculo registrado;
// o balcão e os caixotes ficam de fora pra não criar bolsões onde o jogador encrava na hora do tiroteio.
function criarLojaArmas(x,z){
  const g=new THREE.Group();const y=obterElevacao(x,z);g.position.set(x,y,z);scene.add(g);
  const chapa=bmat(0x4d5358),chapaEscura=bmat(0x353b40),ferrugem=bmat(0x7a4a34);
  const parede=bloco(new THREE.BoxGeometry(6.4,3.4,4.6),chapa,0,1.7,-1.6,g);
  registrarObstaculo(parede);
  bloco(new THREE.BoxGeometry(6.9,.16,5.1),chapaEscura,0,3.48,-1.6,g);
  // Marquise laranja sobre o balcão: é a cor do polo no radar, pra o jogador reconhecer de longe.
  const marquise=bloco(new THREE.BoxGeometry(6.2,.14,2.2),bmat(0xd4762a),0,2.85,1.05,g);
  marquise.rotation.x=-.12;
  for(const lx of[-2.7,2.7])bloco(new THREE.CylinderGeometry(.07,.07,2.7,6),posteMat,lx,1.35,1.95,g);
  bloco(new THREE.BoxGeometry(5.4,.16,1.1),bmat(0x6b6259),0,1,.75,g);
  bloco(new THREE.BoxGeometry(5.4,.9,.1),chapaEscura,0,.5,.75,g);
  // Grade do balcão: barras verticais finas, o detalhe que lê como "loja de armas" à distância.
  for(let i=-5;i<=5;i++)bloco(new THREE.BoxGeometry(.05,.85,.05),posteMat,i*.5,1.5,.75,g);
  for(const[cx,cy,cz]of[[-2.2,.3,1.9],[-1.75,.3,2.05],[-2,.85,1.95],[2.3,.3,1.85]])
    bloco(new THREE.BoxGeometry(.6,.5,.5),ferrugem,cx,cy,cz,g);
  const lampada=new THREE.PointLight(0xffb066,.9,9);lampada.position.set(0,2.6,1);g.add(lampada);
  bloco(new THREE.SphereGeometry(.09,8,8),new THREE.MeshStandardMaterial({color:0xffd9a0,emissive:0xffb066,emissiveIntensity:1.5}),0,2.6,1,g);
  criarSombraContato(4,g,0,-.5);
  return g;
}
criarLojaArmas(POLOS.armas.predio.x,POLOS.armas.predio.z);
export const animais=[];
function criarAnimal(tipo,x,z){
  const g=new THREE.Group();const y=obterElevacao(x,z);g.position.set(x,y,z);bairro.add(g);
  let velocidade=.6;
  if(tipo==='vaca'){
    bloco(new THREE.BoxGeometry(.9,.6,.45),bmat(0xf2ede0),0,.5,0,g);
    bloco(new THREE.BoxGeometry(.35,.35,.4),bmat(0x3a3128),.55,.55,0,g);
    for(const lx of[-.3,.3])for(const lz of[-.15,.15])bloco(new THREE.CylinderGeometry(.07,.07,.45,6),bmat(0x2e281f),lx,.22,lz,g);
    velocidade=.5;
  }else if(tipo==='porco'){
    bloco(new THREE.BoxGeometry(.55,.4,.32),bmat(0xe8a5a0),0,.32,0,g);
    bloco(new THREE.BoxGeometry(.2,.22,.2),bmat(0xe8a5a0),.32,.34,0,g);
    velocidade=.7;
  }else{
    bloco(new THREE.BoxGeometry(.22,.22,.3),bmat(0xf5f0e6),0,.22,0,g);
    bloco(new THREE.BoxGeometry(.14,.14,.14),bmat(0xf5f0e6),0,.34,.14,g);
    bloco(new THREE.ConeGeometry(.04,.09,4),bmat(0xd98a3f),0,.34,.24,g);
    velocidade=.9;
  }
  const animal={grupo:g,x,z,velocidade,alvo:{x,z},proximaDecisao:0};
  animais.push(animal);
  return animal;
}
[['vaca',-84,-48],['vaca',-80,-53],['porco',-88,-45],['porco',-83,-44],['galinha',-79,-49],['galinha',-81,-46],['galinha',-77,-52]].forEach(a=>criarAnimal(a[0],a[1],a[2]));
function dentroDoCurral(x,z){
  if(x<FAZENDA.cx-FAZENDA.meiaLarg+1||x>FAZENDA.cx+FAZENDA.meiaLarg-1||z<FAZENDA.cz-FAZENDA.meiaProf+1||z>FAZENDA.cz+FAZENDA.meiaProf-1)return false;
  const c=FAZENDA.celeiro;
  return!(Math.abs(x-c.x)<c.meiaLarg+.8&&Math.abs(z-c.z)<c.meiaProf+.8);
}
function novoAlvoAnimal(){let x,z,t=0;do{x=FAZENDA.cx+(Math.random()*2-1)*(FAZENDA.meiaLarg-2);z=FAZENDA.cz+(Math.random()*2-1)*(FAZENDA.meiaProf-2);t++}while(!dentroDoCurral(x,z)&&t<10);return{x,z}}
export function atualizarAnimais(dt){
  const agora=performance.now()/1000;
  for(const a of animais){
    if(agora>a.proximaDecisao){a.alvo=novoAlvoAnimal();a.proximaDecisao=agora+4+Math.random()*5}
    const dx=a.alvo.x-a.x,dz=a.alvo.z-a.z,dist=Math.hypot(dx,dz);
    if(dist>.15){const passo=Math.min(dist,a.velocidade*dt);a.x+=dx/dist*passo;a.z+=dz/dist*passo;a.grupo.rotation.y=Math.atan2(dx,dz)}
    a.grupo.position.set(a.x,obterElevacao(a.x,a.z),a.z);
  }
}

// Barraco discreto do Receptador (compra semente rara, compra pacotes), isolado longe do bairro principal.
export function criarEsconderijo(x,z){
  const g=new THREE.Group();const y0=obterElevacao(x,z);g.position.set(x,y0,z);scene.add(g);
  const parede=bloco(new THREE.BoxGeometry(3,2.2,2.4),bmat(0x3a3630),0,1.1,0,g);
  bloco(new THREE.BoxGeometry(3.3,.12,2.7),bmat(0x24211d),0,2.24,0,g);
  const lampada=new THREE.PointLight(0xffb066,1.1,7);lampada.position.set(0,2,1.4);g.add(lampada);
  bloco(new THREE.SphereGeometry(.09,8,8),new THREE.MeshStandardMaterial({color:0xffcf8a,emissive:0xffb066,emissiveIntensity:1.4}),0,2,1.4,g);
  bloco(new THREE.CylinderGeometry(.28,.32,.5,8),bmat(0x4a4034),1.6,.25,1.2,g);
  criarSombraContato(2.2,g,0,.2);
  registrarObstaculo(parede);
  return g;
}
