// Geração do bairro: casas/sobrados, escadarias de viela, postes/fios, árvores, mercado, fazenda e animais.
import*as THREE from'three';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,registrarCaixa,superficiesAndaveis,obstaculosPedestres,marcarObstaculoMovel,marcarSemFusao}from'./Physics.js';
import{bmat,matReboco,matTelha,matConcreto,matMadeira,matTerraArada,matTerraBatida,graffiteMat,uvPorMetro,tijolo,concreto,janela,janelaAcesa,molduraJanela,porta,agua,posteMat,folhaMat,folhaClara,criarSombraContato}from'./Materials.js';
import{POLOS}from'./Poles.js';
// O degrau da escadaria é derivado do step-up do jogador: um número solto aqui viraria escada
// intransponível na primeira vez que a altura do personagem mudasse.
import{ALTURA_DEGRAU}from'./Player.js';

export const bairro=new THREE.Group();scene.add(bairro);
// Paleta encardida, tirada da referência de favela: vermelho de tijolo sujo, ocre, cinza-azulado,
// creme desbotado, salmão queimado. Antes eram laranjas saturados, que com a textura de reboco nova
// (quase branca, com cimento escuro à mostra) sairiam berrantes — a tinta MULTIPLICA o mapa, então
// cor forte aqui vira plástico. Tom baixo é o que deixa a textura aparecer.
const coresBairro=[0x9a5347,0xb08a4e,0x93a09e,0xc2b294,0x7d6b57,0xa8563f,0x6f7b7d];
// Largura da escadaria e a margem de encaixe na parede — compartilhadas entre a escadaria e a mureta da
// casa (ver casaBairro) pra garantir que a mureta sempre cubra o vão da escadaria, sem depender de dois
// números iguais mantidos em lugares separados.
const ESCADA_LARGURA=1,ESCADA_MARGEM=.03;
// Bordas de telhado que ganham mureta. O padrão é as quatro: quem não passa nada (o andar de cima do
// sobrado, o Mercado) é um prédio solto, com vão dos quatro lados.
const BORDAS_TODAS={frente:true,tras:true,esq:true,dir:true};

// Todo bloco com material TEXTURADO ganha UV em metros: sem isto uma parede de 6 m e uma mureta de
// 12 cm receberiam a mesma textura esticada, e o tijolo sairia gigante num e minúsculo no outro.
// ===== DECALQUE DE GRAFFITE =====
// Quatro planos, um por quadrante do atlas. A escolha da tag mora na UV da GEOMETRIA, não numa
// textura por casa: assim as quatro pichações do bairro dividem uma textura e um material só.
// Criadas uma vez e reusadas por todas as paredes que recebem pichação.
const GEOS_GRAFFITE=[[0,0],[1,0],[0,1],[1,1]].map(([qx,qy])=>{
  const g=new THREE.PlaneGeometry(1,1);
  const uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+qx)*.5,(uv.getY(i)+qy)*.5);
  uv.needsUpdate=true;
  return g;
});
// Cola uma pichação na fachada. `larg` é a largura em metros; a altura acompanha a proporção do
// quadrante (quadrado), e o plano fica 4 cm à frente da parede.
function graffite(parent,indice,x,y,z,larg){
  const m=new THREE.Mesh(GEOS_GRAFFITE[indice%GEOS_GRAFFITE.length],graffiteMat);
  m.position.set(x,y,z);m.scale.set(larg,larg,1);
  m.castShadow=false;m.receiveShadow=false;// decalque não projeta nem recebe sombra: é tinta na parede
  parent.add(m);
  return m;
}

