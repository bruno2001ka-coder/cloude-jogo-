// ===== POLÍCIA =====
// Dois motivos pra a polícia descer, e a máquina de estados é a mesma pros dois:
//   BATIDA  — o helicóptero avista uma muda FLORIDA em sobrevoo e vai confiscar (alvoPlanta ≠ null).
//   CAÇADA  — o jogador está com ficha suja (procurado > 0) e o alvo é ELE (alvoPlanta = null,
//             então não há o que confiscar e o desfecho é sempre o confronto).
// `pontoAlvo` é o destino do helicóptero nos dois casos; quem os distingue é `alvoPlanta`.
//
// A ficha só desce dentro do esconderijo (casa da favela com a porta fechada, ver WorldGenerator):
// fora dele nada limpa, nem fugir nem abater a guarnição inteira. Matar policial soma +1, e a ficha
// dimensiona a próxima guarnição (2 a 6) — abater todos é o caminho mais rápido pra trazer mais.
//
// A máquina de estados é EXPLÍCITA (tabela `ESTADOS` + função `transitar`): antes eram seis `else if`
// com as transições espalhadas por dentro dos corpos e nenhum ponto único de entrada/saída — o que já
// tinha custado uma chamada `encerrarEncontro(false)` numa função sem parâmetro e três cópias da rotina
// de limpeza do encontro.
//
//        muda florida em sobrevoo (BATIDA) ∨ procurado > 0 (CAÇADA), e ¬escondido
//     ┌──────────┐ ──────────────────────────────────────────► ┌────────┐
//     │ PATRULHA │ ◄─────────── cooldown 22 s ───┐              │  INDO  │
//     └──────────┘                                │             └────────┘
//                                            ┌──────────┐            │ d(heli,pontoAlvo) < 3
//          todos abatidos ∨ escondido 3 s    │ RECUANDO │            ▼
//          ∨ jogador rendido ───────────────►└──────────┘       ┌──────────┐
//                                                 ▲             │ PAIRANDO │ (t = 1,2 s)
//                            ┌────────────────────┤             └──────────┘
//                            │                    │                  │
//                            │                    │                  ▼
//                            │                    │              ┌────────┐
//                            │                    │              │ RAPEL  │ (t = 1,5 s · 2 a 6 policiais)
//                            │                    │              └────────┘
//                            │                    │                  │ caçada → sempre COMBATE
//                       ┌─────────┐   o jogador se aproxima   ┌──────────────┐
//                       │ COMBATE │ ◄────────────────────────  │ CONFISCANDO  │ (t = 9 s → confisca)
//                       └─────────┘                            └──────────────┘
import*as THREE from'three';
import{scene,camera}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{primeiroImpactoNoSegmento,intersectarSegmentoCaixa,buscarPosicaoLivre}from'./Physics.js';
import{encontrarCaminho,visaoHorizontalLivre,pontoNavegavel}from'./NavMesh.js';
import{player,zonasDeAcertoJogador,PLAYER_HEIGHT,encararDirecao,definirAnimacaoTiro}from'./Player.js';
import{ORDEM_ARMAS,armaEquipada,idArmaEquipada,equiparArma,obterBocaDaArma,direcaoComDispersao}from'./Weapons.js';
import{estaEscondido,refugioEmQueEsta,refugios}from'./WorldGenerator.js';
import{colidePedestre,waypointsVielas}from'./NPCs.js';
import{plantas,confiscarPlanta,aplicarMulta,inventario,atualizarStatusEconomia,isInventarioAberto}from'./Economy.js';
import{dispararBala,atualizarBalas,limparBalas}from'./Bullets.js';
import{aplicarDano,renderizarVidaJogador,criarBarraMundo}from'./HealthBar.js';
import{droneState,miraState}from'./Camera.js';

const HELI_ALTURA=38,HELI_VELOCIDADE=12,MAPA_LIMITE=95;
// Raio de detecção dimensionado pra funcionar em SOBREVOO, agora que o heli não vai mais direto na
// coordenada da muda: mapa de 190x190 = 36.100 m², heli a 12 m/s, faixa varrida = 2R x v.
//   R=10 →  240 m²/s → mapa inteiro em 150 s → na prática a polícia nunca achava nada
//   R=20 →  480 m²/s → mapa inteiro em  75 s → com o viés de patrulha abaixo, ~15-40 s pós-floração
const DETECCAO_RAIO=20,APROX_RAIO=3;
// Só a muda FLORIDA é vista do alto. Broto e vegetativa parecem qualquer mato de 38 m de altura — e
// sem esse filtro a muda era confiscada por volta de t=19 s sendo que só fica colhível em t=44 s, ou
// seja, o ciclo econômico do jogo era impossível de completar.
const PLANTA_DETECTAVEL_ESTAGIO=2;
// Viés de patrulha: fração dos waypoints sorteados DENTRO de um disco em volta de uma muda madura.
// É o que substitui a antiga "caça ativa" — a polícia bate a região, em vez de ir na coordenada.
const PATRULHA_VIES=.55,PATRULHA_RAIO_VIES=30;
// Tempo que o heli fica estabilizado sobre a plantação antes de soltar as cordas.
const PAIRANDO_DURACAO=1.2;
const RAPEL_DURACAO=1.5;
const COMBATE_RAIO_ATIVACAO=16;
const POLICIAL_HP=100,POLICIAL_VELOCIDADE=2,POLICIAL_ALCANCE_TIRO=13,POLICIAL_APROX_MIN=7;
const POLICIAL_DANO_MIN=10,POLICIAL_DANO_MAX=18,POLICIAL_COOLDOWN_MIN=1.1,POLICIAL_COOLDOWN_MAX=2.1;
// ===== PROCURADO =====
// A barra SÓ desce dentro do esconderijo (casa da favela com a porta fechada). Fora dele não existe
// decaimento nenhum: correr não limpa ficha, e é isso que dá função ao esconderijo.
//   · matar policial              → +1
//   · a abordagem avançar         → piso de 1 (indo), 2 (confisco) e 3 (combate)
//   · escondido, a cada 18 s      → −1
//   · escondido por 3 s           → a guarnição em campo perde o rastro e recua
//   · saiu com a barra > 0        → a caçada recomeça, agora atrás do JOGADOR
const PROCURADO_MAX=5;
// 18 s por estrela (faixa pedida: 15–25). Com 6 s o esconderijo zerava uma ficha 5 em meio minuto e
// a escalada nunca chegava a doer; 18 s obriga a planejar a fuga (ficha 5 = 1min30 dentro da casa).
const ESCONDIDO_PARA_SUMIR=3,ESCONDIDO_POR_NIVEL=18,CACA_ATRASO=4;
// ===== O HELICÓPTERO NÃO É PERMANENTE =====
// Antes ele sobrevoava a favela 24 h por dia, e isso matava duas coisas ao mesmo tempo: a favela nunca
// ficava tranquila e a chegada dele deixava de significar alguma coisa. Agora existem dois regimes:
//   procurado < PROCURADO_HELI_ATIVO → RONDA DISTANTE: voa alto, colado nas bordas do mapa, e só
//     enxerga muda florida com raio reduzido (o loop econômico da batida continua existindo, mas raro);
//     caçada AO JOGADOR por rapel não acontece — quem persegue nessa faixa é a polícia de rua.
//   procurado ≥ PROCURADO_HELI_ATIVO → ele entra pra valer: altitude normal, patrulha por cima da
//     favela, raio de detecção cheio e caçada ao jogador.
const PROCURADO_HELI_ATIVO=3;
const HELI_ALTURA_LONGE=62,HELI_BORDA=88,DETECCAO_RAIO_LONGE=8,COOLDOWN_LONGE=55;
// ===== VISÃO (cone + linha de visão) =====
// Meia-abertura do cone em radianos: 0,95 rad ≈ 54°, cone total ≈ 109° — perto do campo útil humano.
// Sobe 0,07 rad por estrela (na ficha 5 vai a 1,30 rad ≈ 74°, cone de ~149°): com ficha alta eles estão
// alertas, olhando pros lados, e é muito mais difícil passar de raspão.
const CONE_MEIA_BASE=.95,CONE_MEIA_POR_ESTRELA=.07;
const VISAO_ALCANCE_BASE=18,VISAO_ALCANCE_POR_ESTRELA=1.8;
// ===== CUSTO POR FRAME DO SISTEMA DE VISÃO =====
// Cada policial só reavalia a visão a cada VISAO_INTERVALO, com a fase defasada por índice (i·0,07 s)
// pra os testes se espalharem pelos frames em vez de estourarem todos juntos. Teto real de policiais em
// campo = 6 (guarnição) + 4 (2 duplas de rua) = 10.
//   10 policiais ÷ 0,3 s ÷ 60 fps ≈ 0,55 avaliação de visão por frame.
// E avaliação ≠ raycast: distância e ângulo são testes aritméticos que descartam a maioria dos casos
// ANTES do raycast — só quem já está dentro do cone e no alcance chega a chamar
// primeiroImpactoNoSegmento. Pior caso absoluto (todos dentro do cone o tempo todo): ~0,55 raycast por
// frame, contra os 10/frame que uma checagem ingênua custaria. Some-se 1 raycast/frame do
// resolverPontoVisado do jogador e ~1 por bala em voo, que já existiam.
const VISAO_INTERVALO=.3,VISAO_DEFASAGEM=.07;
// Quanto tempo a última posição avistada continua valendo como destino depois que o jogador some.
// Curto demais e eles desistem na primeira quina; longo demais e viram teleguiados.
const MEMORIA_ALVO=9;
// ===== BUSCA: o estado que faltava =====
// Antes existiam só dois modos: ou o policial via o jogador, ou (passados os 9 s de rastro) voltava a
// sortear um ponto no mapa INTEIRO. Não havia "procurando" — ou estavam em cima de você, ou andavam à
// toa, e um policial que acabava de te perder podia sair andando pro outro lado da favela.
// Agora, quando o rastro quente esfria, começa a BUSCA: cada um vasculha em volta do último ponto
// conhecido, num raio que CRESCE com o tempo, até desistir.
const BUSCA_DURACAO=26,BUSCA_RAIO_INICIAL=4,BUSCA_RAIO_FINAL=22;
// Ângulo de ouro. Dando a cada policial um setor separado por 137,5°, qualquer número deles se
// espalha em volta do ponto sem ninguém precisar coordenar nada — e é o que faz a dupla ABRIR em vez
// de andar em fila indiana atrás do mesmo destino, que é o que mais denunciava o bot.
const SETOR_OURO=2.399963229728653;
// Deriva angular ao longo da busca: sem ela cada um anda em linha reta pra fora do seu setor. Com
// ela o caminho vira espiral, que é o que lê como varredura.
const BUSCA_DERIVA=1.1;
// Raios tentados ao longo do setor, em fração do raio da vez. São buscas em grade (~1 µs cada), não
// raycast: sai caro zero e é o que mantém cada policial no rumo dele mesmo em quarteirão fechado.
const BUSCA_ESCALAS=[1,.75,1.25,.5,1.5,.3];
// ===== POLÍCIA DE RUA =====
// Duplas que nascem numa borda, rondam as vielas e vão embora. Nunca permanentes: com procurado 0 a
// janela entre surtos é longa de propósito, senão a favela nunca respira. RUA_INTERVALO é sorteado em
// [min,max] e ENCOLHE com a ficha (÷(1+procurado·0,45)), então é a ficha suja que enche a rua de fardado.
const RUA_INTERVALO_MIN=70,RUA_INTERVALO_MAX=140,RUA_DUPLA_VIDA=75,RUA_MAX_DUPLAS=2;
const RUA_VELOCIDADE=1.7,RUA_CHEGADA=1.6,RUA_VASCULHAR_RAIO=3.2;
// Agressividade por estrela: velocidade, cadência e distância em que param de avançar pra trocar tiro.
const AGRESSAO_VEL_POR_ESTRELA=.16,AGRESSAO_CADENCIA_POR_ESTRELA=.11,AGRESSAO_APROX_POR_ESTRELA=.55;
// Quanto mais alta a ficha, maior a guarnição. Teto de 6 por causa do celular: cada policial é uma
// malha de 7 blocos, uma barra de vida com CanvasTexture e um A* próprio replanejando.
function numPoliciaisPara(p){return Math.min(6,2+Math.max(0,p-1))}
const JOGADOR_HP_MAX=100,JOGADOR_ARMADURA_MAX=100,JOGADOR_REGEN=3;
// Cadência/dano/alcance agora vêm da ficha da arma equipada (Weapons.js). Sobrou só o custo da troca:
// o cooldown é global (proximoTiroJogador), então sem ele dava pra escopeta→pistola→escopeta pra
// cancelar os 0,85 s de recarga.
const TEMPO_TROCA=.35;
// Janela generosa: com 2,2 s o jogador quase nunca conseguia chegar a tempo e o confronto virava
// confisco silencioso — dava a impressão de que a troca de tiro nem existia no jogo.
const CONFISCO_DURACAO=9,RECUO_DURACAO=2;
const COOLDOWN_ENTRE_BUSCAS=22,MULTA_RENDICAO=60;
const SPAWN_X=0,SPAWN_Z=8;
// Perseguição: intervalo de recálculo do caminho e distância que o alvo precisa andar pra invalidar a rota.
const REPLANEJAR_INTERVALO=.7,REPLANEJAR_DESVIO=3,CHEGADA_WAYPOINT=.7;

