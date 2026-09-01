// Geração do bairro: casas/sobrados, escadarias de viela, postes/fios, árvores, mercado, fazenda e animais.
import*as THREE from'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,superficiesAndaveis,obstaculos,obstaculosPedestres}from'./Physics.js';
import{bmat,matReboco,matTelha,matConcreto,matMadeira,matTerraArada,matTerraBatida,uvPorMetro,tijolo,concreto,janela,janelaAcesa,molduraJanela,porta,agua,posteMat,folhaMat,folhaClara,criarSombraContato}from'./Materials.js';
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

// Todo bloco com material TEXTURADO ganha UV em metros: sem isto uma parede de 6 m e uma mureta de
// 12 cm receberiam a mesma textura esticada, e o tijolo sairia gigante num e minúsculo no outro.
function bloco(geo,material,x,y,z,parent=bairro){if(material&&material.map)uvPorMetro(geo);const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// ===== ESCADARIA DE VIELA =====
// Escada exterior colada na parede lateral (eixo X local da casa), filha do grupo da casa.
// lado=+1 encosta no lado +X local, lado=-1 no lado -X local; a subida acompanha o eixo Z local.
//
// Reescrita do zero depois de três remendos que não seguraram. As três decisões que sustentam ela:
//
//  1. UMA MALHA. A escada inteira é uma geometria fundida. A versão anterior punha uma malha por
//     degrau: 136 malhas na cena só de escadaria, em 6 escadarias.
//  2. DEGRAU NÃO É OBSTÁCULO DO JOGADOR. Quem sustenta o jogador é a superfície andável (raycast
//     vertical acha o piso do degrau e assenta os pés nele). Pôr cada degrau em `obstaculos` foi a
//     causa direta do "me joga pra fora": o jogador encostava no degrau, a rede anti-travamento
//     entendia "encurralado" e o teleportava. Sem obstáculo no degrau, esse caso deixa de existir.
//     Os degraus vão pra `obstaculosPedestres`, que é exatamente pra que essa lista foi criada.
//  3. NADA ENTERRADO ALÉM DA SAIA. Os blocos vão da base da escada pra cima, e uma saia única fecha
//     do terreno até essa base. Antes cada degrau descia até o subsolo, e onde o terreno caía isso
//     virava uma laje de 2 m saindo do chão no lote do vizinho — parede invisível fechando o acesso.
//
// Degraus todos da mesma altura (divisão exata da subida) e mesma pisada (divisão exata da corrida).
function criarEscadariaViela(casaGrupo,alturaTotal,w=6,d=4.8,lado=1){
  casaGrupo.updateWorldMatrix(true,false);
  const casaMundo=new THREE.Vector3();casaGrupo.getWorldPosition(casaMundo);
  const rotY=casaGrupo.rotation.y,cosR=Math.cos(rotY),sinR=Math.sin(rotY);
  const localParaMundo=(lx,lz)=>({x:casaMundo.x+lx*cosR+lz*sinR,z:casaMundo.z-lx*sinR+lz*cosR});
  const largura=ESCADA_LARGURA;
  const lx=lado*(w/2+largura/2+ESCADA_MARGEM);// encosta na parede, com leve sobreposição pra não flutuar
  const lajeY=casaMundo.y+alturaTotal;
  // O comprimento nunca passa da profundidade da casa: senão a escada invade a fachada da frente.
  const margemPonta=.2,corridaMax=Math.max(1.2,d-2*margemPonta);

  // A escada sobe do terreno NO PÉ dela até a laje. Medir no pé (e não no centro) é o que faz o
  // último degrau terminar exatamente rente ao telhado em terreno inclinado.
  const pe=localParaMundo(lx,-corridaMax/2);
  const yBase=obterElevacao(pe.x,pe.z);
  const subida=lajeY-yBase;
  if(subida<=0)return null;

  // Todos os degraus com a MESMA altura, tirada da divisão exata da subida. A altura alvo fica em 70%
  // do step-up do jogador: a folga é o que impede que um desnível de terreno empurre um degrau pra
  // cima do limite e transforme a escada em parede.
  const numDegraus=Math.max(3,Math.ceil(subida/(ALTURA_DEGRAU*.70)));
  const alturaDegrau=subida/numDegraus;
  // A pisada preenche o comprimento disponível, com teto de 30 cm pra escada baixa não virar rampa.
  const pisada=Math.min(.30,corridaMax/numDegraus);
  const corrida=numDegraus*pisada,lzInicio=-corrida/2;

  const grupoEscada=new THREE.Group();grupoEscada.userData.escadariaViela=true;casaGrupo.add(grupoEscada);

  // ===== UMA MALHA SÓ =====
  // A escada inteira é UMA geometria fundida, não 25 malhas soltas. São 6 escadarias no mapa: o jeito
  // antigo colocava 136 malhas e 136 colisores na cena só de degrau. Fundir é 1 draw call por escada.
  const partes=[];
  // UV em metros ANTES de fundir: depois da fusão a geometria perde os parâmetros da caixa e não dá
  // mais pra saber o tamanho de cada face.
  const caixa=(lgX,lgY,lgZ,cx,cy,cz)=>{const g=new THREE.BoxGeometry(lgX,lgY,lgZ);uvPorMetro(g);g.translate(cx,cy,cz);partes.push(g)};

  // Saia: do ponto mais baixo do terreno sob a corrida até a base do 1º degrau. É ela que fecha o vão
  // quando o chão desce ao longo da escada — sem isso a escada flutua e aparece buraco por baixo.
  let terrenoMin=yBase;
  for(let i=0;i<=numDegraus;i++){const m=localParaMundo(lx,lzInicio+i*pisada);terrenoMin=Math.min(terrenoMin,obterElevacao(m.x,m.z))}
  const saiaAlt=Math.max(.05,yBase-(terrenoMin-.3));
  caixa(largura,saiaAlt,corrida,lx,(yBase-saiaAlt/2)-casaMundo.y,lzInicio+corrida/2);

  // Degraus: cada bloco vai da base da escada até o próprio piso. Empilhados, formam um sólido fechado
  // — nada enterrado abaixo da saia, que era o que virava parede invisível no terreno do vizinho.
  for(let i=0;i<numDegraus;i++){
    const topo=yBase+(i+1)*alturaDegrau,alt=topo-yBase;
    caixa(largura,alt,pisada,lx,(yBase+alt/2)-casaMundo.y,lzInicio+i*pisada+pisada/2);
  }
  // Patamar: liga o último degrau à borda da laje, nivelado com o telhado. É o que fecha o vão pra
  // quem sobe reto em vez de curvar na direção da casa.
  const paredeLocalX=lado*(w/2+.06);
  const patMinX=Math.min(lx-largura/2,paredeLocalX),patMaxX=Math.max(lx+largura/2,paredeLocalX);
  caixa(patMaxX-patMinX,.12,pisada*1.6,(patMinX+patMaxX)/2,alturaTotal-.06,lzInicio+corrida+pisada*.3);

  const malha=new THREE.Mesh(mergeGeometries(partes,false),matConcreto());
  for(const g of partes)g.dispose();
  malha.castShadow=true;malha.receiveShadow=true;malha.userData.superficieEscada=true;
  grupoEscada.add(malha);
  // É por AQUI que o jogador sobe: o raycast vertical acha o piso de cada degrau e assenta os pés nele.
  superficiesAndaveis.push(malha);
  grupoEscada.updateMatrixWorld(true);
  // Medidas da corrida, pro teste e pro depurador não precisarem adivinhar pela forma da malha.
  const topoMundo=localParaMundo(lx,lzInicio+corrida);
  grupoEscada.userData.escadaInfo={
    numDegraus,alturaDegrau,pisada,corrida,
    limiteStepUp:ALTURA_DEGRAU,
    pe:{x:pe.x,z:pe.z,y:yBase},
    topo:{x:topoMundo.x,z:topoMundo.z,y:yBase+subida},
  };

  // ===== COLISÃO =====
  // Degrau NÃO é obstáculo do jogador. Essa era a decisão original do projeto (ver obstaculosPedestres
  // em Physics.js) e eu a furei numa versão anterior: com cada degrau virando obstáculo, o jogador
  // encostava, a rede anti-travamento entendia "encurralado" e o teleportava — o "me joga pra fora".
  // Quem sustenta o jogador é a superfície andável acima; o degrau não precisa barrar ninguém.
  // Só a SAIA vira obstáculo, e o topo dela fica na base do 1º degrau: ela impede entrar por baixo da
  // escada sem nunca barrar quem está subindo, porque fica sempre abaixo dos pés de quem está nela.
  const saiaMundo=localParaMundo(lx,lzInicio+corrida/2);
  const meiaLarg=largura/2,meiaCorr=corrida/2;
  const ex=Math.abs(cosR)*meiaLarg+Math.abs(sinR)*meiaCorr;
  const ez=Math.abs(sinR)*meiaLarg+Math.abs(cosR)*meiaCorr;
  const caixaSaia=new THREE.Box3(
    new THREE.Vector3(saiaMundo.x-ex,yBase-saiaAlt,saiaMundo.z-ez),
    new THREE.Vector3(saiaMundo.x+ex,yBase,saiaMundo.z+ez));
  obstaculos.push(caixaSaia);
  // Os degraus entram na lista de PEDESTRE: moradores e policiais continuam enxergando a escada como
  // volume, sem que ela vire parede pro jogador.
  for(let i=0;i<numDegraus;i++){
    const c=localParaMundo(lx,lzInicio+i*pisada+pisada/2);
    const px=Math.abs(cosR)*meiaLarg+Math.abs(sinR)*(pisada/2);
    const pz=Math.abs(sinR)*meiaLarg+Math.abs(cosR)*(pisada/2);
    obstaculosPedestres.push(new THREE.Box3(
      new THREE.Vector3(c.x-px,yBase,c.z-pz),
      new THREE.Vector3(c.x+px,yBase+(i+1)*alturaDegrau,c.z+pz)));
  }
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
function casaBairro(x,z,w=6,d=6,h=3,cor=0xd87957,tipo=0,registrar=true,ladoEscada=0,corTelhado=0x888888,refugio=false){const g=new THREE.Group();const terrenoY=obterElevacao(x,z);g.position.set(x,terrenoY,z);g.rotation.y=z>0?Math.PI:0;g.userData={bairroCasa:true,cor,tipo};bairro.add(g);const fachada=matReboco(cor);const casca=refugio?construirCascaCasa(g,w,h,d,fachada):null;if(refugio)g.userData.pecaPorta=construirPortaRefugio(g,d);const paredeMesh=casca?null:bloco(new THREE.BoxGeometry(w,h,d),fachada,0,h/2,0,g);const frente=new THREE.Mesh(new THREE.BoxGeometry(w*.7,.1,.04),concreto);frente.position.set(0,.08,d/2+.025);frente.castShadow=true;frente.receiveShadow=true;g.add(frente);const doorHeight=PORTA_ALTURA;if(!refugio)bloco(new THREE.BoxGeometry(.95,doorHeight,.08),porta,0,doorHeight/2,d/2+.07,g);for(const xx of [-w*.27,w*.27]){bloco(new THREE.BoxGeometry(1.22,1.02,.05),molduraJanela,xx,h*.56,d/2+.05,g);bloco(new THREE.BoxGeometry(1.05,.85,.06),Math.random()<.22?janelaAcesa:janela,xx,h*.56,d/2+.12,g);bloco(new THREE.BoxGeometry(1.18,.07,.08),concreto,xx,h*.56,d/2+.20,g)}const laje=bloco(new THREE.BoxGeometry(w+.12,.12,d+.12),matTelha(corTelhado),0,h+.06,0,g);superficiesAndaveis.push(laje);const muretaY=h+.12+.25;
// A escadaria (quando existe) fica FORA da largura w da casa (ver criarEscadariaViela). Sem estender a
// mureta frontal/traseira até lá, sobra um canto sem parapeito bem onde a escadaria termina — o jogador
// caminha por cima do telhado, passa reto por esse canto aberto e cai direto no vão entre as casas.
const alcanceEscada=w/2+ESCADA_LARGURA+ESCADA_MARGEM;
const muretaMinX=ladoEscada===-1?-alcanceEscada:-(w/2+.06),muretaMaxX=ladoEscada===1?alcanceEscada:(w/2+.06);
const muretaLargura=muretaMaxX-muretaMinX,muretaCentroX=(muretaMaxX+muretaMinX)/2;
const muretas=[bloco(new THREE.BoxGeometry(muretaLargura,.5,.12),matTelha(corTelhado),muretaCentroX,muretaY,d/2,g),bloco(new THREE.BoxGeometry(muretaLargura,.5,.12),matTelha(corTelhado),muretaCentroX,muretaY,-d/2,g)];if(ladoEscada!==1)muretas.push(bloco(new THREE.BoxGeometry(.12,.5,d+.12),matTelha(corTelhado),w/2,muretaY,0,g));if(ladoEscada!==-1)muretas.push(bloco(new THREE.BoxGeometry(.12,.5,d+.12),matTelha(corTelhado),-w/2,muretaY,0,g));g.userData.muretas=muretas;casasPos.push({x,z,w,d});if(tipo===2){const sacada=bloco(new THREE.BoxGeometry(w*.62,.12,.75),concreto,0,h*.62,d/2+.42,g);for(const xx of [-w*.3,-w*.1,w*.1,w*.3])bloco(new THREE.BoxGeometry(.05,.8,.05),posteMat,xx,h*.62+.38,d/2+.73,g)}if(tipo!==1){const tank=bloco(new THREE.CylinderGeometry(.38,.38,.62,10),agua,w*.22,h+.55,-d*.12,g);tank.castShadow=true}g.userData.paredeMesh=paredeMesh;if(registrar){if(casca)casca.forEach(registrarObstaculo);else registrarObstaculo(paredeMesh);muretas.forEach(registrarObstaculo)}return g}
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
// Escada precisa de viela nos DOIS lados que importam, e antes só a primeira era checada:
//  · AO LADO (beco entre blocos de 4 colunas) — é onde a escadaria encosta;
//  · À FRENTE DO 1º DEGRAU (beco entre blocos de 3 fileiras) — é por onde se chega nela.
// Sem a segunda, as fileiras ficam coladas fundo-com-frente e a escadaria da casa de trás nasce a
// ~60 cm do pé desta: a laje enterrada dela (2 m saindo do chão) fechava o acesso, o jogador andava
// contra ela sem subir, e aí a rede anti-travamento entendia "encurralado" e teleportava ele pra
// fora — exatamente o "não consigo subir, me joga pra fora".
// UMA escadaria por beco. Já tentei aproveitar também a coluna do outro lado (col%4===3) pra não
// perder escadarias com a regra nova — e o resultado foi dois lances paralelos a 1,34 m um do outro,
// com 1 m de largura cada: sobravam 34 cm entre eles e o beco lia como uma escada duplicada na tela.
const vielaAoLado=(col%4===0&&col>0)?-1:0;
const peDesobstruido=row%3===0;// beco na frente do 1º degrau (na fileira 0, a borda do mapa)
const ladoEscada=(vielaAoLado&&peDesobstruido)?vielaAoLado:0;
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

// ===== PORTEIRA DA FAZENDA =====
// Declarada FORA de criarFazenda pra quem consome (Economy, testes) importar um objeto estável, e
// preenchida lá dentro. `raio` é a distância em que a tecla E passa a valer pra ela.
export const porteiraFazenda={x:0,y:0,z:0,aberta:true,raio:3.6,pivos:[],caixa:null,caixaFechada:null};
const PORTEIRA_ABERTA_RAD=Math.PI*.55;// abre pra dentro do sítio, encostando na cerca
function aplicarPorteira(){
  for(const{pivo,lado}of porteiraFazenda.pivos)
    pivo.rotation.y=porteiraFazenda.aberta?lado*PORTEIRA_ABERTA_RAD:0;
  if(porteiraFazenda.aberta)sumirCaixa(porteiraFazenda.caixa);
  else porteiraFazenda.caixa.copy(porteiraFazenda.caixaFechada);
}
export function alternarPorteira(){
  porteiraFazenda.aberta=!porteiraFazenda.aberta;
  aplicarPorteira();
  return porteiraFazenda.aberta;
}
export function pertoDaPorteira(pos){
  return Math.hypot(pos.x-porteiraFazenda.x,pos.z-porteiraFazenda.z)<porteiraFazenda.raio;
}

// ===== FAZENDA: área rural afastada da cidade, além do limite oeste do bairro.
// A cerca é de RIPA (mourão + duas travessas), não de estaca solta: um anel de palitos espetados no
// chão não lê como cerca de nenhuma distância. Travessa acompanha o desnível entre um mourão e o
// seguinte — o terreno aqui é ondulado, e travessa reta deixaria a cerca boiando no alto do morro.
//
// Tudo que se repete (mourão, travessa, canteiro, pé de planta) vai em InstancedMesh: são ~330 peças
// em 4 draw calls. Nada disso é obstáculo — quem trava o jogador na fazenda é só a parede do celeiro,
// como antes. Pôr a cerca em `obstaculos` mudaria a NavMesh e o caminho da polícia de tabela.
function criarFazenda(cx,cz){
  const meiaLarg=13,meiaProf=11;
  const bx=cx-meiaLarg+5,bz=cz-meiaProf+5,by=obterElevacao(bx,bz);
  const madeiraCeleiro=matMadeira(0xa2603a),madeiraCerca=matMadeira(0x8a6440),ripaEscura=matMadeira(0x59422e);

  // --- PÁTIO ---
  // Manta de terra batida por cima do chão do mapa, um pouco maior que a cerca. Os vértices seguem
  // obterElevacao (o mesmo relevo do terreno) e sobem 4 cm: acompanhando o morro ela não afunda, e a
  // folga tira o z-fighting com o chão. É 1 draw call e dá ao sítio um tom próprio — sem isso a
  // fazenda fica montada em cima da mesma areia clara do bairro e parece deserto.
  const patioL=meiaLarg*2+6,patioP=meiaProf*2+6,divs=Math.round(patioL),divsP=Math.round(patioP);
  const geoPatio=new THREE.PlaneGeometry(patioL,patioP,divs,divsP);
  const vp=geoPatio.attributes.position;
  for(let i=0;i<vp.count;i++){
    const lx=vp.getX(i),ly=vp.getY(i);// plano ainda deitado no XY: Y local vira -Z do mundo
    vp.setZ(i,obterElevacao(cx+lx,cz-ly)-obterElevacao(cx,cz));
  }
  geoPatio.computeVertexNormals();
  const uvPatio=geoPatio.attributes.uv.clone();
  for(let i=0;i<uvPatio.count;i++)uvPatio.setXY(i,uvPatio.getX(i)*patioL/4,uvPatio.getY(i)*patioP/4);
  geoPatio.setAttribute('uv',uvPatio);geoPatio.setAttribute('uv1',uvPatio);
  const patio=new THREE.Mesh(geoPatio,matTerraBatida());
  patio.rotation.x=-Math.PI/2;patio.position.set(cx,obterElevacao(cx,cz)+.04,cz);
  patio.receiveShadow=true;bairro.add(patio);

  // --- CELEIRO ---
  // A parede mantém exatamente a caixa de antes (6 x 3,2 x 5 em bx,bz): é o obstáculo registrado e o
  // que `dentroDoCurral` usa pra manter os bichos do lado de fora. Mudar a medida mexeria nos dois.
  bloco(new THREE.BoxGeometry(6.3,.3,5.3),matConcreto(),bx,by+.15,bz);// base: tira o celeiro do barro
  const paredeCeleiro=bloco(new THREE.BoxGeometry(6,3.2,5),madeiraCeleiro,bx,by+1.6,bz);
  registrarObstaculo(paredeCeleiro);
  // Telhado de duas águas. A inclinação sai da geometria (meia largura x altura do cume), não de um
  // ângulo escolhido no olho: a empena logo abaixo é montada com a MESMA conta, e foi assim que ela
  // parou de furar o telhado. Antes o ângulo era .55 rad chutado e a empena vinha de larguras fixas —
  // os degraus dela apareciam por fora da água, como uma escadinha marrom saindo do telhado.
  const telhadoFazenda=matTelha(0x6e6a62);
  const meiaLargC=3,alturaParede=3.2,alturaCume=4.55,beiral=.45;
  const subidaTelhado=alturaCume-alturaParede;
  const inclinacao=Math.atan2(subidaTelhado,meiaLargC);
  const compAgua=Math.hypot(meiaLargC,subidaTelhado)+beiral;
  for(const lado of[-1,1]){
    const agua=new THREE.Mesh(uvPorMetro(new THREE.BoxGeometry(compAgua,.16,5.9)),telhadoFazenda);
    // Centro da água = meio do trecho que vai do cume até a ponta do beiral.
    agua.position.set(bx+lado*Math.cos(inclinacao)*compAgua/2,
                      by+alturaCume-Math.sin(inclinacao)*compAgua/2,bz);
    // A caixa é simétrica, então girar -incl (lado +1) ou +incl (lado -1) cobre o mesmo trecho.
    agua.rotation.z=-lado*inclinacao;
    agua.castShadow=true;agua.receiveShadow=true;bairro.add(agua);
  }
  bloco(new THREE.BoxGeometry(.3,.26,6),ripaEscura,bx,by+alturaCume-.05,bz);// cumeeira: fecha a junta
  // Empena em degraus de ripa. Cada degrau usa a largura do telhado no TOPO dele (a parte estreita):
  // usando a de baixo, o canto do degrau ficaria por fora da água.
  const DEGRAUS_EMPENA=5,hDegrau=subidaTelhado/DEGRAUS_EMPENA;
  for(const lz of[-1,1])for(let i=0;i<DEGRAUS_EMPENA;i++){
    const yTopo=alturaParede+(i+1)*hDegrau;
    const larg=2*meiaLargC*(alturaCume-yTopo)/subidaTelhado;
    if(larg<.25)break;
    bloco(new THREE.BoxGeometry(larg,hDegrau,.14),madeiraCeleiro,bx,by+yTopo-hDegrau/2,bz+lz*2.5);
  }
  // Portão duplo do celeiro, mais escuro que a parede.
  for(const lx of[-.42,.42])bloco(new THREE.BoxGeometry(.8,2.1,.1),ripaEscura,bx+lx,by+1.35,bz+2.53);
  bloco(new THREE.BoxGeometry(1.75,.12,.14),ripaEscura,bx,by+2.45,bz+2.56);
  bloco(new THREE.BoxGeometry(.9,.7,.1),ripaEscura,bx,by+3.05,bz+2.53);// portinhola do feno, lá em cima
  // Cocho e barril ao lado do celeiro.
  bloco(new THREE.BoxGeometry(2.1,.4,.7),ripaEscura,bx-3.4,by+.3,bz-1.6);
  bloco(new THREE.CylinderGeometry(.35,.4,.7,10),ripaEscura,bx-2.6,by+.35,bz-2.3);

  const m4=new THREE.Matrix4(),posV=new THREE.Vector3(),quatV=new THREE.Quaternion(),escalaV=new THREE.Vector3();
  const eixoY=new THREE.Vector3(0,1,0),eixoX=new THREE.Vector3(1,0,0);

  // --- CERCA DE RIPA, COM COLISOR E PORTEIRA ---
  // A cerca AGORA BARRA. Antes era só desenho e dava pra atravessar a fazenda andando reto. O colisor
  // não é um por mourão: são 5 caixas (uma por trecho reto), porque `caixaColideComObstaculos` varre a
  // lista inteira a cada teste de movimento — 40 caixinhas de mourão custariam 10x mais que 5 barras,
  // e barrariam pior (entre dois mourões passa gente).
  const cantos=[[cx-meiaLarg,cz-meiaProf],[cx+meiaLarg,cz-meiaProf],[cx+meiaLarg,cz+meiaProf],[cx-meiaLarg,cz+meiaProf]];
  const ALTURA_MOURAO=1.25,ALTURAS_TRAVESSA=[.42,.82];
  // A porteira fica no lado LESTE (x = cx+meiaLarg), que é o lado virado pro bairro: é por ali que o
  // jogador chega, e uma entrada no lado errado obrigaria a contornar o sítio inteiro.
  const PORTEIRA_VAO=3.4,porteiraZ=cz,porteiraX=cx+meiaLarg;
  const vaoZ0=porteiraZ-PORTEIRA_VAO/2,vaoZ1=porteiraZ+PORTEIRA_VAO/2;
  // Trechos retos de cerca. O lado leste vira DOIS trechos, com o vão da porteira entre eles.
  const trechos=[];
  for(let lado=0;lado<4;lado++){
    const a=cantos[lado],b=cantos[(lado+1)%4];
    if(lado===1)trechos.push([a,[porteiraX,vaoZ0]],[[porteiraX,vaoZ1],b]);
    else trechos.push([a,b]);
  }
  const mouroes=[],travessas=[];
  for(const[a,b]of trechos){
    const passos=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/2.4));
    let antX=null,antZ=null;
    for(let i=0;i<=passos;i++){
      const t=i/passos,px=a[0]+(b[0]-a[0])*t,pz=a[1]+(b[1]-a[1])*t;
      // Mourão repetido no mesmo ponto brigaria por z-fighting: o fim de um trecho é o começo do
      // seguinte. Compara com o último empilhado em vez de confiar no índice, porque agora os trechos
      // não são mais 4 lados encadeados — o vão da porteira quebra a sequência.
      const ult=mouroes[mouroes.length-1];
      if(!ult||Math.hypot(ult[0]-px,ult[1]-pz)>.05)mouroes.push([px,pz]);
      if(antX!==null)travessas.push([antX,antZ,px,pz]);
      antX=px;antZ=pz;
    }
  }
  // Colisor de cada trecho: uma AABB fina que vai do terreno mais baixo do trecho até o topo do mourão
  // no mais alto. Enterrar 60 cm é o que impede passar por baixo onde o chão cai entre dois mourões.
  const ESPESSURA_CERCA=.16;
  for(const[a,b]of trechos){
    const passos=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
    let yMin=Infinity,yMax=-Infinity;
    for(let i=0;i<=passos;i++){
      const t=i/passos,e=obterElevacao(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
      yMin=Math.min(yMin,e);yMax=Math.max(yMax,e);
    }
    obstaculos.push(new THREE.Box3(
      new THREE.Vector3(Math.min(a[0],b[0])-ESPESSURA_CERCA/2,yMin-.6,Math.min(a[1],b[1])-ESPESSURA_CERCA/2),
      new THREE.Vector3(Math.max(a[0],b[0])+ESPESSURA_CERCA/2,yMax+ALTURA_MOURAO,Math.max(a[1],b[1])+ESPESSURA_CERCA/2)));
  }
  const mesaMourao=new THREE.InstancedMesh(uvPorMetro(new THREE.BoxGeometry(.13,ALTURA_MOURAO,.13)),madeiraCerca,mouroes.length);
  mesaMourao.castShadow=true;mesaMourao.receiveShadow=true;
  mouroes.forEach(([px,pz],i)=>{m4.makeTranslation(px,obterElevacao(px,pz)+ALTURA_MOURAO/2-.1,pz);mesaMourao.setMatrixAt(i,m4)});
  mesaMourao.instanceMatrix.needsUpdate=true;bairro.add(mesaMourao);

  // Travessa: uma caixa de 1 m no eixo X, esticada e girada pra ir de um mourão ao outro. Girar por
  // setFromUnitVectors com a direção JÁ INCLUINDO o desnível é o que faz ela seguir o terreno.
  const geoTravessa=uvPorMetro(new THREE.BoxGeometry(1,.13,.05));
  const mesaTravessa=new THREE.InstancedMesh(geoTravessa,ripaEscura,travessas.length*ALTURAS_TRAVESSA.length);
  mesaTravessa.castShadow=true;mesaTravessa.receiveShadow=true;
  const de=new THREE.Vector3(),para=new THREE.Vector3(),dir=new THREE.Vector3();
  let k=0;
  for(const[ax,az,bx2,bz2]of travessas){
    for(const alt of ALTURAS_TRAVESSA){
      de.set(ax,obterElevacao(ax,az)+alt,az);
      para.set(bx2,obterElevacao(bx2,bz2)+alt,bz2);
      dir.subVectors(para,de);
      const compr=dir.length();dir.divideScalar(compr);
      quatV.setFromUnitVectors(eixoX,dir);
      posV.addVectors(de,para).multiplyScalar(.5);
      escalaV.set(compr,1,1);
      m4.compose(posV,quatV,escalaV);mesaTravessa.setMatrixAt(k++,m4);
    }
  }
  mesaTravessa.instanceMatrix.needsUpdate=true;bairro.add(mesaTravessa);

  // --- ROÇA: canteiros de terra arada com os pés plantados em cima ---
  // Antes eram cones verdes espetados no barro seco, em grade. Canteiro é o que faz virar plantação:
  // a fileira de terra escura dá o desenho, e o pé de planta só mora nela.
  const canteiros=[],pes=[];
  const zIni=cz-meiaProf+2.2,zFim=cz+meiaProf-8,xIni=cx-meiaLarg+7.5,xFim=cx+meiaLarg-2.2;
  const comprimento=xFim-xIni,meioX=(xIni+xFim)/2;
  for(let z=zIni;z<=zFim;z+=1.7){
    canteiros.push([meioX,z,comprimento]);
    for(let x=xIni+.35;x<=xFim-.35;x+=.62)pes.push([x+(Math.random()-.5)*.16,z+(Math.random()-.5)*.22]);
  }
  const mesaCanteiro=new THREE.InstancedMesh(uvPorMetro(new THREE.BoxGeometry(1,.13,1.02)),matTerraArada(),canteiros.length);
  mesaCanteiro.castShadow=false;mesaCanteiro.receiveShadow=true;
  canteiros.forEach(([mx,mz,comp],i)=>{
    // Meio enterrado: um canteiro apoiado por cima do chão vira barra de chocolate. Assentado, o que
    // aparece é a leira de terra levantada, que é o que a enxada faz.
    posV.set(mx,obterElevacao(mx,mz)+.02,mz);escalaV.set(comp,1,1);
    m4.compose(posV,new THREE.Quaternion(),escalaV);mesaCanteiro.setMatrixAt(i,m4);
  });
  mesaCanteiro.instanceMatrix.needsUpdate=true;bairro.add(mesaCanteiro);

  // Pé de planta: icosaedro achatado lê como moita de folha, o cone lia como pinheirinho de enfeite.
  // A cor varia POR INSTÂNCIA (instanceColor) — continua 1 draw call, e sem isso a roça inteira fica
  // do mesmo verde chapado, que é o que mais denuncia repetição.
  // roughness 1: a 0,92 a face plana do icosaedro ainda pegava brilho especular do sol e a roça
  // inteira ficava com cara de vidro leitoso em vez de folha.
  const matPe=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true});
  const mesaPe=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.26,0),matPe,pes.length);
  mesaPe.castShadow=true;mesaPe.receiveShadow=true;
  const corPe=new THREE.Color();
  pes.forEach(([px,pz],i)=>{
    const e=.8+Math.random()*.5;
    posV.set(px,obterElevacao(px,pz)+.14+e*.13,pz);
    quatV.setFromAxisAngle(eixoY,Math.random()*Math.PI*2);
    escalaV.set(e,e*.78,e);// achatado: moita, não bola
    m4.compose(posV,quatV,escalaV);mesaPe.setMatrixAt(i,m4);
    // Verde de folha. O SRGBColorSpace aqui não é enfeite: `setHSL` do three assume o espaço de
    // TRABALHO (linear) quando não se diz nada — ao contrário de `setHex` —, então um L de 0,20
    // "escuro" entrava como 0,20 LINEAR, que é sRGB 0,49. Com o sol a 2,5 e tone mapping ACES por
    // cima, a roça saía verde-menta lavado. Dizendo sRGB, o número volta a significar o que parece.
    corPe.setHSL(.25+Math.random()*.06,.5+Math.random()*.2,.22+Math.random()*.1,THREE.SRGBColorSpace);
    mesaPe.setColorAt(i,corPe);
  });
  mesaPe.instanceMatrix.needsUpdate=true;if(mesaPe.instanceColor)mesaPe.instanceColor.needsUpdate=true;
  bairro.add(mesaPe);

  // --- PORTEIRA ---
  // Duas folhas de ripa penduradas nos dois batentes do vão, abrindo pra DENTRO do sítio. O batente é
  // mais grosso que o mourão comum: é o que faz a entrada se ler como entrada de longe.
  const yPorteira=obterElevacao(porteiraX,porteiraZ);
  const ALTURA_PORTEIRA=1.35,folhaLarg=PORTEIRA_VAO/2;
  const pivos=[];
  for(const lado of[-1,1]){
    const batenteZ=porteiraZ+lado*PORTEIRA_VAO/2;
    bloco(new THREE.BoxGeometry(.2,ALTURA_PORTEIRA+.35,.2),madeiraCerca,
      porteiraX,obterElevacao(porteiraX,batenteZ)+(ALTURA_PORTEIRA+.35)/2-.1,batenteZ);
    const pivo=new THREE.Group();
    pivo.position.set(porteiraX,yPorteira,batenteZ);
    bairro.add(pivo);
    // A folha nasce deslocada meia largura DA DOBRADIÇA pro centro do vão: assim girar o pivô gira a
    // folha em volta do batente, como porteira de verdade, em vez de girar em torno do próprio meio.
    // A folha é comprida no eixo Z, que é o eixo DO VÃO. Montei ela comprida em X na primeira versão
    // e ficou tudo invertido: fechada, as folhas apontavam pra fora perpendiculares ao vão (que
    // continuava aberto), e abrindo é que elas se alinhavam com a cerca.
    const folha=new THREE.Group();folha.position.set(0,0,-lado*folhaLarg/2);pivo.add(folha);
    for(const alt of[.38,.78,1.18])
      bloco(new THREE.BoxGeometry(.06,.14,folhaLarg),ripaEscura,0,alt,0,folha);
    for(const lz of[-folhaLarg/2+.06,folhaLarg/2-.06])
      bloco(new THREE.BoxGeometry(.08,ALTURA_PORTEIRA,.12),ripaEscura,0,ALTURA_PORTEIRA/2,lz,folha);
    // Travessa diagonal (a "cruz" da porteira): é ela que dá a leitura de portão de fazenda.
    const diag=bloco(new THREE.BoxGeometry(.05,.12,Math.hypot(folhaLarg,ALTURA_PORTEIRA-.4)),
      ripaEscura,0,ALTURA_PORTEIRA/2,0,folha);
    diag.rotation.x=lado*Math.atan2(ALTURA_PORTEIRA-.4,folhaLarg);
    pivos.push({pivo,lado});
  }
  // O COLISOR é UM só, a caixa do vão inteiro — não um por folha. O que importa pro jogo é se dá pra
  // passar pelo vão, e uma caixa custa metade da varredura de duas. Mesmo truque do refúgio: a Box3
  // fica na lista pra sempre e o que muda é o CONTEÚDO dela. Trocar de lista a cada abre/fecha
  // invalidaria os índices que a NavMesh já rasterizou.
  const caixaPorteiraFechada=new THREE.Box3(
    new THREE.Vector3(porteiraX-.2,yPorteira-.6,vaoZ0),
    new THREE.Vector3(porteiraX+.2,yPorteira+ALTURA_PORTEIRA,vaoZ1));
  const caixaPorteira=new THREE.Box3();sumirCaixa(caixaPorteira);
  obstaculos.push(caixaPorteira);
  // Nasce ABERTA pelo mesmo motivo que as casas-refúgio: a NavMesh é rasterizada uma vez, depois que
  // todos os obstáculos entraram, e se o vão estivesse fechado nessa hora a polícia nunca acharia
  // caminho pra dentro do sítio — nem depois de o jogador abrir a porteira.
  porteiraFazenda.x=porteiraX;porteiraFazenda.z=porteiraZ;porteiraFazenda.y=yPorteira;
  porteiraFazenda.caixa=caixaPorteira;porteiraFazenda.caixaFechada=caixaPorteiraFechada;
  porteiraFazenda.pivos=pivos;porteiraFazenda.aberta=true;
  aplicarPorteira();

  // Árvores no fundo do sítio, fora da roça e longe do celeiro.
  for(const[ax,az]of[[cx-meiaLarg-3,cz+6],[cx-meiaLarg-2,cz-8],[cx+meiaLarg+3,cz-4],[cx+meiaLarg+2,cz+8],[cx-4,cz+meiaProf+3]])
    arvore(ax,az,1+Math.random()*.25);

  return{cx,cz,meiaLarg,meiaProf,celeiro:{x:bx,z:bz,meiaLarg:3.3,meiaProf:2.8}};
}
export const FAZENDA=criarFazenda(-86,-50);