// ===== QUEM PROJETA SOMBRA =====
// Isto marcava `castShadow=true` em TODA malha, sem exceção: peitoril de 7 cm, balaústre de 6 cm,
// moldura de janela, mureta decorativa do andar de cima do sobrado. O efeito é que o passe de sombra
// redesenha praticamente o bairro inteiro dentro da caixa de 68x68 m que segue o jogador — medido
// pela auditoria em ~800 a 1.400 draw calls EXTRAS por quadro, ou seja, o custo de geometria do jogo
// dobrado pra desenhar sombra de peça que ninguém enxerga.
//
// A regra é dimensional e conservadora: só projeta sombra quem tem espessura (>= 12 cm no menor lado)
// E tamanho (>= 60 cm no maior). Parede, laje, mureta e porta passam; peitoril, moldura, balaústre e
// ripa não. Todo mundo continua RECEBENDO sombra — receber é praticamente de graça, é o que faz a
// peça pequena ficar escura quando está na sombra da casa, e é aí que o olho percebe.
const SOMBRA_MIN_ESPESSURA=.12,SOMBRA_MIN_TAMANHO=.6;
function projetaSombra(geo){
  const p=geo.parameters;
  if(!p)return true;// geometria sem parâmetros (mesclada, importada): não arrisca, projeta
  const d=[p.width??p.radiusTop*2??1,p.height??1,p.depth??p.radiusBottom*2??1];
  return Math.min(...d)>=SOMBRA_MIN_ESPESSURA&&Math.max(...d)>=SOMBRA_MIN_TAMANHO;
}
function bloco(geo,material,x,y,z,parent=bairro){if(material&&material.map)uvPorMetro(geo);const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=projetaSombra(geo);m.receiveShadow=true;parent.add(m);return m}

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
  // O topo encosta na borda da frente do telhado, e a casa com escadaria NÃO leva mureta na frente
  // (ver `bordas` no traçado) — era a mureta estendida por cima da escada que travava a chegada.
  const lzTopoBase=d/2-.25;
  // ===== A CORRIDA ACOMPANHA A SUBIDA =====
  // Era travada na profundidade da casa (4,4 m). No mapa plano isso bastava, porque a subida era só a
  // altura da casa. No morro a laje pode ficar 5 m acima do pé da escada, e espremer 5 m de subida em
  // 4,4 m de corrida dá 49°: a pisada encolhia pra 13 cm e a escada virava parede — o jogador subia
  // 3 m, batia e escorregava pro lado (medido: 6,1 m de desvio lateral, laje nunca alcançada).
  // Agora a corrida sai da subida a 35° (tan 35° ≈ 0,70), que é inclinação de escada de verdade, e a
  // escada CRESCE pra fora da casa quando precisa. O espaço extra é reservado no traçado (ver
  // `escadaDe`), então ela não nasce dentro da vizinha.
  // A ESCADA PROCURA O CHÃO. Fixar o comprimento por trigonometria (subida / tan 35°) parecia certo e
  // estava errado: no morro o terreno atrás da casa DESCE, então o pé calculado ficava pendurado no
  // ar. Medido: o jogador largado no pé caía 2,5 m e terminava andando lá embaixo — o teste dizia
  // "não subiu", e o defeito era a escada não encostar no chão.
  // Agora ela desce do topo pela inclinação alvo, amostrando o terreno de 25 em 25 cm, e PARA no
  // primeiro ponto onde a linha da escada encontra o solo. O comprimento é uma consequência do
  // relevo, não um número escolhido antes de olhar pra ele.
  const CORRIDA_MAX_ABS=9,INCLINACAO=Math.tan(35*Math.PI/180);
  let corridaMax=1.2;
  for(let dist=1.2;dist<=CORRIDA_MAX_ABS;dist+=.25){
    const m=localParaMundo(lx,lzTopoBase-dist);
    if(lajeY-dist*INCLINACAO<=obterElevacao(m.x,m.z)+.05){corridaMax=dist;break}
    corridaMax=dist;
  }

  // A escada sobe do terreno NO PÉ dela até a laje. Medir no pé (e não no centro) é o que faz o
  // último degrau terminar exatamente rente ao telhado em terreno inclinado.
  // O TOPO tem que cair DENTRO da laje, não em cima do vazio. Com a corrida centrada na casa
  // (`-corrida/2` a `+corrida/2`) e agora podendo chegar a 9 m contra 4,8 m de casa, o último degrau
  // terminava 2,1 m ADIANTE do telhado: o jogador subia tudo e parava no ar, a 0,9 m da laje.
  // Ancorando o TOPO na borda do telhado, a escada cresce pra TRÁS — pro lado de fora da casa, que é
  // onde há beco — e o último degrau encosta no telhado.
  const lzTopo=lzTopoBase;
  const pe=localParaMundo(lx,lzTopo-corridaMax);
  const yBase=obterElevacao(pe.x,pe.z);
  const subida=lajeY-yBase;
  if(subida<=0)return null;

  // Todos os degraus com a MESMA altura, tirada da divisão exata da subida. A altura alvo fica em 70%
  // do step-up do jogador: a folga é o que impede que um desnível de terreno empurre um degrau pra
  // cima do limite e transforme a escada em parede.
  const numDegraus=Math.max(3,Math.ceil(subida/(ALTURA_DEGRAU*.70)));
  const alturaDegrau=subida/numDegraus;
  // A pisada preenche o comprimento disponível, com teto de 30 cm pra escada baixa não virar rampa.
  // Piso mínimo de 22 cm: abaixo disso o pé do jogador ocupa três degraus ao mesmo tempo e o
  // raycast vertical fica pingando entre eles.
  const pisada=THREE.MathUtils.clamp(corridaMax/numDegraus,.22,.30);
  const corrida=numDegraus*pisada,lzInicio=lzTopo-corrida;

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
  registrarCaixa(caixaSaia,'escada');
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
// `afundar` estende as paredes PRA BAIXO sem mexer no topo: é o que assenta a casa no terreno em
// declive. Ver casaBairro.
function construirCascaCasa(g,w,h,d,fachada,afundar=0){
  const paredes=[],meia=ESP_PAREDE/2;
  const hp=h+afundar,yp=h/2-afundar/2;// parede mais alta, topo no mesmo lugar
  paredes.push(bloco(new THREE.BoxGeometry(w,hp,ESP_PAREDE),fachada,0,yp,-d/2+meia,g));
  for(const s of[-1,1])paredes.push(bloco(new THREE.BoxGeometry(ESP_PAREDE,hp,d-ESP_PAREDE*2),fachada,s*(w/2-meia),yp,0,g));
  // Frente: duas faixas ao lado do vão + verga por cima, deixando a porta ABERTA (sem a folha, que
  // nas casas normais é uma placa colada na fachada e aqui tamparia justamente a entrada).
  const ladoLarg=(w-VAO_PORTA)/2;
  for(const s of[-1,1])paredes.push(bloco(new THREE.BoxGeometry(ladoLarg,hp,ESP_PAREDE),fachada,s*(VAO_PORTA+ladoLarg)/2,yp,d/2-meia,g));
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
// ASSENTAMENTO NO TERRENO. A casa é posicionada pela elevação do CENTRO, mas o terreno é ondulado:
// num lote em declive isso deixava um canto até 80 cm no ar (e o oposto 80 cm enterrado). `afundar`
// estica as paredes pra baixo até o canto mais baixo, mantendo o topo onde estava. É de graça em
// draw calls — a mesma malha, só mais alta — enquanto um baldrame separado custaria +111 malhas.
// `assentar=false` é pro andar de cima do sobrado, que se apoia na casa e não no chão.
function casaBairro(x,z,w=6,d=6,h=3,cor=0xd87957,tipo=0,registrar=true,ladoEscada=0,corTelhado=0x888888,refugio=false,assentar=true,bordas=BORDAS_TODAS,giro=null){const g=new THREE.Group();
  // A CASA SE ASSENTA PELA SOLEIRA, NÃO PELO CENTRO. Numa encosta de 19° o centro pode estar mais de
  // um metro acima do terreno na frente da porta — medi 1,34 m — e o passo do jogador é 0,22 m: a
  // porta ficava intransponível, com o esconderijo inteiro inacessível e nenhum erro aparecendo.
  // Fincando pela cota da soleira, a entrada nasce sempre no nível da rua; o fundo, que fica mais
  // alto, é absorvido pelo `afundar` (a parede estica pra baixo até o canto mais fundo).
  const gy=giro!==null?giro:(z>0?Math.PI:0);
  const terrenoY=obterElevacao(x+Math.sin(gy)*d/2,z+Math.cos(gy)*d/2);g.position.set(x,terrenoY,z);
  // A casa acompanha a curva da rua que passa na frente dela. Antes era `z>0?PI:0` — dois valores só,
  // porque o traçado era um tabuleiro. `giro` vem da TANGENTE da spline do beco (ver o traçado lá
  // embaixo); o padrão antigo continua valendo pro Mercado e pras lojas, que não estão numa curva.
  g.rotation.y=gy;g.userData={bairroCasa:true,cor,tipo};bairro.add(g);const fachada=matReboco(cor);
// Variação ESTÁVEL por posição: a mesma casa recebe sempre a mesma pichação, o mesmo rodapé e o mesmo
// telheiro. Math.random() aqui faria o bairro trocar de cara a cada carregamento — e o jogador decora
// o caminho pelas casas, então a fachada precisa ser sempre a mesma.
const semente=Math.abs(Math.round(x*7.3+z*13.7));
let afundar=0;
if(assentar){
  // Os quatro cantos medidos NO MUNDO, já girados: com a casa torta, medir nos eixos globais pegava
  // pontos que não são canto nenhum, e a parede parava de encostar no chão justamente na encosta.
  const cg=Math.cos(g.rotation.y),sg=Math.sin(g.rotation.y);
  let menor=terrenoY;
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const lx=sx*w/2,lz=sz*d/2;
    menor=Math.min(menor,obterElevacao(x+lx*cg+lz*sg,z-lx*sg+lz*cg));
  }
  afundar=Math.max(0,terrenoY-menor)+.12;
}
const casca=refugio?construirCascaCasa(g,w,h,d,fachada,afundar):null;if(refugio)g.userData.pecaPorta=construirPortaRefugio(g,d);const paredeMesh=casca?null:bloco(new THREE.BoxGeometry(w,h+afundar,d),fachada,0,h/2-afundar/2,0,g);const frente=new THREE.Mesh(new THREE.BoxGeometry(w*.7,.1,.04),concreto);frente.position.set(0,.08,d/2+.025);frente.castShadow=true;frente.receiveShadow=true;g.add(frente);const doorHeight=PORTA_ALTURA;if(!refugio)bloco(new THREE.BoxGeometry(.95,doorHeight,.08),porta,0,doorHeight/2,d/2+.07,g);for(const xx of [-w*.27,w*.27]){bloco(new THREE.BoxGeometry(1.22,1.02,.05),molduraJanela,xx,h*.56,d/2+.05,g);bloco(new THREE.BoxGeometry(1.05,.85,.06),Math.random()<.22?janelaAcesa:janela,xx,h*.56,d/2+.12,g);bloco(new THREE.BoxGeometry(1.18,.07,.08),concreto,xx,h*.56,d/2+.20,g)}
// ===== FACHADA ENCARDIDA (referência de favela) =====
// Rodapé de tijolo aparente: na favela o reboco cai primeiro na base, onde bate chuva e pé. É UMA
// caixa um tico maior que a casa, cobrindo os quatro lados de uma vez — 1 draw call, não 4.
// O tijolo entra SEM tinta (material `tijolo` compartilhado, branco): é o único jeito de ter tijolo
// vermelho de verdade numa casa pintada de azul, já que `color` MULTIPLICA o mapa inteiro.
// A casa-refúgio fica de fora: ela é OCA, e uma caixa maciça na base emparedaria a porta por dentro.
if(!refugio&&semente%3===0){const alturaBase=.55+(semente%5)*.09;bloco(new THREE.BoxGeometry(w+.04,alturaBase+afundar,d+.04),tijolo,0,alturaBase/2-afundar/2,0,g)}
// Pichação: 1 casa em cada 5, ao lado da porta. O índice da tag soma a altura pra que os dois andares
// de um sobrado (que dividem o mesmo x,z) não recebam a MESMA tag, uma empilhada na outra.
if(semente%5===0)graffite(g,semente+Math.round(h*10),(semente%2?1:-1)*w*.28,.78,d/2+.06,1.35);
const laje=bloco(new THREE.BoxGeometry(w+.12,.12,d+.12),matTelha(corTelhado),0,h+.06,0,g);superficiesAndaveis.push(laje);const muretaY=h+.12+.25;
// A escadaria (quando existe) fica FORA da largura w da casa (ver criarEscadariaViela). Sem estender a
// mureta frontal/traseira até lá, sobra um canto sem parapeito bem onde a escadaria termina — o jogador
// caminha por cima do telhado, passa reto por esse canto aberto e cai direto no vão entre as casas.
const alcanceEscada=w/2+ESCADA_LARGURA+ESCADA_MARGEM;
const muretaMinX=ladoEscada===-1?-alcanceEscada:-(w/2+.06),muretaMaxX=ladoEscada===1?alcanceEscada:(w/2+.06);
const muretaLargura=muretaMaxX-muretaMinX,muretaCentroX=(muretaMaxX+muretaMinX)/2;
// MURETA SÓ ONDE EXISTE VÃO. Antes toda casa levava as quatro, e como as casas são coladas
// parede-com-parede, cada divisa tinha DUAS muretas encostadas — uma de cada casa — guardando um
// vão que não existe. Eram 418 colisores de mureta em 600, a maioria fechando nada.
// Removendo as internas, os telhados viram uma laje contínua: dá pra atravessar o morro por cima,
// que é o que se faz numa favela de verdade. O desnível entre casas vizinhas (h vale 2,8 / 3,2 /
// 3,6) já barra a subida sozinho — o passo do jogador é 0,22 m e o degrau é de 0,4 a 0,8 m — então
// sobe-se pela escadaria do beco e desce-se de telhado em telhado.
const muretas=[];
const poeMureta=(geo,px,pz)=>muretas.push(bloco(geo,matTelha(corTelhado),px,muretaY,pz,g));
if(bordas.frente)poeMureta(new THREE.BoxGeometry(muretaLargura,.5,.12),muretaCentroX,d/2);
if(bordas.tras)poeMureta(new THREE.BoxGeometry(muretaLargura,.5,.12),muretaCentroX,-d/2);
if(bordas.dir&&ladoEscada!==1)poeMureta(new THREE.BoxGeometry(.12,.5,d+.12),w/2,0);
if(bordas.esq&&ladoEscada!==-1)poeMureta(new THREE.BoxGeometry(.12,.5,d+.12),-w/2,0);
g.userData.muretas=muretas;casasPos.push({x,z,w,d,h,laje:terrenoY+h+.12});// Varanda de MADEIRA (era laje de concreto com grade de metal): a referência tem sacada de tábua, e o
// conjunto de madeira já existe pro celeiro e as portas — reaproveitar custa zero textura nova. O
// corrimão é 1 malha a mais e só nas casas tipo 2 (~19 no bairro), o que cabe no orçamento do celular.
if(tipo===2){const mad=matMadeira(0x6b4a30);bloco(new THREE.BoxGeometry(w*.62,.1,.8),mad,0,h*.62,d/2+.44,g);for(const xx of [-w*.3,-w*.1,w*.1,w*.3])bloco(new THREE.BoxGeometry(.06,.85,.06),mad,xx,h*.62+.42,d/2+.8,g);bloco(new THREE.BoxGeometry(w*.62,.07,.07),mad,0,h*.62+.82,d/2+.8,g)}
// Telheiro de zinco sobre a porta, só no tipo 1 — que é o tipo sem sacada e sem caixa d'água, e era a
// casa lisa do bairro. Inclinado pra frente: telha na horizontal não lê como telheiro, lê como prateleira.
// Fora do refúgio: lá a placa vermelha que marca o esconderijo mora exatamente nesse espaço.
if(tipo===1&&!refugio){const telheiro=bloco(new THREE.BoxGeometry(1.9,.07,.8),matTelha(corTelhado),0,PORTA_ALTURA+.26,d/2+.34,g);telheiro.rotation.x=.18}
if(tipo!==1){const tank=bloco(new THREE.CylinderGeometry(.38,.38,.62,10),agua,w*.22,h+.55,-d*.12,g);tank.castShadow=true}g.userData.paredeMesh=paredeMesh;if(registrar){
  // A casca do refúgio é registrada SEM FUSÃO: ela tem vão de porta, e fundir a verga com as
  // laterais da fachada emparedaria a entrada (ver `caixasSemFusao` em Physics.js).
  if(casca)casca.forEach(m=>marcarSemFusao(registrarObstaculo(m,'parede')));else registrarObstaculo(paredeMesh,'parede');muretas.forEach(m=>registrarObstaculo(m,'mureta'))}return g}
