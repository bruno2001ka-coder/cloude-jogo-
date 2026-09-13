// Mundo construído FORA do morro: a FAZENDA (porteira, curral, canteiros, bichos), as duas lojas e o
// esconderijo do Receptador.
// A favela foi removida para focar apenas na área rural/fazenda.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,registrarCaixa,superficiesAndaveis,marcarObstaculoMovel,marcarSemFusao}from'./Physics.js';
import{bmat,matTelha,matConcreto,matParedeRural,matTelhaBarroRural,matMadeira,matTerraArada,matTerraBatida,uvPorMetro,janela,porta,agua,posteMat,folhaMat,folhaClara,criarSombraContato}from'./Materials.js';
import{POLOS}from'./Poles.js';
import{FAZENDA_CONFIG}from'./FarmConfig.js';

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

// ===== FAZENDA: área rural afastada da cidade, além do limite oeste do bairro.
// A favela foi removida para focar apenas na área rural/fazenda.
// Este arquivo agora contém apenas a FAZENDA (porteira, curral, canteiros, bichos), as duas lojas fora do morro e o
// esconderijo do Receptador.

// Exportações vazias para manter compatibilidade com módulos que importam da favela
export const favela=new THREE.Group();
export const casasPos=[];
export const casasCliente=[];
export const BECOS={viaPrincipal:{getPointAt:()=>({x:0,y:0,z:0}),getTangentAt:()=>({x:0,y:0,z:0})},viaBaixa:{getPointAt:()=>({x:0,y:0,z:0}),getTangentAt:()=>({x:0,y:0,z:0})}};
export const casasOcas=[];
// A favela saiu, mas Economy/UI ainda consultam coordenadas de BAR/BIQUEIRA.
// Nunca exportar null aqui: acessar .x em null interrompe o quadro antes do composer.render().
// Pontos desativados ficam muito fora do mapa com raio zero, então preservam a API sem aparecer
// no radar nem criar interação fantasma.
export const BAR={x:1e6,z:1e6,raio:0,desativado:true};
export const BIQUEIRA={x:1e6,z:1e6,raio:0,desativado:true};
export function sumirCaixa(){}
export function alternarPorta(){}
export function casaOcaEmQueEsta(){return null}
export function atualizarPortas(){}
export const lotes=[];
export const viaPrincipal={getPointAt:()=>({x:0,y:0,z:0}),getTangentAt:()=>({x:0,y:0,z:0})};
export const viaBaixa={getPointAt:()=>({x:0,y:0,z:0}),getTangentAt:()=>({x:0,y:0,z:0})};
export const becos=[];
export const corredores=[];
export function levanteContraQuina(x,z,r){return obterElevacao(x,z)}
export const PASSO_DA_FITA=1.0;
export const ESP_PAREDE=.18,PORTA_ALTURA=2.55,VAO_PORTA=1.8,PORTA_ABERTA_RAD=1.9;
export function atualizarFavelaVisivel(x,z){}

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
const menorCotaArea=Math.min(...amostrasArea.map(a=>a.h));
const ESPESSURA_NIVELAMENTO=Math.max(1.8,cotaArea-menorCotaArea+.3);
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
    // Cada degrau recebe a cota do terreno exatamente sob ele: o corpo desce até o solo e não flutua.
    const recuo=(degraus-i-.5)*pisoDegrau;
    let x=AREA_NIVELADA.x,z=AREA_NIVELADA.z;
    if(bordaBaixa==='norte')z=AREA_NIVELADA.z-AREA_NIVELADA.prof/2-recuo;
    if(bordaBaixa==='sul')z=AREA_NIVELADA.z+AREA_NIVELADA.prof/2+recuo;
    if(bordaBaixa==='oeste')x=AREA_NIVELADA.x-AREA_NIVELADA.larg/2-recuo;
    if(bordaBaixa==='leste')x=AREA_NIVELADA.x+AREA_NIVELADA.larg/2+recuo;
    const cotaSoloDegrau=obterElevacao(x,z);
    const topo=Math.max(cotaSoloDegrau+.08,cotaBaixa+espelho*(i+1));
    const altura=Math.max(.16,topo-cotaSoloDegrau);
    const geo=bordaBaixa==='norte'||bordaBaixa==='sul'
      ?new THREE.BoxGeometry(comprimento,altura,pisoDegrau)
      :new THREE.BoxGeometry(pisoDegrau,altura,comprimento);
    const degrau=bloco(geo,materialEscada,x,cotaSoloDegrau+altura/2,z);
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


