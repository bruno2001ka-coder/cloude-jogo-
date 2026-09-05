// Mundo construído FORA do morro: a FAZENDA (porteira, curral, canteiros, bichos), as duas lojas e o
// esconderijo do Receptador — mais o cliente da laje, que é regra de jogo e não geometria de bairro.
// A favela em si mora em `Favela.js` e é só reexportada daqui (ver o bloco logo abaixo).
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,registrarCaixa,superficiesAndaveis,marcarObstaculoMovel}from'./Physics.js';
import{bmat,matTelha,matConcreto,matMadeira,matTerraArada,matTerraBatida,uvPorMetro,janela,porta,agua,posteMat,folhaMat,folhaClara,criarSombraContato}from'./Materials.js';
import{POLOS}from'./Poles.js';

export const bairro=new THREE.Group();scene.add(bairro);
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

// ===== A FAVELA VEM DE Favela.js =====
// O bairro foi reescrito do zero num módulo próprio (`Favela.js`) e este arquivo ficou com o que
// nunca foi favela: a FAZENDA (porteira, curral, canteiros, bichos), as duas lojas fora do morro e o
// esconderijo do Receptador.
//
// A separação não é arrumação: a favela precisa nascer de RUA — spline, becos, escadão, lote pendurado
// na curva — e isso não cabia ao lado de um gerador de sítio sem virar o arquivo de mil linhas que já
// foi. Cinco módulos (Economy, Police, NPCs, UI e main) importam a favela DAQUI; em vez de mandar os
// cinco mudarem de endereço, este arquivo reexporta. É uma linha de indireção contra cinco de
// mudança espalhada.
import{favela,casasPos,casasCliente,BECOS,refugios,BAR,BIQUEIRA,sumirCaixa,alternarPortaRefugio,
  refugioEmQueEsta,estaEscondido,atualizarRefugios}from'./Favela.js';
bairro.add(favela);
export{casasPos,casasCliente,BECOS,refugios,BAR,BIQUEIRA,sumirCaixa,alternarPortaRefugio,
  refugioEmQueEsta,estaEscondido,atualizarRefugios};

// ===== ÁREA NIVELADA 10 x 8 =====
// Posição indicada pelo HUD da referência enviada: o platô fica no lado leste do mapa e não depende
// de uma casa específica. A cota é calculada antes da geometria para o piso ficar plano mesmo no morro.
const AREA_NIVELADA={x:65.7,z:-1.8,larg:10,prof:8};
const amostrasArea=[];
for(let ix=0;ix<=20;ix++)for(let iz=0;iz<=16;iz++){
  const x=AREA_NIVELADA.x-AREA_NIVELADA.larg/2+ix*AREA_NIVELADA.larg/20;
  const z=AREA_NIVELADA.z-AREA_NIVELADA.prof/2+iz*AREA_NIVELADA.prof/16;
  amostrasArea.push({x,z,h:obterElevacao(x,z)});
}
const cotaArea=Math.max(...amostrasArea.map(a=>a.h))+.12;
const materialArea=new THREE.MeshStandardMaterial({color:0x9a9890,roughness:.92,metalness:0});
// Corpo enterrado: o topo continua nivelado, mas a base desce no terreno para não parecer suspensa.
const ESPESSURA_NIVELAMENTO=1.2;
const platoArea=bloco(new THREE.BoxGeometry(AREA_NIVELADA.larg,ESPESSURA_NIVELAMENTO,AREA_NIVELADA.prof),materialArea,
  AREA_NIVELADA.x,cotaArea-ESPESSURA_NIVELAMENTO/2,AREA_NIVELADA.z);
superficiesAndaveis.push(platoArea);
// Acabamento perimetral baixo: deixa a área nivelada visível contra a terra sem virar uma parede.
for(const[x,z,w,d]of[[AREA_NIVELADA.x,AREA_NIVELADA.z-AREA_NIVELADA.prof/2,AREA_NIVELADA.larg,.12],
                      [AREA_NIVELADA.x,AREA_NIVELADA.z+AREA_NIVELADA.prof/2,AREA_NIVELADA.larg,.12],
                      [AREA_NIVELADA.x-AREA_NIVELADA.larg/2,AREA_NIVELADA.z,.12,AREA_NIVELADA.prof],
                      [AREA_NIVELADA.x+AREA_NIVELADA.larg/2,AREA_NIVELADA.z,.12,AREA_NIVELADA.prof]])
  bloco(new THREE.BoxGeometry(w,.08,d),materialArea,x,cotaArea+.04,z);