function sobrado(x,z,w,d,h,cor,ladoEscada=0,corTelhado=0x888888,bordas=BORDAS_TODAS){const g=casaBairro(x,z,w,d,h,cor,2,true,ladoEscada,corTelhado,false,true,bordas);const up=casaBairro(x,z,w*.86,d*.82,h*.72,cor===tijolo.color?.getHex?.()?0xd87957:0xe8c45d,1,false,0,corTelhado,false,false);up.position.y=obterElevacao(x,z)+h+.18;registrarObstaculo(up.userData.paredeMesh,'parede');
  // AS MURETAS DO ANDAR DE CIMA NÃO VIRAM COLISOR. A laje do segundo andar fica .18+.72h acima da
  // primeira — 2,77 m no sobrado mais alto. O salto do jogador alcança v²/2g = 8,2²/48 = 1,40 m, e o
  // passo, 0,22 m. Ninguém nunca vai pisar lá em cima, então o parapeito de lá é PURA DECORAÇÃO:
  // continua desenhado, e some da física. São ~60 caixas, a maior sobra que a auditoria achou.
  // A parede do andar de cima continua registrada: essa o jogador ENCOSTA, andando na laje de baixo.
  return g}
// A árvore nasce NO TERRENO. Ela ficava em y=0 fixo, e o terreno do mapa vai de -2,5 a +3,8 m: as 11
// árvores estavam todas fora do chão — a de (-18,72) enterrada 3,8 m e as das bordas boiando 2,5 m no ar.
function arvore(x,z,s=1){const g=new THREE.Group();g.position.set(x,obterElevacao(x,z),z);bairro.add(g);bloco(new THREE.CylinderGeometry(.16*s,.22*s,1.5*s,6),posteMat,0,.75*s,0,g);
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
  registrarCaixa(caixa,'porta');// a MESMA Box3 fica na lista pra sempre; o que muda é o conteúdo dela
  marcarObstaculoMovel(caixa);// fora da grade espacial: o conteúdo muda, o índice ficaria errado
  // O recuo precisa cobrir a parede MAIS a meia-largura do corpo (≈0,19 m): com o recuo justo da
  // parede, um ponto do "interior" colado na lateral já deixava a hitbox dentro do tijolo, e fechar
  // a porta ali prendia o jogador no próprio colisor. Medido: 42 pontos do interior davam colisão.
  const recuo=ESP_PAREDE+.25;
  // Interior em coordenadas LOCAIS da casa, mais o giro dela. Antes eram limites de MUNDO, e isso só
  // funcionava porque a casa girava exclusivamente 0 ou π — as duas rotações que mapeiam uma caixa
  // alinhada nela mesma. Com a casa acompanhando a curva do beco, um retângulo alinhado aos eixos
  // globais deixaria de cobrir o interior (e cobriria pedaço da rua). Agora o teste desgira o ponto.
  const r={x,z,giro:g.rotation.y,pivo,folha,caixa,caixaFechada,aberta:true,
    meiaLarg:w/2-recuo,meiaProf:d/2-recuo};
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
  for(const r of refugios){
    // Desgira o ponto pro referencial da casa e testa contra o retângulo local. Uma rotação inversa
    // de dois cossenos por refúgio, nove refúgios: mais barato que qualquer alternativa, e correto
    // para qualquer ângulo em vez de só pra 0 e π.
    const dx=pos.x-r.x,dz=pos.z-r.z,c=Math.cos(r.giro),sn=Math.sin(r.giro);
    const lx=dx*c-dz*sn,lz=dx*sn+dz*c;
    if(Math.abs(lx)<=r.meiaLarg&&Math.abs(lz)<=r.meiaProf)return r;
  }
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
// O colisor do poste é o TRONCO, não o grupo. Registrando o grupo, o braço transversal de 1,2 m
// entrava na AABB e cada poste virava uma parede invisível de 1,2 m de largura no meio da rua — o
// jogador esbarrava a meio metro do poste, sem nada visível ali. E o poste agora nasce NO TERRENO:
// em y=0 fixo ele boiava ou enterrava conforme o relevo, o que fica gritante com o morro.
function poste(x,z){const g=new THREE.Group();g.position.set(x,obterElevacao(x,z),z);bairro.add(g);
  const tronco=bloco(new THREE.CylinderGeometry(.09,.13,6.3,6),posteMat,0,3.15,0,g);
  bloco(new THREE.BoxGeometry(1.2,.08,.08),posteMat,0,6.1,0,g);
  registrarObstaculo(tronco,'poste')}
function fio(a,b){const pts=[new THREE.Vector3(a[0],6.05,a[1]),new THREE.Vector3((a[0]+b[0])/2,5.35,(a[1]+b[1])/2),new THREE.Vector3(b[0],6.05,b[1])];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x252321}));bairro.add(line)}
// ===== BAR E BIQUEIRA: os dois pontos do morro =====
// Ficam no bairro, dentro do perímetro que a polícia patrulha — é isso que impede virarem atalho
// grátis. O bar cura, a biqueira compra pacote na hora por menos e sobe o procurado (ver PRECOS).
// As coordenadas nascem de um vão REAL do traçado, não de um número escolhido a olho: os dois
// ocupam lotes que a fileira deixou livres, então nenhuma casa é atropelada.
export const BAR={x:0,y:0,z:0,raio:3.4};
export const BIQUEIRA={x:0,y:0,z:0,raio:3.0};
function construirBar(x,z){
  BAR.x=x;BAR.z=z;BAR.y=obterElevacao(x,z);
  const g=new THREE.Group();g.position.set(x,BAR.y,z);bairro.add(g);
  const mad=matMadeira(0x7a5334);
  // Balcão em L com cobertura de zinco em dois postes. O botequim de esquina não tem parede: é o que
  // deixa ver de fora que ali tem gente, e o que o diferencia de mais uma casa fechada.
  registrarObstaculo(bloco(new THREE.BoxGeometry(4.2,1.05,.5),mad,0,.52,-.9,g),'bar');
  registrarObstaculo(bloco(new THREE.BoxGeometry(.5,1.05,2.2),mad,-1.85,.52,.45,g),'bar');
  for(const bx of[-1.2,0,1.2])bloco(new THREE.CylinderGeometry(.16,.18,.62,8),mad,bx,.31,.1,g);// banquetas
  bloco(new THREE.BoxGeometry(5,.08,3.4),matTelha(0xb0a08c),0,2.3,0,g).rotation.x=.1;
  for(const[px,pz]of[[2.2,1.5],[-2.2,1.5]])registrarObstaculo(bloco(new THREE.BoxGeometry(.14,2.3,.14),posteMat,px,1.15,pz,g),'bar');
  bloco(new THREE.BoxGeometry(2.6,.5,.1),bmat(0xe9d16a),0,2.05,-1.65,g);// letreiro
  // Lâmpada quente: o bar precisa se achar de longe no morro, e uma PointLight barata faz isso sem
  // sombra (sombra de luz pontual custa um render de cubemap por quadro).
  const luz=new THREE.PointLight(0xffcf7a,2.4,11,2);luz.position.set(0,2.1,0);g.add(luz);
  return g;
}
function construirBiqueira(x,z){
  BIQUEIRA.x=x;BIQUEIRA.z=z;BIQUEIRA.y=obterElevacao(x,z);
  const g=new THREE.Group();g.position.set(x,BIQUEIRA.y,z);bairro.add(g);
  const mad=matMadeira(0x6b4a30);
  // Engradados empilhados: é o "balcão" da boca. Só os de baixo viram colisor — os de cima estão a
  // 60 cm do chão e barrar o jogador neles só o faria esbarrar no ar.
  for(const[ex,ez,ey]of[[0,0,0],[.62,.1,0],[.3,.05,.46],[-.6,.25,0]]){
    const c=bloco(new THREE.BoxGeometry(.56,.44,.42),mad,ex,.22+ey,ez,g);
    if(ey===0)registrarObstaculo(c,'biqueira');
  }
  // Tambor com fogo: o ponto de referência visual, e o que diz "tem alguém aqui à noite".
  bloco(new THREE.CylinderGeometry(.36,.36,.82,10),posteMat,1.9,.41,-.5,g);
  const brasa=new THREE.PointLight(0xff7a2a,1.9,7,2);brasa.position.set(1.9,1.0,-.5);g.add(brasa);
  bloco(new THREE.CylinderGeometry(.3,.3,.14,10),bmat(0xff8a3a),1.9,.88,-.5,g);
  return g;
}