// O CLIENTE DA LAJE SAIU DAQUI, a pedido dele: "tem que arrumar cliente em cima do telhado que não
// tem nem como eu entregar". O sistema sorteava uma laje e punha o cliente em cima; o teste de
// alcance media só o TERRENO em volta (não se dava pra subir de verdade) e, quando nenhuma laje
// passava, caía num `lajesAlcancaveis=casasPos` que devolvia o morro inteiro — inclusive telhado sem
// acesso nenhum. A entrega agora acontece onde dá pra chegar andando: dentro das casas de cliente,
// que têm porta (ver `casasCliente` e DeliveryPoints.js).

function distanciaAoCorredorFazenda(px,pz){
  const a=FAZENDA_CONFIG.acesso.a,b=FAZENDA_CONFIG.acesso.b;
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  const t=den?Math.max(0,Math.min(1,((px-a.x)*dx+(pz-a.z)*dz)/den)):0;
  return Math.hypot(px-(a.x+dx*t),pz-(a.z+dz*t));
}

export const porteiraFazenda={x:0,y:0,z:0,aberta:true,raio:3.6,pivos:[],anguloAtual:0};
export const portasCeleiro={x:0,y:0,z:0,aberta:true,raio:3.2,pivos:[],anguloAtual:0};

// ===== COLISÃO DE PORTA GIRATÓRIA SEM "QUINA INVISÍVEL" =====
// A física é AABB. Uma folha longa e fina girada 45° dentro de UMA AABB vira um quadrado grande,
// com quatro cantos sólidos onde não existe madeira. Em vez de aceitar esse fantasma, cada folha é
// aproximada por quatro segmentos curtos. Continuam sendo AABBs baratas, mas acompanham a diagonal
// com erro muito menor. São só 16 caixas móveis entre casa + porteira.
const _cantoFolha=new THREE.Vector3();
function criarSegmentosFolha(folha,eixo,comprimento,altura,espessura,categoria,qtd=4){
  const segmentos=[],passo=comprimento/qtd;
  for(let i=0;i<qtd;i++){
    const p=-comprimento/2+(i+.5)*passo;
    segmentos.push({
      caixa:marcarObstaculoMovel(registrarCaixa(new THREE.Box3(),categoria)),
      cx:eixo==='x'?p:0,cy:altura/2,cz:eixo==='z'?p:0,
      hx:eixo==='x'?passo/2:espessura/2,hy:altura/2,hz:eixo==='z'?passo/2:espessura/2,
    });
  }
  return segmentos;
}
function atualizarColisoresFolhas(registros){
  for(const r of registros){
    r.folha.updateWorldMatrix(true,false);
    for(const seg of r.segmentos){
      seg.caixa.makeEmpty();
      for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1]){
        _cantoFolha.set(seg.cx+sx*seg.hx,seg.cy+sy*seg.hy,seg.cz+sz*seg.hz)
          .applyMatrix4(r.folha.matrixWorld);
        seg.caixa.expandByPoint(_cantoFolha);
      }
    }
  }
}
const PORTA_CELEIRO_ABERTA_RAD=Math.PI*.72;
const PORTA_CELEIRO_VEL=.95;
function aplicarPortasCeleiroImediata(){
  portasCeleiro.anguloAtual=portasCeleiro.aberta?PORTA_CELEIRO_ABERTA_RAD:0;
  for(const{pivo,lado}of portasCeleiro.pivos)pivo.rotation.y=lado*portasCeleiro.anguloAtual;
  atualizarColisoresFolhas(portasCeleiro.pivos);
}
function atualizarPortasCeleiro(dt){
  if(!portasCeleiro.pivos.length)return;
  const alvo=portasCeleiro.aberta?PORTA_CELEIRO_ABERTA_RAD:0;
  const delta=alvo-portasCeleiro.anguloAtual;
  if(Math.abs(delta)<=.0005)return;
  const passo=Math.min(Math.abs(delta),PORTA_CELEIRO_VEL*dt);
  portasCeleiro.anguloAtual+=Math.sign(delta)*passo;
  if(passo>=Math.abs(delta))portasCeleiro.anguloAtual=alvo;
  for(const{pivo,lado}of portasCeleiro.pivos)pivo.rotation.y=lado*portasCeleiro.anguloAtual;
  atualizarColisoresFolhas(portasCeleiro.pivos);
}
export function alternarPortasCeleiro(){portasCeleiro.aberta=!portasCeleiro.aberta;return portasCeleiro.aberta}
export function pertoDasPortasCeleiro(pos){return Math.hypot(pos.x-portasCeleiro.x,pos.z-portasCeleiro.z)<portasCeleiro.raio}
const PORTEIRA_ABERTA_RAD=Math.PI*.55;
const PORTEIRA_VEL=.72;
function aplicarPorteiraImediata(){
  porteiraFazenda.anguloAtual=porteiraFazenda.aberta?PORTEIRA_ABERTA_RAD:0;
  for(const{pivo,lado}of porteiraFazenda.pivos)pivo.rotation.y=lado*porteiraFazenda.anguloAtual;
  atualizarColisoresFolhas(porteiraFazenda.pivos);
}
function atualizarPorteiraFazenda(dt){
  if(!porteiraFazenda.pivos.length)return;
  const alvo=porteiraFazenda.aberta?PORTEIRA_ABERTA_RAD:0;
  const delta=alvo-porteiraFazenda.anguloAtual;
  if(Math.abs(delta)<=.0005)return;
  const passo=Math.min(Math.abs(delta),PORTEIRA_VEL*dt);
  porteiraFazenda.anguloAtual+=Math.sign(delta)*passo;
  if(passo>=Math.abs(delta))porteiraFazenda.anguloAtual=alvo;
  for(const{pivo,lado}of porteiraFazenda.pivos)pivo.rotation.y=lado*porteiraFazenda.anguloAtual;
  atualizarColisoresFolhas(porteiraFazenda.pivos);
}
export function alternarPorteira(){
  // O clique só muda o destino. A animação é física/visual e acontece quadro a quadro.
  porteiraFazenda.aberta=!porteiraFazenda.aberta;
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
function criarFazenda(){
  const{cx,cz,meiaLarg,meiaProf}=FAZENDA_CONFIG;
  const bx=FAZENDA_CONFIG.casa.x,bz=FAZENDA_CONFIG.casa.z,by=obterElevacao(bx,bz);
  // Materiais próprios da fazenda: a parede rural e a telha de barro NÃO vêm do conjunto visual
  // da favela. As geometrias e as medidas continuam exatamente as mesmas.
  const paredeCasa=matParedeRural(),madeiraCeleiro=matMadeira(0x8f5737),madeiraCerca=matMadeira(0x765238),ripaEscura=matMadeira(0x4d3728);
  const ferragemPorta=new THREE.MeshStandardMaterial({color:0x3a342d,roughness:.58,metalness:.48});

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
  const baseCeleiro=bloco(new THREE.BoxGeometry(FAZENDA_CONFIG.casa.baseLargura,FAZENDA_CONFIG.casa.baseAltura,FAZENDA_CONFIG.casa.baseProfundidade),matConcreto(),bx,by+FAZENDA_CONFIG.casa.baseAltura/2,bz);
  // A laje já existia visualmente, mas não era chão para a física: o personagem ficava 30 cm dentro dela.
  superficiesAndaveis.push(baseCeleiro);
  // Paredes separadas deixam uma abertura real na fachada. A caixa única antiga bloqueava a porta
  // mesmo quando o portão visual estava aberto; quatro panos mantêm a estrutura fechada e liberam o vão.
  const ALTURA_CELEIRO=FAZENDA_CONFIG.casa.altura,LARGURA_PORTA_CELEIRO=FAZENDA_CONFIG.casa.portaVao;
  // Todas as paredes usam largura, altura e espessura na ordem correta da BoxGeometry.
  // A versão anterior trocou altura por profundidade e virou vigas horizontais na fachada.
  const paredeFundo=bloco(new THREE.BoxGeometry(6,ALTURA_CELEIRO,.18),paredeCasa,bx,by+1.6,bz-2.41);
  const paredeLateralE=bloco(new THREE.BoxGeometry(.18,ALTURA_CELEIRO,5),paredeCasa,bx-2.91,by+1.6,bz);
  const paredeLateralD=bloco(new THREE.BoxGeometry(.18,ALTURA_CELEIRO,5),paredeCasa,bx+2.91,by+1.6,bz);
  const larguraLateral=(6-LARGURA_PORTA_CELEIRO)/2;
  const paredeFrenteE=bloco(new THREE.BoxGeometry(larguraLateral,ALTURA_CELEIRO,.18),paredeCasa,bx-((LARGURA_PORTA_CELEIRO+larguraLateral)/2),by+1.6,bz+2.41);
  const paredeFrenteD=bloco(new THREE.BoxGeometry(larguraLateral,ALTURA_CELEIRO,.18),paredeCasa,bx+((LARGURA_PORTA_CELEIRO+larguraLateral)/2),by+1.6,bz+2.41);
  // Acabamento construtivo: embasamento de pedra e janelas de madeira evitam o aspecto de caixa branca.
  const pedraBase=matMadeira(0x625344),madeiraJanela=matMadeira(0x60402b);
  const vidroJanela=new THREE.MeshStandardMaterial({color:0x8fa9a0,roughness:.28,metalness:.04,
    transparent:true,opacity:.74,emissive:0x243b38,emissiveIntensity:.12});
  bloco(new THREE.BoxGeometry(6.04,.42,.24),pedraBase,bx,by+.28,bz+2.47);
  bloco(new THREE.BoxGeometry(6.04,.42,.24),pedraBase,bx,by+.28,bz-2.47);
  function janelaRural(x,z,frente=true){
    const g=new THREE.Group();g.position.set(x,by+1.72,z);if(!frente)g.rotation.y=Math.PI/2;bairro.add(g);
    bloco(new THREE.BoxGeometry(1.12,1.02,.10),madeiraJanela,0,0,0,g);
    bloco(new THREE.BoxGeometry(.86,.76,.035),vidroJanela,0,0,.065,g);
    bloco(new THREE.BoxGeometry(.055,.82,.05),madeiraJanela,0,0,.10,g);
    bloco(new THREE.BoxGeometry(.92,.055,.05),madeiraJanela,0,0,.10,g);
    for(const lado of[-1,1]){
      const veneziana=new THREE.Group();veneziana.position.set(lado*.67,0,.04);g.add(veneziana);
      bloco(new THREE.BoxGeometry(.28,1.06,.12),madeiraJanela,0,0,0,veneziana);
      for(const yy of[-.34,-.17,0,.17,.34]){
        const r=bloco(new THREE.BoxGeometry(.23,.035,.14),ripaEscura,0,yy,.075,veneziana);
        r.rotation.z=lado*.18;
      }
    }
  }
  // Centralização exata nos dois panos laterais: (2,35/2) + ((6-2,35)/2) = 2,0875 m.
  const centroPano=LARGURA_PORTA_CELEIRO/2+larguraLateral/2;
  janelaRural(bx-centroPano,bz+2.53,true);janelaRural(bx+centroPano,bz+2.53,true);
  janelaRural(bx-3.02,bz-.55,false);
  // Soleira de pedra e dois degraus assentam a entrada no terreno e criam sombra de contato natural.
  bloco(new THREE.BoxGeometry(2.8,.18,.46),pedraBase,bx,by+.10,bz+3.17);
  bloco(new THREE.BoxGeometry(2.25,.16,.34),pedraBase,bx,by+.04,bz+3.42);
  // Calhas e descidas simples: detalhes pequenos, mas decisivos para uma casa rural construída.
  const metalCalha=new THREE.MeshStandardMaterial({color:0x4b4540,roughness:.72,metalness:.22});
  for(const z of[bz-3.02,bz+3.02]){
    bloco(new THREE.BoxGeometry(6.55,.10,.12),metalCalha,bx,by+3.32,z);
    for(const x of[bx-3.02,bx+3.02])bloco(new THREE.BoxGeometry(.10,3.05,.10),metalCalha,x,by+1.78,z);
  }
  // Fundo e laterais podem ser otimizados normalmente. As duas peças da FACHADA não podem fundir
  // com a verga: se fundirem, o otimizador transforma o vão de 2,35 m numa parede invisível inteira.
  for(const parede of[paredeFundo,paredeLateralE,paredeLateralD])registrarObstaculo(parede,'celeiro');
  marcarSemFusao(registrarObstaculo(paredeFrenteE,'celeiro'));
  marcarSemFusao(registrarObstaculo(paredeFrenteD,'celeiro'));
  // Telhado de duas águas. A inclinação sai da geometria (meia largura x altura do cume), não de um
  // ângulo escolhido no olho: a empena logo abaixo é montada com a MESMA conta, e foi assim que ela
  // parou de furar o telhado. Antes o ângulo era .55 rad chutado e a empena vinha de larguras fixas —
  // os degraus dela apareciam por fora da água, como uma escadinha marrom saindo do telhado.
  // Mesmo telhado, mesma espessura/inclinação/beiral; só troca para o material rural próprio de
  // cerâmica com relevo, sem reutilizar a chapa/telha do bairro.
  const telhadoFazenda=matTelhaBarroRural();
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
    bloco(new THREE.BoxGeometry(larg,hDegrau,.14),paredeCasa,bx,by+yTopo-hDegrau/2,bz+lz*2.5);
  }
  // Forro interno: sem esta face clara a câmera entra no volume e enxerga o verso escuro das águas
  // do telhado como uma faixa preta contínua. O forro fica abaixo do beiral, recebe luz da varanda e
  // é apenas visual — não fecha o vão, não cria colisor e mantém a casa navegável.
  const forroRural=new THREE.MeshStandardMaterial({color:0xd7c9ad,roughness:.95,metalness:0});
  bloco(new THREE.BoxGeometry(5.72,.08,4.72),forroRural,bx,by+3.08,bz);
  for(const z of[-1.65,0,1.65])bloco(new THREE.BoxGeometry(5.55,.12,.12),ripaEscura,bx,by+3.15,bz+z);
  // Portas duplas funcionais. Cada folha tem colisor móvel próprio, exatamente onde a madeira está.
  const pivosCeleiro=[],LARGURA_FOLHA=LARGURA_PORTA_CELEIRO/2-.05;
  for(const lado of[-1,1]){
    const pivo=new THREE.Group();pivo.position.set(bx+lado*LARGURA_PORTA_CELEIRO/2,by+.35,bz+2.53);bairro.add(pivo);
    // A dobradiça fica na extremidade externa; o centro da folha fica meia folha para dentro do vão.
    const folha=new THREE.Group();folha.position.set(-lado*LARGURA_FOLHA/2,0,0);pivo.add(folha);
    bloco(new THREE.BoxGeometry(LARGURA_FOLHA,2.45,.12),madeiraCeleiro,0,1.22,0,folha);
    for(const alt of[.45,1.18,1.9])bloco(new THREE.BoxGeometry(LARGURA_FOLHA-.16,.10,.16),ripaEscura,0,alt,.08,folha);
    const diagonal=bloco(new THREE.BoxGeometry(LARGURA_FOLHA-.18,.09,.12),ripaEscura,0,1.2,.1,folha);
    diagonal.rotation.z=lado*Math.atan2(1.2,LARGURA_FOLHA);
    // Maçaneta metálica na borda interna da folha; fica dentro do volume visual da porta e não altera
    // o vão nem participa da colisão.
    const macaneta=bloco(new THREE.CylinderGeometry(.035,.035,.09,8),ferragemPorta,-lado*(LARGURA_FOLHA/2-.15),1.22,.10,folha);
    macaneta.rotation.x=Math.PI/2;
    // Duas dobradiças visíveis junto ao pivô: detalhe de acabamento, sem colisor novo.
    for(const alt of[.58,1.86])bloco(new THREE.CylinderGeometry(.035,.035,.16,8),ferragemPorta,lado*(LARGURA_FOLHA/2-.04),alt,.08,folha);
    const segmentos=criarSegmentosFolha(folha,'x',LARGURA_FOLHA,2.45,.12,'porta-celeiro');
    pivosCeleiro.push({pivo,lado,folha,segmentos});
  }
  // Batente alinhado à folha: a verga fica ACIMA da porta, nunca atravessando a madeira.
  bloco(new THREE.BoxGeometry(LARGURA_PORTA_CELEIRO+.28,.14,.16),ripaEscura,bx,by+2.88,bz+2.58);
  for(const lado of[-1,1])bloco(new THREE.BoxGeometry(.14,2.8,.16),ripaEscura,bx+lado*(LARGURA_PORTA_CELEIRO/2+.07),by+1.4,bz+2.58);
  // Fecha a faixa de alvenaria entre a porta e a empena sem alterar a altura externa da construção.
  const vergaParede=bloco(new THREE.BoxGeometry(LARGURA_PORTA_CELEIRO,.25,.18),paredeCasa,bx,by+3.075,bz+2.41);
  marcarSemFusao(registrarObstaculo(vergaParede,'celeiro'));
  portasCeleiro.x=bx;portasCeleiro.y=by;portasCeleiro.z=bz+2.7;portasCeleiro.pivos=pivosCeleiro;portasCeleiro.aberta=true;aplicarPortasCeleiroImediata();
  bloco(new THREE.BoxGeometry(.9,.7,.1),ripaEscura,bx,by+3.05,bz+2.53);// portinhola do feno, lá em cima
  // --- CASA DE FAZENDA: varanda frontal e detalhes de leitura ---
  // A referência do sítio tem uma varanda contínua, com pilares de madeira, banco e telhado baixo.
  // São peças decorativas: não entram nos obstáculos para preservar o corredor da porta e a navegação.
  const varandaFrente=bz+2.95,largVaranda=6.8,profVaranda=1.35;
  const pisoVaranda=bloco(new THREE.BoxGeometry(largVaranda,.16,profVaranda),matConcreto(),bx,by+.13,varandaFrente);
  superficiesAndaveis.push(pisoVaranda);
  const pilaresVaranda=matMadeira(0x68452f);
  for(const px of[-2.85,2.85])for(const pz of[2.43,3.47])
    bloco(new THREE.BoxGeometry(.22,2.65,.22),pilaresVaranda,bx+px,by+1.42,bz+pz);
  // Vigas e telheiro criam a silhueta de varanda mesmo à distância.
  bloco(new THREE.BoxGeometry(7.1,.18,.22),ripaEscura,bx,by+2.72,varandaFrente-0.55);
  const telheiroVaranda=new THREE.Mesh(uvPorMetro(new THREE.BoxGeometry(7.15,.14,1.7)),telhadoFazenda);
  telheiroVaranda.position.set(bx,by+2.92,varandaFrente+.05);telheiroVaranda.rotation.x=-.08;
  telheiroVaranda.castShadow=true;telheiroVaranda.receiveShadow=true;bairro.add(telheiroVaranda);
  // Vasos simples dão escala humana e quebram a repetição da fachada.
  const vasoTerracota=bmat(0x9b5937),folhaVaso=folhaMat;
  for(const px of[-2.35,2.35]){
    bloco(new THREE.CylinderGeometry(.16,.21,.28,8),vasoTerracota,bx+px,by+.34,varandaFrente+.40);
    bloco(new THREE.DodecahedronGeometry(.28,0),folhaVaso,bx+px,by+.68,varandaFrente+.40);
  }

  // Marco vertical do sítio: caixa d’água elevada e moinho, inspirados no painel enviado.
  // Ficam no fundo da propriedade e não ocupam o campo, os currais nem o acesso.
  function criarCaixaAgua(x,z){
    const g=new THREE.Group();g.position.set(x,obterElevacao(x,z),z);bairro.add(g);
    const metalRural=new THREE.MeshStandardMaterial({color:0x56616a,roughness:.72,metalness:.38});
    const metalEscuro=new THREE.MeshStandardMaterial({color:0x30383d,roughness:.8,metalness:.3});
    for(const px of[-.62,.62])for(const pz of[-.62,.62])bloco(new THREE.CylinderGeometry(.075,.09,3.15,8),metalEscuro,px,1.58,pz,g);
    bloco(new THREE.CylinderGeometry(.82,.82,1.15,16),metalRural,0,3.35,0,g);
    bloco(new THREE.CylinderGeometry(.78,.78,.10,16),metalEscuro,0,3.94,0,g);
    bloco(new THREE.CylinderGeometry(.10,.10,.18,8),metalEscuro,0,4.10,0,g);
    criarSombraContato(1.25,g,0,0);
  }
  function criarMoinho(x,z){
    const g=new THREE.Group();g.position.set(x,obterElevacao(x,z),z);bairro.add(g);
    const ferro=new THREE.MeshStandardMaterial({color:0x667078,roughness:.78,metalness:.45});
    const ferrugem=new THREE.MeshStandardMaterial({color:0x7a4b32,roughness:.88,metalness:.18});
    bloco(new THREE.CylinderGeometry(.10,.17,6.6,8),ferro,0,3.3,0,g);
    const topo=new THREE.Group();topo.position.set(0,6.45,.05);g.add(topo);
    bloco(new THREE.CylinderGeometry(.18,.18,.30,10),ferrugem,0,0,0,topo).rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){
      const ang=i*Math.PI/4;
      const pa=new THREE.Group();pa.rotation.z=ang;topo.add(pa);
      bloco(new THREE.BoxGeometry(.10,1.42,.06),ferro,0,.82,0,pa);
      bloco(new THREE.BoxGeometry(.22,.10,.07),ferro,0,1.50,0,pa);
    }
    criarSombraContato(1.2,g,0,0);
  }
  // Fundo sudeste livre: a posição anterior caiu dentro do curral das galinhas e fazia a caixa
  // d'água atravessar a cerca. Aqui os dois marcos ficam fora dos três currais, com corredor de serviço.
  criarCaixaAgua(cx+9.5,cz-9.5);
  criarMoinho(cx+7.2,cz-9.2);
  // Cocho e barril continuam existindo, mas saem da parede: antes atravessavam o canto traseiro.
  // Agora formam a área de serviço lateral, fora da porta e fora do corredor da porteira.
  const cocho=FAZENDA_CONFIG.servico.cocho,barril=FAZENDA_CONFIG.servico.barril;
  bloco(new THREE.BoxGeometry(cocho.largura,.4,cocho.profundidade),ripaEscura,
    cocho.x,obterElevacao(cocho.x,cocho.z)+.3,cocho.z);
  bloco(new THREE.CylinderGeometry(.35,barril.raio,.7,10),ripaEscura,
    barril.x,obterElevacao(barril.x,barril.z)+.35,barril.z);

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
  const PORTEIRA_VAO=FAZENDA_CONFIG.porteira.vao,porteiraZ=FAZENDA_CONFIG.porteira.z,porteiraX=FAZENDA_CONFIG.porteira.x;
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

  // --- ROÇA: CAMPO PRÓPRIO, FORA DOS CURRAIS REAIS ---
  // A área vem de FarmConfig, o mesmo arquivo que agora alimenta AnimalPens.js. Mesmo se alguém mover
  // um curral no futuro, a checagem abaixo impede silenciosamente qualquer canteiro de nascer dentro dele.
  const cultivo=FAZENDA_CONFIG.cultivo;
  const RAIO_CORREDOR_ACESSO=FAZENDA_CONFIG.acesso.raio;
  const areaServico=FAZENDA_CONFIG.servico.limpeza;
  const invadeServico=(x,z,meiaX=0,meiaZ=0)=>
    Math.abs(x-areaServico.x)<=areaServico.meiaX+meiaX&&
    Math.abs(z-areaServico.z)<=areaServico.meiaZ+meiaZ;
  const invadeCurral=(x,z,meiaX=0,meiaZ=0)=>Object.values(FAZENDA_CONFIG.currais).some(c=>
    Math.abs(x-c.cx)<=c.w/2+meiaX&&Math.abs(z-c.cz)<=c.d/2+meiaZ);
  const canteiros=[],pes=[];
  const zIni=cultivo.minZ,zFim=cultivo.maxZ,xIni=cultivo.minX,xFim=cultivo.maxX;
  const SEGMENTO_CANTEIRO=cultivo.segmento;
  for(let z=zIni;z<=zFim;z+=cultivo.espacamentoLinha){
    // Uma caixa única atravessava o relevo com a cota do centro e deixava as pontas suspensas. Segmentos
    // curtos permitem apoiar cada parte na altura local sem perder o baixo custo do InstancedMesh.
    for(let x0=xIni;x0<xFim-.001;x0+=SEGMENTO_CANTEIRO){
      const comp=Math.min(SEGMENTO_CANTEIRO,xFim-x0),mx=x0+comp/2;
      // Soma meia peça ao raio para nenhuma ponta do canteiro invadir a passagem.
      if(distanciaAoCorredorFazenda(mx,z)>RAIO_CORREDOR_ACESSO+comp/2&&!invadeServico(mx,z,comp/2,.51)&&!invadeCurral(mx,z,comp/2,.51))canteiros.push([mx,z,comp]);
    }
    for(let x=xIni+.35;x<=xFim-.35;x+=.62){
      const px=x+(Math.random()-.5)*.16,pz=z+(Math.random()-.5)*.22;
      if(distanciaAoCorredorFazenda(px,pz)>RAIO_CORREDOR_ACESSO+.25&&!invadeServico(px,pz,.25,.25)&&!invadeCurral(px,pz,.25,.25))pes.push([px,pz]);
    }
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
    // A soleira foi nivelada no Terrain; cada pivô ainda lê a sua cota real para nunca depender
    // de uma suposição sobre o relevo.
    pivo.position.set(porteiraX,obterElevacao(porteiraX,batenteZ),batenteZ);
    bairro.add(pivo);
    // Ferragens do batente: dobradiças verticais, só acabamento visual.
    for(const alt of[.42,1.02])bloco(new THREE.CylinderGeometry(.04,.04,.16,8),ferragemPorta,.04,alt,0,pivo);
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
    // Trinco/pegador perto do encontro das duas folhas. Fica dentro da silhueta da porteira.
    bloco(new THREE.BoxGeometry(.08,.10,.24),ferragemPorta,.035,.82,-lado*(folhaLarg/2-.16),folha);
    const segmentos=criarSegmentosFolha(folha,'z',folhaLarg,ALTURA_PORTEIRA,.12,'porteira');
    pivos.push({pivo,lado,folha,segmentos});
  }
  // Duas caixas móveis acompanham as duas folhas. Quando abertas, ficam junto da madeira aberta;
  // quando fechadas, encontram-se no centro. Nada some nem aparece antes da animação.
  porteiraFazenda.x=porteiraX;porteiraFazenda.z=porteiraZ;porteiraFazenda.y=yPorteira;
  porteiraFazenda.pivos=pivos;porteiraFazenda.aberta=true;
  aplicarPorteiraImediata();

  // Árvores no fundo do sítio, fora da roça e longe do celeiro.
  for(const[ax,az]of[[cx-meiaLarg-3,cz+6],[cx-meiaLarg-2,cz-8],[cx+meiaLarg+3,cz-4],[cx+meiaLarg+2,cz+8],[cx-4,cz+meiaProf+3]])
    arvore(ax,az,1+Math.random()*.25);

  return{cx,cz,meiaLarg,meiaProf,celeiro:{x:bx,z:bz,meiaLarg:3.3,meiaProf:2.8}};
}
export const FAZENDA=criarFazenda();

