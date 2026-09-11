// Radar (minimapa estilo GTA) e modo debug visual (wireframes das caixas de colisão).
import*as THREE from'three';
import{scene}from'./core.js';
import{player,jogadorBoxDebugTemp}from'./Player.js';
import{obstaculos,superficiesAndaveis,contarColisores}from'./Physics.js';
import{casasPos,casasOcas,BAR,BIQUEIRA}from'./WorldGenerator.js';
import{plantas,lojaPos,receptadorPos,fazendaPos,armasPos}from'./Economy.js';
import{POLOS}from'./Poles.js';
import{marcaCarro}from'./Carro.js';
import{marcaMoto}from'./Moto.js';
import{npcs}from'./NPCs.js';
import{ALT_CANO,ALT_TORSO}from'./Combate.js';
import{RURAL_ZONES}from'./RuralWorld.js';
import{amostrarCelulasBloqueadas}from'./NavMesh.js';
import{policiais,policia,__estadoDeCombate as estadoDeCombate}from'./Police.js';

// ===== O GPS =====
// O Bruno pediu "mais profissional e funcional possível", com "abreviação de cada nome em cada lugar
// igual no GTA San Andreas". O que existia era um disco preto com bolinhas coloridas: dava pra saber
// que TEM alguma coisa ali, nunca O QUE é. A legenda morava numa linha de texto embaixo da tela
// ("🔵 sementes · 🟠 armas · ...") que ninguém lê no meio de uma fuga.
//
// Quatro coisas mudaram, e cada uma responde a uma pergunta que o jogador faz olhando pro canto:
//   1. AS RUAS SÃO DESENHADAS. `corredores` (Favela.js) já tem cada via e cada beco com a largura
//      real que foi usada pra pendurar as casas. Desenhar isso é a diferença entre um mapa e um
//      monte de pontos: dá pra ver PARA ONDE dá pra correr, não só onde estão as coisas.
//   2. CADA MARCA TEM SIGLA. DP, ARM, REC, MERC, BIQ — do lado do ponto, com contorno escuro pra ler
//      em cima de qualquer fundo. É o pedido dele, e é o que tira a dependência da legenda.
//   3. NORTE FIXO. O radar não gira (só a seta do jogador gira), então o N fica cravado em cima —
//      é o que faz "está ao norte" querer dizer alguma coisa.
//   4. QUEM ESTÁ FORA DO ALCANCE GRUDA NA BORDA COM A DISTÂNCIA EM METROS. Antes grudava sem número:
//      o jogador via que a Loja de Armas era "pra lá", sem ideia se era 50 m ou 300.
const radarCanvas=document.getElementById('radar'),radarCtx=radarCanvas.getContext('2d');
const RADAR_TAM=130,RADAR_DPR=Math.min(devicePixelRatio||1,2);
radarCanvas.width=RADAR_TAM*RADAR_DPR;radarCanvas.height=RADAR_TAM*RADAR_DPR;radarCtx.scale(RADAR_DPR,RADAR_DPR);
const RADAR_ALCANCE=45;// metros de mundo visíveis do centro até a borda
const RADAR_CX=RADAR_TAM/2,RADAR_CY=RADAR_TAM/2;
const RADAR_ESCALA=(RADAR_TAM/2-6)/RADAR_ALCANCE;
const RADAR_LIMITE=RADAR_TAM/2-8;

// ===== AS RUAS, AMOSTRADAS UMA VEZ SÓ =====
// `corredores` é {curva, meia} por via e por beco. Reamostrar as curvas a cada quadro seria refazer o
// mesmo trabalho 60 vezes por segundo pra um desenho que nunca muda — o mapa é estático. Uma passada
// no carregamento, e depois é só recortar o pedaço perto do jogador.
const RUAS=[];
// A favela foi removida; não há rede urbana dela para rasterizar no radar.
for(const c of []){
  const comp=c.curva.getLength();
  const n=Math.max(2,Math.ceil(comp/2));// um ponto a cada ~2 m
  const pts=[];
  for(let i=0;i<=n;i++){const q=c.curva.getPointAt(i/n);pts.push(q.x,q.z)}
  RUAS.push({pts,largura:c.meia*2});
}