// ===== TRAÇADO ORGÂNICO: RUA QUE SERPENTEIA, BECOS QUE RAMIFICAM =====
// O bairro era um TABULEIRO. Passou por duas gerações — grade fixa, depois fileiras empacotadas com
// largura variável — e as duas continuavam sendo linhas e colunas: dava pra ver a grade invisível de
// cima. Favela não tem fileira. Tem UMA via que sobe o morro fazendo curva, e becos que ramificam
// dela onde couber, apertando e torcendo conforme o barranco.
//
// Agora o traçado são CURVAS (CatmullRomCurve3) e as casas são penduradas nelas: cada uma nasce a uma
// distância medida ao longo da curva, deslocada perpendicularmente, e GIRADA pela tangente. Não
// existe mais eixo X nem Z no desenho do bairro.
//
// ===== A RESTRIÇÃO QUE DESENHOU A SOLUÇÃO =====
// A física do jogo é AABB pura (Physics.js) — não há caixa girada. Uma casa de 6x4,8 girada 45° tem
// AABB de 7,6x7,6: se eu deslocasse pela profundidade GEOMÉTRICA, a caixa invadiria a rua e fecharia
// a passagem; se usasse a caixa inscrita, o jogador atravessaria a quina.
// A saída é usar a própria AABB como medida: a casa é empurrada pra trás pela META DA AABB DELA, não
// pela metade da profundidade. Assim a largura livre da rua é garantida por construção, para
// QUALQUER ângulo — e o giro deixa de ter limite. O mesmo vale pro espaçamento entre vizinhas, que é
// a soma das meias-larguras de AABB. Nada é selado, e a física continua sendo três comparações.
const RUA_LARGURA=5.0,BECO_LARGURA=3.4;
const CASA_PROF=4.8,LARG_MIN=4.6,LARG_MAX=7.0;
const FOLGA_ENTRE_CASAS=.22;
// AABB de um retângulo w x d girado de `a` em torno de Y.
const aabbGirada=(w,d,a)=>{const c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
  return{W:w*c+d*s,D:w*s+d*c}};
