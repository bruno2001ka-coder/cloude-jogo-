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
import{vestirPolicial,despirPolicial,atualizarCorpoPolicial}from'./PersonagemPolicial.js';
import{ALT_TORSO,ALT_OLHO,ALT_CANO,atualizarCombate,espalhamentoDoTiro,tempoDeReacao,
  distribuirPapeis,destinoDoPapel,procurarCobertura,PAPEL,velJogador,LEAD_FATOR,LEAD_RUIDO}from'./Combate.js';
import{plantas,confiscarPlanta,aplicarMulta,definirDinheiro,inventario,atualizarStatusEconomia,isInventarioAberto,registrarGanchosPolicia}from'./Economy.js';
import{dispararBala,atualizarBalas,limparBalas,VELOCIDADE_BALA}from'./Bullets.js';
import{aplicarDano,renderizarVidaJogador,criarBarraMundo}from'./HealthBar.js';
import{droneState,miraState}from'./Camera.js';

const HELI_ALTURA=38,HELI_VELOCIDADE=12,MAPA_LIMITE=95;
const SALDO_RESPAWN=300;
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
// ===== O AVISO ANTES DA BATIDA =====
// Era 1,2 s entre o heli parar e as cordas descerem: não dava pra ver que ele tinha achado alguma
// coisa, muito menos pra reagir — a batida chegava como um fato consumado. Quatro segundos com aviso
// na tela é o tempo de largar o que está fazendo e correr, que é o que transforma a batida de
// punição em decisão.
const PAIRANDO_DURACAO=4;
// Onde a guarnição pousa, medido do ponto-alvo. Antes era um ANEL DE 2,4 m EM VOLTA DELE: se o
// jogador estivesse ao lado da própria muda, os seis desciam formando um círculo em cima dele, sem
// saída. Agora descem juntos a 13 m, do lado de onde o helicóptero veio, e vêm A PÉ — dá pra ouvir,
// ver e correr, e é a diferença entre uma batida e um teleporte.
const RAPEL_DIST=13,RAPEL_ESPACO=1.6;
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
// Desvios de ângulo tentados em volta do setor, em radianos (0, ±23°, ±46°).
const BUSCA_DESVIOS=[0,.4,-.4,.8,-.8];
// ===== POLÍCIA DE RUA =====
// Duplas que nascem numa borda, rondam as vielas e vão embora. Nunca permanentes: com procurado 0 a
// janela entre surtos é longa de propósito, senão a favela nunca respira. RUA_INTERVALO é sorteado em
// [min,max] e ENCOLHE com a ficha (÷(1+procurado·0,45)), então é a ficha suja que enche a rua de fardado.
const RUA_INTERVALO_MIN=70,RUA_INTERVALO_MAX=140,RUA_DUPLA_VIDA=75,RUA_MAX_DUPLAS=2;
const RUA_VELOCIDADE=1.7,RUA_CHEGADA=1.6,RUA_VASCULHAR_RAIO=3.2;
// ===== NINGUÉM NASCE NA CARA DO JOGADOR =====
// A dupla nascia direto num `pontoDeRonda()` — um beco ou a frente de um esconderijo sorteados no
// mapa inteiro, SEM nenhuma checagem de onde o jogador está. Dois fardados podiam materializar a 3 m
// dele. Era o "surgem do nada".
// Agora o ponto precisa passar por um de dois critérios:
//   · longe o bastante pra estar fora de qualquer alcance de visão (RUA_SPAWN_LONGE), ou
//   · a uma distância média, mas com PAREDE no meio — reusando o mesmo teste de segmento que a visão
//     deles já faz, então o que vale é "não dá pra ver de onde ele está", não um número mágico.
// Se nenhum dos sorteios servir, a dupla NÃO nasce nesta janela. É melhor a favela ficar sem polícia
// um minuto a mais do que ter polícia brotando do chão.
const RUA_SPAWN_LONGE=40,RUA_SPAWN_MINIMO=20,RUA_SPAWN_TENTATIVAS=12;
// Setor proibido em volta da direção do esconderijo mais próximo: com ficha suja, nascer bem entre o
// jogador e a casa em que ele ia se enfiar é o que faz a perseguição virar beco sem saída. Sobra
// sempre pra onde correr.
const RUA_SPAWN_SETOR_FUGA=.9;
// Agressividade por estrela: velocidade, cadência e distância em que param de avançar pra trocar tiro.
const AGRESSAO_VEL_POR_ESTRELA=.16,AGRESSAO_CADENCIA_POR_ESTRELA=.11,AGRESSAO_APROX_POR_ESTRELA=.55;
// ===== A GUARNIÇÃO CHEGA EM ONDAS, NÃO DE UMA VEZ =====
// Descia a guarnição inteira num rapel só — dois, quatro ou seis homens aparecendo no mesmo segundo.
// O problema disso não é o número, é o RITMO: um confronto que começa no seu tamanho final não tem
// para onde escalar, e quem está trocando tiro não sente diferença entre estar ganhando e estar
// prestes a ser cercado.
//
// Agora são três levas de dois. A primeira desce no rapel; as outras chegam quando o confronto DURA —
// é a espera que anuncia. E a espera encurta com a ficha: com 5 estrelas o reforço vem quase no dobro
// da pressa que vem com 1.
//
// O TETO DE 6 É DE CELULAR, e agora custa mais do que custava: cada policial deixou de ser 7 caixas e
// virou malha com esqueleto (24 ossos) animada por um mixer próprio. Subir esse número é uma decisão
// de desempenho, não de dificuldade — e precisa de medição antes.
const ONDA_TAMANHO=2,ONDAS_MAX=3;
const POLICIAIS_MAX=ONDA_TAMANHO*ONDAS_MAX;
// Segundos entre uma leva e a seguinte, com ficha limpa. Cada estrela desconta REFORCO_PRESSA.
const REFORCO_ESPERA=26,REFORCO_PRESSA=3.2;
function esperaDoReforco(){return Math.max(10,REFORCO_ESPERA-REFORCO_PRESSA*policia.procurado)}
// Quantos DEVEM estar em campo agora, dado quantas levas já vieram.
function numPoliciaisPara(){return ONDA_TAMANHO}
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
// ORÇAMENTO DE A* POR QUADRO. Um caminho custa 585 µs; dois policiais replanejando no mesmo
// quadro dão 1,2 ms de uma vez, que num celular é um soluço visível. Com teto de 1 por quadro,
// quem ficou de fora usa a rota velha (ou a reta, que `alvoDeMovimento` já devolve como reserva)
// por mais um quadro — 16 ms de atraso que ninguém percebe, contra um engasgo que se vê.
const ORCAMENTO_A_ESTRELA=1;
let caminhosNesteQuadro=0;

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
  armaMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:.4,metalness:.6}),
  // Mesmo tom do rosto do morador (NPCs.js), de propósito: os dois são gente do mesmo mundo.
  rostoMat=new THREE.MeshStandardMaterial({color:0x171712,roughness:.8});
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