// Sigla de cada lugar. Curta de propósito: o radar tem 130 px e o rótulo divide espaço com o ponto.
const SIGLAS={fazenda:'DEP',sementes:'MERC',armas:'ARM',receptador:'REC',delegacia:'DP'};

function paraTela(x,z){
  return{x:RADAR_CX+(x-player.position.x)*RADAR_ESCALA,y:RADAR_CY+(z-player.position.z)*RADAR_ESCALA};
}
// ===== UM RÓTULO NÃO PODE COMER O OUTRO =====
// A primeira versão escrevia a sigla de tudo, e a foto mostrou o estrago: oito refúgios viraram oito
// "ESC" empilhados por cima de BAR, MERC e DP. Mapa ilegível é pior que mapa sem sigla.
// Duas regras resolveram: refúgio não leva texto (são muitos, e o ponto vermelho já é a legenda), e
// rótulo que cairia em cima de outro simplesmente não é escrito. A ORDEM de desenho vira prioridade —
// os polos e a delegacia vêm primeiro, porque são os que o jogador procura de longe.
let rotulosNoQuadro=[];
// ===== E ANTES DE DESISTIR, TENTA OUTRO LUGAR =====
// A regra era "cai em cima de outro, não escreve". Simples e boa contra o borrão, mas ela DESISTIA
// no primeiro conflito — e num canto cheio isso apaga justamente o rótulo que importa. Medido na
// foto: com o jogador no canto sudeste, tudo colapsa no mesmo pedaço da borda e o MOTO ficou uma
// bolinha branca sem nome atrás do "DP 107m".
// Agora ele tenta o outro lado do ponto e alguns degraus pra cima e pra baixo antes de desistir. A
// proteção contra borrão continua inteira: quem não acha lugar nenhum continua sem escrever.
const DESVIOS=[0,-9,9,-18,18];
function rotulo(txt,x,y,cor,tamanho=8){
  radarCtx.font=`800 ${tamanho}px ui-sans-serif,system-ui,sans-serif`;
  radarCtx.textBaseline='middle';
  const larg=radarCtx.measureText(txt).width;
  // Se não cabe à direita do ponto, escreve à esquerda — senão a sigla sai pela borda do disco.
  const preferida=x+larg+6>RADAR_TAM-2;
  const bate=c1=>rotulosNoQuadro.some(c=>c1.x0<c.x1&&c1.x1>c.x0&&c1.y0<c.y1&&c1.y1>c.y0);
  let alinhaEsquerda=preferida,tx=0,caixa=null;
  busca:
  for(const dy of DESVIOS)for(const esq of[preferida,!preferida]){
    const px=esq?x-5:x+5;
    // O outro lado não vale se o texto sair pelo disco: rótulo cortado é pior que rótulo ausente.
    if(!esq&&px+larg+2>RADAR_TAM)continue;
    if(esq&&px-larg-2<0)continue;
    const c1={x0:esq?px-larg:px,y0:y+dy-tamanho/2-1,x1:esq?px:px+larg,y1:y+dy+tamanho/2+1};
    if(bate(c1))continue;
    alinhaEsquerda=esq;tx=px;caixa=c1;y=y+dy;break busca;
  }
  if(!caixa)return;// não coube em lugar nenhum: melhor sem sigla do que por cima de outra
  rotulosNoQuadro.push(caixa);
  radarCtx.textAlign=alinhaEsquerda?'right':'left';
  radarCtx.lineWidth=2.5;radarCtx.strokeStyle='rgba(0,0,0,.85)';radarCtx.strokeText(txt,tx,y);
  radarCtx.fillStyle=cor;radarCtx.fillText(txt,tx,y);
}
// sempreVisivel: fora do alcance, gruda na borda apontando a direção (waypoint de GTA) em vez de
// sumir — sem isso a Loja de Armas e o Depósito, que ficam fora do bairro, nunca apareceriam.
// O ponto é desenhado NA HORA; a sigla fica pra depois, numa fila. Motivo na foto: com tudo saindo
// junto, o ponto de uma marca desenhada depois caía em cima do rótulo de outra desenhada antes ("DEP
// 114m" com uma bolinha amarela em cima do 1). Pontos primeiro, rótulos por último, e nenhum texto
// fica escondido atrás de bolinha.
const filaDeRotulos=[];
// `limite` é o raio em que a marca gruda quando está fora do alcance. Existe porque TUDO que está
// longe colapsa no mesmo anel: o carro parado a 71 m caiu exatamente em cima do MERC e do DEP, ficou
// escondido atrás deles e ainda perdeu a sigla pra anticolisão — está na foto. Quem tem anel próprio
// não disputa espaço com ninguém.
function desenharPontoRadar(x,z,cor,raio,sempreVisivel,sigla,limite=RADAR_LIMITE){
  let{x:px,y:py}=paraTela(x,z);
  let dx=px-RADAR_CX,dy=py-RADAR_CY;
  const dist=Math.hypot(dx,dy);
  let naBorda=false;
  if(dist>limite){
    if(!sempreVisivel)return;
    const fator=limite/dist;dx*=fator;dy*=fator;
    px=RADAR_CX+dx;py=RADAR_CY+dy;naBorda=true;
    radarCtx.strokeStyle=cor;radarCtx.lineWidth=2;
    radarCtx.beginPath();radarCtx.arc(px,py,raio+2,0,Math.PI*2);radarCtx.stroke();
  }
  radarCtx.fillStyle=cor;radarCtx.beginPath();radarCtx.arc(px,py,raio,0,Math.PI*2);radarCtx.fill();
  if(!sigla)return;
  // Na borda, o rótulo leva a DISTÂNCIA junto: é a informação que falta quando a coisa está fora da
  // tela. Perto, a distância seria ruído — dá pra ver.
  if(naBorda){
    const metros=Math.round(Math.hypot(x-player.position.x,z-player.position.z));
    filaDeRotulos.push({txt:`${sigla} ${metros}m`,x:px,y:py,cor,tam:7.5});
  }else filaDeRotulos.push({txt:sigla,x:px,y:py,cor,tam:8});
}