function hashInt(a,b){let h=(Math.imul(a,73856093)^Math.imul(b,19349663))>>>0;h^=h>>>13;return h>>>0}
const sorteio=(a,b)=>(hashInt(a,b)%10000)/10000;// determinístico: o jogador decora o caminho
let casaIndex=0;

// ===== PRAÇA DO MERCADO =====
// (0,-18) é a coordenada do polo de sementes (Poles.js) e não pode mudar: o Mercado no alto do morro
// é o que obriga a atravessar o bairro patrulhado. Nenhuma casa pode nascer em cima dele.
const MERCADO={x:0,z:-18,w:9,d:7};
const naPraca=(x,z,raio)=>Math.hypot(x-MERCADO.x,z-MERCADO.z)<raio+6.2;
const telhados=[0xb8b2a8,0xa8a49c,0xc0b09c,0x9e9a92,0xb0a08c,0xaaa5a0];

// ===== ONDE PASSA GENTE =====
// Morador (NPCs.js) e polícia de rua (Police.js) leem daqui pra rondar. São pontos amostrados nas
// PRÓPRIAS curvas — antes eram quatro corredores com coordenada fixa no código, que deixaram de ser
// becos assim que o traçado mudou, e os dois passaram meses rondando linhas que só existiam no arquivo.
export const BECOS=[];

// ===== A VIA PRINCIPAL =====
// Sobe o morro em S. Os pontos de controle passam de raspão pela praça do Mercado (o cume) e voltam,
// que é o que obriga o jogador a subir pra comprar semente. `catmullrom` com tensão .5 dá curva
// suave sem os laços que a tensão alta produz em ponto de controle muito junto.
const via=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-46,0,  8),
  new THREE.Vector3(-30,0, -4),
  new THREE.Vector3(-33,0,-21),
  new THREE.Vector3(-16,0,-33),
  new THREE.Vector3(  2,0,-30),
  new THREE.Vector3( 11,0,-15),
  new THREE.Vector3( 27,0,-11),
  new THREE.Vector3( 39,0,-27),
  new THREE.Vector3( 44,0,-45),
],false,'catmullrom',.5);

// ===== OS BECOS =====
// Ramificam da via em pontos sorteados ao longo dela, entram no morro e torcem. Cada um tem três
// pontos de controle: o pé (na via), um meio deslocado pro lado, e a ponta — é o mínimo pra a curva
// não sair reta, e o deslocamento lateral do meio é o que faz o beco "cair" pro lado do barranco.
function criarBeco(mae,uNaVia,lado,comprimento,semente){
  const p0=mae.getPointAt(uNaVia),t=mae.getTangentAt(uNaVia);
  const n=new THREE.Vector3(-t.z*lado,0,t.x*lado).normalize();// normal da via, pro lado escolhido
  // O pé do beco começa DEPOIS da fileira de casas da via mãe, não colado nela: a fileira ocupa
  // RUA_LARGURA/2 + meia-AABB (~3 m), e um beco nascendo antes disso entra por dentro das casas.
  const pe=p0.clone().addScaledVector(n,RUA_LARGURA/2+CASA_PROF+1.6);
  const desvio=(sorteio(semente,7)-.5)*.9;// o meio sai do eixo: é isso que torce o beco
  const meio=pe.clone().addScaledVector(n,comprimento*.55)
    .addScaledVector(t,comprimento*desvio);
  const ponta=pe.clone().addScaledVector(n,comprimento)
    .addScaledVector(t,comprimento*desvio*1.7);
  return new THREE.CatmullRomCurve3([pe,meio,ponta],false,'catmullrom',.5);
}
// ===== A SEGUNDA VIA =====
// Uma espinha só não é rede. Com uma única rua, todo beco tinha que sair dela, e os becos dos dois
// lados de um mesmo trecho nasciam quase em cima das casas da própria via — o descarte de
// sobreposição comia metade do bairro (medi 60 casas de ~180 candidatas). Uma via de baixo, mais
// larga e mais longa, dá um segundo eixo de onde ramificar e é o que faz o morro ter "parte de cima"
// e "parte de baixo" — que é como favela se organiza de verdade.
const viaBaixa=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-52,0,-30),
  new THREE.Vector3(-34,0,-46),
  new THREE.Vector3(-10,0,-50),
  new THREE.Vector3( 12,0,-44),
  new THREE.Vector3( 26,0,-33),
  new THREE.Vector3( 34,0,-16),
  new THREE.Vector3( 30,0,  2),
],false,'catmullrom',.5);

const becos=[];
{
  // Distribuídos ao longo das DUAS vias, alternando de lado. Os extremos ficam de fora: beco na
  // ponta da via nasceria fora do bairro.
  for(const[curva,quantos,marca] of [[via,12,0],[viaBaixa,10,500]]){
    for(let i=0;i<quantos;i++){
      const u=.10+(i/(quantos-1))*.80+(sorteio(i+marca,31)-.5)*.05;
      const lado=(i%2)?1:-1;
      const comp=11+sorteio(i+marca,53)*14;
      becos.push({curva:criarBeco(curva,u,lado,comp,i+marca)});
    }
  }
}