function mediaBorda(tipo){
  const borda=amostrasArea.filter(a=>tipo==='norte'?a.z<AREA_NIVELADA.z-AREA_NIVELADA.prof/2+.001:
    tipo==='sul'?a.z>AREA_NIVELADA.z+AREA_NIVELADA.prof/2-.001:
    tipo==='oeste'?a.x<AREA_NIVELADA.x-AREA_NIVELADA.larg/2+.001:
    a.x>AREA_NIVELADA.x+AREA_NIVELADA.larg/2-.001);
  return borda.reduce((s,a)=>s+a.h,0)/borda.length;
}
const bordas=['norte','sul','oeste','leste'];
const bordaBaixa=bordas.reduce((melhor,tipo)=>mediaBorda(tipo)<mediaBorda(melhor)?tipo:melhor,'norte');
const cotaBaixa=mediaBorda(bordaBaixa),desnivel=cotaArea-cotaBaixa;
if(desnivel>.22){
  // Um degrau extra cria o patamar inferior e faz a escada encostar no chão natural.
  const degraus=Math.max(3,Math.ceil(desnivel/.18)+5),espelho=desnivel/degraus;
  const comprimento=bordaBaixa==='norte'||bordaBaixa==='sul'?AREA_NIVELADA.larg:AREA_NIVELADA.prof;
  // Os quatro degraus novos aumentam o comprimento total; não são apenas uma divisão mais fina.
  const pisoDegrau=Math.min(.7,4/Math.max(1,degraus-4)),espessuraDegrau=.16;
  const materialEscada=new THREE.MeshStandardMaterial({color:0x6f6b65,roughness:.95,metalness:0});
  for(let i=0;i<degraus;i++){
    const topo=cotaBaixa+espelho*(i+1);
    // O primeiro degrau fica no terreno baixo; cada degrau sobe até encostar no platô.
    const recuo=(degraus-i-.5)*pisoDegrau;
    let x=AREA_NIVELADA.x,z=AREA_NIVELADA.z;
    if(bordaBaixa==='norte')z=AREA_NIVELADA.z-AREA_NIVELADA.prof/2-recuo;
    if(bordaBaixa==='sul')z=AREA_NIVELADA.z+AREA_NIVELADA.prof/2+recuo;
    if(bordaBaixa==='oeste')x=AREA_NIVELADA.x-AREA_NIVELADA.larg/2-recuo;
    if(bordaBaixa==='leste')x=AREA_NIVELADA.x+AREA_NIVELADA.larg/2+recuo;
    const geo=bordaBaixa==='norte'||bordaBaixa==='sul'
      ?new THREE.BoxGeometry(comprimento,espessuraDegrau,pisoDegrau)
      :new THREE.BoxGeometry(pisoDegrau,espessuraDegrau,comprimento);
    const degrau=bloco(geo,materialEscada,x,topo-espessuraDegrau/2,z);
    superficiesAndaveis.push(degrau);
  }
}

// A árvore ficou aqui: ela é da FAZENDA (o pomar do sítio), não da favela.
function arvore(x,z,s=1){const g=new THREE.Group();g.position.set(x,obterElevacao(x,z),z);bairro.add(g);
  bloco(new THREE.CylinderGeometry(.16*s,.22*s,1.5*s,6),posteMat,0,.75*s,0,g);
  const clusters=[[0,1.8,0],[-.45,1.55,0],[.45,1.55,0],[0,1.55,.45],[0,1.55,-.42]];
  clusters.forEach((p,i)=>{const folha=bloco(new THREE.DodecahedronGeometry(.62*s*(.85+Math.random()*.3),0),i%2===0?folhaMat:folhaClara,p[0],p[1]*s,p[2],g);folha.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI)});
  criarSombraContato(.85*s,g);
  return g}