// ===== GEOMETRIAS E MATERIAIS COMPARTILHADOS =====
// Policial nasce e morre o tempo todo: duplas de rua com 75 s de vida útil, guarnições de rapel a cada
// encontro. Cada um criava 9 BoxGeometry e um MeshStandardMaterial NOVOS, e a remoção só tirava da
// cena — sem `dispose`, cada ciclo deixava as 9 geometrias na memória de vídeo pra sempre. Medido num
// jogo parado: +15 geometrias depois de uma única dupla nascer e ir embora.
// Compartilhar resolve melhor que descartar: as formas são todas iguais, então são criadas UMA vez e
// reusadas por todo mundo. As 4 cores de pele viram 4 materiais fixos em vez de um por policial.
const GEO_POL={
  tronco:new THREE.BoxGeometry(.55,.82,.33),
  colete:new THREE.BoxGeometry(.58,.4,.36),
  cabeca:new THREE.BoxGeometry(.37,.37,.35),
  bone:new THREE.BoxGeometry(.4,.14,.38),
  perna:new THREE.BoxGeometry(.13,.55,.16),
  // O policial não tinha ROSTO: cabeça lisa, enquanto o morador (NPCs.js) sempre teve olhos e boca.
  // De perto, numa troca de tiros, quem está atirando em você ser um boneco sem cara é o detalhe que
  // mais quebra a cena. Duas caixinhas e um traço, geometria compartilhada como o resto.
  olho:new THREE.BoxGeometry(.06,.06,.03),
  boca:new THREE.BoxGeometry(.13,.03,.02),
  braco:new THREE.BoxGeometry(.13,.58,.16),
  arma:new THREE.BoxGeometry(.08,.1,.42),
};
const MATS_PELE=skinPolicial.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.55}));

function criarPolicial(indice,tipo='rapel'){
  const g=new THREE.Group();
  const skinMat=MATS_PELE[Math.floor(Math.random()*MATS_PELE.length)];
  blocoP(GEO_POL.tronco,uniformeMat,0,.87,0,g);
  blocoP(GEO_POL.colete,coleteMat,0,1.02,0,g);
  blocoP(GEO_POL.cabeca,skinMat,0,1.48,0,g);
  // Rosto na frente da cabeça (+z local, que é pra onde o policial olha). As medidas são as mesmas do
  // morador, pra os dois lerem como gente do mesmo mundo.
  for(const ox of[-.07,.07])blocoP(GEO_POL.olho,rostoMat,ox,1.53,.175,g);
  blocoP(GEO_POL.boca,rostoMat,0,1.4,.18,g);
  blocoP(GEO_POL.bone,boneMat,0,1.7,0,g);
  const pernas=[-.14,.14].map(lx=>blocoP(GEO_POL.perna,uniformeMat,lx,.29,0,g));
  const bracos=[-.37,.37].map(lx=>blocoP(GEO_POL.braco,skinMat,lx,.9,0,g));
  const arma=blocoP(GEO_POL.arma,armaMat,.37,.68,.18,g);
  g.scale.setScalar(ESCALA_POLICIAL);
  scene.add(g);
  const pol={
    grupo:g,pernas,bracos,arma,hp:POLICIAL_HP,vivo:true,caindo:false,quedaT:0,tipo,
    pos:new THREE.Vector3(),proximoTiro:0,caminhando:0,
    // Estado da trocação (ver Combate.js): relógio da mira, papel na equipe e cobertura escolhida.
    viuDesde:0,viuPor:0,prontoEm:0,tiros:0,hpAnterior:POLICIAL_HP,papel:null,papelAte:0,ladoFlanco:1,
    cobertura:null,proximaCobertura:0,faseCobertura:0,pressionadoAte:0,ultimoEspalhamento:0,
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
    // Corpo 3D: chega depois (o arquivo é pedido no primeiro policial que nasce). Até lá `corpo` é
    // nulo e quem anima são as caixas — as duas pernas girando, como sempre foi.
    corpo:null,velocidadeAndando:0,
  };
  // Todas as caixas viram a reserva: quando o modelo chega, elas somem de uma vez. `g.children` já
  // cobre tronco, cabeça, rosto e boné — os três primeiros itens são redundantes de propósito, pra a
  // lista não depender da ordem em que as peças foram criadas acima.
  vestirPolicial(g,[...pernas,...bracos,arma,...g.children.filter(c=>c.isMesh)],arma,
    estado=>{pol.corpo=estado});
  return pol;
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
  tempoEscondido:0,tempoNivel:0,retomarCacaEm:0,procurado:0,
  // Levas de rapel já descidas neste encontro, e quando a próxima pode vir (ver `combate`).
  levasDescidas:0,proximaLeva:0};
// ===== O QUE CHAMA ATENÇÃO DA POLÍCIA =====
// Antes bastava EXISTIR: a abordagem à plantação já elevava a ficha por si só, e a partir daí o
// jogador era caçado pra sempre sem ter feito nada além de plantar. Agora a polícia só se interessa
// por duas razões, e as duas são coisas que o jogador FEZ:
//   · está com a MOCHILA nas costas levando pacote (flagrante — dá pra ver de longe);
//   · SAIU PRESO HÁ POUCO (ficha quente), e aí fica marcado por um tempo.
// Fora isso ele é mais um morador: a batida vem pela PLANTA, confisca e vai embora.
//
// A FICHA ESQUENTA E ESFRIA — ANTES ELA SÓ ESQUENTAVA. `jaFoiPreso` era um booleano PERMANENTE: uma
// prisão, uma única vez, e a partir dali toda dupla de ronda do mapa perseguia o jogador pelo resto
// da partida. Não havia como limpar, salvo apagar o save. Era isso o "eles me seguem sem eu ter feito
// nada" que o Bruno relatou três vezes, e nenhuma das vezes o problema estava no spawn.
//
// Agora a marca tem PRAZO. Sair preso deixa a polícia de olho por FICHA_QUENTE segundos de jogo; passado
// isso, ele volta a ser mais um morador — e o que o marca de novo é o que ele FIZER, não o que já fez.
// Cinco minutos é longo o bastante pra a prisão ter consequência e curto o bastante pra caber numa
// sessão: dá pra sentir a diferença entre andar marcado e andar limpo dentro da mesma jogada.
const FICHA_QUENTE=300;
let vigiadoAte=0;
function levandoPacote(){return inventario.pacote>0}
export function chamaAtencao(){return levandoPacote()||performance.now()/1000<vigiadoAte}
// ===== REPARAR EM ALGUÉM NÃO É IR ATRÁS DE ALGUÉM =====
// `chamaAtencao` misturava as duas coisas, e a ficha quente sozinha bastava pra uma dupla de ronda
// largar a rota e caminhar até o jogador. Era isso o "morri e a polícia continua atrás de mim": ele
// renascia limpo de pacote, sem estrela nenhuma, e ainda assim era seguido — pela marca da prisão
// que acabara de acontecer.
//
// Agora são duas perguntas separadas, e a diferença é exatamente a que o Bruno pediu duas vezes:
//   · chamaAtencao()      → "eles reparam em mim" (é o que o aviso na tela mostra)
//   · motivoDePerseguir() → "eles vêm atrás de mim", e isso exige FLAGRANTE (mochila com pacote) ou
//                           FICHA SUJA (estrela). A marca da prisão, sozinha, não é motivo de caçada.
function motivoDePerseguir(){return levandoPacote()||policia.procurado>0}
// Quanto ainda falta da ficha quente, em segundos. A HUD mostra isso: marca sem prazo visível é
// indistinguível de bug — foi assim que a versão permanente passou tanto tempo sem ser notada.
export function segundosDeFichaQuente(){return Math.max(0,vigiadoAte-performance.now()/1000)}
function elevarProcurado(n){if(n>policia.procurado)policia.procurado=Math.min(PROCURADO_MAX,n)}
function somarProcurado(n){policia.procurado=Math.min(PROCURADO_MAX,policia.procurado+n)}
const policiais=[];
const cordas=[];// rope visual durante o rapel
let saudeJogador=JOGADOR_HP_MAX,armaduraJogador=0,jogadorRendido=false;
let proximoTiroJogador=0;