// ===== PENDURAR AS CASAS NUMA CURVA =====
// Caminha a curva por comprimento de arco. Em cada passo, a casa é deslocada perpendicularmente pela
// meia-AABB dela (ver a restrição lá em cima) e girada pela tangente. O passo seguinte soma as
// meias-larguras de AABB das duas vizinhas, então casa torta ocupa mais espaço ao longo da rua — que
// é exatamente o que acontece de verdade.
const casasDoTracado=[];
function pendurarCasas(curva,larguraDaVia,semente,lados=[-1,1]){
  const total=curva.getLength();
  for(const lado of lados){
    let s=2.5+sorteio(semente,lado+11)*3;// onde a fileira começa, pra os dois lados não se alinharem
    let larguraAnterior=0;
    let k=0;
    while(s<total-3){
      const u=s/total;
      const p=curva.getPointAt(u),t=curva.getTangentAt(u);
      const ang=Math.atan2(t.x,t.z);// giro que alinha o fundo da casa com a curva
      const sem=hashInt(semente*1000+k,lado);
      const larg=LARG_MIN+((sem%1000)/1000)*(LARG_MAX-LARG_MIN);
      const{W,D}=aabbGirada(larg,CASA_PROF,ang);
      if(larguraAnterior){s+=(larguraAnterior+W)/2+FOLGA_ENTRE_CASAS;if(s>=total-3)break}
      const uu=s/total;
      const pp=curva.getPointAt(uu),tt=curva.getTangentAt(uu);
      const angulo=Math.atan2(tt.x,tt.z);
      const{W:WW,D:DD}=aabbGirada(larg,CASA_PROF,angulo);
      // Normal da curva, pro lado da fileira. O deslocamento usa a meia-AABB: é o que mantém a rua
      // livre com a casa em qualquer ângulo.
      const nx=-tt.z*lado,nz=tt.x*lado;
      const off=larguraDaVia/2+DD/2;
      const x=pp.x+nx*off,z=pp.z+nz*off;
      // A porta olha PRA RUA: o fundo da casa é -z local, a frente é +z, então o giro tem que apontar
      // a frente pra curva — ou seja, a normal invertida.
      const giro=Math.atan2(-nx,-nz);
      if(!naPraca(x,z,Math.max(WW,DD)/2)&&Math.hypot(x,z)<86)
        casasDoTracado.push({x,z,giro,larg,W:WW,D:DD,curva,u:uu,lado,sem});
      larguraAnterior=WW;k++;
      if(!larguraAnterior)break;
      if(k>60)break;// trava de segurança contra curva degenerada
    }
  }
}
pendurarCasas(via,RUA_LARGURA,1);
pendurarCasas(viaBaixa,RUA_LARGURA,2);
becos.forEach((b,i)=>pendurarCasas(b.curva,BECO_LARGURA,100+i));

// ===== REJEIÇÃO DE SOBREPOSIÇÃO =====
// Deslocar pela meia-AABB garante a largura da RUA, mas não impede duas casas de se encontrarem: na
// parte de dentro de uma curva fechada as fileiras convergem, e um beco que ramifica passa por cima
// de quem já estava na via. O resultado medido foi 5 dos 9 esconderijos com a porta emparedada — o
// jogador nem conseguia chegar na soleira.
// A varredura aceita as casas em ordem e descarta quem invade quem já entrou, com uma folga extra na
// FRENTE (onde fica a porta e por onde se anda). É a mesma ideia de um gerador de cidade: gera
// demais, depois poda.
const FOLGA_FRENTE=2.2;
// ===== SOBREPOSIÇÃO MEDIDA NO RETÂNGULO DE VERDADE, NÃO NA AABB =====
// Testar AABB contra AABB descartava demais: a AABB de uma casa girada 40° é quase o dobro da casa,
// então duas vizinhas lado a lado numa curva "colidiam" sem se tocarem — sobraram 52 casas de 115.
// Aqui é o teorema do eixo separador entre dois retângulos: se existe um dos quatro eixos (as duas
// direções de cada retângulo) em que as projeções não se encostam, eles não se tocam. São 4 eixos e
// 8 produtos escalares por par, uma vez na geração, e devolve a densidade de favela.
// A AABB continua existindo, mas só onde ela é a ferramenta certa: no COLISOR.
const eixosDe=r=>{const c=Math.cos(r.giro),s2=Math.sin(r.giro);return[[c,-s2],[s2,c]]};
const projeta=(r,ex,ez)=>{
  const c=Math.cos(r.giro),s2=Math.sin(r.giro);
  return Math.abs(c*ex-s2*ez)*r.lw/2+Math.abs(s2*ex+c*ez)*r.ld/2;
};
const invade=(a,b,folga=.18)=>{
  const dx=b.x-a.x,dz=b.z-a.z;
  for(const r of[a,b])for(const[ex,ez]of eixosDe(r)){
    if(Math.abs(dx*ex+dz*ez)>projeta(a,ex,ez)+projeta(b,ex,ez)+folga)return false;
  }
  return true;
};
// Corpo, folga da porta e PEGADA DA ESCADARIA — os três como retângulos girados junto com a casa.
const corpoDe=c=>({x:c.x,z:c.z,giro:c.giro,lw:c.larg,ld:CASA_PROF});
// A folga da frente cobre o VÃO DA PORTA (1,2 m) com margem, não a fachada inteira: com a fachada,
// a vizinha da MESMA rua caía dentro dela e era descartada.
const frenteDe=c=>({x:c.x+Math.sin(c.giro)*(CASA_PROF/2+FOLGA_FRENTE/2),
                    z:c.z+Math.cos(c.giro)*(CASA_PROF/2+FOLGA_FRENTE/2),
                    giro:c.giro,lw:1.8,ld:FOLGA_FRENTE});
// Reserva a pegada da escadaria com o comprimento MÁXIMO que ela pode ter (9 m — ver
// CORRIDA_MAX_ABS em criarEscadariaViela): reservar só a profundidade da casa deixava a escada
// crescer pra dentro da vizinha.
const ESCADA_RESERVA=9.4;
const escadaDe=(c,lado)=>{
  const off=c.larg/2+ESCADA_LARGURA/2+ESCADA_MARGEM,cg=Math.cos(c.giro),sg=Math.sin(c.giro);
  return{x:c.x+lado*off*cg,z:c.z-lado*off*sg,giro:c.giro,lw:ESCADA_LARGURA+.5,ld:ESCADA_RESERVA};
};
{
  const aceitas=[];
  for(const c of casasDoTracado){
    const corpo=corpoDe(c),frente=frenteDe(c);
    if(aceitas.some(a=>invade(corpo,a.corpo)||invade(frente,a.corpo,0)))continue;
    c.corpo=corpo;aceitas.push(c);
  }
  casasDoTracado.length=0;casasDoTracado.push(...aceitas);
}

// Pontos de ronda: amostrados nas curvas de verdade, a cada ~6 m.
function amostrarParaRonda(curva){
  const total=curva.getLength(),passos=Math.max(2,Math.round(total/6));
  for(let i=0;i<=passos;i++){const p=curva.getPointAt(i/passos);BECOS.push({x:p.x,z:p.z})}
}
amostrarParaRonda(via);amostrarParaRonda(viaBaixa);becos.forEach(b=>amostrarParaRonda(b.curva));