// ===== Helicóptero: fuselagem em cápsula, cauda com rotor, rotor principal girando, luzes de alerta piscando.
const heliMat=new THREE.MeshStandardMaterial({color:0x2b3a2e,roughness:.55,metalness:.35});
const heliVidro=new THREE.MeshPhysicalMaterial({color:0x1a2c33,roughness:.15,metalness:.2,clearcoat:.6,emissive:0x1a2c33,emissiveIntensity:.15});
const rotorMat=new THREE.MeshStandardMaterial({color:0x1c1c1c,roughness:.6,metalness:.4});
const lampVermelha=new THREE.MeshStandardMaterial({color:0xff2a2a,emissive:0xff2a2a,emissiveIntensity:1.6});
const lampAzul=new THREE.MeshStandardMaterial({color:0x2a6bff,emissive:0x2a6bff,emissiveIntensity:1.6});
function blocoHeli(geo,mat,x,y,z,parent){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}

const heli=new THREE.Group();scene.add(heli);
const fuselagem=blocoHeli(new THREE.CapsuleGeometry(.85,2.1,4,8),heliMat,0,0,0,heli);fuselagem.rotation.x=Math.PI/2;
blocoHeli(new THREE.SphereGeometry(.68,10,8),heliVidro,0,-.1,1.5,heli);
const caudaBoom=blocoHeli(new THREE.CylinderGeometry(.14,.22,2.6,6),heliMat,0,.15,-2.35,heli);caudaBoom.rotation.x=Math.PI/2;
const rotorCauda=new THREE.Group();rotorCauda.position.set(.28,.35,-3.55);heli.add(rotorCauda);
blocoHeli(new THREE.BoxGeometry(.04,1,.1),rotorMat,0,0,0,rotorCauda);blocoHeli(new THREE.BoxGeometry(.04,1,.1),rotorMat,0,0,0,rotorCauda).rotation.z=Math.PI/2;
const mastro=blocoHeli(new THREE.CylinderGeometry(.08,.1,.35,6),rotorMat,0,.95,0,heli);
const rotorPrincipal=new THREE.Group();rotorPrincipal.position.set(0,1.15,0);heli.add(rotorPrincipal);
for(const ang of[0,Math.PI/2]){const pa=blocoHeli(new THREE.BoxGeometry(5.2,.05,.22),rotorMat,0,0,0,rotorPrincipal);pa.rotation.y=ang}
for(const xx of[-.55,.55])blocoHeli(new THREE.CylinderGeometry(.05,.06,.9,6),heliMat,xx,-.85,.15,heli).rotation.z=.15*Math.sign(-xx);
const luzBarra=new THREE.Group();luzBarra.position.set(0,.62,0);heli.add(luzBarra);
const luzV=blocoHeli(new THREE.BoxGeometry(.22,.1,.22),lampVermelha,-.3,0,0,luzBarra);
const luzA=blocoHeli(new THREE.BoxGeometry(.22,.1,.22),lampAzul,.3,0,0,luzBarra);
const holofoteSpot=new THREE.SpotLight(0xfff2c8,3.2,60,Math.PI*.11,.45,1.4);holofoteSpot.castShadow=false;heli.add(holofoteSpot);
const holofoteAlvo=new THREE.Object3D();scene.add(holofoteAlvo);holofoteSpot.target=holofoteAlvo;
const feixeMat=new THREE.MeshBasicMaterial({color:0xfff2c8,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide});
const feixe=new THREE.Mesh(new THREE.ConeGeometry(1,1,16,1,true),feixeMat);feixe.renderOrder=1;scene.add(feixe);
heli.position.set(0,HELI_ALTURA,0);
let heliAlvo={x:(Math.random()*2-1)*MAPA_LIMITE,z:(Math.random()*2-1)*MAPA_LIMITE};

// ===== Policiais: mesma técnica de bloco do NPC comum, uniforme escuro + boné + "arma" na mão.
const skinPolicial=[0xc79067,0x8a5a3c,0xe0b088,0x6b4a30];
const uniformeMat=new THREE.MeshStandardMaterial({color:0x232c3d,roughness:.7}),
  coleteMat=new THREE.MeshStandardMaterial({color:0x14181f,roughness:.75}),
  boneMat=new THREE.MeshStandardMaterial({color:0x14181f,roughness:.8}),
  armaMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:.4,metalness:.6});