// ===== HUD: vida, alerta, esconderijo, mira de combate, botão de atirar, flash de dano =====
const alertaEl=document.getElementById('alertaPolicia'),
  atencaoEl=document.getElementById('atencaoPolicia'),
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
  // ===== SER PRESO ACERTA A CONTA =====
  // A ficha NÃO caía aqui, e o efeito era o pior possível: o jogador era rendido com 5 estrelas,
  // perdia plantação, pacotes, colete e dinheiro — e RENASCIA com as mesmas 5 estrelas e o rastro
  // ainda quente, com a polícia de rua andando na direção dele antes de ele dar o primeiro passo.
  // Punição em cima de punição, sem nenhuma saída no meio.
  //
  // Existia um comentário defendendo que a ficha não cai no fim do encontro, e ele continua certo:
  // abater a guarnição ou fugir NÃO limpam nada, senão "matar todo mundo" viraria a estratégia
  // dominante e o esconderijo perderia a função. Mas ser PRESO é o outro lado dessa moeda — é o
  // único desfecho em que a polícia consegue o que queria. Conta acertada, ficha zerada.
  policia.procurado=0;
  rastro.ativo=false;rastro.buscaAte=0;
  policia.tempoEscondido=0;policia.tempoNivel=0;
  vigiadoAte=performance.now()/1000+FICHA_QUENTE;
  // A POLÍCIA DE RUA QUE JÁ ESTÁ EM CAMPO PRECISA RECUAR DE FATO. Zerar a ficha faz eles pararem de
  // perseguir, mas o destino de ronda de cada um ainda aponta pro lugar onde a prisão aconteceu —
  // eles continuariam andando pra lá, o que da parte do jogador é indistinguível de continuar sendo
  // caçado. Cada um recebe um destino LONGE e a vida útil encurtada, então a dupla dispersa e some.
  {const agora=performance.now()/1000;
   for(const pol of policiaisRua){
     pol.destinoRonda=pontoDeRonda(true);
     pol.rota=null;pol.destinoRota=null;
     pol.expiraEm=Math.min(pol.expiraEm,agora+8);
   }}
  // O colete é apreendido junto: ser rendido é a "morte" deste jogo, e armadura que sobrevive à
  // rendição deixaria a placa no corpo depois do respawn sem o jogador ter pagado por ela.
  // A carga vai junto: ser rendido apreende os pacotes. Deixar a mochila cheia depois da prisão
  // faria o flagrante recomeçar no mesmo instante do respawn.
  armaduraJogador=0;inventario.colete=0;inventario.pacote=0;atualizarStatusEconomia();
  mostrarAviso('Você foi rendido pela polícia — plantação perdida e multa aplicada.',3400);
  if(policia.alvoPlanta&&!policia.alvoPlanta.colhida)confiscarPlanta(policia.alvoPlanta);
  aplicarMulta(MULTA_RENDICAO);
  // Define o saldo no início da rendição para o HUD e o autosave já refletirem a reserva de respawn.
  definirDinheiro(SALDO_RESPAWN);
  transitar('recuando');
  setTimeout(()=>{
    player.position.set(SPAWN_X,obterElevacao(SPAWN_X,SPAWN_Z),SPAWN_Z);
    // Reaplica a reserva no instante exato em que o personagem nasce no spawn.
    definirDinheiro(SALDO_RESPAWN);
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
let atencaoCache=null;// o texto só volta pro DOM quando muda (ele muda a cada segundo, não a cada quadro)
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
  // Tenta o setor em vários raios E em alguns ângulos em volta dele. Só os raios não bastam: num
  // quarteirão fechado dá pra o setor inteiro cair dentro de casa, e aí o policial desistia e ficava
  // PARADO em cima do ponto do rastro — medido, o raio percorrido em 26 s foi de 0,1 m pra 0,0 m.
  // Os desvios de ângulo são pequenos de propósito: o suficiente pra achar a viela ao lado, não pra
  // invadir o setor do parceiro (que anularia o espalhamento).
  for(const desvio of BUSCA_DESVIOS)for(const escala of BUSCA_ESCALAS){
    const r2=raio*escala,a2=ang+desvio;
    const x=rastro.x+Math.cos(a2)*r2,z=rastro.z+Math.sin(a2)*r2;
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
  // ALTURAS DERIVADAS DO CORPO (ver Combate.js). Eram 1,55 e 1,10 — números da época em que o
  // personagem media 1,75 m. Com 0,9 m, o "olho" ficava 80 cm acima da cabeça do policial e o alvo
  // 29 cm acima da do jogador: a linha de visão passava por cima de mureta que deveria escondê-lo.
  const ox=pol.pos.x,oy=pol.grupo.position.y+ALT_OLHO,oz=pol.pos.z;
  pol.viu=veAlvo(ox,oy,oz,pol.olharY,player.position.x,player.position.y+ALT_TORSO,player.position.z,
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
  const alturaPeito=pol.grupo.position.y+ALT_TORSO;
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
  if(rotaInvalida&&agora>=pol.proximoReplan&&caminhosNesteQuadro<ORCAMENTO_A_ESTRELA){
    caminhosNesteQuadro++;
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
  const antesX=pol.pos.x,antesZ=pol.pos.z;
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
    // Com corpo 3D quem anda é o esqueleto (ver PersonagemPolicial); o balanço de perna abaixo é das
    // CAIXAS, e girar caixa que já está invisível seria trabalho por nada — além de sobrescrever a
    // pose do clipe caso as duas coisas rodassem juntas.
    if(!pol.corpo){
      pol.caminhando+=dt*7;const balanco=Math.sin(pol.caminhando)*.4;
      pol.pernas[0].rotation.x=balanco;pol.pernas[1].rotation.x=-balanco;
    }
  }
  // A velocidade REAL deste quadro, não a pedida: o policial que está raspando numa parede pede
  // 1,7 m/s e anda 0,1 — animar pela velocidade pedida deixaria ele correndo parado contra o muro.
  pol.velocidadeAndando=moveu?Math.hypot(pol.pos.x-antesX,pol.pos.z-antesZ)/Math.max(dt,1e-4):0;
  return moveu;
}
function encararPonto(pol,x,z){pol.olharY=Math.atan2(x-pol.pos.x,z-pol.pos.z);pol.grupo.rotation.y=pol.olharY;pol.velocidadeAndando=0}

// ===== NINGUÉM OCUPA O MESMO LUGAR =====
// `passoPolicial` só testa colisão contra PAREDE. Policial não era obstáculo pra policial nem pro
// jogador, então quatro deles convergindo no mesmo ponto de cobertura terminavam empilhados no mesmo
// metro quadrado, e um que avançasse até a distância mínima entrava DENTRO do jogador. É o
// "eles bugam, entram dentro do meu personagem, entram um dentro do outro".
//
// A separação roda DEPOIS de todo mundo andar, o que é o que a torna estável: resolver durante o
// movimento faz A empurrar B, B empurrar A de volta, e os dois tremerem no lugar. Aqui cada par se
// afasta metade da sobreposição, uma vez por quadro — e o empurrão passa pelo mesmo teste de parede
// do passo normal, senão a separação enfiaria um deles dentro do muro.
const RAIO_CORPO=.34;      // meio corpo no plano, com folga de ombro
const RAIO_JOGADOR=.42;
const _corpos=[];
function empurrar(pol,dx,dz){
  if(!colidePedestre(pol.pos.x+dx,pol.pos.z))pol.pos.x+=dx;
  if(!colidePedestre(pol.pos.x,pol.pos.z+dz))pol.pos.z+=dz;
}
function separarCorpos(){
  _corpos.length=0;
  for(const p of policiais)if(p.vivo)_corpos.push(p);
  for(const p of policiaisRua)if(p.vivo)_corpos.push(p);
  const min=RAIO_CORPO*2,min2=min*min,minJ=RAIO_CORPO+RAIO_JOGADOR;
  for(let i=0;i<_corpos.length;i++){
    const a=_corpos[i];
    for(let j=i+1;j<_corpos.length;j++){
      const b=_corpos[j];
      let dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z;
      let d=Math.sqrt(dx*dx+dz*dz);
      if(d*d>=min2)continue;
      // Exatamente no mesmo ponto (dois nascendo na mesma coordenada, ou um rapel em cima do outro):
      // sem direção pra separar, o ângulo áureo pelo índice desempata sem sorteio e sem divisão por
      // zero — e dá direções diferentes pra cada par, em vez de jogar todo mundo pro mesmo lado.
      if(d<1e-3){const ang=i*2.399963;dx=Math.cos(ang);dz=Math.sin(ang);d=1}
      const meio=(min-d)/2,ux=dx/d*meio,uz=dz/d*meio;
      empurrar(a,-ux,-uz);empurrar(b,ux,uz);
    }
    let dx=a.pos.x-player.position.x,dz=a.pos.z-player.position.z;
    let d=Math.sqrt(dx*dx+dz*dz);
    if(d<minJ){
      if(d<1e-3){dx=Math.sin(a.olharY||0);dz=Math.cos(a.olharY||0);d=1}
      const f=(minJ-d)/d;
      empurrar(a,dx*f,dz*f);
    }
    // O corpo já foi assentado neste quadro; sem reescrever X/Z aqui o empurrão só apareceria no
    // quadro seguinte, e a sobreposição piscaria a cada frame em vez de sumir.
    a.grupo.position.x=a.pos.x;a.grupo.position.z=a.pos.z;
    a.barra.posicionar(a.pos.x,a.grupo.position.y,a.pos.z);
  }
}

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

// ===== O DISPARO, UM LUGAR SÓ =====
// Havia DUAS cópias deste código (a de rua e a de combate), com as mesmas alturas erradas e o mesmo
// modelo de espalhamento copiado. Duas cópias do mesmo cálculo divergem na primeira correção — e
// divergiram: a de rua nem checava linha de visão antes de puxar o gatilho.
//
// A cadeia agora é a de um atirador de verdade, e não "viu → acerta":
//   DETECÇÃO → REAÇÃO (0,28-0,70 s, sorteada por policial) → MIRA QUE ASSENTA (1,4 s) → DISPARO.
// `pol.viuDesde` é o relógio dessa cadeia, e ele ZERA quando a linha de visão quebra: quem se
// esconde e reaparece força o cara a começar de novo, que é o que dá função a usar cobertura.
const _origem=new THREE.Vector3(),_dir=new THREE.Vector3();
// Quanto tempo o policial mantém a mira depois de PERDER o alvo de vista. Zerar na hora era punição
// dupla: um jogador andando de lado sai e entra do cone o tempo todo, e a cada saída a mira voltava a
// ficar fria (2,2x de erro). Medido: 7% de acerto contra alvo em movimento a 9 m, quase inatingível.
// Meio segundo de tolerância é o que um atirador humano tem — ele não esquece onde você estava.
const GRACA_MIRA=.6;
function tentarAtirar(pol,agora,viu,andando){
  if(!viu){
    // Perdeu de vista: a mira só zera se ficar perdida além da graça.
    if(pol.viuDesde&&agora-(pol.viuPor||agora)>GRACA_MIRA)pol.viuDesde=0;
    return false;
  }
  pol.viuPor=agora;
  if(!pol.viuDesde){pol.viuDesde=agora;pol.prontoEm=agora+tempoDeReacao();return false}
  if(agora<pol.prontoEm||agora<pol.proximoTiro)return false;
  if(jogadorEscondido()||jogadorRendido)return false;
  const dist=distXZ(pol.pos,player.position);
  if(dist>POLICIAL_ALCANCE_TIRO)return false;
  const ox=pol.pos.x,oy=pol.grupo.position.y+ALT_CANO,oz=pol.pos.z;
  // ANTECIPAÇÃO: mira onde o alvo VAI estar quando a bala chegar, não onde ele está. Sem isto, um
  // jogador andando de lado a 9 m era inatingível — medido, 0% de acerto em 24 s. O fator é 0,62 com
  // ruído, não 1: um atirador humano lê o movimento, mas não resolve a equação — e é essa imperfeição
  // que mantém correr e trocar de direção sendo defesa de verdade.
  const voo=dist/VELOCIDADE_BALA;
  const lead=voo*(LEAD_FATOR+(Math.random()*2-1)*LEAD_RUIDO);
  const ax=player.position.x+velJogador.x*lead,
        ay=player.position.y+ALT_TORSO,
        az=player.position.z+velJogador.z*lead;
  // A linha é medida do CANO ao TRONCO, que é por onde a bala passa. Medir de outro par de alturas
  // deixava o policial atirar na parede achando que tinha caminho.
  if(!temLinhaDeVisao(ox,oy,oz,player.position.x,player.position.y+ALT_TORSO,player.position.z))return false;
  pol.proximoTiro=agora+cooldownTiro();
  const espalhamento=espalhamentoDoTiro({
    dist,tempoMirando:agora-pol.viuDesde,policialAndando:andando,procurado:policia.procurado});
  pol.ultimoEspalhamento=espalhamento;
  _dir.set(ax-ox,ay-oy,az-oz).normalize();
  _dir.x+=(Math.random()*2-1)*espalhamento;
  _dir.y+=(Math.random()*2-1)*espalhamento*.6;
  _dir.z+=(Math.random()*2-1)*espalhamento;
  _origem.set(ox,oy,oz);
  dispararBala(_origem,_dir,false);
  pol.tiros=(pol.tiros||0)+1;
  return true;
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
  // ===== PERCEPÇÃO ANTES DE TUDO =====
  // O policial não sabe onde o jogador está por decreto: ou ele VÊ (cone + linha de visão), ou
  // trabalha com o rastro do rádio — a última posição avistada por alguém da equipe.
  const vendo=perceber(pol,agora);
  const dist=distXZ(pol.pos,player.position);

  // ===== ONDE ELE ACHA QUE O ALVO ESTÁ =====
  // Vendo, é o jogador. Sem ver, é a ÚLTIMA POSIÇÃO CONHECIDA — nunca a atual. É o que impede o
  // policial de continuar apontando pra alguém que já dobrou a esquina.
  let alvoX=null,alvoZ=null;
  if(vendo){alvoX=player.position.x;alvoZ=player.position.z}
  else if(rastroValido(agora)){alvoX=rastro.x;alvoZ=rastro.z}

  // ===== REAÇÃO A LEVAR TIRO =====
  // Quem está apanhando não fica plantado. Perder vida liga uma janela de "pressionado", e nela o
  // policial passa a procurar cobertura independente do papel que tinha.
  if(pol.hp<pol.hpAnterior){pol.pressionadoAte=agora+3;pol.cobertura=null}
  pol.hpAnterior=pol.hp;
  const pressionado=agora<(pol.pressionadoAte||0);

  // ===== PARA ONDE ELE VAI =====
  let destino=null,querParar=false;
  if(alvoX!==null){
    const buscandoCobertura=pressionado||pol.papel===PAPEL.COBERTURA;
    if(buscandoCobertura){
      // Recalcula cobertura no máximo a cada 1,2 s: a varredura são 30 testes de ponto navegável
      // mais linha de visão, e fazer isso por quadro por policial é o tipo de coisa que engasga no
      // celular sem melhorar nada — cobertura não muda de lugar em 16 ms.
      if(!pol.cobertura||agora>pol.proximaCobertura){
        pol.proximaCobertura=agora+1.2;
        pol.faseCobertura=Math.random()*Math.PI*2;
        pol.cobertura=procurarCobertura(pol,alvoX,alvoZ,
          (px,py,pz,ax,az)=>temLinhaDeVisao(px,py,pz,ax,obterElevacao(ax,az)+ALT_TORSO,az),
          (px,pz)=>obterElevacao(px,pz));
      }
      if(pol.cobertura){
        // Colado na cobertura ele ESPIA: sai pro ponto de tiro, dá o tiro, volta. Sem isso a
        // "cobertura" vira o policial escondido pra sempre e a troca morre de tédio.
        const naCobertura=Math.hypot(pol.pos.x-pol.cobertura.x,pol.pos.z-pol.cobertura.z)<1.1;
        const espiando=naCobertura&&agora>=pol.proximoTiro-.45;
        destino=espiando?{x:pol.cobertura.saidaX,z:pol.cobertura.saidaZ}
                        :{x:pol.cobertura.x,z:pol.cobertura.z};
      }
    }
    if(!destino){
      const p=destinoDoPapel(pol,alvoX,alvoZ);
      destino=p;
      // Chegou na distância que o papel quer: para de andar e trabalha a mira. Atirar parado é mais
      // preciso (ver Combate.js), então parar é uma decisão tática, não uma pausa de animação.
      querParar=Math.abs(dist-(pol.papel===PAPEL.AVANCO?aproxMinima():9))<1.4;
    }
  }else if(emBusca(agora)){
    destino=pontoDeBusca(pol,agora);
  }

  // ===== MOVIMENTO =====
  let andando=false;
  if(destino&&!querParar&&!pol.fixo&&distXZ(pol.pos,destino)>RUA_CHEGADA){
    const alvo=alvoDeMovimento(pol,agora,destino.x,destino.z);
    passoPolicial(pol,dt,alvo.x,alvo.z,velocidadePolicial(POLICIAL_VELOCIDADE));
    andando=true;
  }else if(vendo){
    encararPonto(pol,player.position.x,player.position.z);
  }else if(alvoX!==null){
    encararPonto(pol,alvoX,alvoZ);// olhando pra última posição conhecida
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
  tentarAtirar(pol,agora,vendo,andando);
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

// Desce UMA leva de rapel no ponto dado. Serve pra primeira (que vem com o helicóptero pairando) e
// pros reforços (que vêm com ele voltando por cima do confronto).
function descerLeva(quantos,base,dx,dz){
  const jaEmCampo=policiais.length;
  for(let i=0;i<quantos;i++){
    const pol=criarPolicial(jaEmCampo+i);
    const desloc=(i-(quantos-1)/2)*RAPEL_ESPACO;
    // Vector3.set com DOIS argumentos jogava o z no y e deixava z=0: os policiais desciam sempre na
    // faixa z≈0, longe da plantação. É o que fazia a batida parecer que não existia.
    pol.pos.set(base.x-dz*desloc,0,base.z+dx*desloc);
    pol.grupo.position.set(pol.pos.x,heli.position.y,pol.pos.z);
    policiais.push(pol);
    const corda=new THREE.Line(new THREE.BufferGeometry().setFromPoints([heli.position.clone(),pol.grupo.position.clone()]),new THREE.LineBasicMaterial({color:0x333333}));
    scene.add(corda);cordas.push({linha:corda,pol});
  }
}
// Onde a leva encosta: ao lado do alvo, no rumo de onde o helicóptero veio, empurrado pro espaço
// livre mais próximo — sem isso a fila cai dentro de um quarteirão e eles nascem dentro da parede.
function pontoDeDescida(alvo){
  let dx=heli.position.x-alvo.x,dz=heli.position.z-alvo.z;
  const dh=Math.hypot(dx,dz)||1;dx/=dh;dz/=dh;
  const base=buscarPosicaoLivre(alvo.x+dx*RAPEL_DIST,alvo.z+dz*RAPEL_DIST,
    (x,z)=>colidePedestre(x,z),9)||{x:alvo.x+dx*RAPEL_DIST,z:alvo.z+dz*RAPEL_DIST};
  return{base,dx,dz};
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
      // Um aviso só, no começo do pairar: repetir a cada quadro entupiria a faixa de aviso.
      if(policia.tempoEstado<dt*1.5)mostrarAviso('Helicóptero parado em cima de você. Corre.',PAIRANDO_DURACAO*1000);
      if(policia.tempoEstado>=PAIRANDO_DURACAO)transitar('rapel');
    }
  },
  rapel:{
    aoEntrar(){
      const alvo=policia.pontoAlvo;
      // A PRIMEIRA leva é sempre do tamanho de uma leva. O resto vem depois, se o confronto durar —
      // ver `combate`. Antes o tamanho saía da ficha e a guarnição inteira descia de uma vez só.
      const{base,dx,dz}=pontoDeDescida(alvo);
      descerLeva(numPoliciaisPara(),base,dx,dz);
      policia.levasDescidas=1;
      policia.proximaLeva=performance.now()/1000+esperaDoReforco();
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
      // ===== O REFORÇO =====
      // Vem quando o confronto DURA, e só enquanto houver leva pra descer e vaga no teto. O aviso é
      // parte da mecânica: reforço que aparece sem anúncio lê como spawn, e reforço anunciado lê como
      // "corre agora" — que é a jogada que ele deve provocar.
      if(policia.levasDescidas<ONDAS_MAX&&policiais.length<POLICIAIS_MAX
         &&agora>=policia.proximaLeva&&!jogadorEscondido()){
        const{base,dx,dz}=pontoDeDescida({x:player.position.x,z:player.position.z});
        // Nunca passa do teto, mesmo que a leva seja maior que a vaga que sobrou.
        descerLeva(Math.min(ONDA_TAMANHO,POLICIAIS_MAX-policiais.length),base,dx,dz);
        policia.levasDescidas++;
        policia.proximaLeva=agora+esperaDoReforco();
        mostrarAviso(`🚁 Reforço descendo — ${policiais.filter(p=>p.vivo).length} em campo`,2800);
      }
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
      for(const pol of policiais){scene.remove(pol.grupo);pol.barra.descartar();despirPolicial(pol.corpo)}
      policiais.length=0;limparBalas();
      // Zera as levas AQUI, no único ponto de limpeza do encontro. Deixar isso pro `aoEntrar` do rapel
      // seria zerar tarde: quem conta as levas é o combate, e ele começa antes.
      policia.levasDescidas=0;policia.proximaLeva=0;
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
// ===== RONDA SEM MOTIVO NÃO ANDA NA DIREÇÃO DO JOGADOR =====
// Os pontos de ronda são os becos DE VERDADE — e o jogador também anda nos becos. Sorteando entre os
// 125 pontos por igual, uma dupla que não tem nada com ele mira, com frequência, o beco em que ele
// está: ela cruza o morro inteiro e para atrás dele. Do lado de dentro do jogo isso é
// indistinguível de perseguição, e foi a segunda foto que o Bruno mandou dizendo "tão me seguindo".
//
// Então: enquanto a polícia não tem razão pra se interessar por ele (ficha fria, sem mochila, sem
// rastro), o destino de ronda é sorteado LONGE dele. Ela continua patrulhando o morro todo — só não
// escolhe justamente o pedaço onde ele está. Se em 10 tentativas não achar nada longe (o jogador está
// no meio do morro), vale a última: polícia que some é pior que polícia que passa perto.
const RONDA_LONGE_DO_JOGADOR=16;
function pontoDeRonda(evitarJogador=false){
  // Com ficha suja eles vasculham os ESCONDERIJOS (é onde o jogador se enfia); limpos, andam pelas
  // vielas como qualquer ronda. É o "quando o jogador está procurado, vasculham os esconderijos".
  if(policia.procurado>0&&refugios.length&&Math.random()<.6){
    const r=refugios[Math.floor(Math.random()*refugios.length)];
    return{x:r.x+(Math.random()*2-1)*RUA_VASCULHAR_RAIO,z:r.z+RUA_VASCULHAR_RAIO};// na frente da porta
  }
  let wp=null;
  for(let t=0;t<10;t++){
    wp=waypointsVielas[Math.floor(Math.random()*waypointsVielas.length)];
    if(!evitarJogador)break;
    if(Math.hypot(wp.x-player.position.x,wp.z-player.position.z)>=RONDA_LONGE_DO_JOGADOR)break;
  }
  return{x:wp.x,z:wp.z};
}
// Onde o esconderijo mais próximo fica, visto do jogador. Serve pra não fechar a rota de fuga.
function anguloDaFuga(px,pz){
  let melhor=null,melhorD=Infinity;
  for(const r of refugios){const d=(r.x-px)**2+(r.z-pz)**2;if(d<melhorD){melhorD=d;melhor=r}}
  return melhor?Math.atan2(melhor.x-px,melhor.z-pz):null;
}
// Sorteia um ponto de nascimento aceitável, ou devolve null se não achar em RUA_SPAWN_TENTATIVAS.
function pontoDeNascimento(){
  const px=player.position.x,pz=player.position.z;
  const angFuga=policia.procurado>0?anguloDaFuga(px,pz):null;
  for(let t=0;t<RUA_SPAWN_TENTATIVAS;t++){
    const p=pontoDeRonda();
    const d=Math.hypot(p.x-px,p.z-pz);
    if(d<RUA_SPAWN_MINIMO)continue;
    if(angFuga!==null){
      const ang=Math.atan2(p.x-px,p.z-pz);
      let dif=Math.abs(ang-angFuga);if(dif>Math.PI)dif=Math.PI*2-dif;
      if(dif<RUA_SPAWN_SETOR_FUGA)continue;// tapando a saída pro esconderijo
    }
    if(d>=RUA_SPAWN_LONGE)return p;
    // Distância média: só vale com parede no meio. A altura 1,2 é a do tronco, a mesma que o teste
    // de visão usa — bater no chão do morro não conta como estar escondido.
    if(primeiroImpactoNoSegmento(p.x,obterElevacao(p.x,p.z)+1.2,p.z,px,player.position.y+1.2,pz))return p;
  }
  return null;
}
// Exposto só pro teste de spawn: ele precisa sortear centenas de nascimentos sem esperar os 70-140 s
// da janela real, e sem policial de verdade entrando em cena a cada sorteio.
export function __pontoDeNascimentoParaTeste(){return pontoDeNascimento()}
// Exposto pro teste medir a ronda SEM MOTIVO: é a diferença entre "passou perto por acaso" e "veio
// atrás de mim", e sem número isso vira discussão de sensação.
export function __pontoDeRondaParaTeste(evitar){return pontoDeRonda(evitar)}
// ===== GANCHOS DA BANCADA DE TESTE DA TROCAÇÃO =====
// A troca é um sistema de tempo real com sorteio dentro: a única forma honesta de saber se ela está
// boa é rodar centenas de segundos dela e CONTAR. Estes ganchos deixam o teste montar um policial
// isolado, a uma distância escolhida, e rodar o passo de combate sem esperar um encontro de verdade.
export function __policialDeTeste(x,z){
  const pol=criarPolicial(policiais.length,'rapel');
  pol.pos.set(x,0,z);pol.alturaAtual=obterElevacao(x,z);
  pol.grupo.position.set(x,pol.alturaAtual,z);
  pol.papel='avanco';pol.papelAte=0;
  // `fixo` prega o policial no lugar. Sem isso ele avança até a distância do papel e TODA medição de
  // pontaria acaba acontecendo a 3 m — o teste mediria sempre o mesmo caso achando que mede quatro.
  pol.fixo=false;
  // Já olhando pro jogador: sem isto o teste gastaria os primeiros segundos esperando o giro de
  // varredura encontrar o alvo, e mediria a varredura em vez da pontaria.
  pol.olharY=Math.atan2(player.position.x-x,player.position.z-z);
  pol.grupo.rotation.y=pol.olharY;
  policiais.push(pol);
  return pol;
}
export function __removerPolicialDeTeste(pol){
  const i=policiais.indexOf(pol);
  if(i>=0){scene.remove(pol.grupo);pol.barra.descartar();despirPolicial(pol.corpo);policiais.splice(i,1)}
}
export function __passoDeCombateParaTeste(pol,dt){
  const agora=performance.now()/1000;
  atualizarCombate(dt);
  // Os papéis são distribuídos em `atualizarPolicia`, que o teste não chama — sem isto os quatro
  // ficavam com o papel de partida e o teste "provava" que a equipe toda faz a mesma coisa.
  distribuirPapeis(policiais,agora,player.position.x,player.position.z);
  atualizarPolicialCombate(pol,dt,agora);
}
// As balas só avançam dentro de `atualizarPolicia`, com a lista de alvos daquele quadro. O teste
// precisa do mesmo par (bala + alvos), senão mede tiro que sai e nunca chega em ninguém.
export function __passoDeBalasParaTeste(dt){
  // `montarAlvosDoFrame` roda dentro de `atualizarPolicia`, que o teste não chama. Sem ela a lista de
  // alvos fica vazia e TODA bala passa reto — foi o que fez a primeira medição dar 15 tiros e 0 dano.
  montarAlvosDoFrame();
  atualizarBalas(dt,alvosDaBala);
}
// A separação de corpos roda dentro de `atualizarPolicia`, que o teste não chama — sem este gancho o
// teste montaria quatro policiais empilhados e "provaria" que eles ficam empilhados.
export function __separarCorposParaTeste(){separarCorpos()}
// ===== BANCADA DAS ONDAS DE REFORÇO =====
// A escalada é um relógio: a primeira leva desce no rapel e as outras vêm com o tempo de confronto.
// Medir isso de verdade levaria minutos por caso, então o teste força o estado e roda o `combate` com
// `performance.now()` virtualizado — a mesma técnica da bancada da trocação.
export function __forcarCombateParaTeste(){
  for(const pol of policiais){scene.remove(pol.grupo);pol.barra.descartar();despirPolicial(pol.corpo)}
  policiais.length=0;limparCordas();
  policia.levasDescidas=0;policia.proximaLeva=0;policia.procurado=3;
  policia.pontoAlvo.x=player.position.x;policia.pontoAlvo.z=player.position.z;
  policia.estado='rapel';ESTADOS.rapel.aoEntrar();
  policia.estado='combate';policia.tempoEstado=0;
}
export function __passoDoCombateDoEstado(dt){
  ESTADOS.combate.aoAtualizar(dt,performance.now()/1000);
}
export function __contarPoliciais(){return{emCampo:policiais.length,levas:policia.levasDescidas,
  teto:POLICIAIS_MAX,porOnda:ONDA_TAMANHO,ondasMax:ONDAS_MAX}}
// Rende o jogador na marra, pra o teste medir o que ACONTECE quando ele morre sem precisar levar
// tiro de verdade por trinta segundos.
export function __renderJogadorParaTeste(){receberDanoJogador(9999)}
export function __fichaParaTeste(){return{procurado:policia.procurado,rastroAtivo:rastro.ativo,
  buscaAte:rastro.buscaAte,fichaQuente:+segundosDeFichaQuente().toFixed(0),
  chamaAtencao:chamaAtencao(),perseguem:motivoDePerseguir()}}
export function __ruaParaTeste(){return policiaisRua.map(p=>({x:+p.pos.x.toFixed(1),z:+p.pos.z.toFixed(1),
  destino:p.destinoRonda?{x:+p.destinoRonda.x.toFixed(1),z:+p.destinoRonda.z.toFixed(1)}:null}))}
export function __nascerDuplaParaTeste(x,z){nascerDupla(performance.now()/1000,{x,z})}
export function __vidaJogadorParaTeste(){return saudeJogador}
export function __curarJogadorParaTeste(){
  // Zera TAMBÉM o rendido: sem isso, o primeiro caso do teste matava o jogador, ele ficava rendido, e
  // todos os casos seguintes mediam zero — porque policial não atira em quem já se entregou.
  saudeJogador=JOGADOR_HP_MAX;armaduraJogador=0;jogadorRendido=false;atualizarHudSaude();
}
export function __estadoDeCombate(){
  return policiais.filter(p=>p.vivo).map(p=>({papel:p.papel,tiros:p.tiros,
    espalhamento:+(p.ultimoEspalhamento||0).toFixed(4),temCobertura:!!p.cobertura,
    dist:+distXZ(p.pos,player.position).toFixed(1)}));
}
function nascerDupla(agora,base){
  for(let i=0;i<2;i++){
    const pol=criarPolicial(policiaisRua.length+i,'rua');
    pol.pos.set(base.x+(i?1.2:-1.2),0,base.z);
    pol.alturaAtual=obterElevacao(pol.pos.x,pol.pos.z);
    pol.grupo.position.set(pol.pos.x,pol.alturaAtual,pol.pos.z);
    // Longe do jogador também no primeiro destino: nascer a 20 m e mirar exatamente onde ele está
    // é a mesma perseguição-sem-motivo, só que começando antes.
    pol.expiraEm=agora+RUA_DUPLA_VIDA;pol.destinoRonda=pontoDeRonda(!motivoDePerseguir());
    policiaisRua.push(pol);
  }
}
// `despirPolicial` tira o mixer da lista de atualização. Sem isso o mixer de um policial já removido
// da cena continua sendo avançado a cada quadro, pra sempre — é o mesmo vazamento que as geometrias
// por policial já causaram uma vez neste arquivo, só que em CPU em vez de VRAM.
function removerRua(i){const pol=policiaisRua[i];scene.remove(pol.grupo);pol.barra.descartar();despirPolicial(pol.corpo);policiaisRua.splice(i,1)}
function atualizarPoliciaDeRua(dt,agora){
  // Durante um encontro de rapel a rua não recebe reforço novo: seriam duas equipes disputando o
  // mesmo alvo, e no celular isso é o dobro de A* por frame sem ganho nenhum de jogo.
  const emEncontro=policia.estado!=='patrulha'&&policia.estado!=='recuando';
  proximaDupla-=dt;
  if(proximaDupla<=0&&!emEncontro&&policiaisRua.length<RUA_MAX_DUPLAS*2){
    const base=pontoDeNascimento();
    // Sem ponto aceitável a dupla não nasce, e a próxima janela é CURTA: senão um jogador parado em
    // campo aberto no meio do mapa ficaria sem polícia nenhuma por dois minutos.
    if(base){
      nascerDupla(agora,base);
      proximaDupla=RUA_INTERVALO_MIN+Math.random()*(RUA_INTERVALO_MAX-RUA_INTERVALO_MIN);
    }else proximaDupla=8;
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
    // Ver o jogador só INTERESSA se ele chama atenção (mochila com pacote ou ficha corrida). Sem
    // isso a dupla segue a ronda mesmo olhando direto pra ele — que é o comportamento certo pra quem
    // não fez nada. Antes qualquer avistamento virava abordagem.
    //
    // ESTA LINHA PRECISA VIR ANTES DA EXPIRAÇÃO ABAIXO. Ela estava depois, e a expiração já usava
    // `deOlho`: enquanto a dupla era nova a condição curto-circuitava em `agora>pol.expiraEm` e nada
    // acontecia, mas no instante em que a primeira dupla completava os 75 s de vida o acesso à const
    // ainda não inicializada lançava ReferenceError — dentro do laço do quadro, que matava o
    // requestAnimationFrame e congelava o jogo. Era o "trava depois de alguns minutos".
    const deOlho=vendo&&motivoDePerseguir();
    // Expira e vai embora — mas nunca no meio de uma perseguição, que seria a polícia evaporando na
    // cara do jogador. Com rastro ativo eles ficam até o rastro esfriar.
    if(agora>pol.expiraEm&&!deOlho&&!rastroValido(agora)&&!emBusca(agora)){removerRua(i);continue}
    let destino=null;
    if(deOlho)destino={x:player.position.x,z:player.position.z};
    else if(rastroValido(agora))destino={x:rastro.x,z:rastro.z};
    else if(emBusca(agora))destino=pontoDeBusca(pol,agora);
    else{
      destino=pol.destinoRonda;
      // `true`: aqui, por construção, não há deOlho, nem rastro, nem busca — ou seja, a polícia não
      // tem razão nenhuma pra ir na direção do jogador.
      if(distXZ(pol.pos,destino)<RUA_CHEGADA)pol.destinoRonda=pontoDeRonda(true);
    }
    const perto=deOlho&&distXZ(pol.pos,player.position)<=aproxMinima();
    let andandoRua=false;
    if(perto)encararPonto(pol,player.position.x,player.position.z);
    else{
      const alvo=alvoDeMovimento(pol,agora,destino.x,destino.z);
      passoPolicial(pol,dt,alvo.x,alvo.z,velocidadePolicial(RUA_VELOCIDADE));
      andandoRua=true;
    }
    if(colidePedestre(pol.pos.x,pol.pos.z)){
      const livre=buscarPosicaoLivre(pol.pos.x,pol.pos.z,colidePedestre);
      if(livre){pol.pos.x=livre.x;pol.pos.z=livre.z;pol.rota=null;pol.destinoRota=null}
    }
    assentarPolicial(pol,dt,vendo);
    pol.barra.posicionar(pol.pos.x,pol.grupo.position.y,pol.pos.z);
    pol.barra.mostrar(pol.hp<POLICIAL_HP);
    // Polícia de rua só abre fogo com ficha suja: patrulha de rotina não fuzila quem passa na rua.
    // Era uma SEGUNDA CÓPIA do disparo, com as mesmas alturas erradas e o espalhamento copiado. Duas
    // cópias do mesmo cálculo divergem na primeira correção, e tinham divergido. Agora a rua usa o
    // mesmo `tentarAtirar` da guarnição — com a mesma cadeia de reação e mira.
    tentarAtirar(pol,agora,deOlho&&policia.procurado>0,andandoRua);
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
// ===== GANCHOS DO BAR E DA BIQUEIRA =====
// Ficam aqui porque saúde e procurado moram aqui, e Economy não pode importar o estado interno da
// polícia sem fechar ciclo (Police já importa `inventario` de Economy).
// Beber no bar recupera vida: é a única cura instantânea do jogo — a regeneração normal só corre em
// patrulha (ver o fim de `atualizarPolicia`), então quem apanha em perseguição não tem como sarar.
export function curarJogador(pontos){
  if(jogadorRendido||saudeJogador>=JOGADOR_HP_MAX)return false;
  // Sem argumento cura tudo (a dose do bar); com argumento cura o tanto pedido (comida e água do
  // Mercado). Um só caminho pra mexer na vida do jogador evita duas fontes de verdade pro mesmo HP.
  saudeJogador=Math.min(JOGADOR_HP_MAX,pontos?saudeJogador+pontos:JOGADOR_HP_MAX);
  atualizarHudSaude();return true;
}
export function jogadorPrecisaCurar(){return !jogadorRendido&&saudeJogador<JOGADOR_HP_MAX}
// Vender na biqueira é venda NA RUA, à vista de todo mundo: sobe uma estrela.
export function denunciarBoca(){somarProcurado(1);mostrarAviso('Venderam na tua cara. A polícia soube.',2600)}
// Entrega os ganchos pra Economy no momento em que este módulo é avaliado. É o sentido de
// dependência que já existia (Police -> Economy); o contrário fecharia ciclo e explodiria no TDZ
// da const `inventario`.
registrarGanchosPolicia({curar:curarJogador,precisaCurar:jogadorPrecisaCurar,denunciar:denunciarBoca});
// O save guarda o RESTO da ficha quente, em segundos — não um instante absoluto. `performance.now()`
// zera a cada carregamento da página, então gravar o prazo em tempo de máquina faria toda ficha
// salva vencer no instante em que o jogo reabre.
// A armadura equipada também é persistida: o colete do inventário é consumido ao vestir, então salvar
// apenas `inventario.colete` fazia o colete desaparecer ao sair e entrar novamente.
export function estadoPoliciaParaSave(){return{procurado:policia.procurado,fichaQuente:segundosDeFichaQuente(),armadura:armaduraJogador}}
export function aplicarEstadoPoliciaDoSave(s){
  try{
    const n=Math.floor(Number(s&&s.procurado));
    policia.procurado=Number.isFinite(n)?Math.min(PROCURADO_MAX,Math.max(0,n)):0;
    // SAVE ANTIGO ENTRA LIMPO. O booleano `jaFoiPreso` era PERMANENTE e não guardava quando a prisão
    // aconteceu — pode ter sido há três sessões. Convertê-lo numa ficha quente CHEIA (foi a primeira
    // versão desta migração) faz o jogador abrir o jogo e levar cinco minutos de perseguição por algo
    // que ele não fez nesta sessão e não tem como ver: é exatamente o "a polícia tá me seguindo sem eu
    // ter feito nada" de novo, só que agora vindo do carregamento.
    // Save novo traz o prazo restante e ele é respeitado; save velho começa do zero.
    const resto=Number(s&&s.fichaQuente);
    const restante=Number.isFinite(resto)?Math.max(0,Math.min(FICHA_QUENTE,resto)):0;
    const arm=Number(s&&s.armadura);
    armaduraJogador=Number.isFinite(arm)?Math.min(JOGADOR_ARMADURA_MAX,Math.max(0,Math.floor(arm))):0;
    vigiadoAte=performance.now()/1000+restante;
  }catch(e){policia.procurado=0;vigiadoAte=0}
}

export function atualizarPolicia(dt){
  const agora=performance.now()/1000;
  caminhosNesteQuadro=0;// zera o orçamento de A* deste quadro
  // Velocidade do jogador, usada pela pontaria: alvo correndo é mais difícil de acertar.
  atualizarCombate(dt);
  // Papéis da equipe. Reavaliados a cada ~5 s (o próprio distribuirPapeis segura o intervalo), e só
  // quando há alvo: distribuir função sem ninguém pra cercar é gasto por nada.
  if(policiais.length&&(policia.estado==='combate'||rastroValido(agora)))
    distribuirPapeis(policiais,agora,
      rastroValido(agora)?rastro.x:player.position.x,rastroValido(agora)?rastro.z:player.position.z);
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
  separarCorpos();
  // Um quadro de animação por policial VIVO. Morto não anima: ele está tombando por rotação do grupo,
  // e deixar o clipe de andar correndo por cima faria o corpo caído continuar dando passos.
  for(const pol of policiais)if(pol.vivo&&pol.corpo)atualizarCorpoPolicial(pol.corpo,dt,pol.velocidadeAndando||0);
  for(const pol of policiaisRua)if(pol.vivo&&pol.corpo)atualizarCorpoPolicial(pol.corpo,dt,pol.velocidadeAndando||0);

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
  // ===== POR QUE A POLÍCIA ESTÁ DE OLHO =====
  // "A polícia tá me seguindo sem eu ter feito nada" foi relatado três vezes, e nas três a resposta
  // teve que ser CAVADA no código, porque na tela não havia diferença nenhuma entre uma dupla que
  // passa de ronda e uma que veio atrás dele. Agora existe: quando a polícia tem razão, ela é dita, e
  // com o prazo. Quando este aviso está apagado, quem passou do lado estava de ronda — e isso é uma
  // informação tão útil quanto a outra.
  if(policia.procurado>0)atencaoEl.style.display='none';
  else{
    const seg=segundosDeFichaQuente();
    const motivo=levandoPacote()
      ?'🎒 Mochila à vista — a polícia repara'
      :(seg>0?`👁 Ficha quente · ${Math.floor(seg/60)}:${String(Math.floor(seg%60)).padStart(2,'0')}`:'');
    if(motivo!==atencaoCache){atencaoCache=motivo;atencaoEl.textContent=motivo;atencaoEl.style.display=motivo?'block':'none'}
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