let proximoRadar=0;
export function atualizarRadar(){
  // Radar a 10 Hz, sem alterar movimento, camera ou combate.
  const agora=performance.now();
  if(agora<proximoRadar)return;
  proximoRadar=agora+100;
  radarCtx.clearRect(0,0,RADAR_TAM,RADAR_TAM);
  rotulosNoQuadro=[];filaDeRotulos.length=0;
  radarCtx.save();
  radarCtx.beginPath();radarCtx.arc(RADAR_CX,RADAR_CY,RADAR_TAM/2-3,0,Math.PI*2);radarCtx.clip();
  // Chão. Escuro de propósito: rua e casa são claras, e o contraste é o que faz o traçado aparecer.
  radarCtx.fillStyle='#171a14';radarCtx.fillRect(0,0,RADAR_TAM,RADAR_TAM);
  // ===== AS RUAS =====
  radarCtx.lineCap='round';radarCtx.lineJoin='round';
  radarCtx.strokeStyle='rgba(196,190,170,.55)';
  for(const rua of RUAS){
    radarCtx.lineWidth=Math.max(1.5,rua.largura*RADAR_ESCALA);
    radarCtx.beginPath();
    let desenhando=false;
    for(let i=0;i<rua.pts.length;i+=2){
      const p=paraTela(rua.pts[i],rua.pts[i+1]);
      // Recorta o pedaço perto: fora do disco não adianta traçar.
      if(Math.abs(p.x-RADAR_CX)>RADAR_TAM||Math.abs(p.y-RADAR_CY)>RADAR_TAM){desenhando=false;continue}
      if(desenhando)radarCtx.lineTo(p.x,p.y);else{radarCtx.moveTo(p.x,p.y);desenhando=true}
    }
    radarCtx.stroke();
  }
  // ===== AS CASAS =====
  radarCtx.fillStyle='rgba(226,214,180,.5)';
  for(const c of casasPos){
    const p=paraTela(c.x,c.z);
    if(Math.hypot(p.x-RADAR_CX,p.y-RADAR_CY)>RADAR_TAM/2+10)continue;
    radarCtx.fillRect(p.x-(c.w/2)*RADAR_ESCALA,p.y-(c.d/2)*RADAR_ESCALA,c.w*RADAR_ESCALA,c.d*RADAR_ESCALA);
  }
  radarCtx.restore();

  // ===== AS MARCAS =====
  radarCtx.save();
  radarCtx.beginPath();radarCtx.arc(RADAR_CX,RADAR_CY,RADAR_TAM/2-3,0,Math.PI*2);radarCtx.clip();
  // ===== CASA DO JOGADOR =====
  // CJ = Casa do Jogador. Fica sempre visível e usa um anel próprio quando está longe, para não
  // desaparecer atrás de CAR, MOTO ou dos polos econômicos.
  const CJ=casasOcas.find(r=>r.papel==='jogador');
  if(CJ)desenharPontoRadar(CJ.x,CJ.z,'#55d6ff',5,true,'CJ',RADAR_LIMITE-31);
  // ===== O CARRO E A MOTO VÊM ANTES DOS POLOS, E NUM ANEL SÓ DELES =====
  // "marque o carro e a moto no mapa também, quando fico longe custo achar eles."
  // Duas decisões, e as duas saíram da foto do radar em que eu já tinha "resolvido" isto:
  //
  //  · ANEL PRÓPRIO (9 px pra dentro do dos polos). Tudo que está longe gruda no mesmo raio, e o
  //    carro a 71 m caiu bem em cima do MERC e do DEP — a bolinha branca ficou espremida atrás das
  //    deles. Marca que existe mas não se vê não resolve o pedido dele.
  //  · PRIMEIRO NA FILA. A ordem de desenho é a prioridade do rótulo (ver `rotulo`), e desenhando
  //    depois dos polos as siglas CAR e MOTO eram simplesmente descartadas por colisão: sobrava um
  //    ponto branco sem nome nem distância, que é quase o mesmo que nada.
  //    O polo perde a vez sem prejuízo: ele não anda, fica sempre no mesmo canto e o jogador já sabe
  //    de cor onde é. O veículo é o que ele está PROCURANDO, e é o único que muda de lugar.
  //
  // Branco-gelo nos dois, sigla pra separar: nenhuma outra marca do radar é branca.
  // E UM ANEL PARA CADA UM DOS DOIS, não um anel para os dois. Os dois nascem perto do ponto de
  // partida, então de longe eles ficam quase no MESMO RUMO: com um anel só, o CAR comeu o rótulo do
  // MOTO exatamente como os polos tinham comido os dois. Separados em raio, empilham um sobre o
  // outro em vez de um DENTRO do outro, e os dois nomes cabem.
  const CAR=marcaCarro(),MOT=marcaMoto();
  if(CAR)desenharPontoRadar(CAR.x,CAR.z,'#eef2f5',4.5,true,'CAR',RADAR_LIMITE-9);
  if(MOT)desenharPontoRadar(MOT.x,MOT.z,'#eef2f5',4.5,true,'MOTO',RADAR_LIMITE-20);
  // Os quatro polos econômicos e a delegacia grudam na borda: são eles que ficam FORA do bairro, e
  // saber onde a polícia mora é o que deixa o jogador desviar dela em vez de só reagir.
  desenharPontoRadar(lojaPos.x,lojaPos.z,POLOS.sementes.cor,5,true,SIGLAS.sementes);
  desenharPontoRadar(receptadorPos.x,receptadorPos.z,POLOS.receptador.cor,5,true,SIGLAS.receptador);
  desenharPontoRadar(fazendaPos.x,fazendaPos.z,POLOS.fazenda.cor,5,true,SIGLAS.fazenda);
  desenharPontoRadar(armasPos.x,armasPos.z,POLOS.armas.cor,5,true,SIGLAS.armas);
  desenharPontoRadar(POLOS.delegacia.x,POLOS.delegacia.z,POLOS.delegacia.cor,5,true,SIGLAS.delegacia);
  // Areas rurais sao destinos permanentes de expansao do cultivo.
  for(const zona of RURAL_ZONES)desenharPontoRadar(zona.x,zona.z,'#9bc46d',4.5,true,zona.sigla,RADAR_LIMITE-4);
  // Os do morro não grudam na borda: encher a borda de marca tira a leitura dos que ficam longe.
  desenharPontoRadar(BIQUEIRA.x,BIQUEIRA.z,'#c86bff',4.5,false,'BIQ');
  desenharPontoRadar(BAR.x,BAR.z,'#ffc14d',4.5,false,'BAR');
  // AS CASAS OCAS, E CADA PAPEL NA SUA COR. Antes era um ponto vermelho igual pros treze — o mesmo
  // vermelho de esconderijo desenhado por cima das casas de cliente, que não eram esconderijo
  // nenhum. Agora: comércio na cor da placa da fachada (é a mesma cor no radar e no prédio, que é o
  // que liga uma coisa na outra), cliente no verde da zona de entrega.
  // SEM SIGLA: são catorze espalhadas pelo morro, e catorze etiquetas tapavam o mapa inteiro — está
  // na foto que motivou esta linha. A casa do jogador fica fora daqui porque já recebeu a marca CJ.
  const CORES_CASA_OCA={boteco:'#ffb43c',roupas:'#e0559c',eletronicos:'#3f8fe0'};
  for(const r of casasOcas)if(r.papel!=='jogador')
    desenharPontoRadar(r.x,r.z,r.papel==='cliente'?'#63d16a':(CORES_CASA_OCA[r.comercio]||'#c23a3a'),
      r.papel==='cliente'?4.5:4,false);
  // Muda sem sigla: são muitas, e o ponto verde já diz tudo. Sigla em cada pé viraria borrão.
  for(const pl of plantas)if(!pl.colhida)desenharPontoRadar(pl.x,pl.z,'#7cfc00',3.5,false);
  // Helicóptero removido do jogo. O radar mostra apenas policiais realmente em campo.
  if(policia.estado==='combate')for(const pol of policiais)if(pol.vivo)desenharPontoRadar(pol.pos.x,pol.pos.z,'#ff3b3b',3,false);
  radarCtx.restore();

  // ===== NORTE =====
  // O radar é norte-fixo (só a seta do jogador gira), então o N pode ficar cravado em cima.
  radarCtx.font='800 9px ui-sans-serif,system-ui,sans-serif';
  radarCtx.textAlign='center';radarCtx.textBaseline='top';
  radarCtx.lineWidth=3;radarCtx.strokeStyle='rgba(0,0,0,.85)';
  radarCtx.strokeText('N',RADAR_CX,3);
  radarCtx.fillStyle='#f0e2b0';radarCtx.fillText('N',RADAR_CX,3);

  // Seta do jogador: fixa no centro, girando pra mostrar pra onde ele olha.
  radarCtx.save();radarCtx.translate(RADAR_CX,RADAR_CY);radarCtx.rotate(Math.PI-player.rotation.y);
  radarCtx.lineWidth=1.5;radarCtx.strokeStyle='rgba(0,0,0,.8)';
  radarCtx.fillStyle='#ffe17a';
  radarCtx.beginPath();radarCtx.moveTo(0,-8);radarCtx.lineTo(6,7);radarCtx.lineTo(0,3);radarCtx.lineTo(-6,7);radarCtx.closePath();
  radarCtx.fill();radarCtx.stroke();
  radarCtx.restore();

  // ===== AS SIGLAS, POR ÚLTIMO =====
  // Depois de rua, casa, ponto e seta: texto é a camada que não pode ser tapada por nada, porque é a
  // única que responde "o que É aquilo".
  radarCtx.save();
  radarCtx.beginPath();radarCtx.arc(RADAR_CX,RADAR_CY,RADAR_TAM/2-3,0,Math.PI*2);radarCtx.clip();
  for(const r of filaDeRotulos)rotulo(r.txt,r.x,r.y,r.cor,r.tam);
  radarCtx.restore();
}