// ===== CLIENTE NA LAJE: a entrega =====
// De tempos em tempos um cliente aparece EM CIMA de uma laje e o radar marca. Entregar paga mais que
// o Receptador (PRECOS.entregaLaje) porque o preço é o risco: pra chegar nele você atravessa os
// telhados e fica de pé no lugar mais visível do morro, que é onde o helicóptero enxerga. É o que dá
// função ao telhado — sem isso a laje é só um lugar por onde dá pra andar.
export const clienteLaje={ativo:false,x:0,y:0,z:0,raio:2.6,pacotesPedidos:0};
const CLIENTE_ESPERA_MIN=40,CLIENTE_ESPERA_MAX=85,CLIENTE_DURACAO=80,CLIENTE_DIST_MIN=25;
let grupoCliente=null,esperaCliente=18,tempoCliente=0;
function corpoDoCliente(){
  // Corpo simples e PARADO: o cliente não anda, então não precisa das pernas animadas do morador.
  // Criado UMA vez e reposicionado — criar e descartar a cada aparição vazaria geometria na GPU.
  const g=new THREE.Group();bairro.add(g);
  const pele=bmat(0xc79067),roupa=bmat(0x2e4a6b),calca=bmat(0x2a2a26);
  bloco(new THREE.BoxGeometry(.5,.72,.3),roupa,0,.78,0,g);
  bloco(new THREE.BoxGeometry(.34,.34,.32),pele,0,1.32,0,g);
  bloco(new THREE.BoxGeometry(.36,.09,.33),bmat(0x171712),0,1.52,0,g);
  // Braços completos e destacados do tronco: manga azul no alto, antebraço e mão de pele na ponta.
  // O pequeno ângulo para fora evita que os braços desapareçam dentro do corpo quando vistos da rua.
  for(const lado of[-1,1]){
    const braco=bloco(new THREE.CapsuleGeometry(.075,.27,4,8),roupa,lado*.31,.87,0,g);
    braco.rotation.z=lado*.12;
    const mao=bloco(new THREE.SphereGeometry(.085,8,6),pele,lado*.35,.56,0,g);
    mao.scale.set(.85,1.1,.9);
  }
  for(const lx of[-.13,.13])bloco(new THREE.BoxGeometry(.12,.5,.15),calca,lx,.26,0,g);
  g.scale.setScalar(.52);
  criarSombraContato(.5,g);
  // Marcador vertical: sem ele o cliente some entre as caixas d'água quando visto do chão.
  bloco(new THREE.BoxGeometry(.14,.5,.14),bmat(0x63d16a),0,2.3,0,g);
  return g;
}
// ===== O CLIENTE SÓ NASCE EM LAJE QUE DÁ PRA ALCANÇAR =====
// A entrega depende de o jogador CHEGAR no telhado. Mandar o cliente pra uma laje inalcançável é dar
// uma missão impossível sem nenhum aviso — pior que não ter a missão. A lista é montada UMA vez, no
// carregamento: ~110 casas x 48 amostras de terreno, caro demais pra refazer a cada cliente.
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
  if(!lajesAlcancaveis.length)return null;
  // Longe do jogador na hora de nascer, pelo mesmo motivo do spawn da polícia: cliente que aparece do
  // lado não lê como cliente, lê como bug.
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
    // Tem que estar EM CIMA da laje, não embaixo: sem a checagem de altura dava pra entregar da rua, e
    // aí a entrega deixava de custar a subida, que é a coisa toda.
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
  const comprimento=xFim-xIni,meioX=(xIni+xFim)/2,SEGMENTO_CANTEIRO=1.25;
  for(let z=zIni;z<=zFim;z+=1.7){
    // Uma caixa única atravessava o relevo com a cota do centro e deixava as pontas suspensas. Segmentos
    // curtos permitem apoiar cada parte na altura local sem perder o baixo custo do InstancedMesh.
    for(let x0=xIni;x0<xFim-.001;x0+=SEGMENTO_CANTEIRO){
      const comp=Math.min(SEGMENTO_CANTEIRO,xFim-x0);
      canteiros.push([x0+comp/2,z,comp]);
    }
    for(let x=xIni+.35;x<=xFim-.35;x+=.62)pes.push([x+(Math.random()-.5)*.16,z+(Math.random()-.5)*.22]);
  }
  const mesaCanteiro=new THREE.InstancedMesh(uvPorMetro(new THREE.BoxGeometry(1,.13,1.02)),matTerraArada(),canteiros.length);
  mesaCanteiro.castShadow=false;mesaCanteiro.receiveShadow=true;
  canteiros.forEach(([mx,mz,comp],i)=>{
    // Meio enterrado: cada segmento segue o terreno local, então nenhuma ponta fica no ar numa encosta.
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

// ===== DELEGACIA: a base da polícia, no pé do morro =====
// Existe por uma razão de jogo, não de cenário: policial nenhum aparece mais do nada perto do
// jogador — todos entram no mundo por esta porta e sobem a rua andando. Isso é o que faz a polícia
// PARECER que mora no mapa, e é literalmente o que o Bruno pediu ("do nada aparece dois policial
// atrás de mim").
//
// Segue a receita do barracão da loja de armas: grupo assentado na elevação, UMA parede registrada
// como obstáculo (o resto é enfeite, pra não criar bolsão onde o jogador encrava), e sombra de
// contato. A porta fica virada pra via principal — é de onde eles saem.
function criarDelegacia(x,z){
  const g=new THREE.Group();const y=obterElevacao(x,z);g.position.set(x,y,z);scene.add(g);
  // Vira a frente pra porta declarada em Poles, MAS EM ÂNGULO RETO. O arredondamento não é preguiça:
  // `registrarObstaculo` mede a AABB da malha, e a AABB de uma caixa girada num ângulo qualquer é bem
  // maior que a caixa — girado 116° este prédio de 8,4 x 6,8 registrava um colisor de 9,8 x 10,5, que
  // engolia a própria porta (medido: o ponto de saída dava colisão). Em múltiplo de 90° a AABB é
  // exatamente a caixa, e o colisor é o prédio. É a mesma dor das casas do morro, que por isso são
  // fatiadas; aqui o prédio é um só e dá pra resolver alinhando.
  const paraAPorta=Math.atan2(POLOS.delegacia.porta.x-x,POLOS.delegacia.porta.z-z);
  g.rotation.y=Math.round(paraAPorta/(Math.PI/2))*(Math.PI/2);
  const claro=bmat(0xdcd8cc),azul=bmat(0x2f5fa8),escuro=bmat(0x3a3f45);
  const parede=bloco(new THREE.BoxGeometry(8.4,3.6,6.8),claro,0,1.8,-1.4,g);
  registrarObstaculo(parede,'delegacia');
  // Faixa azul na altura do peito: é o que faz ler "polícia" de longe, na cor do ponto do radar.
  bloco(new THREE.BoxGeometry(8.5,.5,6.9),azul,0,2.5,-1.4,g);
  bloco(new THREE.BoxGeometry(8.9,.18,7.3),escuro,0,3.7,-1.4,g);
  // Vão da porta na fachada, virado pra rua. Não vira obstáculo: é por onde eles saem.
  bloco(new THREE.BoxGeometry(1.6,2.3,.12),escuro,0,1.15,1.95,g);
  bloco(new THREE.BoxGeometry(2,.16,.5),azul,0,2.45,2.1,g);
  for(const lx of[-1.4,1.4])bloco(new THREE.CylinderGeometry(.08,.08,2.6,6),posteMat,lx,1.3,2.05,g);
  // Giroflex no telhado, aceso: o ponto de referência noturno.
  const luz=new THREE.PointLight(0x4d8dff,1.1,12);luz.position.set(0,4.1,0);g.add(luz);
  bloco(new THREE.SphereGeometry(.16,8,8),
    new THREE.MeshStandardMaterial({color:0x9ec8ff,emissive:0x2f6fd0,emissiveIntensity:2}),0,4.05,0,g);
  criarSombraContato(5,g,0,-1);
  return g;
}
criarDelegacia(POLOS.delegacia.predio.x,POLOS.delegacia.predio.z);
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