// ===== CONSTRUÇÃO =====
// A ESCADARIA agora nasce de uma MEDIÇÃO, não de aritmética de coluna: onde o terreno sobe mais de
// ESCADA_DESNIVEL ao longo da lateral da casa, o barranco ali é intransponível a pé e entra uma
// escadaria. É a regra que o morro pedia — degrau onde o morro é degrau.
// ESCADARIA SÓ ONDE O BARRANCO É BARRANCO, E NO MÁXIMO OITO.
// A primeira versão media o desnível lateral de cada casa e punha escada acima de 1,5 m. Num morro
// com 19° de inclinação MÉDIA isso é quase toda casa: saíram ~60 escadarias, 1.256 colisores de
// degrau, e de cima o bairro virou um campo de rampas cinzas. A escadaria é um MARCO — o caminho pra
// laje — e marco que se repete sessenta vezes deixa de ser marco.
// Agora todas são medidas, ordenadas pelo desnível, e só as oito maiores viram escada; e nenhuma
// nasce a menos de 14 m de outra, pra elas se espalharem pelo morro em vez de brotarem juntas na
// encosta mais íngreme.
const ESCADA_MAXIMO=8,ESCADA_DISTANCIA_MIN=14;
const desnivelLateral=c=>{
  const cg=Math.cos(c.giro),sg=Math.sin(c.giro);
  const hEsq=obterElevacao(c.x-(c.larg/2+1)*cg,c.z+(c.larg/2+1)*sg);
  const hDir=obterElevacao(c.x+(c.larg/2+1)*cg,c.z-(c.larg/2+1)*sg);
  return{dif:Math.abs(hEsq-hDir),lado:hEsq<hDir?-1:1};
};
// ===== BAR E BIQUEIRA OCUPAM DOIS LOTES DO TRAÇADO =====
// Eles moravam em `{row:4,col:3}` e `{row:1,col:8}` — coordenadas de um tabuleiro que não existe
// mais. Com o traçado em curvas os dois ficaram órfãos em (0,0), um em cima do outro: o teste da
// biqueira acusou "contexto bar" parado na boca. Agora eles TOMAM O LUGAR de duas casas aceitas, o
// que garante que estão numa rua de verdade, com frente livre e sem atropelar parede.
// Escolhidos pelo extremo de uma ordenação estável: o bar na parte alta (o ponto de encontro fica
// onde passa gente), a boca na parte baixa e longe dele — os dois pontos do morro não podem disputar
// o mesmo contexto de painel.
{
  const ordenadas=[...casasDoTracado].sort((a,b)=>b.z-a.z||a.x-b.x);
  const doBar=ordenadas[Math.floor(ordenadas.length*.25)];
  const daBoca=[...casasDoTracado].sort((a,b)=>a.z-b.z||b.x-a.x)
    .find(c=>Math.hypot(c.x-doBar.x,c.z-doBar.z)>34)||ordenadas[ordenadas.length-1];
  construirBar(doBar.x,doBar.z);
  construirBiqueira(daBoca.x,daBoca.z);
  const fora=new Set([doBar,daBoca]);
  const resto=casasDoTracado.filter(c=>!fora.has(c));
  casasDoTracado.length=0;casasDoTracado.push(...resto);
}

const comEscada=new Set();
{
  const ranking=casasDoTracado.map(c=>({c,...desnivelLateral(c)}))
    .sort((a,b)=>b.dif-a.dif);
  const postas=[];
  for(const r of ranking){
    if(postas.length>=ESCADA_MAXIMO)break;
    if(r.dif<1.2)break;
    if(postas.some(p=>Math.hypot(p.x-r.c.x,p.z-r.c.z)<ESCADA_DISTANCIA_MIN))continue;
    // A ESCADARIA PRECISA DE ESPAÇO PRÓPRIO. O corte de sobreposição olhava o corpo da casa e a
    // frente da porta; a escadaria encosta na LATERAL, e num traçado em curva essa lateral costuma
    // estar colada na vizinha. O resultado era escada nascendo dentro de parede: o jogador subia 3 m,
    // batia e escorregava (medido: 6,17 m de desvio lateral). Se nenhum dos dois lados tem espaço, a
    // casa não ganha escada — é melhor uma escadaria a menos do que uma que não sobe.
    let lado=r.lado;
    const livre=l=>{const e=escadaDe(r.c,l);
      return !casasDoTracado.some(o=>o!==r.c&&invade(e,o.corpo,0))};
    if(!livre(lado))lado=-lado;
    if(!livre(lado))continue;
    comEscada.add(r.c);r.c.ladoEscada=lado;postas.push(r.c);
  }
}
{
  let ultimoRefugioEm=-99;
  for(const c of casasDoTracado){
    const i=casaIndex++;
    const h=i%7===0?3.6:i%3===0?3.2:2.8;
    const tipo=i%5===0?1:i%4===0?2:i%3;
    const cor=coresBairro[i%coresBairro.length];
    const corTelhado=telhados[i%telhados.length];
    const ladoEscada=comEscada.has(c)?c.ladoEscada:0;
    // Refúgio: precisa de frente livre (está numa curva, então sempre tem rua na frente) e de
    // distância do refúgio anterior, pra dois esconderijos não nascerem colados.
    const longeDoUltimo=casaIndex-ultimoRefugioEm>=9;
    const ehRefugio=longeDoUltimo&&i%7!==0&&!ladoEscada&&c.z<0;
    if(ehRefugio)ultimoRefugioEm=casaIndex;
    // Bordas de mureta: numa curva toda casa tem rua na frente, e as laterais só encostam na vizinha
    // quando a folga é pequena. O fundo dá pro barranco, então sempre leva mureta.
    // Mureta na frente e no fundo, e nas laterais só quando há escadaria (é ali que fica o vão do
    // beco). A casa COM escadaria perde a mureta da frente: é por lá que a escada chega no telhado, e
    // a mureta estendida por cima dela é uma parede na saída da escada.
    const bordas={frente:!ladoEscada,tras:true,esq:!!ladoEscada,dir:!!ladoEscada};
    const g=i%7===0
      ?sobrado(c.x,c.z,c.larg,CASA_PROF,h,cor,ladoEscada,corTelhado,bordas)
      :casaBairro(c.x,c.z,c.larg,CASA_PROF,h,cor,tipo,true,ladoEscada,corTelhado,ehRefugio,true,bordas,c.giro);
    if(ladoEscada)criarEscadariaViela(g,h+.12,c.larg,CASA_PROF,ladoEscada);
    if(ehRefugio){marcarRefugio(g,CASA_PROF);const r=registrarRefugio(g,c.x,c.z,c.larg,CASA_PROF,g.userData.pecaPorta);r.giro=c.giro}
  }
}
// Comércio de esquina e ponto de encontro visual.
const mercado=casaBairro(0,-18,9,7,3.1,0xd98545,0);bloco(new THREE.BoxGeometry(7.2,1.1,.12),bmat(0xe9d16a),-0,2.15,3.56,mercado);bloco(new THREE.BoxGeometry(5.9,.5,.08),bmat(0x7b3f2b),0,2.15,3.65,mercado);
[-35,35].forEach(x=>[-55,-28,14,56].forEach(z=>poste(x,z)));for(const a of [[-35,-55],[-35,-28],[-35,14],[-35,56],[35,-55],[35,-28],[35,14]])fio(a,[a[0],a[1]+12]);
[[-62,-62],[-62,36],[62,-34],[62,64],[-18,72],[18,-70]].forEach((p,i)=>arvore(p[0],p[1],.9+(i%2)*.18));