function blocoP(geo,mat,x,y,z,parent){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// A malha crua do policial mede 1,78 nesta escala — dividindo por PLAYER_HEIGHT dá a escala que
// deixa o policial exatamente do mesmo tamanho do personagem principal.
const ESCALA_POLICIAL=PLAYER_HEIGHT/1.78;

// ===== ZONAS DE ACERTO DO POLICIAL =====
// Mesmas frações do corpo cru (cabeça 1,3–1,78 · tronco 0,62–1,3 · pernas 0–0,62), escaladas por
// ESCALA_POLICIAL pra bater com o policial do tamanho do jogador (0,9 m).
const ZONAS_POLICIAL=[
  {nome:'cabeca',de:.657,ate:.9,meia:.131,multiplicador:2},
  {nome:'tronco',de:.313,ate:.657,meia:.172,multiplicador:1},
  {nome:'pernas',de:0,ate:.313,meia:.111,multiplicador:.6},
];

function criarPolicial(indice,tipo='rapel'){
  const g=new THREE.Group();
  const skinMat=new THREE.MeshStandardMaterial({color:skinPolicial[Math.floor(Math.random()*skinPolicial.length)],roughness:.55});
  blocoP(new THREE.BoxGeometry(.55,.82,.33),uniformeMat,0,.87,0,g);
  blocoP(new THREE.BoxGeometry(.58,.4,.36),coleteMat,0,1.02,0,g);
  blocoP(new THREE.BoxGeometry(.37,.37,.35),skinMat,0,1.48,0,g);
  blocoP(new THREE.BoxGeometry(.4,.14,.38),boneMat,0,1.7,0,g);
  const pernas=[-.14,.14].map(lx=>blocoP(new THREE.BoxGeometry(.13,.55,.16),uniformeMat,lx,.29,0,g));
  const bracos=[-.37,.37].map(lx=>blocoP(new THREE.BoxGeometry(.13,.58,.16),skinMat,lx,.9,0,g));
  const arma=blocoP(new THREE.BoxGeometry(.08,.1,.42),armaMat,.37,.68,.18,g);
  g.scale.setScalar(ESCALA_POLICIAL);
  scene.add(g);
  return{
    grupo:g,pernas,bracos,arma,hp:POLICIAL_HP,vivo:true,caindo:false,quedaT:0,tipo,
    pos:new THREE.Vector3(),proximoTiro:0,caminhando:0,
    // Percepção: `proximaVisao` defasa a checagem entre policiais (ver comentário do custo por frame);
    // `viu` é o resultado da última avaliação, reaproveitado pelos frames intermediários.
    proximaVisao:indice*VISAO_DEFASAGEM,viu:false,olharY:0,
    // Setor de busca deste policial, espalhado pelo ângulo de ouro (ver SETOR_OURO).
    setorBusca:indice*SETOR_OURO,
    // Altura renderizada, interpolada: é o que deixa o policial subir junto pra laje (o A* é 2D).
    alturaAtual:null,
    // Vida útil e destino da ronda — só a polícia de RUA usa. `modo` distingue ronda · vasculhando ·
    // caçando · saindo; a guarnição de rapel continua toda no estado 'combate' da máquina do heli.
    modo:'ronda',destino:null,expiraEm:0,refugioAlvo:null,
    // Perseguição: rota do A*, waypoint atual e o relógio de replanejamento — defasado por policial
    // (i·0,35 s) pra os dois não recalcularem no mesmo frame e dobrarem o custo num pico só.
    rota:null,indiceRota:0,destinoRota:null,proximoReplan:indice*.35,
    // As caixas de acerto são criadas UMA vez e só têm os valores reescritos por frame.
    caixas:ZONAS_POLICIAL.map(()=>new THREE.Box3()),
    barra:criarBarraMundo(2.05*ESCALA_POLICIAL,ESCALA_POLICIAL),
  };
}
// Reescreve as caixas de acerto do policial na posição atual (sem alocar) e devolve a lista.
function zonasDoPolicial(pol){
  const baseY=pol.grupo.position.y;
  return ZONAS_POLICIAL.map((zona,i)=>{
    const caixa=pol.caixas[i];
    caixa.min.set(pol.pos.x-zona.meia,baseY+zona.de,pol.pos.z-zona.meia);
    caixa.max.set(pol.pos.x+zona.meia,baseY+zona.ate,pol.pos.z+zona.meia);
    return{caixa,multiplicador:zona.multiplicador};
  });
}

// ===== Estado da polícia e do jogador =====
// `pontoAlvo` é pra onde o helicóptero vai: a muda, numa batida de plantação, ou o JOGADOR, numa
// caçada por ficha suja. `alvoPlanta` fica null na caçada — é o que distingue os dois casos, porque
// só a batida termina em confisco.
const policia={estado:'patrulha',alvoPlanta:null,pontoAlvo:{x:0,z:0},tempoEstado:0,cooldownAte:0,
  tempoEscondido:0,tempoNivel:0,retomarCacaEm:0,procurado:0};
// ===== O QUE CHAMA ATENÇÃO DA POLÍCIA =====
// Antes bastava EXISTIR: a abordagem à plantação já elevava a ficha por si só, e a partir daí o
// jogador era caçado pra sempre sem ter feito nada além de plantar. Agora a polícia só se interessa
// por duas razões, e as duas são coisas que o jogador FEZ:
//   · está com a MOCHILA nas costas levando pacote (flagrante — dá pra ver de longe);
//   · já foi preso alguma vez (tem ficha corrida, então fica marcado).
// Fora isso ele é mais um morador: a batida vem pela PLANTA, confisca e vai embora.
let jaFoiPreso=false;
function levandoPacote(){return inventario.pacote>0}
export function chamaAtencao(){return levandoPacote()||jaFoiPreso}
export function temFichaCorrida(){return jaFoiPreso}
function elevarProcurado(n){if(n>policia.procurado)policia.procurado=Math.min(PROCURADO_MAX,n)}
function somarProcurado(n){policia.procurado=Math.min(PROCURADO_MAX,policia.procurado+n)}
const policiais=[];
const cordas=[];// rope visual durante o rapel
let saudeJogador=JOGADOR_HP_MAX,armaduraJogador=0,jogadorRendido=false;
let proximoTiroJogador=0;

// ===== HUD: vida, alerta, esconderijo, mira de combate, botão de atirar, flash de dano =====
const alertaEl=document.getElementById('alertaPolicia'),
  refugioEl=document.getElementById('refugioIndicador'),miraCombateEl=document.getElementById('miraCombate'),
  fireBtn=document.getElementById('fireBtn'),danoFlash=document.getElementById('danoFlash'),
  avisoPolicia=document.getElementById('avisoPolicia'),municaoEl=document.getElementById('municaoHud'),
  armaBtn=document.getElementById('armaBtn'),armaIconeEl=document.getElementById('armaIcone'),
  armaMunicaoEl=document.getElementById('armaMunicao'),miraBtn=document.getElementById('miraBtn');
function atualizarHudSaude(){renderizarVidaJogador(saudeJogador,JOGADOR_HP_MAX,armaduraJogador,JOGADOR_ARMADURA_MAX)}
// A munição também muda por COMPRA (na Economy, que não conhece este módulo). Em vez de acoplar os dois,
// o HUD observa o valor e só redesenha quando ele muda de fato — nada de escrever no DOM por frame.
// A chave é COMPOSTA de propósito: só o número não bastaria, porque rifle com 12 balas e pistola com
// 12 balas dariam cache-hit e o ícone congelaria na arma anterior.
let armaHudCache='',alertaCache='';
function atualizarHudMunicao(){
  const arma=armaEquipada(),n=inventario.municao[arma.id],donas=ORDEM_ARMAS.filter(id=>inventario.armas[id]).length;
  const chave=`${arma.id}:${n}:${donas}`;
  if(chave===armaHudCache)return;
  armaHudCache=chave;
  if(municaoEl)municaoEl.textContent=`${arma.icone} ${n}`;
  if(armaIconeEl)armaIconeEl.textContent=arma.icone;
  if(armaMunicaoEl)armaMunicaoEl.textContent=n;
}
function mostrarAviso(texto,ms=2600){avisoPolicia.textContent=texto;avisoPolicia.style.display='block';avisoPolicia.style.opacity='1';clearTimeout(avisoPolicia._t);avisoPolicia._t=setTimeout(()=>{avisoPolicia.style.opacity='0';setTimeout(()=>avisoPolicia.style.display='none',300)},ms)}
function flashDano(){danoFlash.style.opacity='.55';clearTimeout(danoFlash._t);danoFlash._t=setTimeout(()=>danoFlash.style.opacity='0',120)}
atualizarHudSaude();atualizarHudMunicao();

function distXZ(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function jogadorEscondido(){return estaEscondido(player.position)}

// Uma muda só existe pros olhos da polícia depois de florescer.
function plantaDetectavel(p){return !p.colhida&&p.estagio>=PLANTA_DETECTAVEL_ESTAGIO}
function mudasMaduras(){return plantas.filter(plantaDetectavel)}

// Próximo ponto da patrulha. Com PATRULHA_VIES de chance cai num disco de PATRULHA_RAIO_VIES em volta
// de uma muda madura sorteada — o heli "está batendo aquela região", não indo na coordenada exata dela.
// Nunca devolve o ponto da planta: é sempre um ponto do disco, e o disco é maior que o raio de detecção.
function sortearWaypointPatrulha(){
  const maduras=mudasMaduras();
  if(maduras.length&&Math.random()<PATRULHA_VIES){
    const alvo=maduras[Math.floor(Math.random()*maduras.length)];
    const ang=Math.random()*Math.PI*2;
    // sqrt(u) distribui uniformemente NA ÁREA do disco; sem isso o sorteio se amontoa no centro,
    // que é justamente o comportamento teleguiado que estamos tirando.
    const raio=PATRULHA_RAIO_VIES*Math.sqrt(Math.random());
    return{x:THREE.MathUtils.clamp(alvo.x+Math.cos(ang)*raio,-MAPA_LIMITE,MAPA_LIMITE),
           z:THREE.MathUtils.clamp(alvo.z+Math.sin(ang)*raio,-MAPA_LIMITE,MAPA_LIMITE)};
  }
  return{x:(Math.random()*2-1)*MAPA_LIMITE,z:(Math.random()*2-1)*MAPA_LIMITE};
}

// Aviso único por muda, no frame em que ela floresce: é quando o relógio de risco começa a correr, e
// sem esse sinal o jogador continua sendo pego de surpresa mesmo com o balanceamento certo.
function avisarFloracao(){
  for(const p of plantas){
    if(p.colhida||p.avisadaFloracao||p.estagio<PLANTA_DETECTAVEL_ESTAGIO)continue;
    p.avisadaFloracao=true;
    mostrarAviso('🌾 Sua muda floresceu — do alto dá pra ver. Colha rápido ou se esconda.',3400);
  }
}

// ===== Dano ao jogador (armadura em série — ver HealthBar.aplicarDano) =====
function receberDanoJogador(dano){
  if(jogadorRendido)return;
  const novo=aplicarDano(saudeJogador,armaduraJogador,dano);
  saudeJogador=novo.saude;armaduraJogador=novo.armadura;
  flashDano();atualizarHudSaude();
  if(saudeJogador<=0)renderJogador();
}
function renderJogador(){
  jogadorRendido=true;
  // Ficha corrida: a partir daqui a polícia passa a ficar de olho nele mesmo sem flagrante. É a
  // segunda (e única outra) razão de a polícia se interessar por alguém — ver `chamaAtencao`.
  jaFoiPreso=true;
  // O colete é apreendido junto: ser rendido é a "morte" deste jogo, e armadura que sobrevive à
  // rendição deixaria a placa no corpo depois do respawn sem o jogador ter pagado por ela.
  // A carga vai junto: ser rendido apreende os pacotes. Deixar a mochila cheia depois da prisão
  // faria o flagrante recomeçar no mesmo instante do respawn.
  armaduraJogador=0;inventario.colete=0;inventario.pacote=0;atualizarStatusEconomia();
  mostrarAviso('Você foi rendido pela polícia — plantação perdida e multa aplicada.',3400);
  if(policia.alvoPlanta&&!policia.alvoPlanta.colhida)confiscarPlanta(policia.alvoPlanta);
  aplicarMulta(MULTA_RENDICAO);
  transitar('recuando');
  setTimeout(()=>{
    player.position.set(SPAWN_X,obterElevacao(SPAWN_X,SPAWN_Z),SPAWN_Z);
    saudeJogador=JOGADOR_HP_MAX;jogadorRendido=false;atualizarHudSaude();
  },1400);
}
// O colete comprado na loja de armas entra em uso sozinho quando o anterior acaba. É verificado aqui, e
// não na Economy, porque Economy → Police seria dependência circular (Police já importa Economy).
function conferirColete(){
  if(armaduraJogador<=0&&inventario.colete>0){
    inventario.colete--;armaduraJogador=JOGADOR_ARMADURA_MAX;
    atualizarStatusEconomia();atualizarHudSaude();
    mostrarAviso('Colete equipado — a armadura absorve parte do dano.',2200);
  }
}

function limparCordas(){
  for(const c of cordas){scene.remove(c.linha);c.linha.geometry.dispose();c.linha.material.dispose()}
  cordas.length=0;
}

// ===== IA de cada policial em combate =====
// Existe parede entre A e B? Sem isso os policiais atiravam através das casas.
function temLinhaDeVisao(ax,ay,az,bx,by,bz){
  return primeiroImpactoNoSegmento(ax,ay,az,bx,by,bz)===null;
}

// ===== CONE DE VISÃO — matemática pura, sem three e sem estado global =====
// Fica isolada de propósito: é a regra que decide se o jogador foi visto, e uma regra dessas precisa
// ser testável fora do jogo (ver o teste do cone). `olharY` usa a MESMA convenção de grupo.rotation.y
// do three: ângulo medido com atan2(x,z), 0 apontando pro +Z.
export function dentroDoCone(ox,oz,olharY,ax,az,meiaAbertura){
  const dx=ax-ox,dz=az-oz;
  if(dx===0&&dz===0)return true;// em cima do policial: não existe direção, considera visto
  let d=Math.atan2(dx,dz)-olharY;
  // Normaliza pra (-π,π]: sem isso, olhar pra 3,1 rad e o alvo a -3,1 rad daria 6,2 rad de diferença
  // (fora de qualquer cone) sendo que são 0,08 rad de distância angular de verdade.
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return Math.abs(d)<=meiaAbertura;
}
// As DUAS condições do pedido, nesta ordem por causa do custo: alcance (aritmética), cone (um atan2),
// e só então a parede. `semParede` é injetado pra esta função continuar pura e testável — no jogo é
// sempre `temLinhaDeVisao`, que é quem chama o raycast de verdade.
export function veAlvo(ox,oy,oz,olharY,ax,ay,az,meiaAbertura,alcance,semParede){
  const dx=ax-ox,dz=az-oz;
  if(dx*dx+dz*dz>alcance*alcance)return false;
  if(!dentroDoCone(ox,oz,olharY,ax,az,meiaAbertura))return false;
  return semParede(ox,oy,oz,ax,ay,az);
}
export function meiaAberturaCone(procurado){return CONE_MEIA_BASE+CONE_MEIA_POR_ESTRELA*Math.max(0,procurado||0)}
export function alcanceVisao(procurado){return VISAO_ALCANCE_BASE+VISAO_ALCANCE_POR_ESTRELA*Math.max(0,procurado||0)}

// ===== RÁDIO: um viu, todos sabem =====
// Guarda só a ÚLTIMA posição avistada, com validade. É o suficiente pra os outros convergirem sem
// virarem teleguiados: ninguém recebe a posição atual do jogador, recebe onde ele estava.
const rastro={ativo:false,x:0,z:0,ate:0,avisadoEm:-99,buscaAte:0};
function compartilharAvistamento(x,z,agora){
  const novo=!rastro.ativo;
  rastro.ativo=true;rastro.x=x;rastro.z=z;rastro.ate=agora+MEMORIA_ALVO;
  rastro.buscaAte=rastro.ate+BUSCA_DURACAO;
  // O aviso é limitado no tempo porque o rastro é reescrito a cada avistamento — sem a trava, um
  // policial de olho no jogador cuspiria a mesma frase a cada 0,3 s.
  if(novo&&agora-rastro.avisadoEm>12){rastro.avisadoEm=agora;mostrarAviso('👮 Te viram — estão chamando reforço no rádio.',2800)}
}
function rastroValido(agora){if(rastro.ativo&&agora>rastro.ate)rastro.ativo=false;return rastro.ativo}
// Janela de busca: já passou o rastro quente, mas ainda não desistiram. Chamar SEMPRE depois de
// rastroValido — é ele que expira o rastro quente.
function emBusca(agora){return !rastro.ativo&&rastro.buscaAte>0&&agora<=rastro.buscaAte}
// Ponto que ESTE policial vasculha agora. Função pura do tempo e do setor dele: o ponto se afasta
// sozinho conforme a busca avança, então o policial varre pra fora sem precisar de máquina de estado
// própria nem de sorteio a cada chegada.
const _busca={x:0,z:0};
function pontoDeBusca(pol,agora){
  const t=THREE.MathUtils.clamp((agora-rastro.ate)/BUSCA_DURACAO,0,1);
  const raio=BUSCA_RAIO_INICIAL+(BUSCA_RAIO_FINAL-BUSCA_RAIO_INICIAL)*t;
  const ang=pol.setorBusca+t*BUSCA_DERIVA;
  // Ponto dentro de casa ou fora do mapa não serve de destino: o A* falharia e ele ficaria empurrando
  // parede. Mas desistir e mandar pro ponto do rastro COLAPSA a dupla inteira no mesmo destino — foi
  // o que a primeira versão fez, e mediu 4° de separação onde os setores prometem 137°. Então ele
  // anda pelo PRÓPRIO setor atrás de um ponto livre, mais perto ou mais longe, e só desiste no fim.
  for(const escala of BUSCA_ESCALAS){
    const r2=raio*escala;
    const x=rastro.x+Math.cos(ang)*r2,z=rastro.z+Math.sin(ang)*r2;
    if(Math.abs(x)<=MAPA_LIMITE&&Math.abs(z)<=MAPA_LIMITE&&pontoNavegavel(x,z)){
      _busca.x=x;_busca.z=z;return _busca;
    }
  }
  _busca.x=rastro.x;_busca.z=rastro.z;
  return _busca;
}

// Avaliação de visão de UM policial, escalonada no tempo. Devolve o resultado memorizado nos frames
// em que não é a vez dele — é isso que segura o custo por frame (ver bloco de constantes).
function perceber(pol,agora){
  if(agora<pol.proximaVisao)return pol.viu;
  pol.proximaVisao=agora+VISAO_INTERVALO;
  // Escondido de verdade (dentro da casa E porta fechada) é invisível por definição, sem gastar raycast.
  if(jogadorEscondido()||jogadorRendido){pol.viu=false;return false}
  const ox=pol.pos.x,oy=pol.grupo.position.y+1.55,oz=pol.pos.z;// olho, não peito
  pol.viu=veAlvo(ox,oy,oz,pol.olharY,player.position.x,player.position.y+1.1,player.position.z,
    meiaAberturaCone(policia.procurado),alcanceVisao(policia.procurado),temLinhaDeVisao);
  if(pol.viu){
    // FLAGRANTE. Ver alguém carregando pacote é o que dá causa pra abordagem — é o único jeito de a
    // ficha nascer sem o jogador ter atirado em ninguém. Sem mochila e sem ficha corrida, ver o
    // jogador não gera nada: ele é mais um morador passando na viela.
    if(levandoPacote())elevarProcurado(1);
    compartilharAvistamento(player.position.x,player.position.z,agora);
  }
  return pol.viu;
}

// Perseguição híbrida: reta quando a visão horizontal está limpa (custo zero), A* quando não está.
// Sem isso o policial anda contra a quina da casa até o desencravador cuspir ele pra fora.
function alvoDeMovimento(pol,agora,destX,destZ){
  const alturaPeito=pol.grupo.position.y+1.1;
  if(visaoHorizontalLivre(pol.pos.x,pol.pos.z,destX,destZ,alturaPeito)){
    pol.rota=null;pol.destinoRota=null;
    return{x:destX,z:destZ};
  }
  const rotaInvalida=!pol.rota||pol.indiceRota>=pol.rota.length
    ||!pol.destinoRota||Math.hypot(pol.destinoRota.x-destX,pol.destinoRota.z-destZ)>REPLANEJAR_DESVIO;
  // O portão de tempo vale AGORA TAMBÉM pra rota inválida. Antes era `rotaInvalida||agora>=...`, e o
  // corpo só rodava com rotaInvalida — ou seja, o portão nunca barrava nada: rota nula significava A*
  // todo quadro. Um policial encravado numa quina zera a rota, o A* falha, a rota continua nula, e ele
  // gastava 585 µs por quadro pra sempre (35 ms por segundo de CPU, de um policial só).
  if(rotaInvalida&&agora>=pol.proximoReplan){
    pol.proximoReplan=agora+REPLANEJAR_INTERVALO;
    const caminho=encontrarCaminho(pol.pos.x,pol.pos.z,destX,destZ);
    if(caminho&&caminho.length){pol.rota=caminho;pol.indiceRota=0;pol.destinoRota={x:destX,z:destZ}}
    else{pol.rota=null;pol.destinoRota=null}
  }
  if(!pol.rota)return{x:destX,z:destZ};// sem rota: tenta a reta, o desencravador cobre
  let wp=pol.rota[pol.indiceRota];
  while(wp&&Math.hypot(wp.x-pol.pos.x,wp.z-pol.pos.z)<CHEGADA_WAYPOINT){wp=pol.rota[++pol.indiceRota]}
  return wp||{x:destX,z:destZ};
}

// Um passo de caminhada com colisão por eixo + animação de perna. Devolve se andou. `olharY` só é
// reescrito quando o corpo se move: parado, o policial mantém a direção do olhar, que é justamente o
// que o cone de visão consulta.
function passoPolicial(pol,dt,alvoX,alvoZ,velocidade){
  const dx=alvoX-pol.pos.x,dz=alvoZ-pol.pos.z,d=Math.hypot(dx,dz)||1;
  const vx=dx/d*velocidade,vz=dz/d*velocidade;
  const nx=pol.pos.x+vx*dt,nz=pol.pos.z+vz*dt;let moveu=false;
  if(!colidePedestre(nx,pol.pos.z)){pol.pos.x=nx;moveu=true}
  if(!colidePedestre(pol.pos.x,nz)){pol.pos.z=nz;moveu=true}
  // Bater na parede invalida a rota, mas NÃO libera replanejamento imediato: era o `proximoReplan=0`
  // daqui que abria a torneira de A* por quadro (ver alvoDeMovimento).
  if(!moveu){pol.rota=null;pol.destinoRota=null}
  else{
    pol.olharY=Math.atan2(vx,vz);pol.grupo.rotation.y=pol.olharY;
    pol.caminhando+=dt*7;const balanco=Math.sin(pol.caminhando)*.4;
    pol.pernas[0].rotation.x=balanco;pol.pernas[1].rotation.x=-balanco;
  }
  return moveu;
}
function encararPonto(pol,x,z){pol.olharY=Math.atan2(x-pol.pos.x,z-pol.pos.z);pol.grupo.rotation.y=pol.olharY}

// Assenta o corpo no chão — e sobe na laje quando o jogador está lá em cima. O A* é 2D e não conhece
// escadaria, então a regra mais simples que funciona é esta: chegando embaixo do jogador elevado
// (≤2,5 m no plano), o policial ganha altura até a altura dele, como se tivesse subido a escada. Custa
// zero raycast, e visualmente resolve o caso que importa — fugir pra laje deixar de ser imunidade.
function assentarPolicial(pol,dt,perseguindo){
  const chao=obterElevacao(pol.pos.x,pol.pos.z);
  let alvoY=chao;
  if(perseguindo&&player.position.y>chao+1.2&&distXZ(pol.pos,player.position)<2.5)alvoY=player.position.y;
  if(pol.alturaAtual===null)pol.alturaAtual=alvoY;
  const passo=2.4*dt;// velocidade de subida/descida, em metros por segundo
  pol.alturaAtual+=THREE.MathUtils.clamp(alvoY-pol.alturaAtual,-passo,passo);
  pol.grupo.position.set(pol.pos.x,pol.alturaAtual,pol.pos.z);
}

// Agressividade em função da ficha: mais rápido, mais cadenciado e chegando mais perto.
function velocidadePolicial(base){return base*(1+AGRESSAO_VEL_POR_ESTRELA*policia.procurado)}
function cooldownTiro(){
  const fator=Math.max(.35,1-AGRESSAO_CADENCIA_POR_ESTRELA*policia.procurado);
  return (POLICIAL_COOLDOWN_MIN+Math.random()*(POLICIAL_COOLDOWN_MAX-POLICIAL_COOLDOWN_MIN))*fator;
}
function aproxMinima(){return Math.max(3,POLICIAL_APROX_MIN-AGRESSAO_APROX_POR_ESTRELA*policia.procurado)}

// Tiro: só sai quando o policial ENXERGA o jogador de fato — o mesmo `viu` do cone, não um teste
// separado. Antes bastava distância + parede livre, então ele acertava alvo que estava nas costas dele.
function tentarAtirar(pol,agora,viu){
  if(!viu||agora<pol.proximoTiro)return;
  const dist=distXZ(pol.pos,player.position);
  if(dist>POLICIAL_ALCANCE_TIRO)return;
  const ox=pol.pos.x,oy=pol.grupo.position.y+1.15,oz=pol.pos.z;
  const ax=player.position.x,ay=player.position.y+1.1,az=player.position.z;
  pol.proximoTiro=agora+cooldownTiro();
  const espalhamento=THREE.MathUtils.clamp(dist/POLICIAL_ALCANCE_TIRO,.05,1)*.13;
  const dir=new THREE.Vector3(ax-ox,ay-oy,az-oz).normalize();
  dir.x+=(Math.random()*2-1)*espalhamento;
  dir.y+=(Math.random()*2-1)*espalhamento*.5;
  dir.z+=(Math.random()*2-1)*espalhamento;
  dispararBala(new THREE.Vector3(ox,oy,oz),dir,false);
}

function atualizarPolicialCombate(pol,dt,agora){
  if(!pol.vivo){
    if(pol.caindo){
      pol.quedaT+=dt;pol.grupo.rotation.x=Math.min(Math.PI/2,pol.quedaT*4);
      if(pol.quedaT>1.1)pol.grupo.visible=false;
    }
    pol.barra.mostrar(false);
    return;
  }
  // ===== PERCEPÇÃO ANTES DE TUDO =====
  // O policial não sabe mais onde o jogador está por decreto: ou ele VÊ (cone + linha de visão), ou
  // trabalha com o rastro do rádio — a última posição avistada por alguém da equipe. Sem nenhum dos
  // dois ele fica no lugar, olhando em volta. É o que separa "IA que persegue pelas coordenadas" de
  // "IA que procura".
  const vendo=perceber(pol,agora);
  const dist=distXZ(pol.pos,player.position);
  let destino=null;
  if(vendo)destino={x:player.position.x,z:player.position.z};
  else if(rastroValido(agora))destino={x:rastro.x,z:rastro.z};
  else if(emBusca(agora))destino=pontoDeBusca(pol,agora);
  const aproxMin=aproxMinima();
  if(destino&&(vendo?dist>aproxMin:distXZ(pol.pos,destino)>RUA_CHEGADA)){
    const alvo=alvoDeMovimento(pol,agora,destino.x,destino.z);
    passoPolicial(pol,dt,alvo.x,alvo.z,velocidadePolicial(POLICIAL_VELOCIDADE));
  }else if(vendo){
    encararPonto(pol,player.position.x,player.position.z);
  }else{
    // Perdeu o rastro: varre o olhar devagar em vez de congelar encarando o nada — e é esse giro que
    // dá ao jogador a chance de contornar por trás, que é o ponto do cone de visão existir.
    pol.olharY+=dt*.7;pol.grupo.rotation.y=pol.olharY;
  }
  // Desencrava se acabou dentro de uma parede.
  if(colidePedestre(pol.pos.x,pol.pos.z)){
    const livre=buscarPosicaoLivre(pol.pos.x,pol.pos.z,colidePedestre);
    if(livre){pol.pos.x=livre.x;pol.pos.z=livre.z;pol.rota=null;pol.destinoRota=null}
  }
  // Acompanha o jogador pra cima da laje quando ele sobe e o policial está colado: sem isso ele fica
  // preso no chão atirando na sola do pé de quem está no telhado.
  assentarPolicial(pol,dt,vendo);
  pol.barra.posicionar(pol.pos.x,pol.grupo.position.y,pol.pos.z);
  pol.barra.mostrar(pol.hp<POLICIAL_HP);
  // Só atira em quem ESTÁ VENDO. Antes bastava distância + linha de visão, então levava tiro de
  // policial que estava de costas.
  if(vendo&&dist<=POLICIAL_ALCANCE_TIRO&&agora>=pol.proximoTiro&&!jogadorEscondido()){
    const ox=pol.pos.x,oy=pol.grupo.position.y+1.15,oz=pol.pos.z;
    const ax=player.position.x,ay=player.position.y+1.1,az=player.position.z;
    // só atira se realmente enxerga o jogador — nada de tiro atravessando casa
    if(temLinhaDeVisao(ox,oy,oz,ax,ay,az)){
      pol.proximoTiro=agora+cooldownTiro();
      // erro de pontaria cresce com a distância: a bala sai torta, e é a física dela que decide o acerto
      const espalhamento=THREE.MathUtils.clamp(dist/POLICIAL_ALCANCE_TIRO,.05,1)*.13;
      const dir=new THREE.Vector3(ax-ox,ay-oy,az-oz).normalize();
      dir.x+=(Math.random()*2-1)*espalhamento;
      dir.y+=(Math.random()*2-1)*espalhamento*.5;
      dir.z+=(Math.random()*2-1)*espalhamento;
      dispararBala(new THREE.Vector3(ox,oy,oz),dir,false);
    }
  }
}

// ===== Tiro do jogador =====
// A mira é a do centro da tela (câmera), mas a bala nasce no cano da arma — que fica ~1 m à frente e ao
// lado da câmera. Mirar num ponto FIXO a 60 m como antes tinha dois defeitos: esse ponto pode cair
// dentro/atrás de uma parede, e em alvo próximo o erro de paralaxe chega a atan(0,5/3) ≈ 9,5°, que é
// exatamente a sensação de "errei o que estava na mira".
// Correção: resolver o ponto visado de verdade, pelo mesmo slab test do resto da física.
const _dirCamera=new THREE.Vector3(),_visado=new THREE.Vector3();
// `miraNoAlvo` é lido pelo HUD: é o que faz a mira mudar de cor quando está em cima de um policial —
// sem esse retorno o jogador não tem nenhuma confirmação de pontaria antes de gastar a bala.
let miraNoAlvo=false;
function resolverPontoVisado(alcance){
  camera.getWorldDirection(_dirCamera);
  const ox=camera.position.x,oy=camera.position.y,oz=camera.position.z;
  const dx=_dirCamera.x*alcance,dy=_dirCamera.y*alcance,dz=_dirCamera.z*alcance;
  let melhorT=1;
  const parede=primeiroImpactoNoSegmento(ox,oy,oz,ox+dx,oy+dy,oz+dz);
  if(parede)melhorT=parede.t;
  miraNoAlvo=false;
  // A mira gruda no CORPO, não na parede atrás dele: se o alvo vier antes, é ele que define o ponto.
  for(const pol of policiais){
    if(!pol.vivo||pol.caindo)continue;
    for(const zona of zonasDoPolicial(pol)){
      const t=intersectarSegmentoCaixa(zona.caixa,ox,oy,oz,dx,dy,dz);
      if(t!==null&&t<melhorT){melhorT=t;miraNoAlvo=true}
    }
  }
  // Piso de 2 m: com o jogador de nariz na parede, um t minúsculo inverteria a direção da bala.
  const distancia=Math.max(2,melhorT*alcance);
  return _visado.set(ox+_dirCamera.x*distancia,oy+_dirCamera.y*distancia,oz+_dirCamera.z*distancia);
}
const _dirTiro=new THREE.Vector3(),_dirChumbo=new THREE.Vector3();
let avisouSemMunicao=false;
export function atirar(){
  const agora=performance.now()/1000;
  // No modo drone a câmera não é a do jogador — mirar por ela lançaria a bala de qualquer lugar do mapa.
  if(agora<proximoTiroJogador||jogadorRendido||droneState.ativo)return;
  const arma=armaEquipada(),restante=inventario.municao[arma.id];
  if(restante<arma.gasto){
    // Com o gatilho segurado o dedo fica no botão: sem esta trava o aviso repetiria a cada 0,9 s pra
    // sempre. Volta a false quando o gatilho solta ou quando sai um tiro válido.
    if(!avisouSemMunicao){avisouSemMunicao=true;mostrarAviso(`Sem munição de ${arma.nome} — compre na Loja de Armas (nordeste do mapa).`,2400)}
    proximoTiroJogador=agora+.9;return;
  }
  avisouSemMunicao=false;
  proximoTiroJogador=agora+arma.cooldown;
  inventario.municao[arma.id]-=arma.gasto;atualizarHudMunicao();
  // Resolve o alvo primeiro: além do ponto visado, isso deixa _dirCamera preenchido com a direção da
  // câmera, que é justo pra onde o boneco tem que virar.
  const visado=resolverPontoVisado(arma.alcance);
  // Vira o boneco ANTES de ler a boca: a arma é filha do braço, então a posição do cano depende dessa
  // rotação — girar depois faria a bala nascer de onde o corpo acabou de sair.
  encararDirecao(_dirCamera.x,_dirCamera.z);
  const boca=obterBocaDaArma();
  _dirTiro.copy(visado).sub(boca).normalize();
  // Mirando, o cone fecha pra 30%: é a recompensa concreta de parar pra mirar em vez de sair
  // atirando andando. A escopeta continua espalhando (30% de 5° ainda é 1,5°), só que muito mais
  // fechada — o que a torna utilizável a média distância sem deixar de ser escopeta.
  const cone=arma.dispersao*(1-.7*miraState.fator);
  for(let i=0;i<arma.projeteis;i++)dispararBala(boca,direcaoComDispersao(_dirTiro,cone,_dirChumbo),true);
}
// ===== Gatilho segurado =====
// Antes era um tiro por toque: com cooldown de 0,28 s (e 0,11 s da metralhadora) isso exigia martelar
// a tela, que é metade da sensação de "jogabilidade ruim". Quem limita a cadência é o cooldown da
// arma dentro de atirar(), então segurar não dispara mais rápido que 1/cooldown — não existe rajada
// dependente de FPS.
let gatilhoPressionado=false;
// Avisa o boneco 3D pra ele trocar pra animação de andar atirando. Fica aqui, e não no Input, porque
// o gatilho também é acionado pelo botão 🔫 do celular — este é o ponto por onde os dois passam.
export function definirGatilho(v){gatilhoPressionado=v;if(!v)avisouSemMunicao=false;definirAnimacaoTiro(v)}
export function atualizarTiroContinuo(){if(gatilhoPressionado)atirar()}
// Cicla só entre as armas que o jogador POSSUI. Mora aqui porque é o único módulo que enxerga os três
// pedaços: inventario.armas (Economy), equiparArma (Weapons) e proximoTiroJogador (local).
export function trocarArma(destino){
  const donas=ORDEM_ARMAS.filter(id=>inventario.armas[id]);
  let id;
  if(destino){if(!inventario.armas[destino])return;id=destino}
  else{if(donas.length<2)return;id=donas[(donas.indexOf(idArmaEquipada())+1)%donas.length]}
  if(id===idArmaEquipada())return;
  equiparArma(id);
  proximoTiroJogador=Math.max(proximoTiroJogador,performance.now()/1000+TEMPO_TROCA);
  avisouSemMunicao=false;atualizarHudMunicao();
}

// ===== Alvos das balas, montados UMA VEZ POR FRAME =====
// Antes esta lista era reconstruída por bala E por frame, alocando Box3 + Vector3 novos toda vez: com 6
// balas em voo e 2 policiais dava ~2.160 objetos por segundo direto no coletor de lixo — o padrão exato
// que produz microtravamento no meio do combate.
let alvosJogador=[],alvosPolicia=[];
function montarAlvosDoFrame(){
  alvosJogador.length=0;alvosPolicia.length=0;
  // Guarnição de rapel E polícia de rua: sem juntar as duas listas, o policial de rua seria
  // invulnerável — as balas do jogador atravessariam ele.
  for(const pol of policiaisAtingiveis()){
    if(!pol.vivo||pol.caindo)continue;
    for(const zona of zonasDoPolicial(pol)){
      // `armaEquipada()` é lido DENTRO da arrow de propósito: esta lista é montada por frame, mas a
      // bala só chama aoAtingir() no frame do impacto — lendo fora, o dano congelaria na arma que
      // estava na mão quando a lista foi montada, não na que disparou.
      alvosJogador.push({caixa:zona.caixa,aoAtingir:()=>atingirPolicial(pol,armaEquipada().dano*zona.multiplicador)});
    }
  }
  if(!jogadorRendido){
    for(const zona of zonasDeAcertoJogador()){
      alvosPolicia.push({caixa:zona.caixa,aoAtingir:()=>receberDanoJogador((POLICIAL_DANO_MIN+Math.random()*(POLICIAL_DANO_MAX-POLICIAL_DANO_MIN))*zona.multiplicador)});
    }
  }
}
function alvosDaBala(deDoJogador){return deDoJogador?alvosJogador:alvosPolicia}

function atingirPolicial(pol,dano){
  if(!pol.vivo)return;
  pol.hp=Math.max(0,pol.hp-dano);
  pol.barra.definir(pol.hp/POLICIAL_HP);
  pol.barra.mostrar(pol.hp>0);
  if(pol.hp<=0){
    pol.vivo=false;pol.caindo=true;pol.quedaT=0;pol.barra.mostrar(false);
    // Matar policial é o que mais suja a ficha — e a ficha é o que dimensiona a próxima guarnição.
    // Sem esconderijo isso é uma escalada só de ida: cada baixa traz mais gente na volta.
    somarProcurado(1);
    // Matar em plena rua é avistamento na certa: o rádio espalha a posição na hora. É o que impede
    // "limpar a ronda um por um sem ninguém notar".
    compartilharAvistamento(player.position.x,player.position.z,performance.now()/1000);
  }
  // Só a guarnição de rapel encerra o ENCONTRO ao ser abatida — a polícia de rua não está num
  // encontro, e sem esta guarda matar uma dupla de ronda cancelaria a batida em andamento.
  if(pol.tipo!=='rua'&&policiais.length&&policiais.every(p=>!p.vivo)){
    mostrarAviso(policia.procurado>=PROCURADO_MAX
      ?'Guarnição abatida — mas a sua ficha está no topo. Some num esconderijo.'
      :'Guarnição abatida. Eles vão voltar em maior número — procure um esconderijo.',3400);
    transitar('recuando');
  }
}

// Para onde o helicóptero está indo. Numa BATIDA o ponto é a muda; numa CAÇADA (ficha suja, sem
// planta) é o jogador — mas só enquanto ele estiver à vista: escondido, o heli segue pra ÚLTIMA
// posição conhecida, que é o que faz o esconderijo despistar de verdade em vez de dar imunidade
// instantânea. Devolve false quando o alvo deixou de existir (muda colhida/confiscada).
function atualizarPontoAlvo(){
  if(policia.alvoPlanta){
    if(policia.alvoPlanta.colhida){transitar('recuando');return false}
    policia.pontoAlvo.x=policia.alvoPlanta.x;policia.pontoAlvo.z=policia.alvoPlanta.z;
  }else if(!jogadorEscondido()){
    policia.pontoAlvo.x=player.position.x;policia.pontoAlvo.z=player.position.z;
  }
  return true;
}

// ===== MÁQUINA DE ESTADOS =====
// `aoEntrar` roda uma vez na transição; `aoAtualizar` roda por frame. Toda mudança de estado passa por
// `transitar()` — é o que garante o invariante de que a limpeza do encontro acontece num lugar só.
function transitar(novoEstado){
  if(policia.estado===novoEstado)return;
  policia.estado=novoEstado;policia.tempoEstado=0;
  ESTADOS[novoEstado].aoEntrar?.();
}

const ESTADOS={
  patrulha:{
    aoEntrar(){
      policia.alvoPlanta=null;
      policia.cooldownAte=performance.now()/1000+COOLDOWN_ENTRE_BUSCAS;
      // A ficha NÃO cai aqui. Abater a guarnição, fugir ou perder a muda encerram o encontro, não a
      // procura: fora do esconderijo o nível só sobe. É o que impede "matar todo mundo" de virar a
      // estratégia dominante e o que dá função ao esconderijo.
      heliAlvo=sortearWaypointPatrulha();
    },
    aoAtualizar(dt,agora){
      // PATRULHA DE VERDADE. Antes existia aqui uma "caça ativa" que reescrevia o heliAlvo com a
      // coordenada EXATA da muda a cada frame: o waypoint aleatório logo abaixo nunca chegava a ser
      // usado, e o helicóptero virava um míssil teleguiado que saía atrás da planta no segundo em que
      // ela nascia. Agora o destino só é sorteado ao CHEGAR no waypoint anterior, e o sorteio no
      // máximo puxa pra região da muda (ver sortearWaypointPatrulha), nunca pro ponto dela.
      // ===== O AVIÃO SÓ ENTRA COM FICHA ALTA =====
      // Abaixo do limiar ele fica em RONDA DISTANTE: alto, colado nas bordas do mapa e com raio de
      // detecção curto. Continua existindo no céu (some por completo daria a impressão de que o
      // sistema quebrou), mas não é uma ameaça — a favela fica pro jogo de rua.
      const heliAtivo=policia.procurado>=PROCURADO_HELI_ATIVO;
      const alturaVoo=heliAtivo?HELI_ALTURA:HELI_ALTURA_LONGE;
      const dx=heliAlvo.x-heli.position.x,dz=heliAlvo.z-heli.position.z,d=Math.hypot(dx,dz);
      if(d<3){heliAlvo=sortearWaypointPatrulha();if(!heliAtivo){heliAlvo.x=Math.sign(heliAlvo.x||1)*HELI_BORDA;heliAlvo.z=Math.sign(heliAlvo.z||1)*HELI_BORDA}}
      else{heli.position.x+=dx/d*HELI_VELOCIDADE*dt;heli.position.z+=dz/d*HELI_VELOCIDADE*dt;heli.rotation.z=THREE.MathUtils.clamp(-dz/d*.35,-.35,.35);heli.rotation.y=Math.atan2(dx,dz)}
      heli.position.y=THREE.MathUtils.lerp(heli.position.y,alturaVoo,dt*2);
      if(jogadorEscondido())return;
      // CAÇADA: com ficha suja, o alvo é o jogador, e o helicóptero vai direto atrás dele de onde
      // quer que esteja — não depende de sobrevoo nem de plantação. É o "saiu do esconderijo com
      // procurado > 0, a polícia volta a procurar". `retomarCacaEm` dá um respiro de alguns segundos
      // ao sair, senão eles reapareceriam em cima do jogador no mesmo frame em que ele abre a porta.
      // O AVIÃO SÓ CAÇA COM FICHA ALTA — agora de verdade. O limiar existia e governava só a altitude
      // e o raio de detecção; a caçada disparava em `procurado > 0`, então com UMA estrela o
      // helicóptero já vinha e descia guarnição (medido: 2 policiais em ~13 s). O comentário da
      // constante sempre disse o contrário; era o código que não cumpria. Abaixo do limiar quem
      // persegue é a polícia de rua, como está escrito lá em cima.
      if(policia.procurado>=PROCURADO_HELI_ATIVO){
        if(agora<policia.retomarCacaEm)return;
        policia.alvoPlanta=null;
        policia.pontoAlvo.x=player.position.x;policia.pontoAlvo.z=player.position.z;
        transitar('indo');
        mostrarAviso('🚁 Sua ficha está suja — a polícia está te caçando.',3200);
        return;
      }
      // Em ronda distante a batida por sobrevoo fica muito mais rara (cooldown longo e raio curto):
      // é o que faz a plantação valer a pena antes de a ficha subir.
      if(agora<policia.cooldownAte+(heliAtivo?0:COOLDOWN_LONGE))return;
      const raio=heliAtivo?DETECCAO_RAIO:DETECCAO_RAIO_LONGE;
      // BATIDA: achou por sobrevoo, só enxerga muda florida e só dentro do raio de detecção.
      for(const p of plantas){
        if(plantaDetectavel(p)&&distXZ(heli.position,p)<raio){
          policia.alvoPlanta=p;
          transitar('indo');
          mostrarAviso('🚁 O helicóptero achou sua plantação — corre pra defender!',3400);
          return;
        }
      }
    }
  },
  indo:{
    // A ficha só sobe se o alvo for O JOGADOR. Numa batida o destino é a muda: eles vêm pela planta,
    // e ser abordado por causa dela não faz de ninguém procurado — era isso que transformava "plantei"
    // em "sou caçado pra sempre".
    aoEntrar(){if(!policia.alvoPlanta)elevarProcurado(1)},
    aoAtualizar(dt){
      if(!atualizarPontoAlvo())return;
      const alvo=policia.pontoAlvo;
      const dx=alvo.x-heli.position.x,dz=alvo.z-heli.position.z,d=Math.hypot(dx,dz);
      if(d<APROX_RAIO){transitar('pairando');return}
      heli.position.x+=dx/d*HELI_VELOCIDADE*1.3*dt;heli.position.z+=dz/d*HELI_VELOCIDADE*1.3*dt;
      heli.rotation.y=Math.atan2(dx,dz);
    }
  },
  // Ele PARA em cima da plantação antes de descer o rapel. Sem esse estado o heli chegava a 3 m e as
  // cordas apareciam no mesmo frame — não dava pra ler que ele tinha achado alguma coisa.
  pairando:{
    aoAtualizar(dt){
      if(!atualizarPontoAlvo())return;
      const alvo=policia.pontoAlvo;
      policia.tempoEstado+=dt;
      // estabiliza exatamente sobre a muda e desinclina, como um helicóptero pairando de verdade
      heli.position.x=THREE.MathUtils.lerp(heli.position.x,alvo.x,1-Math.exp(-4*dt));
      heli.position.z=THREE.MathUtils.lerp(heli.position.z,alvo.z,1-Math.exp(-4*dt));
      heli.rotation.z=THREE.MathUtils.lerp(heli.rotation.z,0,1-Math.exp(-5*dt));
      if(policia.tempoEstado>=PAIRANDO_DURACAO)transitar('rapel');
    }
  },
  rapel:{
    aoEntrar(){
      const alvo=policia.pontoAlvo;
      // O tamanho da guarnição sai da ficha: 2 até 1 estrela, +1 por estrela até 6. É o "quanto mais
      // mata, mais aparecem" — a escalada é consequência das baixas, não um número fixo.
      const quantos=numPoliciaisPara(policia.procurado);
      for(let i=0;i<quantos;i++){
        const pol=criarPolicial(i);
        const ang=(i/quantos)*Math.PI*2,raio=2.4;
        // Vector3.set com DOIS argumentos jogava o z no y e deixava z=0: os policiais desciam sempre na
        // faixa z≈0, longe da plantação. É o que fazia a batida parecer que não existia.
        pol.pos.set(alvo.x+Math.cos(ang)*raio,0,alvo.z+Math.sin(ang)*raio);
        pol.grupo.position.set(pol.pos.x,heli.position.y,pol.pos.z);
        policiais.push(pol);
        const corda=new THREE.Line(new THREE.BufferGeometry().setFromPoints([heli.position.clone(),pol.grupo.position.clone()]),new THREE.LineBasicMaterial({color:0x333333}));
        scene.add(corda);cordas.push({linha:corda,pol});
      }
    },
    aoAtualizar(dt){
      policia.tempoEstado+=dt;
      const t=Math.min(1,policia.tempoEstado/RAPEL_DURACAO);
      for(const c of cordas){
        c.pol.grupo.position.y=THREE.MathUtils.lerp(heli.position.y,obterElevacao(c.pol.pos.x,c.pol.pos.z),t);
        c.linha.geometry.setFromPoints([heli.position.clone(),c.pol.grupo.position.clone()]);
      }
      if(t<1)return;
      limparCordas();
      // Sem muda no alvo é CAÇADA: não há o que confiscar, então o desfecho é sempre o confronto.
      const perto=distXZ(player.position,policia.pontoAlvo)<=COMBATE_RAIO_ATIVACAO&&!jogadorEscondido();
      if(!policia.alvoPlanta){transitar(perto?'combate':'recuando');if(perto)mostrarAviso('A polícia te encontrou.',2800);return}
      transitar(perto?'combate':'confiscando');
      if(perto)mostrarAviso('A polícia achou sua plantação — defenda com o botão de atirar!',3200);
    }
  },
  confiscando:{
    // Confisco não é crime do jogador: eles estão levando a planta, não prendendo ele. Ficar por perto
    // vendo não suja ficha; atirar suja (ver o estado de combate).
    aoEntrar(){if(!policia.alvoPlanta)elevarProcurado(2)},
    aoAtualizar(dt){
      policia.tempoEstado+=dt;
      if(!policia.alvoPlanta){transitar('recuando');return}
      if(distXZ(player.position,policia.alvoPlanta)<=COMBATE_RAIO_ATIVACAO&&!jogadorEscondido()){
        transitar('combate');mostrarAviso('A polícia te viu — defenda a plantação!',2800);
      }else if(policia.tempoEstado>=CONFISCO_DURACAO){
        if(policia.alvoPlanta&&!policia.alvoPlanta.colhida){confiscarPlanta(policia.alvoPlanta);mostrarAviso('A polícia confiscou sua plantação.',2600)}
        transitar('recuando');
      }
    }
  },
  combate:{
    aoEntrar(){elevarProcurado(3)},
    aoAtualizar(dt,agora){
      // Perder o rastro deixou de ser regra local do combate: agora existe UM cronômetro de
      // esconderijo, válido em qualquer estado, em atualizarPolicia.
      for(const pol of policiais)atualizarPolicialCombate(pol,dt,agora);
    }
  },
  // Único ponto de limpeza do encontro do jogo inteiro: recolhe corda, policiais e balas.
  recuando:{
    aoEntrar(){limparCordas()},
    aoAtualizar(dt,agora){
      policia.tempoEstado+=dt;
      heli.position.y+=dt*10;heli.position.x+=dt*4;
      for(const pol of policiais){pol.grupo.visible=policia.tempoEstado<RECUO_DURACAO*.4;pol.barra.mostrar(false)}
      if(policia.tempoEstado<RECUO_DURACAO)return;
      for(const pol of policiais){scene.remove(pol.grupo);pol.barra.descartar()}
      policiais.length=0;limparBalas();
      transitar('patrulha');
    }
  },
};

// ===== Atualização principal, chamada a cada frame pelo main.js =====
// ===== POLÍCIA DE RUA: ronda intermitente, a pé, sem helicóptero =====
// A favela precisa RESPIRAR: a guarnição de rapel só existe em encontro, e sem uma presença de rua o
// bairro ficava vazio de polícia entre um encontro e outro. Mas 24 h de patrulha também não — por
// isso as duplas têm VIDA ÚTIL: nascem, rondam, e vão embora sozinhas.
const policiaisRua=[];
let proximaDupla=RUA_INTERVALO_MIN;
function pontoDeRonda(){
  // Com ficha suja eles vasculham os ESCONDERIJOS (é onde o jogador se enfia); limpos, andam pelas
  // vielas como qualquer ronda. É o "quando o jogador está procurado, vasculham os esconderijos".
  if(policia.procurado>0&&refugios.length&&Math.random()<.6){
    const r=refugios[Math.floor(Math.random()*refugios.length)];
    return{x:r.x+(Math.random()*2-1)*RUA_VASCULHAR_RAIO,z:r.z+RUA_VASCULHAR_RAIO};// na frente da porta
  }
  const wp=waypointsVielas[Math.floor(Math.random()*waypointsVielas.length)];
  return{x:wp.x,z:wp.z};
}
function nascerDupla(agora){
  const base=pontoDeRonda();
  for(let i=0;i<2;i++){
    const pol=criarPolicial(policiaisRua.length+i,'rua');
    pol.pos.set(base.x+(i?1.2:-1.2),0,base.z);
    pol.alturaAtual=obterElevacao(pol.pos.x,pol.pos.z);
    pol.grupo.position.set(pol.pos.x,pol.alturaAtual,pol.pos.z);
    pol.expiraEm=agora+RUA_DUPLA_VIDA;pol.destinoRonda=pontoDeRonda();
    policiaisRua.push(pol);
  }
}
function removerRua(i){const pol=policiaisRua[i];scene.remove(pol.grupo);pol.barra.descartar();policiaisRua.splice(i,1)}
function atualizarPoliciaDeRua(dt,agora){
  // Durante um encontro de rapel a rua não recebe reforço novo: seriam duas equipes disputando o
  // mesmo alvo, e no celular isso é o dobro de A* por frame sem ganho nenhum de jogo.
  const emEncontro=policia.estado!=='patrulha'&&policia.estado!=='recuando';
  proximaDupla-=dt;
  if(proximaDupla<=0&&!emEncontro&&policiaisRua.length<RUA_MAX_DUPLAS*2){
    nascerDupla(agora);
    proximaDupla=RUA_INTERVALO_MIN+Math.random()*(RUA_INTERVALO_MAX-RUA_INTERVALO_MIN);
  }
  for(let i=policiaisRua.length-1;i>=0;i--){
    const pol=policiaisRua[i];
    if(!pol.vivo){
      pol.quedaT+=dt;pol.grupo.rotation.x=Math.min(Math.PI/2,pol.quedaT*4);
      pol.barra.mostrar(false);
      if(pol.quedaT>2.5)removerRua(i);
      continue;
    }
    const vendo=perceber(pol,agora);
    // Expira e vai embora — mas nunca no meio de uma perseguição, que seria a polícia evaporando na
    // cara do jogador. Com rastro ativo eles ficam até o rastro esfriar.
    if(agora>pol.expiraEm&&!deOlho&&!rastroValido(agora)&&!emBusca(agora)){removerRua(i);continue}
    // Ver o jogador só INTERESSA se ele chama atenção (mochila com pacote ou ficha corrida). Sem
    // isso a dupla segue a ronda mesmo olhando direto pra ele — que é o comportamento certo pra quem
    // não fez nada. Antes qualquer avistamento virava abordagem.
    const deOlho=vendo&&chamaAtencao();
    let destino=null;
    if(deOlho)destino={x:player.position.x,z:player.position.z};
    else if(rastroValido(agora))destino={x:rastro.x,z:rastro.z};
    else if(emBusca(agora))destino=pontoDeBusca(pol,agora);
    else{
      destino=pol.destinoRonda;
      if(distXZ(pol.pos,destino)<RUA_CHEGADA)pol.destinoRonda=pontoDeRonda();
    }
    const perto=deOlho&&distXZ(pol.pos,player.position)<=aproxMinima();
    if(perto)encararPonto(pol,player.position.x,player.position.z);
    else{
      const alvo=alvoDeMovimento(pol,agora,destino.x,destino.z);
      passoPolicial(pol,dt,alvo.x,alvo.z,velocidadePolicial(RUA_VELOCIDADE));
    }
    if(colidePedestre(pol.pos.x,pol.pos.z)){
      const livre=buscarPosicaoLivre(pol.pos.x,pol.pos.z,colidePedestre);
      if(livre){pol.pos.x=livre.x;pol.pos.z=livre.z;pol.rota=null;pol.destinoRota=null}
    }
    assentarPolicial(pol,dt,vendo);
    pol.barra.posicionar(pol.pos.x,pol.grupo.position.y,pol.pos.z);
    pol.barra.mostrar(pol.hp<POLICIAL_HP);
    // Polícia de rua só abre fogo com ficha suja: patrulha de rotina não fuzila quem passa na rua.
    const dist=distXZ(pol.pos,player.position);
    if(deOlho&&policia.procurado>0&&dist<=POLICIAL_ALCANCE_TIRO&&agora>=pol.proximoTiro&&!jogadorEscondido()){
      const ox=pol.pos.x,oy=pol.grupo.position.y+1.15,oz=pol.pos.z;
      const ax=player.position.x,ay=player.position.y+1.1,az=player.position.z;
      if(temLinhaDeVisao(ox,oy,oz,ax,ay,az)){
        pol.proximoTiro=agora+cooldownTiro();
        const esp=THREE.MathUtils.clamp(dist/POLICIAL_ALCANCE_TIRO,.05,1)*.13;
        const dir=new THREE.Vector3(ax-ox,ay-oy,az-oz).normalize();
        dir.x+=(Math.random()*2-1)*esp;dir.y+=(Math.random()*2-1)*esp*.5;dir.z+=(Math.random()*2-1)*esp;
        dispararBala(new THREE.Vector3(ox,oy,oz),dir,false);
      }
    }
  }
}
// Alvos das balas do jogador incluem a polícia de rua — sem isso ela seria invulnerável.
export function policiaisAtingiveis(){return policiais.concat(policiaisRua)}

// ===== ESTADO PRO SAVE =====
// Tolerante a lixo por contrato: um save antigo, adulterado ou com campo faltando não pode lançar —
// quem chama é o carregamento, e uma exceção aqui deixaria o jogador com tela preta.
// O colete VISÍVEL segue a armadura equipada mais os coletes em estoque: vestido enquanto houver
// proteção, some quando a última acaba (ou quando o jogador é rendido). Quem desenha é o Player;
// aqui só se expõe a condição, que é estado de combate.
export function jogadorComColete(){return !jogadorRendido&&(armaduraJogador>0||inventario.colete>0)}
// A mochila é o FLAGRANTE: aparece enquanto houver pacote e é vendo ela que a polícia decide
// abordar (`chamaAtencao`). Rendido, some junto com a carga apreendida.
export function jogadorComMochila(){return !jogadorRendido&&inventario.pacote>0}
export function estadoPoliciaParaSave(){return{procurado:policia.procurado,jaFoiPreso}}
export function aplicarEstadoPoliciaDoSave(s){
  try{
    const n=Math.floor(Number(s&&s.procurado));
    policia.procurado=Number.isFinite(n)?Math.min(PROCURADO_MAX,Math.max(0,n)):0;
    jaFoiPreso=!!(s&&s.jaFoiPreso);
  }catch(e){policia.procurado=0;jaFoiPreso=false}
}

export function atualizarPolicia(dt){
  const agora=performance.now()/1000;
  // Rotor sempre girando e luzes piscando, em qualquer estado — o helicóptero nunca "desliga".
  rotorPrincipal.rotation.y+=dt*26;rotorCauda.rotation.x+=dt*40;
  const pisca=Math.floor(agora*3)%2===0;luzV.material.emissiveIntensity=pisca?1.6:.1;luzA.material.emissiveIntensity=pisca?.1:1.6;

  // ===== ESCONDERIJO: o único lugar onde a ficha desce =====
  // Dois relógios separados, e é a separação que faz a mecânica funcionar:
  //   tempoEscondido → aos 3 s a guarnição em campo perde o rastro e recua;
  //   tempoNivel     → a cada 18 s apaga UMA estrela (ESCONDIDO_POR_NIVEL).
  // Sair antes de zerar deixa ficha, e com ficha a patrulha recomeça a caçada — é o "se ainda tiver
  // nível de procurado, a polícia volta a procurar".
  const escondido=jogadorEscondido();
  if(escondido){
    policia.tempoEscondido+=dt;
    if(policia.tempoEscondido>=ESCONDIDO_PARA_SUMIR&&policia.estado!=='patrulha'&&policia.estado!=='recuando'){
      policia.alvoPlanta=null;transitar('recuando');
      mostrarAviso('Você sumiu — a polícia perdeu o rastro.',2800);
    }
    if(policia.procurado>0){
      policia.tempoNivel+=dt;
      if(policia.tempoNivel>=ESCONDIDO_POR_NIVEL){
        policia.tempoNivel=0;policia.procurado--;
        if(policia.procurado===0)mostrarAviso('Ficha limpa. Dá pra sair.',2600);
      }
    }else policia.tempoNivel=0;
  }else{
    // Ao SAIR, o relógio zera e a caçada ganha alguns segundos de respiro: sem isso o helicóptero
    // engataria a perseguição no mesmo frame em que a porta abre.
    if(policia.tempoEscondido>0)policia.retomarCacaEm=agora+CACA_ATRASO;
    policia.tempoEscondido=0;policia.tempoNivel=0;
  }

  ESTADOS[policia.estado].aoAtualizar(dt,agora);
  atualizarPoliciaDeRua(dt,agora);

  montarAlvosDoFrame();
  atualizarBalas(dt,alvosDaBala);

  // Holofote: em patrulha varre o chão logo abaixo do heli; a partir do momento em que ele acha a
  // plantação, TRAVA na muda. É o sinal visual de "ele te achou" — de graça, já que o SpotLight e o
  // cone do feixe existem desde sempre.
  // Trava no PONTO ALVO, não na muda: numa caçada esse ponto é o jogador, então o facho passa a
  // seguir quem está sendo procurado — é a leitura visual de "eles estão atrás de você".
  const travado=policia.estado==='indo'||policia.estado==='pairando'||policia.estado==='rapel';
  const focoX=travado?policia.pontoAlvo.x:heli.position.x;
  const focoZ=travado?policia.pontoAlvo.z:heli.position.z;
  const chaoAbaixo=obterElevacao(focoX,focoZ);
  holofoteAlvo.position.set(focoX,chaoAbaixo,focoZ);
  const alturaFeixe=heli.position.y-chaoAbaixo;
  feixe.position.set((heli.position.x+focoX)/2,(heli.position.y+chaoAbaixo)/2,(heli.position.z+focoZ)/2);
  feixe.scale.set(alturaFeixe*.32,alturaFeixe,alturaFeixe*.32);

  // Vida regenera devagar fora de combate; HUD de alerta/esconderijo, munição e mira de combate.
  avisarFloracao();conferirColete();atualizarHudMunicao();
  if(policia.estado==='patrulha'&&saudeJogador<JOGADOR_HP_MAX&&!jogadorRendido){saudeJogador=Math.min(JOGADOR_HP_MAX,saudeJogador+dt*JOGADOR_REGEN);atualizarHudSaude()}
  const emAlerta=policia.estado!=='patrulha';
  // Nível de procurado em estrelas: o jogador precisa VER a barra subir pra entender que se esconder
  // serviu pra alguma coisa. Escrito só quando muda, pelo mesmo motivo do cache da munição.
  // Três estados, não dois: PERSEGUINDO (alguém está te vendo), PROCURANDO (perderam de vista mas a
  // busca corre) e limpo. O jogador precisa enxergar em qual está — é o que transforma sumir de vista
  // numa jogada, em vez de num acaso.
  const perseguindo=rastro.ativo;
  const procurando=!perseguindo&&emBusca(agora);
  const chaveAlerta=`${policia.procurado}|${emAlerta}|${policiais.length}|${perseguindo}|${procurando}`;
  if(chaveAlerta!==alertaCache){
    alertaCache=chaveAlerta;
    alertaEl.style.display=(emAlerta||policia.procurado>0)?'block':'none';
    alertaEl.classList.toggle('procurando',procurando);
    const vivos=policiais.filter(p=>p.vivo).length;
    const estrelas=`${'★'.repeat(policia.procurado)}${'☆'.repeat(PROCURADO_MAX-policia.procurado)}`;
    alertaEl.textContent=(procurando?`🔦 PROCURANDO ${estrelas}`:`🚁 PROCURADO ${estrelas}`)
      +(vivos?` · 👮${vivos}`:'');
  }
  // O indicador conta a diferença entre "dentro da casa" e "escondido de verdade": dentro com a porta
  // ABERTA não esconde ninguém, e sem esse aviso o jogador acharia que o esconderijo está quebrado.
  const refugioAqui=refugioEmQueEsta(player.position);
  if(!refugioAqui)refugioEl.style.display='none';
  else{
    refugioEl.style.display='block';
    if(refugioAqui.aberta)refugioEl.textContent='🚪 FECHE A PORTA PRA SE ESCONDER';
    else if(policia.procurado>0)
      // Mostra quanto falta pra PRÓXIMA estrela cair, não pra ficha inteira: é a informação que o
      // jogador usa pra decidir se dá pra sair agora ou se compensa esperar mais um pouco.
      refugioEl.textContent=`🫥 ESCONDIDO · ${'★'.repeat(policia.procurado)} cai em ${Math.max(0,Math.ceil(ESCONDIDO_POR_NIVEL-policia.tempoNivel))}s`;
    else refugioEl.textContent='🫥 ESCONDIDO · ficha limpa';
  }
  const emCombate=policia.estado==='combate';
  const temArma=inventario.municao[idArmaEquipada()]>0;
  // A mira fica na tela SEMPRE que dá pra atirar — antes só aparecia no estado 'combate', que exige
  // plantar, esperar a muda florir, o heli achar e descer de rapel. Fora dessa janela o botão de tiro
  // continuava clicável e gastava bala de verdade sem nenhuma indicação de para onde se estava
  // mirando. Some só no drone (a câmera não é a do jogador), rendido, ou com a mira de plantio ativa.
  const podeMirar=temArma&&!droneState.ativo&&!jogadorRendido&&!isInventarioAberto();
  miraCombateEl.style.display=podeMirar?'block':'none';
  if(podeMirar){
    // Resolver o ponto visado por frame também alimenta `miraNoAlvo`: é o que dá o retorno de
    // pontaria (mira vermelha grande em cima do corpo) que antes não existia.
    resolverPontoVisado(armaEquipada().alcance);
    miraCombateEl.classList.toggle('noAlvo',miraNoAlvo);
    // Mira FECHADA no modo de mira: a cruz encolhe junto com o cone de dispersão, então o tamanho
    // dela na tela conta a verdade sobre a precisão em vez de ser enfeite.
    miraCombateEl.classList.toggle('fechada',miraState.ativo);
  }
  // O botão aparece quando há munição pra gastar OU polícia em campo: senão o jogador nunca via que
  // existe arma no jogo. Fora do combate ele fica esmaecido, indicando que não há em quem atirar.
  fireBtn.style.display=(emAlerta||temArma)?'flex':'none';
  fireBtn.style.opacity=emCombate&&temArma?'1':'.45';
  // O botão de mira acompanha o de tiro: mirar sem ter em que atirar não faz sentido. Fica DEPOIS de
  // fireBtn.style.display ser escrito, senão copiaria o valor do frame anterior.
  if(miraBtn){
    miraBtn.classList.toggle('on',miraState.ativo);
    miraBtn.style.display=fireBtn.style.display;
    if(!podeMirar&&miraState.ativo)miraState.ativo=false;// entrou no drone/inventário mirando
  }
  // Com uma arma só, o botão de troca seria um no-op comendo espaço de polegar: só aparece com 2+.
  if(armaBtn){
    const temTroca=ORDEM_ARMAS.filter(id=>inventario.armas[id]).length>1;
    armaBtn.style.display=(temTroca&&fireBtn.style.display==='flex')?'flex':'none';
  }
}

// Gatilho SEGURADO: pointerdown liga, e os quatro eventos de soltura desligam. O setPointerCapture é
// obrigatório — sem ele, o dedo deslizando pra fora do botão faz o pointerup cair noutro elemento e o
// gatilho fica preso ligado, atirando até acabar a munição. Mesmo tratamento que o joystick já usa.
fireBtn?.addEventListener('pointerdown',e=>{
  e.preventDefault();fireBtn.setPointerCapture?.(e.pointerId);
  definirGatilho(true);atirar();// tiro imediato: o primeiro disparo não pode esperar o próximo frame
});
for(const ev of['pointerup','pointercancel','pointerleave','lostpointercapture'])fireBtn?.addEventListener(ev,()=>definirGatilho(false));
addEventListener('blur',()=>definirGatilho(false));// alt-tab com o dedo/tecla presos
armaBtn?.addEventListener('pointerdown',e=>{e.preventDefault();trocarArma()});
// Mira no celular é ALTERNADOR, não "segurar": o polegar direito já está ocupado com o gatilho, e
// segurar os dois ao mesmo tempo é o que não dá pra fazer numa tela. No teclado/mouse é segurar
// (ver Input.js), que é o gesto esperado ali.
miraBtn?.addEventListener('pointerdown',e=>{e.preventDefault();miraState.ativo=!miraState.ativo});
export function definirMira(v){miraState.ativo=v}

export{heli,policiais,policia};