// ===== BALCÃO DO DEPÓSITO RURAL (polo Fazenda) =====
// Marca visual de que o celeiro atende: sem isso o jogador chega no ponto de interação e não entende por
// que apareceu um painel de compra. Puramente decorativo — nada aqui vira obstáculo, o celeiro já é um.
function criarBalcaoFazenda(x,z){
  const g=new THREE.Group();const y=obterElevacao(x,z);g.position.set(x,y,z);bairro.add(g);
  bloco(new THREE.BoxGeometry(2.6,.12,1),matMadeira(0x9c7448),0,.95,0,g);
  for(const lx of[-1.1,1.1])bloco(new THREE.BoxGeometry(.12,.95,.12),matMadeira(0x8a6440),lx,.48,0,g);
  bloco(new THREE.BoxGeometry(2.9,.1,1.3),matTelha(0x6e6a62),0,2.05,-.1,g);
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
    // Sem perna, o porco era um retângulo rosa boiando 32 cm do chão — de longe lia como um papel
    // largado na roça. Quatro tocos e um focinho já resolvem a silhueta.
    const pele=bmat(0xc9827c),focinho=bmat(0xa8635e);
    bloco(new THREE.BoxGeometry(.55,.4,.32),pele,0,.42,0,g);
    bloco(new THREE.BoxGeometry(.2,.22,.2),pele,.32,.44,0,g);
    bloco(new THREE.BoxGeometry(.07,.08,.14),focinho,.44,.42,0,g);
    for(const lx of[-.16,.18])for(const lz of[-.11,.11])bloco(new THREE.BoxGeometry(.09,.24,.09),focinho,lx,.12,lz,g);
    for(const lz of[-.07,.07])bloco(new THREE.BoxGeometry(.09,.09,.03),focinho,.3,.56,lz,g);// orelhas
    velocidade=.7;
  }else{
    const pena=bmat(0xe4dece),bico=bmat(0xd98a3f),crista=bmat(0xb03c30);
    bloco(new THREE.BoxGeometry(.22,.22,.3),pena,0,.3,0,g);
    bloco(new THREE.BoxGeometry(.14,.14,.14),pena,0,.42,.14,g);
    bloco(new THREE.ConeGeometry(.04,.09,4),bico,0,.42,.24,g);
    bloco(new THREE.BoxGeometry(.05,.06,.03),crista,0,.51,.12,g);
    for(const lx of[-.06,.06])bloco(new THREE.BoxGeometry(.03,.19,.03),bico,lx,.1,0,g);// pernas
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