// ===== PORTEIRA DA FAZENDA =====
// Declarada FORA de criarFazenda pra quem consome (Economy, testes) importar um objeto estável, e
// preenchida lá dentro. `raio` é a distância em que a tecla E passa a valer pra ela.
// ===== CLIENTE NA LAJE: a entrega =====
// De tempos em tempos um cliente aparece EM CIMA de um telhado e o radar marca. Entregar paga mais
// que o Receptador (ver PRECOS.entregaLaje) porque o preço é o risco: pra chegar nele você atravessa
// os telhados e fica de pé no lugar mais visível do morro, que é onde o helicóptero enxerga.
//
// É o que dá função ao telhado. Antes ele era só um lugar por onde dava pra andar; agora existe um
// motivo pra subir — e as lajes viraram um caminho contínuo justamente porque a mureta parou de ser
// construída em divisa que não guarda nada.
export const clienteLaje={ativo:false,x:0,y:0,z:0,raio:2.6,pacotesPedidos:0};
const CLIENTE_ESPERA_MIN=40,CLIENTE_ESPERA_MAX=85,CLIENTE_DURACAO=80,CLIENTE_DIST_MIN=25;
let grupoCliente=null,esperaCliente=18,tempoCliente=0;
function corpoDoCliente(){
  // Corpo simples e PARADO: o cliente não anda, então não precisa das pernas animadas do morador.
  // Cinco malhas, criadas UMA vez e reposicionadas — criar e descartar a cada aparição vazaria
  // geometria na GPU do mesmo jeito que os policiais vazavam antes de compartilharem GEO_POL.
  const g=new THREE.Group();bairro.add(g);
  const pele=bmat(0xc79067),roupa=bmat(0x2e4a6b),calca=bmat(0x2a2a26);
  bloco(new THREE.BoxGeometry(.5,.72,.3),roupa,0,.78,0,g);
  bloco(new THREE.BoxGeometry(.34,.34,.32),pele,0,1.32,0,g);
  bloco(new THREE.BoxGeometry(.36,.09,.33),bmat(0x171712),0,1.52,0,g);
  for(const lx of[-.13,.13])bloco(new THREE.BoxGeometry(.12,.5,.15),calca,lx,.26,0,g);
  g.scale.setScalar(.52);
  criarSombraContato(.5,g);
  // Marcador vertical: sem ele o cliente some entre as caixas d'água quando visto do chão.
  bloco(new THREE.BoxGeometry(.14,.5,.14),bmat(0x63d16a),0,2.3,0,g);
  return g;
}
// ===== O CLIENTE SÓ NASCE EM LAJE QUE DÁ PRA ALCANÇAR =====
// A entrega depende de o jogador CHEGAR no telhado. No mapa plano isso era a escadaria; no morro,
// medido, só 23% das lajes ficam ao alcance de um passo (0,22 m) ou de um pulo (1,40 m) a partir do
// terreno em volta. Mandar o cliente pra uma laje inalcançável é dar ao jogador uma missão impossível
// sem nenhum aviso — pior que não ter a missão.
// A lista é montada UMA vez, no carregamento: são ~100 casas x 48 amostras de terreno, caro demais
// pra refazer a cada cliente e barato de sobra pra fazer no boot.
const PULO_ALCANCE=1.40;// v²/2g com VELOCIDADE_PULO=8,2 e GRAVIDADE=-24 (Player.js)
let lajesAlcancaveis=null;
function montarLajesAlcancaveis(){
  lajesAlcancaveis=casasPos.filter(c=>{
    let maisAlto=-99;
    for(let a=0;a<16;a++)for(const raio of[1.6,2.6,4]){
      const ang=a/16*Math.PI*2;
      maisAlto=Math.max(maisAlto,obterElevacao(c.x+Math.cos(ang)*raio,c.z+Math.sin(ang)*raio));
    }
    return c.laje-maisAlto<=PULO_ALCANCE;
  });
  // Se o relevo mudar e nenhuma laje passar no teste, é melhor o cliente aparecer em qualquer uma do
  // que a entrega sumir do jogo sem ninguém notar.
  if(!lajesAlcancaveis.length)lajesAlcancaveis=casasPos;
}
function sortearLaje(jogador){
  if(!lajesAlcancaveis)montarLajesAlcancaveis();
  // Longe do jogador na hora de nascer, pelo mesmo motivo do spawn da polícia: cliente que aparece
  // do lado não lê como cliente, lê como bug.
  for(let t=0;t<24;t++){
    const c=lajesAlcancaveis[Math.floor(Math.random()*lajesAlcancaveis.length)];
    if(Math.hypot(c.x-jogador.x,c.z-jogador.z)<CLIENTE_DIST_MIN)continue;
    return c;
  }
  return null;
}
export function atualizarClienteLaje(dt,jogador){
  if(clienteLaje.ativo){
    tempoCliente-=dt;
    if(tempoCliente<=0||clienteLaje.pacotesPedidos<=0){
      clienteLaje.ativo=false;
      if(grupoCliente)grupoCliente.visible=false;
      esperaCliente=CLIENTE_ESPERA_MIN+Math.random()*(CLIENTE_ESPERA_MAX-CLIENTE_ESPERA_MIN);
    }
    return;
  }
  esperaCliente-=dt;
  if(esperaCliente>0)return;
  const c=sortearLaje(jogador);
  if(!c){esperaCliente=6;return}// nenhuma laje longe o bastante: tenta de novo daqui a pouco
  if(!grupoCliente)grupoCliente=corpoDoCliente();
  clienteLaje.x=c.x;clienteLaje.z=c.z;clienteLaje.y=c.laje;
  clienteLaje.pacotesPedidos=2+Math.floor(Math.random()*3);
  clienteLaje.ativo=true;tempoCliente=CLIENTE_DURACAO;
  grupoCliente.position.set(c.x,c.laje,c.z);grupoCliente.visible=true;
}
export function pertoDoCliente(pos){
  return clienteLaje.ativo&&Math.hypot(pos.x-clienteLaje.x,pos.z-clienteLaje.z)<clienteLaje.raio
    // Tem que estar EM CIMA da laje, não embaixo dela: sem a checagem de altura dava pra entregar da
    // rua, e aí a entrega deixava de custar a subida, que é a coisa toda.
    &&Math.abs(pos.y-clienteLaje.y)<1.6;
}
export function entregouAoCliente(n){clienteLaje.pacotesPedidos=Math.max(0,clienteLaje.pacotesPedidos-n)}

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
  registrarObstaculo(paredeCeleiro,'celeiro');
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
    registrarCaixa(new THREE.Box3(
      new THREE.Vector3(Math.min(a[0],b[0])-ESPESSURA_CERCA/2,yMin-.6,Math.min(a[1],b[1])-ESPESSURA_CERCA/2),
      new THREE.Vector3(Math.max(a[0],b[0])+ESPESSURA_CERCA/2,yMax+ALTURA_MOURAO,Math.max(a[1],b[1])+ESPESSURA_CERCA/2)),'cerca');
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
  registrarCaixa(caixaPorteira,'porteira');marcarObstaculoMovel(caixaPorteira);
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
  registrarObstaculo(parede,'loja');
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
  registrarObstaculo(parede,'loja');
  return g;
}