// O antigo balcão decorativo do Depósito Rural foi removido daqui. Ele era criado em (-94,-53),
// enquanto a soleira da porta fica em torno de z=-53,47: apenas ~47 cm de separação. Visualmente
// tampava a entrada e ocupava exatamente o corredor porteira -> porta. A interação econômica continua
// no mesmo POLOS.fazenda; só o obstáculo visual indevido saiu.


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
[
  ['vaca',-84.6,-58.2],['vaca',-81.5,-56.8],
  ['porco',-79.1,-58.1],['porco',-76.8,-56.4],
  ['galinha',-84.2,-55.5],['galinha',-80.5,-58.7],['galinha',-76.4,-58.8]
].forEach(a=>criarAnimal(a[0],a[1],a[2]));
function dentroCampoAnimais(x,z){
  const c=FAZENDA_CONFIG.animais,m=c.margem;
  return x>=c.minX+m&&x<=c.maxX-m&&z>=c.minZ+m&&z<=c.maxZ-m;
}
function novoAlvoAnimal(){
  const c=FAZENDA_CONFIG.animais,m=c.margem;
  return{
    x:c.minX+m+Math.random()*(c.maxX-c.minX-2*m),
    z:c.minZ+m+Math.random()*(c.maxZ-c.minZ-2*m)
  };
}
export function atualizarAnimais(dt){
  atualizarPorteiraFazenda(dt);
  atualizarPortasCeleiro(dt);
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