// ===== MODO DEBUG VISUAL: wireframes das caixas de colisão + malha de navegação =====
// Vermelho = obstáculos sólidos (paredes/muretas/postes, bloqueiam X/Z). Verde = superfícies andáveis (lajes/degraus, só eixo Y). Amarelo = hitbox do jogador.
// Roxo = células BLOQUEADAS da NavMesh em volta do jogador: é o que a polícia enxerga como parede ao
// traçar rota. Sem essa camada, depurar "por que o policial deu a volta por ali" é adivinhação.
const debugGroup=new THREE.Group();debugGroup.visible=false;scene.add(debugGroup);
let debugConstruido=false,navPontos=null;
const navMat=new THREE.PointsMaterial({color:0xb066ff,size:.22,sizeAttenuation:true});
// ===== A CONTA DOS COLISORES, NA TELA =====
// "Tem colisor demais" só vira trabalho quando dá pra ver ONDE eles estão. Cada caixa carrega uma
// categoria desde que é registrada (Physics.js), então o painel mostra a origem, não só o total —
// é o que transformou "363 colisores" em "174 são mureta, e 60 delas estão num telhado onde ninguém
// consegue subir". Ligar e desligar não mexe na física: o debug só DESENHA.
function textoDoPainel(){
  const c=contarColisores();
  const linhas=Object.entries(c.por).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${String(n).padStart(4)}  ${k}`);
  return[`COLISORES: ${c.total}`,'',
    ...linhas,'',
    `${String(c.pedestres).padStart(4)}  degraus (só NPC)`,
    `${String(c.andaveis).padStart(4)}  superfícies andáveis`,
    '',`${String(policiais.length).padStart(4)}  policiais em campo`,
    `${String(npcs.length).padStart(4)}  moradores`,
    ...linhasDeCombate()].join('\n');
}
// ===== DEBUG DA TROCAÇÃO =====
// A troca é um sistema de tempo real com sorteio dentro: olhar o código não diz se um policial está
// mirando, avançando ou escondido. Aqui cada um mostra o papel, a distância, o erro de mira do último
// tiro, se achou cobertura e quanto falta pro próximo disparo — que é o suficiente pra explicar
// qualquer comportamento estranho sem adivinhação.
function linhasDeCombate(){
  const est=estadoDeCombate();
  if(!est.length)return[];
  const l=['','TROCAÇÃO  papel      dist   erro   tiros  cob'];
  for(const p of est)l.push(
    `          ${String(p.papel||'-').padEnd(10)}${String(p.dist).padStart(5)}m`+
    `${String(p.espalhamento.toFixed(3)).padStart(7)}${String(p.tiros).padStart(7)}   ${p.temCobertura?'S':'-'}`);
  return l;
}
function construirDebugColisao(){
  if(debugConstruido)return;debugConstruido=true;
  for(const box of obstaculos)debugGroup.add(new THREE.Box3Helper(box,0xff2222));
  // A superfície andável virou MALHA FUNDIDA (todas as lajes do morro numa geometria só), e a caixa
  // de contorno dela é o bairro inteiro: o debug desenhava uma gaiola verde de 100 m atravessando o
  // céu, que não informa nada e ainda escondia o resto. Malha fundida se desenha em ARAME, que mostra
  // onde cada laje realmente está; malha solta (a laje de refúgio) continua com a caixa.
  for(const surf of superficiesAndaveis){
    const geo=surf.geometry;
    if(geo&&geo.getAttribute('position')?.count>200){
      const arame=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x33ff55,wireframe:true}));
      arame.position.copy(surf.position);arame.quaternion.copy(surf.quaternion);arame.scale.copy(surf.scale);
      debugGroup.add(arame);
    }else debugGroup.add(new THREE.Box3Helper(new THREE.Box3().setFromObject(surf),0x33ff55));
  }
  debugGroup.add(new THREE.Box3Helper(jogadorBoxDebugTemp,0xffee33));
  navPontos=new THREE.Points(new THREE.BufferGeometry(),navMat);navPontos.frustumCulled=false;debugGroup.add(navPontos);
}
// Só amostra as células perto do jogador, só enquanto o debug está ligado e no máximo 4x por segundo:
// a grade inteira tem 214 mil células e reconstruir a nuvem de pontos por frame custaria mais que o jogo.
let proximaAmostraNav=0;
export function atualizarDebugNavMesh(){
  if(!debugGroup.visible||!navPontos)return;
  const agora=performance.now()/1000;
  if(agora<proximaAmostraNav)return;
  proximaAmostraNav=agora+.25;
  // 4x por segundo, não por quadro: o painel é texto e o DOM é caro no celular.
  painelColisores.textContent=textoDoPainel();
  desenharLinhasDeCombate();
  navPontos.geometry.dispose();
  navPontos.geometry=new THREE.BufferGeometry().setFromPoints(amostrarCelulasBloqueadas(player.position.x,player.position.z,20));
}
// Linhas da trocação: uma por policial vivo, do cano dele até para onde ele está mirando. Amarela =
// vendo o jogador; laranja = indo pra última posição conhecida. É o jeito mais direto de ver "ele
// ainda acha que estou ali".
const linhasCombate=new THREE.Group();scene.add(linhasCombate);
const matVendo=new THREE.LineBasicMaterial({color:0xffe17a});
const matRastro=new THREE.LineBasicMaterial({color:0xff8a3a});
function desenharLinhasDeCombate(){
  for(const o of linhasCombate.children)o.geometry.dispose();
  linhasCombate.clear();
  linhasCombate.visible=debugGroup.visible;
  if(!debugGroup.visible)return;
  for(const pol of policiais){
    if(!pol.vivo)continue;
    const a=new THREE.Vector3(pol.pos.x,pol.grupo.position.y+ALT_CANO,pol.pos.z);
    const b=new THREE.Vector3(player.position.x,player.position.y+ALT_TORSO,player.position.z);
    linhasCombate.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),
      pol.viu?matVendo:matRastro));
  }
}
const debugBtn=document.getElementById('debugBtn');
const painelColisores=document.createElement('pre');
painelColisores.style.cssText='position:fixed;left:8px;bottom:8px;margin:0;padding:8px 10px;'+
  'background:rgba(12,14,18,.82);color:#9ff;font:11px/1.35 ui-monospace,monospace;'+
  'border-radius:8px;pointer-events:none;z-index:60;display:none;white-space:pre';
document.body.appendChild(painelColisores);
export function alternarDebug(){
  construirDebugColisao();debugGroup.visible=!debugGroup.visible;
  debugBtn.classList.toggle('on',debugGroup.visible);
  debugBtn.textContent=debugGroup.visible?'DEBUG ON':'DEBUG';
  painelColisores.style.display=debugGroup.visible?'block':'none';
  if(debugGroup.visible)painelColisores.textContent=textoDoPainel();
}
debugBtn.addEventListener('click',alternarDebug);
