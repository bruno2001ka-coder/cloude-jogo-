// Mundo construído FORA do morro: a FAZENDA (porteira, curral, canteiros, bichos), as duas lojas e o
// esconderijo do Receptador.
// A favela em si mora em `Favela.js` e é só reexportada daqui (ver o bloco logo abaixo).
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,registrarCaixa,superficiesAndaveis,marcarObstaculoMovel}from'./Physics.js';
import{bmat,matTelha,matConcreto,matMadeira,matTerraArada,matTerraBatida,uvPorMetro,janela,porta,agua,posteMat,folhaMat,folhaClara,criarSombraContato}from'./Materials.js';
import{POLOS}from'./Poles.js';
import{buildFarm,getFarm,toggleFarmGate,nearFarmGate,FARM_DEFS}from'./FarmGenerator.js';

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
import{favela,casasPos,casasCliente,BECOS,casasOcas,BAR,BIQUEIRA,sumirCaixa,alternarPorta,
  casaOcaEmQueEsta,atualizarPortas}from'./Favela.js';
bairro.add(favela);
export{casasPos,casasCliente,BECOS,casasOcas,BAR,BIQUEIRA,sumirCaixa,alternarPorta,
  casaOcaEmQueEsta,atualizarPortas};

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

// ===== FAZENDA BASE =====
// Não existe mais um gerador paralelo aqui. A fazenda antiga também passa pelo MESMO buildFarm()
// usado por Boa Vista, Vale do Cedro e Ribeirão. Portanto não há arquitetura velha embaixo da nova.
const DEF_FAZENDA_BASE=FARM_DEFS.find(f=>f.id==='fazenda-base');
const HANDLE_FAZENDA_BASE=buildFarm(DEF_FAZENDA_BASE.x,DEF_FAZENDA_BASE.z,0,{
  ...DEF_FAZENDA_BASE,parent:bairro,seed:7,gateIndex:1
});
export const FAZENDA={
  cx:DEF_FAZENDA_BASE.x,cz:DEF_FAZENDA_BASE.z,
  meiaLarg:DEF_FAZENDA_BASE.meiaLarg,meiaProf:DEF_FAZENDA_BASE.meiaProf,
  sede:{...HANDLE_FAZENDA_BASE.sede},
  celeiro:{
    x:HANDLE_FAZENDA_BASE.galpao.x,z:HANDLE_FAZENDA_BASE.galpao.z,
    meiaLarg:HANDLE_FAZENDA_BASE.galpao.meiaLarg,meiaProf:HANDLE_FAZENDA_BASE.galpao.meiaProf
  },
  pasto:{...HANDLE_FAZENDA_BASE.pasto,areaAnimal:{...HANDLE_FAZENDA_BASE.pasto.areaAnimal}}
};
export const porteiraFazenda=HANDLE_FAZENDA_BASE.gate;
export function alternarPorteira(){return toggleFarmGate('fazenda-base')}
export function pertoDaPorteira(pos){return nearFarmGate('fazenda-base',pos)}


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
// Os animais pertencem à ZONA C (pasto), não à sede nem ao galpão.
// As posições são locais ao pasto; mover/redimensionar a fazenda não volta a colocar bicho sob coluna.
function pontoDoPasto(lx,lz){
  const p=FAZENDA.pasto,c=Math.cos(p.rotation||0),sn=Math.sin(p.rotation||0);
  return{x:p.x+lx*c+lz*sn,z:p.z-lx*sn+lz*c};
}
[
  ['vaca', -2.8,-.2],['vaca', 2.6,.8],
  ['porco',-1.8,-2.0],['porco',2.0,-1.8],
  ['galinha',-3.4,1.7],['galinha',0,1.9],['galinha',3.3,1.5]
].forEach(([tipo,lx,lz])=>{const p=pontoDoPasto(lx,lz);criarAnimal(tipo,p.x,p.z)});

function dentroDoCurral(x,z){
  const p=FAZENDA.pasto,a=p.areaAnimal,dx=x-p.x,dz=z-p.z,c=Math.cos(p.rotation||0),sn=Math.sin(p.rotation||0);
  const lx=dx*c-dz*sn,lz=dx*sn+dz*c;
  return Math.abs(lx)<=a.meiaLarg&&Math.abs(lz)<=a.meiaProf;
}
function novoAlvoAnimal(){
  const p=FAZENDA.pasto,a=p.areaAnimal;
  const lx=(Math.random()*2-1)*a.meiaLarg*.92,lz=(Math.random()*2-1)*a.meiaProf*.92;
  return pontoDoPasto(lx,lz);
}
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
