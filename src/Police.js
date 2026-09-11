// ===== POLÃCIA =====
// Dois motivos pra a polÃ­cia descer, e a mÃ¡quina de estados Ã© a mesma pros dois:
//   BATIDA  â€” o helicÃ³ptero avista uma muda FLORIDA em sobrevoo e vai confiscar A PLANTAÃ‡ÃƒO INTEIRA
//             em volta dela (`alvoPlantacao` â‰  null; `alvoPlanta` Ã© sÃ³ o pÃ© da vez dentro dela).
//   CAÃ‡ADA  â€” o jogador estÃ¡ com ficha suja (procurado > 0) e o alvo Ã© ELE (alvoPlanta = null,
//             entÃ£o nÃ£o hÃ¡ o que confiscar e o desfecho Ã© sempre o confronto).
// `pontoAlvo` Ã© o destino do helicÃ³ptero nos dois casos; quem os distingue Ã© `alvoPlanta`.
//
// A ficha desce SOZINHA, com o tempo em que ninguÃ©m te acha (ver "PROCURADO" mais abaixo). O
// esconderijo saiu do jogo; sumir agora Ã© sumir de verdade â€” sair da vista deles e ficar fora dela.
// Matar policial soma +1, e a ficha dimensiona a prÃ³xima guarniÃ§Ã£o (2 a 6) â€” abater todos Ã© o
// caminho mais rÃ¡pido pra trazer mais.
//
// A mÃ¡quina de estados Ã© EXPLÃCITA (tabela `ESTADOS` + funÃ§Ã£o `transitar`): antes eram seis `else if`
// com as transiÃ§Ãµes espalhadas por dentro dos corpos e nenhum ponto Ãºnico de entrada/saÃ­da â€” o que jÃ¡
// tinha custado uma chamada `encerrarEncontro(false)` numa funÃ§Ã£o sem parÃ¢metro e trÃªs cÃ³pias da rotina
// de limpeza do encontro.
//
//        muda florida em sobrevoo (BATIDA) âˆ¨ procurado > 0 (CAÃ‡ADA)
//     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”
//     â”‚ PATRULHA â”‚ â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ cooldown 22 s â”€â”€â”€â”              â”‚  INDO  â”‚
//     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                â”‚             â””â”€â”€â”€â”€â”€â”€â”€â”€â”˜
//                                            â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚ d(heli,pontoAlvo) < 3
//          todos abatidos âˆ¨ despistou 8 s    â”‚ RECUANDO â”‚            â–¼
//          âˆ¨ jogador rendido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–ºâ””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
//                                                 â–²             â”‚ PAIRANDO â”‚ (t = 1,2 s)
//                            â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤             â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
//                            â”‚                    â”‚                  â”‚
//                            â”‚                    â”‚                  â–¼
//                            â”‚                    â”‚              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”
//                            â”‚                    â”‚              â”‚ RAPEL  â”‚ (t = 1,5 s Â· 2 a 6 policiais)
//                            â”‚                    â”‚              â””â”€â”€â”€â”€â”€â”€â”€â”€â”˜
//                            â”‚                    â”‚                  â”‚ caÃ§ada â†’ sempre COMBATE
//                       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”   o jogador se aproxima   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
//                       â”‚ COMBATE â”‚ â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  â”‚ CONFISCANDO  â”‚ (t = 9 s â†’ confisca)
//                       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                            â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
import*as THREE from'three';
import{scene,camera}from'./core.js';
import{obterElevacao,alturaDoChaoDesenhado}from'./Terrain.js';
import{primeiroImpactoNoSegmento,intersectarSegmentoCaixa,buscarPosicaoLivre}from'./Physics.js';
import{encontrarCaminho,visaoHorizontalLivre,pontoNavegavel}from'./NavMesh.js';
import{player,zonasDeAcertoJogador,PLAYER_HEIGHT,encararDirecao,definirAnimacaoTiro}from'./Player.js';
import{ORDEM_ARMAS,armaEquipada,idArmaEquipada,equiparArma,obterBocaDaArma,direcaoComDispersao,definirArmaEmpunhada,aplicarRecuoArma}from'./Weapons.js';
import{colidePedestre,waypointsVielas}from'./NPCs.js';
import{vestirPolicial,despirPolicial,atualizarCorpoPolicial}from'./PersonagemPolicial.js';
import{ALT_TORSO,ALT_OLHO,ALT_CANO,atualizarCombate,espalhamentoDoTiro,tempoDeReacao,
  distribuirPapeis,destinoDoPapel,procurarCobertura,PAPEL,velJogador,LEAD_FATOR,LEAD_RUIDO}from'./Combate.js';
import{POLOS}from'./Poles.js';
import{plantas,confiscarPlanta,aplicarMulta,obterDinheiro,inventario,atualizarStatusEconomia,isInventarioAberto,registrarGanchosPolicia}from'./Economy.js';
import{dispararBala,atualizarBalas,limparBalas,VELOCIDADE_BALA}from'./Bullets.js';
import{aplicarDano,renderizarVidaJogador,criarBarraMundo}from'./HealthBar.js';
import{definirColeteVisivel}from'./Player.js';
import{droneState,miraState}from'./Camera.js';
import{crimeAtivo,alertarDisparoProximo,alertarColisaoPolicial,alertarEntregaIlegal,definirArmaVisivel}from'./CrimeTriggers.js';
import{pontoDeEntregaAtual}from'./DeliveryPoints.js';
// `montarPistola` Ã© a receita da pistola do JOGADOR, usada tal e qual pela polÃ­cia â€” ver
// `construirArmaPolicial` mais abaixo.
import{hasWeaponEquipped,montarPistola}from'./Weapons.js';
import{tocarSomEquiparColete,tocarSomTiro,tocarSomSemMunicao}from'./Audio.js';
import{adicionarTremorCamera}from'./Camera.js';
import{obterPontoNascimento,registrarCuraHospital}from'./Hospital.js';
import{jogadorEmVeiculo}from'./Veiculo.js';


// O terreno mede 260x260 (aprox. -130 a 130). O limite antigo de 95 deixava uma faixa grande sem patrulha.
const HELI_ALTURA=38,HELI_VELOCIDADE=14,MAPA_LIMITE=124;
const SALDO_RESPAWN=300;
// Raio de detecÃ§Ã£o dimensionado pra funcionar em SOBREVOO, agora que o heli nÃ£o vai mais direto na
// coordenada da muda: mapa de 190x190 = 36.100 mÂ², heli a 12 m/s, faixa varrida = 2R x v.
//   R=10 â†’  240 mÂ²/s â†’ mapa inteiro em 150 s â†’ na prÃ¡tica a polÃ­cia nunca achava nada
//   R=20 â†’  480 mÂ²/s â†’ mapa inteiro em  75 s â†’ com o viÃ©s de patrulha abaixo, ~15-40 s pÃ³s-floraÃ§Ã£o
const DETECCAO_RAIO=20,APROX_RAIO=3;
// SÃ³ a muda FLORIDA Ã© vista do alto. Broto e vegetativa parecem qualquer mato de 38 m de altura â€” e
// sem esse filtro a muda era confiscada por volta de t=19 s sendo que sÃ³ fica colhÃ­vel em t=44 s, ou
// seja, o ciclo econÃ´mico do jogo era impossÃ­vel de completar.
const PLANTA_DETECTAVEL_ESTAGIO=2;
// ViÃ©s de patrulha: fraÃ§Ã£o dos waypoints sorteados DENTRO de um disco em volta de uma muda madura.
// Ã‰ o que substitui a antiga "caÃ§a ativa" â€” a polÃ­cia bate a regiÃ£o, em vez de ir na coordenada.
const PATRULHA_VIES=.55,PATRULHA_RAIO_VIES=30;
const POLICIAL_HP=100,POLICIAL_VELOCIDADE=2,POLICIAL_ALCANCE_TIRO=13;
export const stoppingDistance=3.0;
const POLICIAL_DANO_MIN=6,POLICIAL_DANO_MAX=11,POLICIAL_COOLDOWN_MIN=1.1,POLICIAL_COOLDOWN_MAX=2.1;
// ===== PROCURADO =====
//   Â· matar policial              â†’ +1
//   Â· a abordagem avanÃ§ar         â†’ piso de 1 (indo), 2 (confisco) e 3 (combate)
//   Â· ninguÃ©m te vÃª por 8 s       â†’ a guarniÃ§Ã£o em campo perde o rastro e recua
//   Â· e a cada 10 s depois disso  â†’ âˆ’1 estrela
//   Â· voltou a aparecer           â†’ os dois relÃ³gios zeram e a caÃ§ada recomeÃ§a
const PROCURADO_MAX=5;
// ===== A FICHA CAI COM O TEMPO SEM SEREM TE ACHAR =====
// Isto substituiu o ESCONDERIJO inteiro, a pedido dele: "tira esconderijos, vai ser sÃ³ procurando
// mesmo, passou um tempo nÃ£o achou vai sumindo as estrelas".
//
// A regra velha era entrar numa casa e fechar a porta; a ficha sÃ³ descia lÃ¡ dentro, e fora dela nada
// limpava. Isso tinha uma consequÃªncia que ele sentiu antes de nomear: a fuga nÃ£o era fuga, era ir
// atÃ© um endereÃ§o. Agora o que conta Ã© o que o jogo jÃ¡ sabe medir â€” SE ALGUÃ‰M ESTÃ TE VENDO. Nenhum
// policial vivo com `viu` ligado, e o relÃ³gio anda; qualquer um te enxergando, ele zera.
//
// Os nÃºmeros: 8 s pra eles perderem o rastro e 10 s por estrela DEPOIS disso. Ficha 5 custa 58 s de
// nÃ£o aparecer â€” mais que os 25 s do esconderijo, e tem que ser mesmo: lÃ¡ o jogador ficava trancado
// sem poder fazer nada, aqui ele estÃ¡ correndo pelo morro, que Ã© jogo. E os 8 s iniciais sÃ£o o que
// impede a estrela de cair no primeiro beco: eles ainda vÃªm no seu rumo enquanto isso.
const SEM_VER_PARA_SUMIR=8,SEM_VER_POR_NIVEL=10,CACA_ATRASO=4;
// ===== O HELICÃ“PTERO NUNCA VEM ATRÃS DO JOGADOR =====
// Ele era o motor do encontro inteiro: caÃ§ava o jogador com ficha suja, pairava em cima dele e descia
// guarniÃ§Ã£o de rÃ¡pel. Isso saiu INTEIRO, a pedido â€” "nÃ£o quero mais eles caindo do aviÃ£o, o aviÃ£o sÃ³
// vai ser pra localizamento".
//
// O que sobrou Ã© o que ele faz bem: ele Ã© o OLHO. Voa alto, acha plantaÃ§Ã£o madura por sobrevoo e
// avisa pelo rÃ¡dio. Quem vem Ã© a polÃ­cia de pÃ©, saindo da delegacia e ANDANDO atÃ© lÃ¡ â€” e essa
// caminhada Ã© jogo: dÃ¡ tempo de correr e colher antes de eles chegarem.
// `obterElevacao(x,z)` fornece o chÃ£o mesmo nos morros; a margem mantÃ©m os esquis acima do relevo.
const HELI_ALTURA_RONDA=52,HELI_ALTURA_APONTANDO=30,HELI_ALTURA_POUSO=2.4;
const DESEMBARQUE_QTD=2,DESEMBARQUE_INTERVALO=.65;
// Quanto ele demora pra revidar depois de LEVAR um tiro. Curto, porque nÃ£o precisa procurar o
// atirador â€” a bala jÃ¡ disse de onde veio. Mas nÃ£o zero: revide no mesmo quadro do tiro tira do
// jogador a chance de acertar e correr, que Ã© a jogada.
const REACAO_LEVOU_TIRO=.35;
// ===== VISÃƒO (cone + linha de visÃ£o) =====
// Meia-abertura do cone em radianos: 0,95 rad â‰ˆ 54Â°, cone total â‰ˆ 109Â° â€” perto do campo Ãºtil humano.
// Sobe 0,07 rad por estrela (na ficha 5 vai a 1,30 rad â‰ˆ 74Â°, cone de ~149Â°): com ficha alta eles estÃ£o
// alertas, olhando pros lados, e Ã© muito mais difÃ­cil passar de raspÃ£o.
const CONE_MEIA_BASE=.95,CONE_MEIA_POR_ESTRELA=.07;
const VISAO_ALCANCE_BASE=18,VISAO_ALCANCE_POR_ESTRELA=1.8;
// ===== CUSTO POR FRAME DO SISTEMA DE VISÃƒO =====
// Cada policial sÃ³ reavalia a visÃ£o a cada VISAO_INTERVALO, com a fase defasada por Ã­ndice (iÂ·0,07 s)
// pra os testes se espalharem pelos frames em vez de estourarem todos juntos. Teto real de policiais em
// campo = 6 (guarniÃ§Ã£o) + 4 (2 duplas de rua) = 10.
//   10 policiais Ã· 0,3 s Ã· 60 fps â‰ˆ 0,55 avaliaÃ§Ã£o de visÃ£o por frame.
// E avaliaÃ§Ã£o â‰  raycast: distÃ¢ncia e Ã¢ngulo sÃ£o testes aritmÃ©ticos que descartam a maioria dos casos
// ANTES do raycast â€” sÃ³ quem jÃ¡ estÃ¡ dentro do cone e no alcance chega a chamar
// primeiroImpactoNoSegmento. Pior caso absoluto (todos dentro do cone o tempo todo): ~0,55 raycast por
// frame, contra os 10/frame que uma checagem ingÃªnua custaria. Some-se 1 raycast/frame do
// resolverPontoVisado do jogador e ~1 por bala em voo, que jÃ¡ existiam.
const VISAO_INTERVALO=.3,VISAO_DEFASAGEM=.07;
// Quanto tempo a Ãºltima posiÃ§Ã£o avistada continua valendo como destino depois que o jogador some.
// Curto demais e eles desistem na primeira quina; longo demais e viram teleguiados.
const MEMORIA_ALVO=9;
// ===== BUSCA: o estado que faltava =====
// Antes existiam sÃ³ dois modos: ou o policial via o jogador, ou (passados os 9 s de rastro) voltava a
// sortear um ponto no mapa INTEIRO. NÃ£o havia "procurando" â€” ou estavam em cima de vocÃª, ou andavam Ã 
// toa, e um policial que acabava de te perder podia sair andando pro outro lado da favela.
// Agora, quando o rastro quente esfria, comeÃ§a a BUSCA: cada um vasculha em volta do Ãºltimo ponto
// conhecido, num raio que CRESCE com o tempo, atÃ© desistir.
const BUSCA_DURACAO=26,BUSCA_RAIO_INICIAL=4,BUSCA_RAIO_FINAL=22;
// Ã‚ngulo de ouro. Dando a cada policial um setor separado por 137,5Â°, qualquer nÃºmero deles se
// espalha em volta do ponto sem ninguÃ©m precisar coordenar nada â€” e Ã© o que faz a dupla ABRIR em vez
// de andar em fila indiana atrÃ¡s do mesmo destino, que Ã© o que mais denunciava o bot.
const SETOR_OURO=2.399963229728653;
// Deriva angular ao longo da busca: sem ela cada um anda em linha reta pra fora do seu setor. Com
// ela o caminho vira espiral, que Ã© o que lÃª como varredura.
const BUSCA_DERIVA=1.1;
// Raios tentados ao longo do setor, em fraÃ§Ã£o do raio da vez. SÃ£o buscas em grade (~1 Âµs cada), nÃ£o
// raycast: sai caro zero e Ã© o que mantÃ©m cada policial no rumo dele mesmo em quarteirÃ£o fechado.
const BUSCA_ESCALAS=[1,.75,1.25,.5,1.5,.3];
// Desvios de Ã¢ngulo tentados em volta do setor, em radianos (0, Â±23Â°, Â±46Â°).
const BUSCA_DESVIOS=[0,.4,-.4,.8,-.8];
// ===== A POLÃCIA MORA NO MAPA =====
// Isto aqui substitui um sistema inteiro, e vale registrar o que ele fazia: policiais nasciam em
// DUPLAS materializadas a 20 m do jogador, a cada 70-140 s, viviam 75 s e eram apagados da cena.
// Tinha atÃ© uma peneira elaborada pra escolher onde materializar (longe, ou com parede no meio, e
// nunca tapando a rota pro esconderijo). Nada disso resolvia o problema de fundo, que o Bruno disse
// em uma frase: "eu tÃ´ andando, do nada aparece dois policial atrÃ¡s de mim". Peneira nenhuma conserta
// aparecer do nada â€” o que conserta Ã© NÃƒO APARECER.
//
// Agora o efetivo Ã© PERMANENTE e tem endereÃ§o. Quatro policiais patrulham a favela o tempo todo, e
// todo policial que entra em campo sai pela porta da delegacia (POLOS.delegacia) e vai ANDANDO. O
// jogador vÃª chegar. E porque a base estÃ¡ no radar, ele pode desviar dela â€” saber onde eles moram Ã©
// o que torna uma patrulha permanente justa em vez de sufocante.
//
// O TETO DE 8 Ã‰ DE CELULAR: cada policial Ã© malha com esqueleto (24 ossos) e mixer prÃ³prio. Oito Ã© o
// dobro do efetivo normal e foi o nÃºmero que ele escolheu; subir disso pede mediÃ§Ã£o, nÃ£o opiniÃ£o.
// Dupla de ronda e teto de quatro em crise. Seis esqueletos, IA e rotas ao mesmo tempo causavam
// a queda brusca relatada justamente quando a perseguiÃ§Ã£o comeÃ§ava.
const EFETIVO_BASE=2,POLICIAIS_MAX=4;
// Teto TOTAL em campo por intensidade. NÃ­vel zero Ã© ronda normal; batida/abordagem tÃªm teto prÃ³prio
// em `tetoDoNivel`. Assim a favela continua viva sem virar uma enxurrada de fardados.
const LIMITE_POR_NIVEL=[2,3,3,4,4,4];
// Espera entre um reforÃ§o e o seguinte saindo da porta, e quanto tempo de paz zera a conta de baixas.
const REPOSICAO_ESPERA=18,CALMARIA=25;
const RUA_VELOCIDADE=1.7,RUA_CHEGADA=1.6,RUA_VASCULHAR_RAIO=3.2;
// Quanto tempo o corpo fica no chÃ£o antes de sumir.
const CORPO_DURACAO=2.5;
// ===== A ESCADA DA SUSPEITA =====
// Ver o jogador com a mochila NÃƒO Ã© mais motivo de ficha. Ã‰ motivo de ABORDAGEM: aparece o aviso, o
// prazo comeÃ§a a correr e eles vÃªm no rumo dele. Se ele sumir da vista, o prazo para e eles procuram
// por um tempo antes de voltar Ã  ronda â€” sem estrela nenhuma. Se ele ficar parado atÃ© o prazo acabar,
// aÃ­ sim vira procurado. Ã‰ literalmente o pedido: "se eles me ver com pasta vai aparecer um aviso e
// eles vem no meu rumo; aÃ­ se eu nÃ£o correr, ficar parado, aÃ­ sim eu vou dar como procurado".
const PRAZO_ABORDAGEM=5,BUSCA_ABORDAGEM=10;
// Agressividade por estrela: velocidade e cadÃªncia. A distÃ¢ncia de parada mora em `stoppingDistance`
// e em DIST_PAPEL (Combate.js) â€” a terceira constante daqui alimentava `aproxMinima()`, que ninguÃ©m
// chamava desde que os papÃ©is passaram a decidir isso.
const AGRESSAO_VEL_POR_ESTRELA=.16,AGRESSAO_CADENCIA_POR_ESTRELA=.11;
const JOGADOR_HP_MAX=100,JOGADOR_ARMADURA_MAX=100,JOGADOR_REGEN=3;
// CadÃªncia/dano/alcance agora vÃªm da ficha da arma equipada (Weapons.js). Sobrou sÃ³ o custo da troca:
// o cooldown Ã© global (proximoTiroJogador), entÃ£o sem ele dava pra escopetaâ†’pistolaâ†’escopeta pra
// cancelar os 0,85 s de recarga.
const TEMPO_TROCA=.35;
// Quanto tempo a polÃ­cia leva confiscando, JÃ EM CIMA da planta. Antes o relÃ³gio corria a partir do
// momento em que o helicÃ³ptero pousava a guarniÃ§Ã£o do lado; agora eles ainda precisam ATRAVESSAR a
// favela a pÃ©, e essa caminhada Ã© a chance real de chegar antes e colher.
const CONFISCO_DURACAO=9;
const COOLDOWN_ENTRE_BUSCAS=22,PENALIDADE_MORTE=.25;
// ===== O HELICÃ“PTERO PASSA A ENXERGAR PLANTAÃ‡ÃƒO, E NÃƒO PÃ‰ =====
// Como era: ele achava UMA muda, pousava, largava dois policiais, e a batida terminava no instante em
// que AQUELE pÃ© saÃ­a do chÃ£o. Com 30 pÃ©s no mesmo canteiro isso virava 30 batidas â€” o Bruno colhia
// um, o heli ia embora, achava o pÃ© do lado, voltava e largava mais dois. "Ele nÃ£o entende que ali Ã©
// uma plantaÃ§Ã£o."
// Como fica: ao avistar um pÃ©, ele recolhe TODOS os pÃ©s floridos num raio em volta â€” isso Ã© a
// plantaÃ§Ã£o â€” e a batida Ã© uma sÃ³, contra o conjunto. Ela acaba quando nÃ£o sobra pÃ© nenhum ali, seja
// porque a polÃ­cia confiscou, seja porque o jogador colheu tudo debaixo do nariz deles.
// E o lugar fica MARCADO por um tempo: mesmo que brote coisa nova ali, o heli nÃ£o vai bater de novo
// no minuto seguinte, que Ã© o que fazia a sensaÃ§Ã£o de perseguiÃ§Ã£o ao canteiro.
const RAIO_PLANTACAO=22;        // o que conta como "o mesmo canteiro"
const COOLDOWN_PLANTACAO=120;   // segundos atÃ© a mesma plantaÃ§Ã£o poder ser batida de novo
const SPAWN_X=0,SPAWN_Z=8;
// PerseguiÃ§Ã£o: intervalo de recÃ¡lculo do caminho e distÃ¢ncia que o alvo precisa andar pra invalidar a rota.
const REPLANEJAR_INTERVALO=.7,REPLANEJAR_DESVIO=3,CHEGADA_WAYPOINT=.7;
// ===== QUANDO ELE ESTÃ BARRADO =====
// `travado` conta quadros seguidos em que o passo nÃ£o saiu do lugar. A 30-60 fps, 5 quadros sÃ£o
// 0,08-0,16 s â€” rÃ¡pido o bastante pra nÃ£o virar cena de policial socando parede, e longo o bastante
// pra nÃ£o disparar num esbarrÃ£o de um quadro sÃ³.
// O replanejamento de quem estÃ¡ preso tem portÃ£o PRÃ“PRIO e curto (0,25 s contra 0,7 s): o portÃ£o
// longo era o que prendia o policial encravado, mas tirar o portÃ£o traria de volta a torneira de A*
// por quadro. Curto resolve os dois.
const TRAVADO_PARA_REPLANEJAR=5,TRAVADO_PARA_CONTORNAR=10,REPLANEJAR_PRESO=.25,CONTORNO_PASSO=2.5;
// 60 quadros (1-2 s) [jÇºã
âµç«®ŠÁ®‰˜©z–ç6—7F–æFò6VÒ6—"FòÇVv#¢G&ö6òFW7F–æòFR&öæFâ8’òFWFòFRVÇVW ¢òòG&f(	BæVæ‡VÖöFRGW&"Ö—2VR—76òà¦6öç7BE$dDõõ$ôDU4•5D•#Óc°¢òòg&:|:6òFò76òVF–Fò&—†òFVÂòVG&ò6öçF6öÖòG&fFò‡fW"76õöÆ–6–Â’à¦6öç7Be$4õôDUõ54õõE$dDóÒã3S°¢òòõ,8tÔTåDòDR¢õ"TE$òâVÒ6Ö–æ†ò7W7FSƒR+W3²Fö—2öÆ–6–—2&WÆæV¦æFòæòÖW6Öğ¢òòVG&òL:6òÃ"×2FRVÖfW¢ÂVRçVÒ6VÇVÆ":’VÒ6öÇ\:vòf—<:×fVÂâ6öÒFWFòFR÷"VG&òÀ¢òòVVÒf–6÷RFRf÷&W6&÷FfVÆ††÷R&WFÂVRÇfôFTÖ÷f–ÖVçFö¬:FWföÇfR6öÖò&W6W'f¢òò÷"Ö—2VÒVG&ò(	Bb×2FRG&6òVRæ–æw\:–ÒW&6V&RÂ6öçG&VÒVæv6vòVR6Rl:¢à¦6öç7Bõ$4ÔTåDõôôU5E$TÄÓ°¦ÆWB6Ö–æ†÷4æW7FUVG&óÓ° ¢òòÓÓÓÓÒ†VÆ–<;7FW&ó¢gW6VÆvVÒVÒ<:7VÆÂ6VF6öÒ&÷F÷"Â&÷F÷"&–æ6—Âv—&æFòÂÇW¦W2FRÆW'F—66æFòà¦6öç7B†VÆ”ÖCÖæWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#£ƒ&#6&RÇ&÷Vv†æW73¢ãSRÆÖWFÆæW73¢ã3WÒ“°¦6öç7B†VÆ•f–G&óÖæWrD…$TRäÖW6…‡—6–6ÄÖFW&–Â‡¶6öÆ÷#£ƒ&332Ç&÷Vv†æW73¢ãRÆÖWFÆæW73¢ã"Æ6ÆV&6öC¢ãbÆVÖ—76—fS£ƒ&332ÆVÖ—76—fT–çFVç6—G“¢ãWÒ“°¦6öç7B&÷F÷$ÖCÖæWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#£ƒ332Ç&÷Vv†æW73¢ãbÆÖWFÆæW73¢ãGÒ“°¦6öç7BÆ×fW&ÖVÆ†ÖæWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#£†fc&&ÆVÖ—76—fS£†fc&&ÆVÖ—76—fT–çFVç6—G“£ãgÒ“°¦6öç7BÆ×§VÃÖæWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#£ƒ&f&fbÆVÖ—76—fS£ƒ&f&fbÆVÖ—76—fT–çFVç6—G“£ãgÒ“°¦gVæ7F–öâ&Æö6ô†VÆ’†vVòÆÖBÇ‚Ç’Ç¢Ç&VçB—¶6öç7BÓÖæWrD…$TRäÖW6‚†vVòÆÖB“¶Òç÷6—F–öâç6WB‡‚Ç’Ç¢“¶Òæ67E6†F÷s×G'VS·&VçBæFB†Ò“·&WGW&â×Ğ ¦6öç7B†VÆ“ÖæWrD…$TRäw&÷W‚“·66VæRæFB††VÆ’“°¦6öç7BgW6VÆvVÓÖ&Æö6ô†VÆ’†æWrD…$TRä67VÆTvVöÖWG'’‚ãƒRÃ"ãÃBÃ‚’Æ†VÆ”ÖBÃÃÃÆ†VÆ’“¶gW6VÆvVÒç&÷FF–öâçƒÔÖF‚å’ó#°¦&Æö6ô†VÆ’†æWrD…$TRå7†W&TvVöÖWG'’‚ãc‚ÃÃ‚’Æ†VÆ•f–G&òÃÂÒãÃãRÆ†VÆ’“°¦6öç7B6VF&ööÓÖ&Æö6ô†VÆ’†æWrD…$TRä7–Æ–æFW$vVöÖWG'’‚ãBÂã#"Ã"ãbÃb’Æ†VÆ”ÖBÃÂãRÂÓ"ã3RÆ†VÆ’“¶6VF&ööÒç&÷FF–öâçƒÔÖF‚å’ó#°¦6öç7B&÷F÷$6VFÖæWrD…$TRäw&÷W‚“·&÷F÷$6VFç÷6—F–öâç6WB‚ã#‚Âã3RÂÓ2ãSR“¶†VÆ’æFB‡&÷F÷$6VF“°¦&Æö6ô†VÆ’†æWrD…$TRä&÷„vVöÖWG'’‚ãBÃÂã’Ç&÷F÷$ÖBÃÃÃÇ&÷F÷$6VF“¶&Æö6ô†VÆ’†æWrD…$TRä&÷„vVöÖWG'’‚ãBÃÂã’Ç&÷F÷$ÖBÃÃÃÇ&÷F÷$6VF’ç&÷FF–öâç£ÔÖF‚å’ó#°¦6öç7BÖ7G&óÖ&Æö6ô†VÆ’†æWrD…$TRä7–Æ–æFW$vVöÖWG'’‚ã‚ÂãÂã3RÃb’Ç&÷F÷$ÖBÃÂã“RÃÆ†VÆ’“°¦6öç7B&÷F÷%&–æ6—ÃÖæWrD…$TRäw&÷W‚“·&÷F÷%&–æ6—Âç÷6—F–öâç6WBƒÃãRÃ“¶†VÆ’æFB‡&÷F÷%&–æ6—Â“°¦f÷"†6öç7Bæröe³ÄÖF‚å’ó%Ò—¶6öç7BÖ&Æö6ô†VÆ’†æWrD…$TRä&÷„vVöÖWG'’ƒRã"ÂãRÂã#"’Ç&÷F÷$ÖBÃÃÃÇ&÷F÷%&–æ6—Â“·ç&÷FF–öâç“ÖæwĞ¦f÷"†6öç7B‡‚öe²ÒãSRÂãSUÒ–&Æö6ô†VÆ’†æWrD…$TRä7–Æ–æFW$vVöÖWG'’‚ãRÂãbÂã’Ãb’Æ†VÆ”ÖBÇ‡‚ÂÒãƒRÂãRÆ†VÆ’’ç&÷FF–öâç£ÒãR¤ÖF‚ç6–vâ‚×‡‚“°¦6öç7BÇW¤&'&ÖæWrD…$TRäw&÷W‚“¶ÇW¤&'&ç÷6—F–öâç6WBƒÂãc"Ã“¶†VÆ’æFB†ÇW¤&'&“°¦6öç7BÇW¥cÖ&Æö6ô†VÆ’†æWrD…$TRä&÷„vVöÖWG'’‚ã#"ÂãÂã#"’ÆÆ×fW&ÖVÆ†ÂÒã2ÃÃÆÇW¤&'&“°¦6öç7BÇW¤Ö&Æö6ô†VÆ’†æWrD…$TRä&÷„vVöÖWG'’‚ã#"ÂãÂã#"’ÆÆ×§VÂÂã2ÃÃÆÇW¤&'&“°¦6öç7B†öÆöf÷FU7÷CÖæWrD…$TRå7÷DÆ–v‡Bƒ†ffc&3‚Ã2ã"ÃcÄÖF‚å’¢ãÂãCRÃãB“¶†öÆöf÷FU7÷Bæ67E6†F÷sÖfÇ6S¶†VÆ’æFB††öÆöf÷FU7÷B“°¦6öç7B†öÆöf÷FTÇfóÖæWrD…$TRäö&¦V7C4B‚“·66VæRæFB††öÆöf÷FTÇfò“¶†öÆöf÷FU7÷BçF&vWCÖ†öÆöf÷FTÇfó°¦6öç7BfV—†TÖCÖæWrD…$TRäÖW6„&6–4ÖFW&–Â‡¶6öÆ÷#£†ffc&3‚ÇG&ç7&VçC§G'VRÆ÷6—G“¢ãÆFWF…w&—FS¦fÇ6RÇ6–FS¥D…$TRäF÷V&ÆU6–FWÒ“°¦6öç7BfV—†SÖæWrD…$TRäÖW6‚†æWrD…$TRä6öæTvVöÖWG'’ƒÃÃbÃÇG'VR’ÆfV—†TÖB“¶fV—†Rç&VæFW$÷&FW#Ó·66VæRæFB†fV—†R“°¦†VÆ’ç÷6—F–öâç6WBƒÄ„TÄ•ôÅEU$Ã“°¦ÆWB†VÆ”Çfó×·ƒ¢„ÖF‚ç&æFöÒ‚’£"Ó’¤ÔôÄ”Ô•DRÇ£¢„ÖF‚ç&æFöÒ‚’£"Ó’¤ÔôÄ”Ô•DWÓ° ¢òòÓÓÓÓÒöÆ–6–—3¢ÖW6ÖL:–6æ–6FR&Æö6òFòå26ö×VÒÂVæ–f÷&ÖRW67W&ò²&öì:’²&&Ö"æÜ:6òà¦6öç7B6¶–åöÆ–6–ÃÕ³†3s“crÃƒ†V62Ã†S#ƒ‚Ãƒf#F3Ó°¦6öç7BVæ–f÷&ÖTÖCÖæWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#£ƒ#3&36BÇ&÷Vv†æW73¢ãwÒ’À¢6öÆWFTÖCÖæWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#£ƒCƒbÇ&÷Vv†æW73¢ãsWÒ’À¢&öæTÖCÖæWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#£ƒCƒbÇ&÷Vv†æW73¢ã‡Ò’À¢òò†ò&ÖÖFFV’6—R§VçFò6öÒ&ÖfVÆ†¢—7FöÆæ÷fW6÷2ÖFW&–—2FòvVöç2æ§2À¢òò÷2ÔU4Ôõ2Fò¦övF÷"(	BÖFW&–Â,;7&–òW&Ö—2VÒ¦V—FòFR2GV2&Ö2F—fW&v—&VÒ¢òòÖW6ÖòFöÒFò&÷7FòFòÖ÷&F÷"„å72æ§2’ÂFR&÷;76—Fó¢÷2Fö—2<:6òvVçFRFòÖW6Öò×VæFòà¢&÷7FôÖCÖæWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#£ƒss"Ç&÷Vv†æW73¢ã‡Ò“°¦gVæ7F–öâ&Æö6õ†vVòÆÖBÇ‚Ç’Ç¢Ç&VçB—¶6öç7BÓÖæWrD…$TRäÖW6‚†vVòÆÖB“¶Òç÷6—F–öâç6WB‡‚Ç’Ç¢“¶Òæ67E6†F÷s×G'VS¶Òç&V6V—fU6†F÷s×G'VS·&VçBæFB†Ò“·&WGW&â×Ğ¢òòÓÓÓÓÒ$ÔDôÌ8Ô4”8’$ÔDò¤ôtDõ"ÓÓÓÓĞ¢òòFV’fö’tDR&VfV—FFò¦W&òÂVF–Fó¢'<;2f2v"2&Ö2FVÆW2R7&–"VÖæ÷fFğ¢òò¦W&ò6öÒF—&\:|:6ò–wVÂFòÖWR¦övF÷""à¢òğ¢òòçF–vW&VÖ6VwVæF—7FöÆW67&—F:Ü:6òÂR6ö×&:|:6òÆFòÆFòW‡Æ–6VV—†¢6÷'ğ¢òòFRB6Ò6öçG&÷2FFò¦övF÷"Â6æòæ66VæFòVÒ£Òã3’6öçG&ã3"ÂV×Væ†GW&VÒ£Òã6öçG&¢òòÒãBÂRòVæ†òçVÒÖFW&–ÂFR6öÆWFRVÒfW¢FRÖFV—&â&V6–FÂçVæ6–wVÂ(	BR'&V6–F":’ğ¢òòVR&öGW¢VVÆRVfV—FòFR&ÖW'&FR6ö'&W÷7Fà¢òğ¢òòv÷&VÆ6’FRÖöçF%—7FöÆÂÔU4ÔgVì:|:6òVRÖöçFFò¦övF÷"…vVöç2æ§2’âì:6òŒ:¢òòÖVF–F,;7&–&§W7F"ÂæVÒ&Æw\:–ÒÖW†W"çVÒÆFòRW7VV6W"ò÷WG&òâ÷&–VçF:|:6òfVÒFP¢òòw&:v§VçFó¢&V6V—Fæ66RöçFæFò&µ¢æ÷&–vVÒF:&æ6÷&ÂRòW'6öævVÕöÆ–6–Âæ§6 ¢òò6÷–:&æ6÷&Fò¦övF÷"–çFV—&(	BÖW6Ö&V6V—FÂÖW6Ö:&æ6÷&ÂÖW6Ö&Öà¦gVæ7F–öâ6öç7G'V—$&ÖöÆ–6–Â‚—°¢6öç7BsÖÖöçF%—7FöÆ†æWrD…$TRäw&÷W‚’“°¢rææÖSÒw—7FöÆöÆ–6–Âs°¢&WGW&âs°§Ğ ¢òòÖÆ†7'VFòöÆ–6–ÂÖVFRÃs‚æW7FW66Æ(	BF—f–F–æFò÷"Ä”U%ô„T”t…BL:W66ÆVP¢òòFV—†òöÆ–6–ÂW†FÖVçFRFòÖW6ÖòFÖæ†òFòW'6öævVÒ&–æ6—Âà¦6öç7BU44ÄõôÄ”4”ÃÕÄ”U%ô„T”t…Bóãsƒ° ¢òòÓÓÓÓÒ¤ôä2DR4U%DòDòôÄ”4”ÂÓÓÓÓĞ¢òòÖW6Ö2g&:|;VW2Fò6÷'ò7'R†6&\:vÃ>(	3Ãs‚+rG&öæ6òÃc.(	3Ã2+rW&æ2(	3Ãc"’ÂW66ÆF2÷ ¢òòU44ÄõôÄ”4”Â&&FW"6öÒòöÆ–6–ÂFòFÖæ†òFò¦övF÷"ƒÃ’Ò’à¦6öç7B¤ôä5õôÄ”4”ÃÕ°¢¶æöÖS¢v6&V6rÆFS¢ãcSrÆFS¢ã’ÆÖV–¢ã3Æ×VÇF—Æ–6F÷#£'ÒÀ¢¶æöÖS¢wG&öæ6òrÆFS¢ã32ÆFS¢ãcSrÆÖV–¢ãs"Æ×VÇF—Æ–6F÷#£ÒÀ¢¶æöÖS¢wW&æ2rÆFS£ÆFS¢ã32ÆÖV–¢ãÆ×VÇF—Æ–6F÷#¢ãgÒÀ¥Ó° ¢òòÓÓÓÓÒtTôÔUE$”2RÔDU$”•24ôÕ%D”Ä„Dõ2ÓÓÓÓĞ¢òòöÆ–6–Âæ66RRÖ÷'&RòFV×òFöFó¢GWÆ2FR'V6öÒsR2FRf–F;§F–ÂÂwV&æœ:|;VW2FR&VÂ6F¢òòVæ6öçG&òâ6FVÒ7&–f’&÷„vVöÖWG'’RVÒÖW6…7FæF&DÖFW&–Âäõdõ2ÂR&VÖü:|:6ò<;2F—&fF¢òò6Væ(	B6VÒF—7÷6VÂ6F6–6ÆòFV—†f2’vVöÖWG&–2æÖVÜ;7&–FRl:ÖFVò&6V×&RâÖVF–FòçVĞ¢òò¦övò&Fó¢³RvVöÖWG&–2FWö—2FRVÖ;¦æ–6GWÆæ66W"R—"VÖ&÷&à¢òò6ö×'F–Æ†"&W6öÇfRÖVÆ†÷"VRFW66'F#¢2f÷&Ö2<:6òFöF2–wV—2ÂVçL:6ò<:6ò7&–F2TÔfW¢P¢òò&WW6F2÷"FöFò×VæFòâ2B6÷&W2FRVÆRf—&ÒBÖFW&–—2f—†÷2VÒfW¢FRVÒ÷"öÆ–6–Âà¦6öç7BtTõõôÃ×°¢G&öæ6ó¦æWrD…$TRä&÷„vVöÖWG'’‚ãSRÂãƒ"Âã32’À¢6öÆWFS¦æWrD…$TRä&÷„vVöÖWG'’‚ãS‚ÂãBÂã3b’À¢6&V6¦æWrD…$TRä&÷„vVöÖWG'’‚ã3rÂã3rÂã3R’À¢&öæS¦æWrD…$TRä&÷„vVöÖWG'’‚ãBÂãBÂã3‚’À¢W&æ¦æWrD…$TRä&÷„vVöÖWG'’‚ã2ÂãSRÂãb’À¢òòòöÆ–6–Âì:6òF–æ†$õ5Dó¢6&\:vÆ—6ÂVçVçFòòÖ÷&F÷"„å72æ§2’6V×&RFWfRöÆ†÷2R&ö6à¢òòFRW'FòÂçVÖG&ö6FRF—&÷2ÂVVÒW7L:F—&æFòVÒfö<:¢6W"VÒ&öæV6ò6VÒ6&:’òFWFÆ†RVP¢òòÖ—2VV'&6VæâGV26—†–æ†2RVÒG&:vòÂvVöÖWG&–6ö×'F–Æ†F6öÖòò&W7Fòà¢öÆ†ó¦æWrD…$TRä&÷„vVöÖWG'’‚ãbÂãbÂã2’À¢&ö6¦æWrD…$TRä&÷„vVöÖWG'’‚ã2Âã2Âã"’À¢'&6ó¦æWrD…$TRä&÷„vVöÖWG'’‚ã2ÂãS‚Âãb’À¢òò†26–æ6òvVöÖWG&–2FR&Ö6:×&ÒFV“¢—7FöÆFöÌ:Ö6–v÷&fVÒFRÖöçF%—7FöÆ§Ó°¦6öç7BÔE5õTÄS×6¶–åöÆ–6–ÂæÖ†3ÓææWrD…$TRäÖW6…7FæF&DÖFW&–Â‡¶6öÆ÷#¦2Ç&÷Vv†æW73¢ãSWÒ’“° ¢òò6öçFF÷"FR–FVçF–FFRâW†—7FR&òFW7FR6öç6VwV—"F—¦W"TTÒ:’æ÷fòVÒ6×ó¢6ö×&æFò<;0¢òò÷6œ:|:6òÂFöFòöÆ–6–Â&V6Ræ÷fò6FVG&ò†VÆW2æFÒ’ÂRÖVFœ:|:6òFR&öæFRò&Vf÷,:vğ¢òòæ66WR"f—&'\:ÖFò(	Bfö’W†FÖVçFRòVR6öçFV6WRà¦ÆWB–EöÆ–6–ÃÓ°¦gVæ7F–öâ7&–%öÆ–6–Â†–æF–6RÇF—óÒw&VÂr—°¢6öç7BsÖæWrD…$TRäw&÷W‚“°¢6öç7B6¶–äÖCÔÔE5õTÄU´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’¤ÔE5õTÄRæÆVæwF‚•Ó°¢&Æö6õ„tTõõôÂçG&öæ6òÇVæ–f÷&ÖTÖBÃÂãƒrÃÆr“°¢&Æö6õ„tTõõôÂæ6öÆWFRÆ6öÆWFTÖBÃÃã"ÃÆr“°¢&Æö6õ„tTõõôÂæ6&V6Ç6¶–äÖBÃÃãC‚ÃÆr“°¢òò&÷7Fòæg&VçFRF6&\:v‚·¢Æö6ÂÂVR:’&öæFRòöÆ–6–ÂöÆ†’â2ÖVF–F2<:6ò2ÖW6Ö2Fğ¢òòÖ÷&F÷"Â&÷2Fö—2ÆW&VÒ6öÖòvVçFRFòÖW6Öò×VæFòà¢f÷"†6öç7B÷‚öe²ÒãrÂãuÒ–&Æö6õ„tTõõôÂæöÆ†òÇ&÷7FôÖBÆ÷‚ÃãS2ÂãsRÆr“°¢&Æö6õ„tTõõôÂæ&ö6Ç&÷7FôÖBÃÃãBÂã‚Ær“°¢&Æö6õ„tTõõôÂæ&öæRÆ&öæTÖBÃÃãrÃÆr“°¢6öç7BW&æ3Õ²ÒãBÂãEÒæÖ†ÇƒÓæ&Æö6õ„tTõõôÂçW&æÇVæ–f÷&ÖTÖBÆÇ‚Âã#’ÃÆr’“°¢6öç7B'&6÷3Õ²Òã3rÂã3uÒæÖ†ÇƒÓæ&Æö6õ„tTõõôÂæ'&6òÇ6¶–äÖBÆÇ‚Âã’ÃÆr’“°¢òòò&öæV6òFR4•„†òVR&V6RVçVçFòòÖöFVÆò4Bì:6ò6†Vv÷R’6VwW&&ÖæÜ:6òF—&V—FÀ¢òòì:6òfÇWGVæFòæòVG&–Ã¢÷2'&:v÷2f–6ÒVÒƒÜ+ã3rRòVæ†ò6’÷"föÇFFR“Òãc"âRVÆ¢òòöçF&µ¢6VÒv—&òæVæ‡VÒ÷'VR:’$Ì8VRòöÆ–6–ÂöÆ†(	Bò&÷7FòFVÆR:’FW6Væ†FòVĞ¢òò·¢Æö6ÂÂæÖW6Ö6öçfVì:|:6òà¢6öç7B&ÖÖ6öç7G'V—$&ÖöÆ–6–Â‚“¶&Öç÷6—F–öâç6WB‚ã3rÂãc"Âã“¶ræFB†&Ö“°¢rç66ÆRç6WE66Æ"„U44ÄõôÄ”4”Â“°¢66VæRæFB†r“°¢6öç7BöÃ×°¢–C¢²¶–EöÆ–6–ÂÀ¢w'Wó¦rÇW&æ2Æ'&6÷2Æ&ÖÆ‡¥ôÄ”4”Åô…Çf—fó§G'VRÆ6–æFó¦fÇ6RÇVVFC£ÇF—òÀ¢fVÆö6—G“¦æWrD…$TRåfV7F÷#2‚’À¢÷3¦æWrD…$TRåfV7F÷#2‚’Ç&÷†–ÖõF—&ó£Æ6Ö–æ†æFó£À¢òòW7FFòFG&ö6:|:6ò‡fW"6öÖ&FRæ§2“¢&VÌ;6v–òFÖ—&ÂVÂæWV—RR6ö&W'GW&W66öÆ†–Fà¢f—TFW6FS£Çf—U÷#£Ç&öçFôVÓ£ÇF—&÷3£Æ‡çFW&–÷#¥ôÄ”4”Åô…ÇVÃ¦çVÆÂÇVÄFS£ÆÆFôfÆæ6ó£À¢6ö&W'GW&¦çVÆÂÇ&÷†–Ö6ö&W'GW&£Æf6T6ö&W'GW&£Ç&W76–öæFôFS£ÇF—&õf—7VÄFS£ÇVÇF–ÖôW7Æ†ÖVçFó£À¢òòW&6W:|:6ó¢&÷†–Öf—6öFVf66†V6vVÒVçG&RöÆ–6–—2‡fW"6öÖVçL:&–òFò7W7Fò÷"g&ÖR“°¢òòf—V:’ò&W7VÇFFòF;¦ÇF–ÖfÆ–:|:6òÂ&V&÷fV—FFòVÆ÷2g&ÖW2–çFW&ÖVFœ:&–÷2à¢&÷†–Öf—6ó¦–æF–6R¥d•4õôDTd4tTÒÇf—S¦fÇ6RÆöÆ†%“£À¢òòÖW6ÖFVf6vVÒFf—<:6òÂVÆòÖW6ÖòÖ÷F—fó¢÷2VG&òf'&VæFòÆ—7FFRÆçF2æòÔU4Ôğ¢òòVG&ò:’VÒ–6òFRG&&Æ†òVRì:6ò&V6—6W†—7F—"à¢&÷†–ÖöÆ†F¦–æF–6R¥d•4õôDTd4tTÒÆ¦fö”fW&–Fó¦fÇ6RÀ¢òò6WF÷"FR'W66FW7FRöÆ–6–ÂÂW7Æ†FòVÆò:&æwVÆòFR÷W&ò‡fW"4UDõ%ôõU$ò’à¢6WF÷$'W66¦–æF–6R¥4UDõ%ôõU$òÀ¢òòÇGW&&VæFW&—¦FÂ–çFW'öÆF¢:’òVRFV—†òöÆ–6–Â7V&—"§VçFò&Æ¦R†ò¢:’$B’à¢ÇGW&GVÃ¦çVÆÂÀ¢òòf–F;§F–ÂRFW7F–æòF&öæF(	B<;2öÌ:Ö6–FR%TW6âÖöFöF—7F–æwVR&öæF+rf67VÆ†æFò+p¢òò6:væFò+r6–æFó²wV&æœ:|:6òFR&VÂ6öçF–çVFöFæòW7FFòv6öÖ&FRrFÜ:V–æFò†VÆ’à¢ÖöFó¢w&öæFrÆFW7F–æó¦çVÆÂÆW‡—&VÓ£À¢òòW'6VwVœ:|:6ó¢&÷FFò¢Âv—ö–çBGVÂRò&VÌ;6v–òFR&WÆæV¦ÖVçFò(	BFVf6Fò÷"öÆ–6–À¢òò†œ+sÃ3R2’&÷2Fö—2ì:6ò&V6Æ7VÆ&VÒæòÖW6Öòg&ÖRRFö'&&VÒò7W7FòçVÒ–6ò<;2à¢&÷F¦çVÆÂÆ–æF–6U&÷F£ÆFW7F–æõ&÷F¦çVÆÂÇ&÷†–Öõ&WÆã¦–æF–6R¢ã3RÇ&÷†–Öõ&WÆå&W6ó£À¢òòVG&÷26VwV–F÷2&'&FòVÆ6öÆ—<:6òâ¦W&76–ÒVRVÆRæFà¢G&fFó£À¢òò26—†2FR6W'Fò<:6ò7&–F2TÔfW¢R<;2L:¦Ò÷2fÆ÷&W2&VW67&—F÷2÷"g&ÖRà¢6—†3¥¤ôä5õôÄ”4”ÂæÖ‚‚“ÓææWrD…$TRä&÷ƒ2‚’’À¢&'&¦7&–$&'&×VæFòƒ"ãR¤U44ÄõôÄ”4”ÂÄU44ÄõôÄ”4”Â’À¢òò6÷'ò4C¢6†VvFWö—2†ò'V—fò:’VF–Fòæò&–ÖV—&òöÆ–6–ÂVRæ66R’âL:’Ì:6÷'ö:¢òòçVÆòRVVÒæ–Ö<:6ò26—†2(	B2GV2W&æ2v—&æFòÂ6öÖò6V×&Rfö’à¢6÷'ó¦çVÆÂÇfVÆö6–FFTæFæFó£À¢Ó°¢òòFöF226—†2f—&Ò&W6W'f¢VæFòòÖöFVÆò6†VvÂVÆ26öÖVÒFRVÖfW¢âræ6†–ÆG&Væ¬:¢òò6ö'&RG&öæ6òÂ6&\:vÂ&÷7FòR&öì:’(	B÷2G,:§2&–ÖV—&÷2—FVç2<:6ò&VGVæFçFW2FR&÷;76—FòÂ&¢òòÆ—7Fì:6òFWVæFW"F÷&FVÒVÒVR2\:v2f÷&Ò7&–F26–Öà¢fW7F—%öÆ–6–Â†rÅ²ââçW&æ2Âââæ'&6÷2Æ&ÖÂââæræ6†–ÆG&Vâæf–ÇFW"†3Óæ2æ—4ÖW6‚•ÒÆ&ÖÀ¢W7FFóÓç·öÂæ6÷'óÖW7FF÷Ò“°¢&WGW&âöÃ°§Ğ¢òò&VW67&WfR26—†2FR6W'FòFòöÆ–6–Âæ÷6œ:|:6òGVÂ‡6VÒÆö6"’RFWföÇfRÆ—7Fà¦gVæ7F–öâ¦öæ4FõöÆ–6–Â‡öÂ—°¢6öç7B&6U“×öÂæw'Wòç÷6—F–öâç“°¢&WGW&â¤ôä5õôÄ”4”ÂæÖ‚‡¦öæÆ’“Óç°¢6öç7B6—†×öÂæ6—†5¶•Ó°¢6—†æÖ–âç6WB‡öÂç÷2ç‚×¦öææÖV–Æ&6U’·¦öææFRÇöÂç÷2ç¢×¦öææÖV–“°¢6—†æÖ‚ç6WB‡öÂç÷2ç‚·¦öææÖV–Æ&6U’·¦öææFRÇöÂç÷2ç¢·¦öææÖV–“°¢&WGW&ç¶6—†Æ×VÇF—Æ–6F÷#§¦öææ×VÇF—Æ–6F÷'Ó°¢Ò“°§Ğ ¢òòÓÓÓÓÒW7FFòFöÌ:Ö6–RFò¦övF÷"ÓÓÓÓĞ¢òòöçFôÇfö:’&öæFRò†VÆ–<;7FW&òf“¢×VFÂçVÖ&F–FFRÆçF:|:6òÂ÷Rò¤ôtDõ"ÂçVÖ¢òò6:vF÷"f–6†7V¦âÇfõÆçFf–6çVÆÂæ6:vF(	B:’òVRF—7F–æwVR÷2Fö—266÷2Â÷'VP¢òò<;2&F–FFW&Ö–æVÒ6öæf—66òà¦6öç7BöÆ–6–×¶W7FFó¢w&öæFæFòrÆÇfõÆçF¦çVÆÂÆÇfõÆçF6ó¦çVÆÂÆWV—Uf–GW&£ÇöçFôÇfó§·ƒ£Ç££ÒÇFV×ôW7FFó£Æ6ööÆF÷väFS£À¢FV×õ6VÕfW#£ÇFV×ôæ—fVÃ£Ç&WFöÖ$66VÓ£Ç&ö7W&Fó£À¢òòöÆ–6–—2VRò¦övF÷"&FWRR–æFì:6òf÷&Ò&W7VV6–F÷2"â8’ò9¤ä”4òÖ÷F—fòFRòVfWF—fğ¢òò7&W66W"(	B&Vf÷,:vò6VÒ6W6:’òVRVÆR6†Ö÷RFR&VÖVçF"öÌ:Ö6–FòæF"à¢&—†3£À¢òòVæFòò,;7†–Öò&Vf÷,:vòöFR6—"VÆ÷'FÂRL:’VæFò–æF6öçF6öÖò6öæg&öçFòVVçFRà¢&W÷6–6ôVÓ£Æ6ÆÖ&–FS£À¢òòVæFòò6öæf—66òVÒ7W'6òFW&Ö–æ†öÌ:Ö6–$T4•4W7F"VÒ6–ÖFÆçF&VÆR6÷'&W"’à¢6öæf—66ôFS£ÆFW6VÖ&'VTfV—F÷3£Ç&÷†–ÖôFW6VÖ&'VS£Æ†VÆ•÷W6Fó¦fÇ6WÓ°¢òòÓÓÓÓÒòTR4„ÔDTì8|84òDôÌ8Ô4”ÓÓÓÓĞ¢òòçFW2&7FfU„•5D•#¢&÷&FvVÒ:ÆçF:|:6ò¬:VÆWfff–6†÷"6’<;2ÂR'F—"F:Òğ¢òò¦övF÷"W&6:vFò&6V×&R6VÒFW"fV—FòæFÌ:–ÒFRÆçF"âv÷&öÌ:Ö6–<;26R–çFW&W76¢òò÷"GV2&¬;VW2ÂR2GV2<:6ò6ö—62VRò¦övF÷"dU£ ¢òò+rW7L:6öÒÔô4„”Äæ26÷7F2ÆWfæFò6÷FR†fÆw&çFR(	BL:&fW"FRÆöævR“°¢òò+r4•R$U4òŒ8õT4ò†f–6†VVçFR’ÂR:Òf–6Ö&6Fò÷"VÒFV×òà¢òòf÷&—76òVÆR:’Ö—2VÒÖ÷&F÷#¢&F–FfVÒVÆÄåDÂ6öæf—66Rf’VÖ&÷&à¢òğ¢òòd”4„U5TTåDRU4e$”(	BåDU2TÄ<92U5TTåDdâ¦fö•&W6öW&VÒ&ööÆVæòU$ÔäTåDS¢VÖ¢òò&—<:6òÂVÖ;¦æ–6fW¢ÂR'F—"FÆ’FöFGWÆFR&öæFFòÖW'6VwV–ò¦övF÷"VÆò&W7Fğ¢òòF'F–Fâì:6ò†f–6öÖòÆ–×"Â6Çfòv"ò6fRâW&—76òò&VÆW2ÖR6VwVVÒ6VÒWRFW"fV—Fğ¢òòæF"VRò''Væò&VÆF÷RG,:§2fW¦W2ÂRæVæ‡VÖF2fW¦W2ò&ö&ÆVÖW7Ffæò7vâà¢òğ¢òòv÷&Ö&6FVÒ$¤òâ6—"&W6òFV—†öÌ:Ö6–FRöÆ†ò÷"d”4„õTTåDR6VwVæF÷2FR¦övó²76Fğ¢òò—76òÂVÆRföÇF6W"Ö—2VÒÖ÷&F÷"(	BRòVRòÖ&6FRæ÷fò:’òVRVÆRd•¤U"Âì:6òòVR¬:fW¢à¢òò6–æ6òÖ–çWF÷2:’Æöævòò&7FçFR&&—<:6òFW"6öç6W\:¦æ6–R7W'Fòò&7FçFR&6&W"çVÖ¢òò6W7<:6ó¢L:&6VçF—"F–fW&Vì:vVçG&RæF"Ö&6FòRæF"Æ–×òFVçG&òFÖW6Ö¦övFà¢òò32Âì:6ò3â6–æ6òÖ–çWF÷2FRÖ&6FWö—2FRTÔ&—<:6ò:’Ö—2FV×òFòVRVÖ6W7<:6òFRFW7FP¢òò–çFV—&(	Bæ,:F–66–væ–f–6f¦öv"'F–FFöFÖ&6FòâÖV–òÖ–çWFò–æFf¢&—<:6òW6 ¢òòR6&Ræ6&\:vFRVVÒW7L:¦övæFòà¦6öç7Bd”4„õTTåDSÓ3°¦ÆWBf–v–FôFSÓ°¦gVæ7F–öâÆWfæFõ6÷FR‚—·&WGW&â–çfVçF&–òç6÷FSãĞ¦W‡÷'BgVæ7F–öâ6†ÖFVæ6ò‚—·&WGW&âÆWfæFõ6÷FR‚—ÇÇW&f÷&Öæ6Rææ÷r‚’óÇf–v–FôFWĞ¢òòÓÓÓÓÒ$õ$DtTÓ¢òFVw&RVRfÇFfVçG&R'FRf—&Ò"R'fö<:¢:’&ö7W&Fò"ÓÓÓÓĞ¢òòFV:’ò–ç7FçFRVÒVRW7G&VÆ6’6RVÆR6öçF–çV":f—7F²f–Ô'W66:’L:’VæFòVÆW0¢òò&ö7W&ÒFWö—2VRVÆR6öÖRâfVæFö:’&V6Æ7VÆFò÷"VG&ò(	B:’òVRf¢ò&¦ò4ôätTÄ ¢òò76–ÒVRò¦övF÷"VV'&Æ–æ†FRf—<:6òÂVR:’ÖV<:&æ–6–çFV—&à¦6öç7B&÷&FvVÓ×¶F—f¦fÇ6RÆFS£ÇfVæFó¦fÇ6RÇƒ£Ç££Æf–Ô'W66£Ó°¢òòÓÓÓÓÒ$U$"TÒÄu\8”Òì84ò8’•"E,82DRÄu\8”ÒÓÓÓÓĞ¢òò6†ÖFVæ6öÖ—7GW&f2GV26ö—62ÂRf–6†VVçFR6÷¦–æ†&7Ff&VÖGWÆFR&öæF¢òòÆ&v"&÷FR6Ö–æ†"L:’ò¦övF÷"âW&—76òò&Ö÷'&’RöÌ:Ö6–6öçF–çVG,:2FRÖ–Ò#¢VÆP¢òò&Væ66–Æ–×òFR6÷FRÂ6VÒW7G&VÆæVæ‡VÖÂR–æF76–ÒW&6VwV–Fò(	BVÆÖ&6F&—<:6ğ¢òòVR6&&FR6öçFV6W"à¢òğ¢òòÖ÷F—fôFUW'6VwV—"‚–Ö÷&fV’Rì84òtõdU$ädäD¢æVæ‡VÒ6ö×÷'FÖVçFò6†ÖfÂ<;2VĞ¢òòvæ6†òFRFW7FRâVVÒFV6–F–W'6VwVœ:|:6òW&÷WG&6öæFœ:|:6òÂÆ–æ†2&—†òâ6—Rà¦gVæ7F–öâöÆ–6–ÅFVÔvF–Æ†ò‡öÂÆv÷&—°¢6öç7BVçG&Vv×öçFôFTVçG&VvGVÂ‡Æ–W"ç÷6—F–öâ“°¢6öç7BVçG&Vv–ÆVvÃÒ†VçG&VvbfÆWfæFõ6÷FR‚’bgfTÇfò‡öÂç÷2ç‚ÇöÂæw'Wòç÷6—F–öâç’´ÅEôôÄ„òÇöÂç÷2ç¢ÇöÂæöÆ†%’ÇÆ–W"ç÷6—F–öâç‚ÇÆ–W"ç÷6—F–öâç’´ÅEõDõ%4òÇÆ–W"ç÷6—F–öâç¢ÆÖV–&W'GW&6öæR‡öÆ–6–ç&ö7W&Fò’ÆÆ6æ6Uf—6ò‡öÆ–6–ç&ö7W&Fò’ÇFVÔÆ–æ†FUf—6ò’“°¢–b†VçG&Vv–ÆVvÂ–ÆW'F$VçG&Vv–ÆVvÂ‚“°¢&WGW&â7&–ÖTF—fò†v÷&ÇöÂç÷2—ÇÆVçG&Vv–ÆVvÃ°§Ğ¢òòVçFò–æFfÇFFf–6†VVçFRÂVÒ6VwVæF÷2â…TBÖ÷7G&—76ó¢Ö&66VÒ&¦òf—<:×fVÂ:¢òò–æF—7F–æw\:×fVÂFR'Vr(	Bfö’76–ÒVRfW'<:6òW&ÖæVçFR76÷RFçFòFV×ò6VÒ6W"æ÷FFà¦W‡÷'BgVæ7F–öâ6VwVæF÷4FTf–6†VVçFR‚—·&WGW&âÖF‚æÖ‚ƒÇf–v–FôFR×W&f÷&Öæ6Rææ÷r‚’ó—Ğ¢òò$W7L:&öÆæFòÆwVÖ6ö—66öÒöÌ:Ö6–ò"(	BW&wVçFVR…TBÂò&F"R&VvVæW&:|:6òFRf–F¢òòf¦–ÒöÆ†æFò&òU5DDòDò„TÄ”<95DU$ò†W7FFòÓÒwG'VÆ†v’â—76òFV—†÷RFRf¦W"6VçF–Fòæğ¢òò–ç7FçFRVÒVRò†VÆ’&÷RFR6öÖæF"ò6öæg&öçFó¢v÷&VVÒ&W7öæFR:’f–6†R&÷&FvVÒà¦W‡÷'BgVæ7F–öâVÔ6öæg&öçFò‚—·&WGW&âöÆ–6–ç&ö7W&FóãÇÆ&÷&FvVÒæF—fĞ¦gVæ7F–öâVÆWf%&ö7W&Fò†â—¶–b†ãçöÆ–6–ç&ö7W&Fò—öÆ–6–ç&ö7W&FóÔÖF‚æÖ–â…$ô5U$DõôÔ‚Æâ—Ğ¦gVæ7F–öâ6öÖ%&ö7W&Fò†â—·öÆ–6–ç&ö7W&FóÔÖF‚æÖ–â…$ô5U$DõôÔ‚ÇöÆ–6–ç&ö7W&Fò¶â—Ğ¦6öç7BöÆ–6–—3ÕµÓ°¦ÆWB6VFT¦övF÷#Ô¤ôtDõ%ô…ôÔ‚Æ&ÖGW&¦övF÷#ÓÆ¦övF÷%&VæF–FóÖfÇ6S°¦ÆWB&÷†–ÖõF—&ô¦övF÷#Ó° ¢òòÓÓÓÓÒ…TC¢f–FÂÆW'FÂFW7—7FRÂÖ—&FR6öÖ&FRÂ&÷L:6òFRF—&"ÂfÆ6‚FRFæòÓÓÓÓĞ¦6öç7BÆW'FVÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚vÆW'FöÆ–6–r’À¢FVæ6ôVÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚vFVæ6õöÆ–6–r’À¢&VgVv–ôVÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚w&VgVv–ô–æF–6F÷"r’ÆÖ—&6öÖ&FTVÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚vÖ—&6öÖ&FRr’À¢f—&T'FãÖFö7VÖVçBævWDVÆVÖVçD'”–B‚vf—&T'Fâr’Æf—&U6V6öæF'“ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚vf—&U6V6öæF'’r’ÆFæôfÆ6ƒÖFö7VÖVçBævWDVÆVÖVçD'”–B‚vFÚ±î¸Â¸­yêë¢°k¢G§¦*^noFlash'),
  avisoPolicia=document.getElementById('avisoPolicia'),municaoEl=document.getElementById('municaoHud'),
  armaBtn=document.getElementById('armaBtn'),armaIconeEl=document.getElementById('armaIcone'),
  armaMunicaoEl=document.getElementById('armaMunicao'),miraBtn=document.getElementById('miraBtn'),aimBase=document.getElementById('aimBase');
function atualizarHudSaude(){renderizarVidaJogador(saudeJogador,JOGADOR_HP_MAX,armaduraJogador,JOGADOR_ARMADURA_MAX)}
// A muniÃ§Ã£o tambÃ©m muda por COMPRA (na Economy, que nÃ£o conhece este mÃ³dulo). Em vez de acoplar os dois,
// o HUD observa o valor e sÃ³ redesenha quando ele muda de fato â€” nada de escrever no DOM por frame.
// A chave Ã© COMPOSTA de propÃ³sito: sÃ³ o nÃºmero nÃ£o bastaria, porque rifle com 12 balas e pistola com
// 12 balas dariam cache-hit e o Ã­cone congelaria na arma anterior.
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

// Uma muda sÃ³ existe pros olhos da polÃ­cia depois de florescer.
function plantaDetectavel(p){return !p.colhida&&p.estagio>=PLANTA_DETECTAVEL_ESTAGIO}
function mudasMaduras(){return plantas.filter(plantaDetectavel)}

// ===== A PLANTAÃ‡ÃƒO: O CANTEIRO INTEIRO, NÃƒO O PÃ‰ =====
// Agrupamento por raio simples, e nÃ£o por vizinhanÃ§a em cadeia. Cadeia (dois pÃ©s juntos puxam um
// terceiro, e assim por diante) uniria o mapa todo numa plantaÃ§Ã£o sÃ³ quando o jogador plantasse uma
// trilha de mudas; raio fixo dÃ¡ um pedaÃ§o previsÃ­vel de terreno, que Ã© o que o piloto de um
// helicÃ³ptero enxergaria de cima de uma vez.
function plantacaoEmVolta(planta){
  const dentro=[];
  for(const p of plantas)if(plantaDetectavel(p)&&distXZ(p,planta)<RAIO_PLANTACAO)dentro.push(p);
  let sx=0,sz=0;
  for(const p of dentro){sx+=p.x;sz+=p.z}
  return{x:sx/dentro.length,z:sz/dentro.length,pes:dentro.length};
}
// Os pÃ©s que ainda estÃ£o de pÃ© nesta plantaÃ§Ã£o. Ã‰ o que decide se a batida acabou.
function pesVivosDaPlantacao(){
  const pl=policia.alvoPlantacao;
  if(!pl)return[];
  return plantas.filter(p=>plantaDetectavel(p)&&distXZ(p,pl)<RAIO_PLANTACAO);
}
// ===== MEMÃ“RIA DAS PLANTAÃ‡Ã•ES JÃ BATIDAS =====
// Sem ela, colher o Ãºltimo pÃ© devolvia o heli pra ronda e o primeiro broto novo no mesmo canteiro
// comeÃ§ava tudo de novo. O lugar fica queimado por um tempo â€” a polÃ­cia jÃ¡ veio aqui.
const plantacoesBatidas=[];
function plantacaoQueimada(x,z,agora){
  for(let i=plantacoesBatidas.length-1;i>=0;i--){
    const q=plantacoesBatidas[i];
    if(agora>q.ate){plantacoesBatidas.splice(i,1);continue}
    if(Math.hypot(q.x-x,q.z-z)<RAIO_PLANTACAO)return true;
  }
  return false;
}
function marcarPlantacaoBatida(agora){
  const pl=policia.alvoPlantacao;
  if(pl)plantacoesBatidas.push({x:pl.x,z:pl.z,ate:agora+COOLDOWN_PLANTACAO});
}
// ===== TODO POLICIAL A PÃ‰ TAMBÃ‰M ENXERGA PLANTAÃ‡ÃƒO =====
// "todos os policiais devem conseguir detectar uma planta de cannabis ou algo de errado."
// Era sÃ³ o helicÃ³ptero. Um fardado podia passar RASPANDO num canteiro florido e seguir andando â€” o
// que, do lado de fora, Ã© a polÃ­cia sendo cega. E tinha um efeito colateral chato: plantar em beco
// coberto, onde o heli nÃ£o passa, era seguro pra sempre.
//
// As regras sÃ£o as mesmas que valem pro heli, de propÃ³sito: sÃ³ pÃ© FLORIDO conta (Ã© quando a muda fica
// visÃ­vel, e Ã© quando o jogo avisa "sua muda floresceu"), canteiro batido hÃ¡ pouco nÃ£o vale outra, e
// quem acha chama a batida inteira pelo rÃ¡dio â€” o heli vem, e a viatura tambÃ©m.
// A diferenÃ§a Ã© o alcance: o heli varre de cima com 20 m; o de pÃ© enxerga 14 m, E PRECISA DE LINHA DE
// VISÃƒO. Parede tapa. Ã‰ isso que mantÃ©m o beco fechado valendo alguma coisa em vez de virar armadilha.
const POLICIAL_VE_PLANTA=14;
const OLHADA_INTERVALO=.5;// nÃ£o vale varrer a lista de plantas todo quadro, pra cada policial
function policialOlhaPlantas(pol,agora){
  // JÃ¡ tem batida rolando: o rÃ¡dio estÃ¡ ocupado, e abrir outra por cima sÃ³ embaralharia o alvo.
  if(policia.estado!=='rondando'||agora<pol.proximaOlhada)return false;
  pol.proximaOlhada=agora+OLHADA_INTERVALO;
  const ox=pol.pos.x,oy=pol.grupo.position.y+ALT_OLHO,oz=pol.pos.z;
  for(const pl of plantas){
    if(!plantaDetectavel(pl)||distXZ(pol.pos,pl)>POLICIAL_VE_PLANTA)continue;
    if(plantacaoQueimada(pl.x,pl.z,agora))continue;
    // A linha vai do OLHO dele atÃ© a altura do vaso: Ã© por onde ele enxergaria de verdade.
    if(!temLinhaDeVisao(ox,oy,oz,pl.x,pl.y+.35,pl.z))continue;
    policia.alvoPlantacao=plantacaoEmVolta(pl);
    policia.alvoPlanta=pl;policia.confiscoAte=0;
    transitar('apontando');
    const n=policia.alvoPlantacao.pes;
    mostrarAviso(n>1
      ?`ğŸ‘® Um policial na rua achou sua plantaÃ§Ã£o de ${n} pÃ©s e chamou no rÃ¡dio.`
      :'ğŸ‘® Um policial na rua achou sua muda e chamou no rÃ¡dio.',3800);
    return true;
  }
  return false;
}

// Exposto pro teste: contar batidas repetidas no mesmo canteiro Ã© a Ãºnica forma de provar o conserto.
export function __plantacoesBatidas(){return plantacoesBatidas.map(q=>({x:q.x,z:q.z}))}

// A OCORRÃŠNCIA ABERTA, PRO RESTO DO JOGO
// O canteiro que a polÃ­cia estÃ¡ batendo agora, ou null. Quem lÃª Ã© a viatura: quando tem ocorrÃªncia
// ela larga a ronda e vem. Ã‰ um acessor e nÃ£o o `policia` inteiro exportado de propÃ³sito â€” o de fora
// sÃ³ precisa saber ONDE Ã© a treta, nÃ£o mexer na mÃ¡quina de estados.
// ===== O JOGADOR TAMBÃ‰M Ã‰ UMA OCORRÃŠNCIA =====
// "melhora a polÃ­cia, ela nÃ£o me para, nÃ£o faz nada, fica andando o carro."
//
// Ele estava certo, e a causa era esta linha: a ocorrÃªncia sÃ³ podia ser um CANTEIRO. O despacho
// inteiro da viatura pendurava aqui, entÃ£o o nÃ­vel de procurado nÃ£o chegava nela â€” com 5 estrelas a
// viatura seguia a ronda. Medido antes do conserto, com ele procurado e jÃ¡ avistado: a viatura
// passou a 0,2 m dele e seguiu reto, zero guarniÃ§Ã£o desembarcada.
//
// O ALVO Ã‰ O RASTRO, e nÃ£o a posiÃ§Ã£o viva dele. O rastro Ã© o que a polÃ­cia SABE pelo rÃ¡dio (ver
// `compartilharAvistamento`): eles vÃ£o onde ele foi VISTO. Perseguir a coordenada viva seria
// teleguiado â€” e injusto, porque despistar deixaria de existir.
// ===== O QUE O RÃDIO SABE, E POR QUE A VIATURA PRECISA DE MAIS QUE UM PONTO =====
// "tem como deixar elas mais inteligente?" Medido antes de responder, e o nÃºmero foi feio:
//     5 estrelas, nenhum policial por perto -> a viatura ficou 0 s dos 120 s com alvo.
// Ou seja: ficha mÃ¡xima e as duas viaturas rodando a ronda como se nada acontecesse. A causa estÃ¡
// aqui: o alvo delas era SÃ“ o rastro quente, e rastro sÃ³ nasce quando um policial A PÃ‰ enxerga o
// jogador. Sem ninguÃ©m por perto, a polÃ­cia motorizada nÃ£o sabia da existÃªncia dele.
//
// O conserto NÃƒO Ã© mandar elas na posiÃ§Ã£o viva dele â€” isso mataria o despiste, que Ã© a mecÃ¢nica que
// acabou de entrar ("passou um tempo nÃ£o achou, vai sumindo as estrelas"). O conserto Ã© dar a elas a
// mesma coisa que uma polÃ­cia de verdade tem: O ÃšLTIMO ENDEREÃ‡O CONHECIDO, mesmo depois de esfriar.
//   Â· rastro QUENTE  -> vÃ£o nele e param: Ã© onde ele estÃ¡ agora, pelo que se sabe;
//   Â· rastro FRIO    -> vÃ£o pra Ã¡rea e VASCULHAM, sem parar em cima do ponto velho.
// `ultimoVisto` guarda o endereÃ§o alÃ©m da validade do rastro. Fica null se ninguÃ©m nunca o viu â€”
// inclusive num save com ficha suja carregado do zero, e aÃ­ elas nÃ£o tÃªm mesmo o que perseguir.
let ultimoVisto=null;
function alvoDoJogador(){
  if(policia.procurado<=0)return null;
  const agora=performance.now()/1000;
  if(rastroValido(agora))return{x:rastro.x,z:rastro.z,perseguicao:true,quente:true,nivel:policia.procurado};
  if(!ultimoVisto)return null;
  return{x:ultimoVisto.x,z:ultimoVisto.z,perseguicao:true,quente:false,nivel:policia.procurado};
}
// Canteiro primeiro: batida em andamento Ã© serviÃ§o comeÃ§ado, e largar no meio deixa a guarniÃ§Ã£o a pÃ©
// sozinha do outro lado do morro â€” defeito que o `viatura.mjs` jÃ¡ mediu uma vez.
// A ocorrÃªncia leva CONSIGO o que a viatura precisa pra decidir, e nÃ£o sÃ³ a coordenada: se Ã©
// perseguiÃ§Ã£o ou batida, se o endereÃ§o Ã© quente, e o nÃ­vel da ficha. Ã‰ o que mantÃ©m a fronteira â€”
// `Viatura.js` continua sem conhecer `Police.js`, sÃ³ recebe uma ficha de ocorrÃªncia mais completa.
export function ocorrenciaAtual(){
  if(policia.alvoPlantacao)
    return{x:policia.alvoPlantacao.x,z:policia.alvoPlantacao.z,
      perseguicao:false,quente:true,nivel:policia.procurado};
  return alvoDoJogador();
}

// PrÃ³ximo ponto da patrulha. Com PATRULHA_VIES de chance cai num disco de PATRULHA_RAIO_VIES em volta
// de uma muda madura sorteada â€” o heli "estÃ¡ batendo aquela regiÃ£o", nÃ£o indo na coordenada exata dela.
// Nunca devolve o ponto da planta: Ã© sempre um ponto do disco, e o disco Ã© maior que o raio de detecÃ§Ã£o.
function sortearWaypointPatrulha(){
  const maduras=mudasMaduras();
  if(maduras.length&&Math.random()<PATRULHA_VIES){
    const alvo=maduras[Math.floor(Math.random()*maduras.length)];
    const ang=Math.random()*Math.PI*2;
    // sqrt(u) distribui uniformemente NA ÃREA do disco; sem isso o sorteio se amontoa no centro,
    // que Ã© justamente o comportamento teleguiado que estamos tirando.
    const raio=PATRULHA_RAIO_VIES*Math.sqrt(Math.random());
    return{x:THREE.MathUtils.clamp(alvo.x+Math.cos(ang)*raio,-MAPA_LIMITE,MAPA_LIMITE),
           z:THREE.MathUtils.clamp(alvo.z+Math.sin(ang)*raio,-MAPA_LIMITE,MAPA_LIMITE)};
  }
  return{x:(Math.random()*2-1)*MAPA_LIMITE,z:(Math.random()*2-1)*MAPA_LIMITE};
}

// Aviso Ãºnico por muda, no frame em que ela floresce: Ã© quando o relÃ³gio de risco comeÃ§a a correr, e
// sem esse sinal o jogador continua sendo pego de surpresa mesmo com o balanceamento certo.
function avisarFloracao(){
  for(const p of plantas){
    if(p.colhida||p.avisadaFloracao||p.estagio<PLANTA_DETECTAVEL_ESTAGIO)continue;
    p.avisadaFloracao=true;
    mostrarAviso('ğŸŒ¾ Sua muda floresceu â€” do alto dÃ¡ pra ver. Colha rÃ¡pido ou se esconda.',3400);
  }
}

// ===== Dano ao jogador (armadura em sÃ©rie â€” ver HealthBar.aplicarDano) =====
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
  // A ficha NÃƒO caÃ­a aqui, e o efeito era o pior possÃ­vel: o jogador era rendido com 5 estrelas,
  // perdia plantaÃ§Ã£o, pacotes, colete e dinheiro â€” e RENASCIA com as mesmas 5 estrelas e o rastro
  // ainda quente, com a polÃ­cia de rua andando na direÃ§Ã£o dele antes de ele dar o primeiro passo.
  // PuniÃ§Ã£o em cima de puniÃ§Ã£o, sem nenhuma saÃ­da no meio.
  //
  // Existia um comentÃ¡rio defendendo que a ficha nÃ£o cai no fim do encontro, e ele continua certo:
  // abater a guarniÃ§Ã£o nÃ£o limpa nada por si sÃ³, senÃ£o "matar todo mundo" viraria a estratÃ©gia
  // dominante â€” quem limpa Ã© o tempo depois, e ele sÃ³ corre com ninguÃ©m te vendo. Mas ser PRESO Ã© o
  // outro lado da moeda â€” Ã© o Ãºnico desfecho em que a polÃ­cia consegue o que queria. Conta acertada,
  // ficha zerada, na hora.
  policia.procurado=0;
  rastro.ativo=false;rastro.buscaAte=0;ultimoVisto=null;
  policia.tempoSemVer=0;policia.tempoNivel=0;
  vigiadoAte=performance.now()/1000+FICHA_QUENTE;
  // A PATRULHA QUE JÃ ESTÃ EM CAMPO PRECISA RECUAR DE FATO. Zerar a ficha faz eles pararem de
  // perseguir, mas o destino de ronda de cada um ainda aponta pro lugar onde a prisÃ£o aconteceu â€”
  // eles continuariam andando pra lÃ¡, o que da parte do jogador Ã© indistinguÃ­vel de continuar sendo
  // caÃ§ado. Cada um ganha um destino LONGE e volta pro modo de ronda.
  fecharAbordagem();
  for(const pol of policiais){
    pol.modo='ronda';pol.esperandoPatrulhaAte=0;
    pol.destinoRonda=pontoDeRonda(true);
    pol.rota=null;pol.destinoRota=null;
  }
  // O colete Ã© apreendido junto: ser rendido Ã© a "morte" deste jogo, e armadura que sobrevive Ã 
  // rendiÃ§Ã£o deixaria a placa no corpo depois do respawn sem o jogador ter pagado por ela.
  // A carga vai junto: ser rendido apreende os pacotes. Deixar a mochila cheia depois da prisÃ£o
  // faria o flagrante recomeÃ§ar no mesmo instante do respawn.
  armaduraJogador=0;inventario.colete=0;inventario.pacote=0;definirColeteVisivel(false);atualizarStatusEconomia();
  mostrarAviso('VocÃª foi rendido pela polÃ­cia â€” plantaÃ§Ã£o perdida e multa aplicada.',3400);
  // O aviso acima diz "plantaÃ§Ã£o perdida", e agora ele fala a verdade: ser rendido durante uma batida
  // custa o CANTEIRO inteiro, nÃ£o o pÃ© que o policial estava confiscando naquele instante.
  for(const pe of pesVivosDaPlantacao())confiscarPlanta(pe);
  if(policia.alvoPlanta&&!policia.alvoPlanta.colhida)confiscarPlanta(policia.alvoPlanta);
  policia.alvoPlantacao=null;policia.alvoPlanta=null;
  // A penalidade Ã© proporcional ao saldo atual: morrer custa 25%, mas nÃ£o apaga quase todo o dinheiro.
  aplicarMulta(Math.round(obterDinheiro()*PENALIDADE_MORTE));
  setTimeout(()=>{
    const pontoHospital=obterPontoNascimento();
    player.position.set(pontoHospital.x,pontoHospital.y,pontoHospital.z);
    saudeJogador=JOGADOR_HP_MAX;jogadorRendido=false;atualizarHudSaude();
    mostrarAviso('VocÃª acordou no Hospital â€” multa aplicada e itens apreendidos.',2800);
  },1400);
}
// O!¶¬{®0®+^zºè¬è‘ééŠ—†6öÆWFR6ö×&FòæÆö¦FR&Ö2VçG&VÒW6ò6÷¦–æ†òVæFòòçFW&–÷"6&â8’fW&–f–6FòV’ÂP¢òòì:6òæV6öæö×’Â÷'VRV6öæö×’(i"öÆ–6R6W&–FWVæL:¦æ6–6—&7VÆ"…öÆ–6R¬:–×÷'FV6öæö×’’à¦gVæ7F–öâ6öæfW&—$6öÆWFR‚—°¢–b†&ÖGW&¦övF÷#ÃÓbf–çfVçF&–òæ6öÆWFSã—°¢–çfVçF&–òæ6öÆWFRÒÓ¶&ÖGW&¦övF÷#Ô¤ôtDõ%ô$ÔEU$ôÔƒ°¢FVf–æ—$6öÆWFUf—6—fVÂ‡G'VR“°¢Fö6%6öÔWV—$6öÆWFR‚“°¢GVÆ—¦%7FGW4V6öæöÖ–‚“¶GVÆ—¦$‡VE6VFR‚“°¢Ö÷7G&$f—6ò‚t6öÆWFRWV—Fò(	B&ÖGW&'6÷'fR'FRFòFæòârÃ##“°¢Ğ§Ğ¢òò6ö×&fV—FæÆö¦¢WV—–ÖVF–FÖVçFRVÒ6öÆWFRÂVÒfW¢FRFV—†"ò¦övF÷"6öÒVÒì;¦ÖW&òæğ¢òòW7F÷VRR6VÒ&÷F\:|:6òf—7VÂâ6R¬:†÷WfW"&ÖGW&F—fÂ&WF÷&æfÇ6R&V6öæö×’wV&F"¢òòæ÷fVæ–FFRæòW7F÷VRæ÷&ÖÆÖVçFRà¦gVæ7F–öâWV—$6öÆWFT6ö×&Fò‚—°¢–b†&ÖGW&¦övF÷#ã—&WGW&âfÇ6S°¢&ÖGW&¦övF÷#Ô¤ôtDõ%ô$ÔEU$ôÔƒ°¢FVf–æ—$6öÆWFUf—6—fVÂ‡G'VR“°¢Fö6%6öÔWV—$6öÆWFR‚“¶GVÆ—¦%7FGW4V6öæöÖ–‚“¶GVÆ—¦$‡VE6VFR‚“°¢Ö÷7G&$f—6ò‚t6öÆWFRWV—Fò(	B&ÖGW&'6÷'fR'FRFòFæòârÃ##“°¢&WGW&âG'VS°§Ğ¦gVæ7F–öâ6öÆWFTVÕW6ò‚—·&WGW&â&ÖGW&¦övF÷#ãĞ¢òòÓÓÓÓÒ”FR6FöÆ–6–ÂVÒ6öÖ&FRÓÓÓÓĞ¢òòW†—7FR&VFRVçG&RR#ò6VÒ—76ò÷2öÆ–6–—2F—&fÒG&l:—2F2662à¦gVæ7F–öâFVÔÆ–æ†FUf—6ò†‚Æ’Æ¢Æ'‚Æ'’Æ'¢—°¢&WGW&â&–ÖV—&ô–×7Fôæõ6VvÖVçFò†‚Æ’Æ¢Æ'‚Æ'’Æ'¢“ÓÓÖçVÆÃ°§Ğ ¢òòÓÓÓÓÒ4ôäRDRd•<84ò(	BÖFVÜ:F–6W&Â6VÒF‡&VRR6VÒW7FFòvÆö&ÂÓÓÓÓĞ¢òòf–6—6öÆFFR&÷;76—Fó¢:’&Vw&VRFV6–FR6Rò¦övF÷"fö’f—7FòÂRVÖ&Vw&FW762&V6—6¢òò6W"FW7L:fVÂf÷&Fò¦övò‡fW"òFW7FRFò6öæR’âöÆ†%–W6ÔU4Ô6öçfVì:|:6òFRw'Wòç&÷FF–öâç¢òòFòF‡&VS¢:&æwVÆòÖVF–Fò6öÒFã"‡‚Ç¢’ÂöçFæFò&òµ¢à¦W‡÷'BgVæ7F–öâFVçG&ôFô6öæR†÷‚Æ÷¢ÆöÆ†%’Æ‚Æ¢ÆÖV–&W'GW&—°¢6öç7BGƒÖ‚Ö÷‚ÆG£Ö¢Ö÷£°¢–b†GƒÓÓÓbfG£ÓÓÓ—&WGW&âG'VS²òòVÒ6–ÖFòöÆ–6–Ã¢ì:6òW†—7FRF—&\:|:6òÂ6öç6–FW&f—7Fğ¢ÆWBCÔÖF‚æFã"†G‚ÆG¢’ÖöÆ†%“°¢òòæ÷&ÖÆ—¦&‚ÜøÌøÓ¢6VÒ—76òÂöÆ†"&2Ã&BRòÇfòÓ2Ã&BF&–bÃ"&BFRF–fW&Vì:v¢òò†f÷&FRVÇVW"6öæR’6VæFòVR<:6òÃ‚&BFRF—7L:&æ6–æwVÆ"FRfW&FFRà¢v†–ÆR†CäÖF‚å’–BÓÔÖF‚å’£#°¢v†–ÆR†CÂÔÖF‚å’–B³ÔÖF‚å’£#°¢&WGW&âÖF‚æ'2†B“ÃÖÖV–&W'GW&°§Ğ¢òò2ET26öæFœ:|;VW2FòVF–FòÂæW7F÷&FVÒ÷"6W6Fò7W7Fó¢Æ6æ6R†&—FÜ:—F–6’Â6öæR‡VÒFã"’À¢òòR<;2VçL:6ò&VFRâ6VÕ&VFV:’–æ¦WFFò&W7FgVì:|:6ò6öçF–çV"W&RFW7L:fVÂ(	Bæò¦övò:¢òò6V×&RFVÔÆ–æ†FUf—6öÂVR:’VVÒ6†Öò&–67BFRfW&FFRà¦W‡÷'BgVæ7F–öâfTÇfò†÷‚Æ÷’Æ÷¢ÆöÆ†%’Æ‚Æ’Æ¢ÆÖV–&W'GW&ÆÆ6æ6RÇ6VÕ&VFR—°¢6öç7BGƒÖ‚Ö÷‚ÆG£Ö¢Ö÷£°¢–b†G‚¦G‚¶G¢¦G£æÆ6æ6R¦Æ6æ6R—&WGW&âfÇ6S°¢–b‚FVçG&ôFô6öæR†÷‚Æ÷¢ÆöÆ†%’Æ‚Æ¢ÆÖV–&W'GW&’—&WGW&âfÇ6S°¢&WGW&â6VÕ&VFR†÷‚Æ÷’Æ÷¢Æ‚Æ’Æ¢“°§Ğ¦W‡÷'BgVæ7F–öâÖV–&W'GW&6öæR‡&ö7W&Fò—·&WGW&â4ôäUôÔT”ô$4R´4ôäUôÔT”õõ%ôU5E$TÄ¤ÖF‚æÖ‚ƒÇ&ö7W&F÷ÇÃ—Ğ¦W‡÷'BgVæ7F–öâÆ6æ6Uf—6ò‡&ö7W&Fò—·&WGW&âd•4õôÄ4ä4Uô$4Rµd•4õôÄ4ä4Uõõ%ôU5E$TÄ¤ÖF‚æÖ‚ƒÇ&ö7W&F÷ÇÃ—Ğ ¢òòÓÓÓÓÒ,8D”ó¢VÒf—RÂFöF÷26&VÒÓÓÓÓĞ¢òòwV&F<;29¤ÅD”Ô÷6œ:|:6òf—7FFÂ6öÒfÆ–FFRâ8’ò7Vf–6–VçFR&÷2÷WG&÷26öçfW&v—&VÒ6VĞ¢òòf—&&VÒFVÆVwV–F÷3¢æ–æw\:–Ò&V6V&R÷6œ:|:6òGVÂFò¦övF÷"Â&V6V&RöæFRVÆRW7Ffà¦ÆWBFVæ6ô66†SÖçVÆÃ²òòòFW‡Fò<;2föÇF&òDôÒVæFò×VF†VÆR×VF6F6VwVæFòÂì:6ò6FVG&ò¦6öç7B&7G&ó×¶F—fó¦fÇ6RÇƒ£Ç££ÆFS£Æf—6FôVÓ¢Ó“’Æ'W66FS£Ó°¦gVæ7F–öâ6ö×'F–Æ†$f—7FÖVçFò‡‚Ç¢Æv÷&—°¢6öç7Bæ÷fóÒ&7G&òæF—fó°¢òòòVæFW&\:vòf–6w&fFòDUô•2FRò&7G&òW6g&–#¢:’òVRf–GW&W6&—"f67VÆ†"¢òò:&VVÒfW¢FRföÇF"&&öæF6öÖò6RæFF—fW76R6öçFV6–Fòà¢VÇF–Öõf—7Fó×·‚Ç§Ó°¢&7G&òæF—fó×G'VS·&7G&òçƒ×ƒ·&7G&òç£×£·&7G&òæFSÖv÷&´ÔTÔõ$”ôÅdó°¢&7G&òæ'W66FS×&7G&òæFR´%U44ôEU$4ó°¢òòòf—6ò:’Æ–Ö—FFòæòFV×ò÷'VRò&7G&ò:’&VW67&—Fò6Ff—7FÖVçFò(	B6VÒG&fÂVĞ¢òòöÆ–6–ÂFRöÆ†òæò¦övF÷"7W7—&–ÖW6Ög&6R6FÃ22à¢–b†æ÷fòbfv÷&×&7G&òæf—6FôVÓã"—·&7G&òæf—6FôVÓÖv÷&¶Ö÷7G&$f—6ò‚	ùâFRf—&Ò(	BW7L:6ò6†ÖæFò&Vf÷,:vòæò,:F–òârÃ#ƒ—Ğ§Ğ¦gVæ7F–öâ&7G&õfÆ–Fò†v÷&—¶–b‡&7G&òæF—fòbfv÷&ç&7G&òæFR—&7G&òæF—fóÖfÇ6S·&WGW&â&7G&òæF—f÷Ğ¢òò¦æVÆFR'W66¢¬:76÷Rò&7G&òVVçFRÂÖ2–æFì:6òFW6—7F—&Òâ6†Ö"4TÕ$RFWö—2FP¢òò&7G&õfÆ–Fò(	B:’VÆRVRW‡—&ò&7G&òVVçFRà¦gVæ7F–öâVÔ'W66†v÷&—·&WGW&â&7G&òæF—fòbg&7G&òæ'W66FSãbfv÷&Ã×&7G&òæ'W66FWĞ¢òòöçFòVRU5DRöÆ–6–Âf67VÆ†v÷&âgVì:|:6òW&FòFV×òRFò6WF÷"FVÆS¢òöçFò6Rf7F¢òò6÷¦–æ†ò6öæf÷&ÖR'W66fì:vÂVçL:6òòöÆ–6–Âf'&R&f÷&6VÒ&V6—6"FRÜ:V–æFRW7FFğ¢òò,;7&–æVÒFR6÷'FV–ò6F6†VvFà¦6öç7Bö'W66×·ƒ£Ç££Ó°¦gVæ7F–öâöçFôFT'W66‡öÂÆv÷&—°¢6öç7BCÕD…$TRäÖF…WF–Ç2æ6Æ×‚†v÷&×&7G&òæFR’ô%U44ôEU$4òÃÃ“°¢6öç7B&–óÔ%U44õ$”õô”ä”4”Â²„%U44õ$”õôd”äÂÔ%U44õ$”õô”ä”4”Â’§C°¢6öç7Bæs×öÂç6WF÷$'W66·B¤%U44ôDU$•d°¢òòöçFòFVçG&òFR66÷Rf÷&FòÖì:6ò6W'fRFRFW7F–æó¢ò¢fÆ†&–RVÆRf–6&–V×W'&æFğ¢òò&VFRâÖ2FW6—7F—"RÖæF"&òöçFòFò&7G&ò4ôÄ4GWÆ–çFV—&æòÖW6ÖòFW7F–æò(	Bfö¢òòòVR&–ÖV—&fW'<:6òfW¢ÂRÖVF—RL+FR6W&:|:6òöæFR÷26WF÷&W2&öÖWFVÒ3|+âVçL:6òVÆP¢òòæFVÆò,95$”ò6WF÷"G,:2FRVÒöçFòÆ—g&RÂÖ—2W'Fò÷RÖ—2ÆöævRÂR<;2FW6—7FRæòf–Òà¢òòFVçFò6WF÷"VÒl:&–÷2&–÷2RVÒÆwVç2:&æwVÆ÷2VÒföÇFFVÆRâ<;2÷2&–÷2ì:6ò&7FÓ¢çVĞ¢òòV'FV—,:6òfV6†FòL:&ò6WF÷"–çFV—&ò6—"FVçG&òFR66ÂR:ÒòöÆ–6–ÂFW6—7F–Rf–6f¢òò$DòVÒ6–ÖFòöçFòFò&7G&ò(	BÖVF–FòÂò&–òW&6÷'&–FòVÒ#b2fö’FRÃÒ&ÃÒà¢òò÷2FW7f–÷2FR:&æwVÆò<:6òWVVæ÷2FR&÷;76—Fó¢ò7Vf–6–VçFR&6†"f–VÆòÆFòÂì:6ò&¢òò–çfF—"ò6WF÷"Fò&6V—&ò‡VRçVÆ&–òW7Æ†ÖVçFò’à¢f÷"†6öç7BFW7f–òöb%U44ôDU5d”õ2–f÷"†6öç7BW66Æöb%U44ôU44Ä2—°¢6öç7B##×&–ò¦W66ÆÆ#Öær¶FW7f–ó°¢6öç7Bƒ×&7G&òç‚´ÖF‚æ6÷2†"’§#"Ç£×&7G&òç¢´ÖF‚ç6–â†"’§##°¢–b„ÖF‚æ'2‡‚“ÃÔÔôÄ”Ô•DRbdÖF‚æ'2‡¢“ÃÔÔôÄ”Ô•DRbgöçFôæfVvfVÂ‡‚Ç¢’—°¢ö'W66çƒ×ƒµö'W66ç£×£·&WGW&âö'W66°¢Ğ¢Ğ¢ö'W66çƒ×&7G&òçƒµö'W66ç£×&7G&òç£°¢&WGW&âö'W66°§Ğ ¢òòfÆ–:|:6òFRf—<:6òFRTÒöÆ–6–ÂÂW66ÆöæFæòFV×òâFWföÇfRò&W7VÇFFòÖVÖ÷&—¦Fòæ÷2g&ÖW0¢òòVÒVRì:6ò:’fW¢FVÆR(	B:’—76òVR6VwW&ò7W7Fò÷"g&ÖR‡fW"&Æö6òFR6öç7FçFW2’à¦gVæ7F–öâW&6V&W"‡öÂÆv÷&—°¢–b†v÷&ÇöÂç&÷†–Öf—6ò—&WGW&âöÂçf—S°¢öÂç&÷†–Öf—6óÖv÷&µd•4õô”åDU%dÄó°¢òò&VæF–Fòì:6ò:’ÇfòFRf–v–Ì:&æ6–¢VVÒ¬:W7L:6öÒ2Ü:6÷2æ6&\:vì:6ò:’&ö7W&FòÂ:’&W6òà¢–b†¦övF÷%&VæF–Fò—·öÂçf—SÖfÇ6S·&WGW&âfÇ6WĞ¢òòÅEU$2DU$•dD2Dò4õ%ò‡fW"6öÖ&FRæ§2’âW&ÒÃSRRÃ(	Bì;¦ÖW&÷2F:—ö6VÒVRğ¢òòW'6öævVÒÖVF–ÃsRÒâ6öÒÃ’ÒÂò&öÆ†ò"f–6fƒ6Ò6–ÖF6&\:vFòöÆ–6–ÂRòÇfğ¢òò#’6Ò6–ÖFFò¦övF÷#¢Æ–æ†FRf—<:6ò76f÷"6–ÖFR×W&WFVRFWfW&–W66öæL:¢ÖÆòà¢6öç7B÷ƒ×öÂç÷2ç‚Æ÷“×öÂæw'Wòç÷6—F–öâç’´ÅEôôÄ„òÆ÷£×öÂç÷2ç£°¢öÂçf—S×fTÇfò†÷‚Æ÷’Æ÷¢ÇöÂæöÆ†%’ÇÆ–W"ç÷6—F–öâç‚ÇÆ–W"ç÷6—F–öâç’´ÅEõDõ%4òÇÆ–W"ç÷6—F–öâç¢À¢ÖV–&W'GW&6öæR‡öÆ–6–ç&ö7W&Fò’ÆÆ6æ6Uf—6ò‡öÆ–6–ç&ö7W&Fò’ÇFVÔÆ–æ†FUf—6ò“°¢–b‡öÂçf—R—°¢òòdÄu$åDR(	BÖ2fÆw&çFR%$R$õ$DtTÒÂì:6ò6ö&Rf–6†âV’W7FfVÆWf%&ö7W&Fòƒ–Âæğ¢òò&–ÖV—&òVG&òVÒVRVÇVW"öÆ–6–ÂVç†W&v76RÖö6†–Æ¢W&ò'<;2FVÆW2ÖRfW"ÂVÆW2¬:¢òòl:¦ÒG,:2FRÖ–Ò"âW7G&VÆv÷&<;2fVÒ6Rò&¦òF&÷&FvVÒW7F÷W&"6öÒVÆR:f—7Fà¢–b†ÆWfæFõ6÷FR‚’bgöÆ–6–ç&ö7W&FóÓÓÓ–'&—$&÷&FvVÒ†v÷&“°¢òòò,:F–ò<;2W7Æ†÷6œ:|:6òVæFòŒ:$¬84òâW7Æ†"6V×&Rf¦–&öæF6öçfW&v—"&ğ¢òò¦övF÷"ÖW6Öò6öÒf–6†Æ–×R6VÒÖö6†–Æ(	BW'6VwVœ:|:6ò6VÒÖ÷F—fòÂ6öÒ÷WG&òæöÖRà¢–b‡öÆ–6–ç&ö7W&FóãÇÆ&÷&FvVÒæF—f–6ö×'F–Æ†$f—7FÖVçFò‡Æ–W"ç÷6—F–öâç‚ÇÆ–W"ç÷6—F–öâç¢Æv÷&“°¢Ğ¢&WGW&âöÂçf—S°§Ğ ¢òòW'6VwVœ:|:6òŒ:Ö'&–F¢&WFVæFòf—<:6ò†÷&—¦öçFÂW7L:Æ–×†7W7Fò¦W&ò’Â¢VæFòì:6òW7L:à¢òò6VÒ—76òòöÆ–6–ÂæF6öçG&V–æF66L:’òFW6Væ7&fF÷"7W7—"VÆR&f÷&à¦gVæ7F–öâÇfôFTÖ÷f–ÖVçFò‡öÂÆv÷&ÆFW7E‚ÆFW7E¢—°¢6öç7BÇGW&V—Fó×öÂæw'Wòç÷6—F–öâç’´ÅEõDõ%4ó°¢–b‡f—6ô†÷&—¦öçFÄÆ—g&R‡öÂç÷2ç‚ÇöÂç÷2ç¢ÆFW7E‚ÆFW7E¢ÆÇGW&V—Fò’—°¢öÂç&÷FÖçVÆÃ·öÂæFW7F–æõ&÷FÖçVÆÃ°¢&WGW&ç·ƒ¦FW7E‚Ç£¦FW7E§Ó°¢Ğ¢òòE$dDò6öçF6öÖò&÷F–çl:Æ–FÂR6öÒF—&V—FògW&"ò÷'L:6òFRFV×ò‡fW"&—†ò“¢f–6 ¢òòÃr2V×W'&æFò&VFR:’F–fW&Vì:vVçG&R&6öçF÷&æ÷R66"R&Væ7&f÷RæVÆ"à¢6öç7BG&fFôFVÖ—3×öÂçG&fFóãÕE$dDõõ$õ$UÄäT¤#°¢6öç7B&÷F–çfÆ–F×G&fFôFVÖ—7ÇÂöÂç&÷FÇÇöÂæ–æF–6U&÷Fã×öÂç&÷FæÆVæwF€¢ÇÂöÂæFW7F–æõ&÷FÇÄÖF‚æ‡—÷B‡öÂæFW7F–æõ&÷Fç‚ÖFW7E‚ÇöÂæFW7F–æõ&÷Fç¢ÖFW7E¢“å$UÄäT¤%ôDU5d”ó°¢òòò÷'L:6òFRFV×òfÆRtõ$DÔ,8”Ò&&÷F–çl:Æ–FâçFW2W&&÷F–çfÆ–FÇÆv÷&ãÒââæÂRğ¢òò6÷'ò<;2&öFf6öÒ&÷F–çfÆ–F(	B÷R6V¦Âò÷'L:6òçVæ6&'&fæF¢&÷FçVÆ6–væ–f–6f ¢òòFöFòVG&òâVÒöÆ–6–ÂVæ7&fFòçVÖV–æ¦W&&÷FÂò¢fÆ†Â&÷F6öçF–çVçVÆÂRVÆP¢òòv7FfSƒR+W2÷"VG&ò&6V×&Rƒ3R×2÷"6VwVæFòFR5RÂFRVÒöÆ–6–Â<;2’à¢òòò÷'L:6òFRFV×òFRVVÒW7L:E$dDò:’Ö—27W'Fò(	BÖ2W†—7FRÂ6Vì:6òföÇFF÷&æV—&FR ¢òò÷"VG&òVRò6öÖVçL:&–ò6–ÖFW67&WfRà¢6öç7B÷'Fó×G&fFôFVÖ—3÷öÂç&÷†–Öõ&WÆå&W6ó§öÂç&÷†–Öõ&WÆã°¢–b‡&÷F–çfÆ–Fbfv÷&ã×÷'Fòbf6Ö–æ†÷4æW7FUVG&óÄõ$4ÔTåDõôôU5E$TÄ—°¢6Ö–æ†÷4æW7FUVG&ò²³°¢öÂç&÷†–Öõ&WÆãÖv÷&µ$UÄäT¤%ô”åDU%dÄó°¢öÂç&÷†–Öõ&WÆå&W6óÖv÷&µ$UÄäT¤%õ$U4ó°¢òòG&fFöì84ò¦W&V’â¦W&fÂRW&òVR–×VF–ò6öçF÷&æòFR6öçFV6W#¢ò&WÆæV¦ÖVçFğ¢òò†6FÃ#R2’&W6WFfò6öçFF÷"çFW2FRVÆR6†Vv"æ÷2VG&÷2Fò6öçF÷&æòÂVçL:6ò¢òò;¦æ–66:ÖFVRgVæ6–öæçVæ6W&Æ6ì:vFâVVÒ¦W&:’æF"FRfW&FFR‡76õöÆ–6–Â’à¢6öç7B6Ö–æ†óÖVæ6öçG&$6Ö–æ†ò‡öÂç÷2ç‚ÇöÂç÷2ç¢ÆFW7E‚ÆFW7E¢“°¢–b†6Ö–æ†òbf6Ö–æ†òæÆVæwF‚—·öÂç&÷FÖ6Ö–æ†ó·öÂæ–æF–6U&÷FÓ·öÂæFW7F–æõ&÷F×·ƒ¦FW7E‚Ç£¦FW7E§×Ğ¢VÇ6W·öÂç&÷FÖçVÆÃ·öÂæFW7F–æõ&÷FÖçVÆÇĞ¢Ğ¢òòÓÓÓÓÒ”äD$%$DòDUô•2DR$UÄäT¤#¢4ôåDõ$äÓÓÓÓĞ¢òò&WÆæV¦"6÷¦–æ†òì84ò&W6öÇfRÂRÖVFœ:|:6òÖ÷7G&÷R÷"\:£¢ò¢'FRF÷6œ:|:6òGVÂRÂF¢òòÖW6Ö÷6œ:|:6òÂFWföÇfRÔU4Ô&÷FâòöÆ–6–Âf–6f÷66–ÆæFò(	B&WÆæV¦ÂæFRÖÒÂ&'&À¢òò&WÆæV¦(	B“RRF÷2VG&÷2&'&F÷26VÒçVæ66ö×ÆWF"VÖ&FÆöævâòVRfÇFì:6ò:¢òò&÷Fæ÷fÂ:’4•"D$TDRà¢òğ¢òòVçL:6òÂ–ç6—7F–æFòò&7FçFRÂòÇfò766W"“+&VÒF÷2ÆF÷3¢VÆR&7&VFRL:¢òòFö'&"V–æÂVR:’òVRVÖW76öf¢âòÆFò:’f—†ò÷"öÆ–6–Â†ÆFôfÆæ6öÂVR¢òòWV—RFR6öÖ&FR¬:W6’&VÆRì:6òv–æv"VçG&R÷2Fö—2âfÆR4ôÒ÷R4TÒ&÷F(	B&÷FöFP¢òòW7F"6W'FRò6÷'ò:’VRì:6ò76¢ædÖW6‚F–ÆFö'7L:7VÆòVÒÃ#ÒRò6÷'òFVÒÃ#0¢òòFRÖV–ÖÆ&wW&ÂVçL:6òW†—7FR6Ö–æ†òVRò¢&÷fRò6÷'ò&7à¢–b‡öÂçG&fFóãÕE$dDõõ$ô4ôåDõ$ä"—°¢6öç7BGƒÖFW7E‚×öÂç÷2ç‚ÆG£ÖFW7E¢×öÂç÷2ç¢ÆCÔÖF‚æ‡—÷B†G‚ÆG¢—ÇÃ°¢òòÅDU$äòÄDòâçVÒ6çFò–çFW&æò÷2Dô•2ÆF÷2W7L:6òfV6†F÷2&VÒFVÆW3²–ç6—7F–æFò6V×&P¢òòæòÖW6ÖòÂVÆRf–6&7æFòV–æ&6V×&RâG&ö6æFòFRÆFò6FFçFòVÆRW‡W&–ÖVçF¢òò÷2Fö—2ÂRVÒFVÆW2'&Rà¢6öç7BÆFóÒ„ÖF‚æfÆö÷"‡öÂçG&fFòõE$dDõõ$ô4ôåDõ$ä"’S#òÓ£’¢‡öÂæÆFôfÆæ6÷ÇÃ“°¢&WGW&ç·ƒ§öÂç÷2ç‚ÖG¢öB¤4ôåDõ$äõõ54ò¦ÆFòÇ£§öÂç÷2ç¢¶G‚öB¤4ôåDõ$äõõ54ò¦ÆF÷Ó°¢Ğ¢–b‚öÂç&÷F—&WGW&ç·ƒ¦FW7E‚Ç£¦FW7E§Ó°¢ÆWBw×öÂç&÷F·öÂæ–æF–6U&÷FÓ°¢v†–ÆR‡wbdÖF‚æ‡—÷B‡wç‚×öÂç÷2ç‚Çwç¢×öÂç÷2ç¢“Ä4„TtDõt•ô”åB—·w×öÂç&÷F²²·öÂæ–æF–6U&÷F×Ğ¢&WGW&âwÇÇ·ƒ¦FW7E‚Ç£¦FW7E§Ó°§Ğ ¢òòVÒ76òFR6Ö–æ†F6öÒ6öÆ—<:6ò÷"V—†ò²æ–Ö:|:6òFRW&æâFWföÇfR6RæF÷RâöÆ†%–<;2:¢òò&VW67&—FòVæFòò6÷'ò6RÖ÷fS¢&FòÂòöÆ–6–ÂÖçL:–ÒF—&\:|:6òFòöÆ†"ÂVR:’§W7FÖVçFRğ¢òòVRò6öæRFRf—<:6ò6öç7VÇFà¦gVæ7F–öâ76õöÆ–6–Â‡öÂÆGBÆÇfõ‚ÆÇfõ¢ÇfVÆö6–FFR—°¢6öç7BçFW5ƒ×öÂç÷2ç‚ÆçFW5£×öÂç÷2ç£°¢6öç7BGƒÖÇfõ‚×öÂç÷2ç‚ÆG£ÖÇfõ¢×öÂç÷2ç¢ÆCÔÖF‚æ‡—÷B†G‚ÆG¢—ÇÃ°¢6öç7BgƒÖG‚öB§fVÆö6–FFRÇg£ÖG¢öB§fVÆö6–FFS°¢6öç7Bçƒ×öÂç÷2ç‚·g‚¦GBÆç£×öÂç÷2ç¢·g¢¦GC¶ÆWBÖ÷fWSÖfÇ6S°¢–b‚6öÆ–FUVFW7G&R†ç‚ÇöÂç÷2ç¢’—·öÂç÷2çƒÖçƒ¶Ö÷fWS×G'VWĞ¢–b‚6öÆ–FUVFW7G&R‡öÂç÷2ç‚Æç¢’—·öÂç÷2ç£Öç£¶Ö÷fWS×G'VWĞ¢öÂçfVÆö6—G’ç6WB†Ö÷fWS÷gƒ£ÃÆÖ÷fWS÷g££“°¢òòÓÓÓÓÒ$DU"ä$TDRì84ò¤ôt$õDdõ$ÓÓÓÓĞ¢òò¦övfÂRW&—76òò&öÌ:Ö6–f–6&FVæFòæ2662RG&f"âò6–6ÆòÂÖVF–Fó¢VÆR&7çVÖ¢òòV–æ(i"&÷F:’vF(i"ÇfôFTÖ÷f–ÖVçFöf–6Ãr26VÒöFW"&WÆæV¦"†ò÷'L:6òFRFV×ò¢òò(i"6VÒ&÷FÂ;¦æ–66:ÖF:’Ä”ä„$UDL:’òFW7F–æò(i"&WFöçFW†FÖVçFR&&VFRVĞ¢òòVRVÆR6&÷RFR&FW"(i"&FRFRæ÷fòâòFW6Væ7&fF÷"F—&fVÆR36Ò&f÷&R&WFğ¢òòFWföÇf–&FVçG&òæòVG&ò6VwV–çFRâÖVF–Fó¢ƒRF÷2VG&÷2&'&F÷2RVÒöÆ–6–Â&Fğ¢òòC’6VwVæF÷2æòÖW6ÖòÇVv"à¢òò&÷Fì:6òF–æ†æFFRW'&Fò(	BVÆRVæ6÷7F÷RçVÖV–ææòÖV–òFò6Ö–æ†òâòVR6RwV&F¢òòv÷&:’Œ8TåDõ2TE$õ2VÆRW7L:&'&FòÂRVVÒFV6–FRòVRf¦W"6öÒ—76ò:’ÇfôFTÖ÷f–ÖVçFöà¢òòE$dDòì84ò8’$äTä…TÒT•„òäDõR"Â8’%T4Rì84ò4•RDòÅTt""â&–ÖV—&fW'<:6ò6öçFf<;0¢òòVæFò÷2Dô•2V—†÷2fÆ†fÒ(	BRò66ò&VÂÖVF–FòW&÷WG&ó¢VW&VæFò—"&Õ¢6öÒ&VFP¢òòæò¢ÂVÆRFW6Æ—¦fæò‚Vç2RÔ”Ì8ÔÔUE$õ2õ"4TuTäDòâÖ÷fWVW&G'VRÂò6öçFF÷"çVæ67V&–À¢òòRVÆR76÷R#"2&7æFòòÖW6Öò×W&òâòVR6W&&6öçF÷&ææFò"FR&Væ7&fFò":’g&:|:6ğ¢òòFò76òVF–FòVRVÆR6öç6VwV—RæF#¢&7"VÖ&VFRC\+&VæFRãsS²V×W'&"VÖ&VFP¢òòFRg&VçFR&VæFRãà¢6öç7BæF÷SÔÖF‚æ‡—÷B‡öÂç÷2ç‚ÖçFW5‚ÇöÂç÷2ç¢ÖçFW5¢“°¢–b†æF÷SÇfVÆö6–FFR¦GB¤e$4õôDUõ54õõE$dDò—öÂçG&fFò²³°¢VÇ6RöÂçG&fFóÓ°¢–b†Ö÷fWR—°¢öÂæöÆ†%“ÔÖF‚æFã"‡g‚Çg¢“·öÂæw'Wòç&÷FF–öâç“×öÂæöÆ†%“°¢òò6öÒ6÷'ò4BVVÒæF:’òW7VVÆWFò‡fW"W'6öævVÕöÆ–6–Â“²ò&Æì:vòFRW&æ&—†ò:’F0¢òò4•„2ÂRv—&"6—†VR¬:W7L:–çf—<:×fVÂ6W&–G&&Æ†ò÷"æF(	BÌ:–ÒFR6ö'&W67&WfW"¢òò÷6RFò6Æ—R66ò2GV26ö—62&öF76VÒ§VçF2à¢–b‚öÂæ6÷'ò—°¢öÂæ6Ö–æ†æFò³ÖGB£s¶6öç7B&Ææ6óÔÖF‚ç6–â‡öÂæ6Ö–æ†æFò’¢ãC°¢öÂçW&æ5³Òç&÷FF–öâçƒÖ&Ææ6ó·öÂçW&æ5³Òç&÷FF–öâçƒÒÖ&Ææ6ó°¢Ğ¢Ğ¢òòfVÆö6–FFR$TÂFW7FRVG&òÂì:6òVF–F¢òöÆ–6–ÂVRW7L:&7æFòçVÖ&VFRVFP¢òòÃrÒ÷2RæFÃ(	Bæ–Ö"VÆfVÆö6–FFRVF–FFV—†&–VÆR6÷'&VæFò&Fò6öçG&ò×W&òà¢öÂçfVÆö6–FFTæFæFóÖÖ÷fWSôÖF‚æ‡—÷B‡öÂç÷2ç‚ÖçFW5‚ÇöÂç÷2ç¢ÖçFW5¢’ôÖF‚æÖ‚†GBÃRÓB“£°¢&WGW&âÖ÷fWS°§Ğ¦gVæ7F–öâVæ6&%öçFò‡öÂÇ‚Ç¢—·öÂæöÆ†%“ÔÖF‚æFã"‡‚×öÂç÷2ç‚Ç¢×öÂç÷2ç¢“·öÂæw'Wòç&÷FF–öâç“×öÂæöÆ†%“·öÂçfVÆö6–FFTæFæFóÓĞ ¢òòÓÓÓÓÒä”äu\8”Òô5UòÔU4ÔòÅTt"ÓÓÓÓĞ¢òò76õöÆ–6–Æ<;2FW7F6öÆ—<:6ò6öçG&$TDRâöÆ–6–Âì:6òW&ö'7L:7VÆò&öÆ–6–ÂæVÒ&ğ¢òò¦övF÷"ÂVçL:6òVG&òFVÆW26öçfW&v–æFòæòÖW6ÖòöçFòFR6ö&W'GW&FW&Ö–æfÒV×–Æ†F÷2æòÖW6Öğ¢òòÖWG&òVG&FòÂRVÒVRfì:v76RL:’F—7L:&æ6–Ü:Öæ–ÖVçG&fDTåE$òFò¦övF÷"â8’ğ¢òò&VÆW2'VvÒÂVçG&ÒFVçG&òFòÖWRW'6öævVÒÂVçG&ÒVÒFVçG&òFò÷WG&ò"à¢òğ¢òò6W&:|:6ò&öFDUô•2FRFöFò×VæFòæF"ÂòVR:’òVRF÷&æW7L:fVÃ¢&W6öÇfW"GW&çFRğ¢òòÖ÷f–ÖVçFòf¢V×W'&""Â"V×W'&"FRföÇFÂR÷2Fö—2G&VÖW&VÒæòÇVv"âV’6F"6P¢òòf7FÖWFFRF6ö'&W÷6œ:|:6òÂVÖfW¢÷"VG&ò(	BRòV×W',:6ò76VÆòÖW6ÖòFW7FRFR&VFP¢òòFò76òæ÷&ÖÂÂ6Vì:6ò6W&:|:6òVæf–&–VÒFVÆW2FVçG&òFò×W&òà¦6öç7B$”õô4õ%óÒã3C²òòÖV–ò6÷'òæòÆæòÂ6öÒföÆvFRöÖ'&ğ¦6öç7B$”õô¤ôtDõ#ÒãC#°¦6öç7Bö6÷'÷3ÕµÓ°¦gVæ7F–öâV×W'&"‡öÂÆG‚ÆG¢—°¢–b‚6öÆ–FUVFW7G&R‡öÂç÷2ç‚¶G‚ÇöÂç÷2ç¢’—öÂç÷2ç‚³ÖGƒ°¢–b‚6öÆ–FUVFW7G&R‡öÂç÷2ç‚ÇöÂç÷2ç¢¶G¢’—öÂç÷2ç¢³ÖG£°§Ğ¦gVæ7F–öâ6W&$6÷'÷2‚—°¢ö6÷'÷2æÆVæwFƒÓ°¢f÷"†6öç7BöböÆ–6–—2––b‡çf—fò•ö6÷'÷2çW6‚‡“°¢6öç7BÖ–ãÕ$”õô4õ%ò£"ÆÖ–ã#ÖÖ–â¦Ö–âÆÖ–ä£Õ$”õô4õ%òµ$”õô¤ôtDõ#°¢f÷"†ÆWB“Ó¶“Åö6÷'÷2æÆVæwFƒ¶’²²—°¢6öç7BÕö6÷'÷5¶•Ó°¢f÷"†ÆWB£Ö’³¶£Åö6÷'÷2æÆVæwFƒ¶¢²²—°¢6öç7B#Õö6÷'÷5¶¥Ó°¢ÆWBGƒÖ"ç÷2ç‚Öç÷2ç‚ÆG£Ö"ç÷2ç¢Öç÷2ç£°¢ÆWBCÔÖF‚ç7'B†G‚¦G‚¶G¢¦G¢“°¢–b†B¦CãÖÖ–ã"–6öçF–çVS°¢òòW†FÖVçFRæòÖW6ÖòöçFò†Fö—2æ66VæFòæÖW6Ö6ö÷&FVæFÂ÷RVÒ&VÂVÒ6–ÖFò÷WG&ò“ ¢òò6VÒF—&\:|:6ò&6W&"Âò:&æwVÆò:W&VòVÆò:ÖæF–6RFW6V×F6VÒ6÷'FV–òR6VÒF—f—<:6ò÷ ¢òò¦W&ò(	BRL:F—&\:|;VW2F–fW&VçFW2&6F"ÂVÒfW¢FR¦öv"FöFò×VæFò&òÖW6ÖòÆFòà¢–b†CÃRÓ2—¶6öç7BæsÖ’£"ã3“““c3¶GƒÔÖF‚æ6÷2†ær“¶G£ÔÖF‚ç6–â†ær“¶CÓĞ¢6öç7BÖV–óÒ†Ö–âÖB’ó"ÇWƒÖG‚öB¦ÖV–òÇW£ÖG¢öB¦ÖV–ó°¢V×W'&"†Â×W‚Â×W¢“¶V×W'&"†"ÇW‚ÇW¢“°¢Ğ¢ÆWBGƒÖç÷2ç‚×Æ–W"ç÷6—F–öâç‚ÆG£Öç÷2ç¢×Æ–W"ç÷6—F–öâç£°¢ÆWBCÔÖF‚ç7'B†G‚¦G‚¶G¢¦G¢“°¢–b†CÆÖ–ä¢—°¢–b†CÃRÓ2—¶GƒÔÖF‚ç6–â†æöÆ†%—ÇÃ“¶G£ÔÖF‚æ6÷2†æöÆ†%—ÇÃ“¶CÓĞ¢6öç7BcÒ†Ö–ä¢ÖB’öC°¢V×W'&"†ÆG‚¦bÆG¢¦b“°¢Ğ¢òòò6÷'ò¬:fö’76VçFFòæW7FRVG&ó²6VÒ&VW67&WfW"‚õ¢V’òV×W',:6ò<;2&V6W&–æğ¢òòVG&ò6VwV–çFRÂR6ö'&W÷6œ:|:6ò—66&–6Fg&ÖRVÒfW¢FR7VÖ—"à¢æw'Wòç÷6—F–öâçƒÖç÷2çƒ¶æw'Wòç÷6—F–öâç£Öç÷2ç£°¢æ&'&ç÷6–6–öæ"†ç÷2ç‚Ææw'Wòç÷6—F–öâç’Æç÷2ç¢“°¢Ğ§Ğ ¢òò76VçFò6÷'òæò6Œ:6ò(	BR6ö&RæÆ¦RVæFòò¦övF÷"W7L:Ì:VÒ6–Öâò¢:’$BRì:6ò6öæ†V6P¢òòW66F&–ÂVçL:6ò&Vw&Ö—26–×ÆW2VRgVæ6–öæ:’W7F¢6†VvæFòVÖ&—†òFò¦övF÷"VÆWfFğ¢òò(šC"ÃRÒæòÆæò’ÂòöÆ–6–Âvæ†ÇGW&L:’ÇGW&FVÆRÂ6öÖò6RF—fW76R7V&–FòW66Fâ7W7F¢òò¦W&ò&–67BÂRf—7VÆÖVçFR&W6öÇfRò66òVR–×÷'F(	BgVv—"&Æ¦RFV—†"FR6W"–×Væ–FFRà¦gVæ7F–öâ76VçF%öÆ–6–Â‡öÂÆGBÇW'6VwV–æFò—°¢6öç7B6†óÖö'FW$VÆWf6ò‡öÂç÷2ç‚ÇöÂç÷2ç¢“°¢ÆWBÇfõ“Ö6†ó°¢–b‡W'6VwV–æFòbgÆ–W"ç÷6—F–öâç“æ6†ò³ã"bfF—7E…¢‡öÂç÷2ÇÆ–W"ç÷6—F–öâ“Ã"ãR–Çfõ“×Æ–W"ç÷6—F–öâç“°¢–b‡öÂæÇGW&GVÃÓÓÖçVÆÂ—öÂæÇGW&GVÃÖÇfõ“°¢6öç7B76óÓ"ãB¦GC²òòfVÆö6–FFRFR7V&–FöFW66–FÂVÒÖWG&÷2÷"6VwVæFğ¢öÂæÇGW&GVÂ³ÕD…$TRäÖF…WF–Ç2æ6Æ×†Çfõ’×öÂæÇGW&GVÂÂ×76òÇ76ò“°¢öÂæw'Wòç÷6—F–öâç6WB‡öÂç÷2ç‚ÇöÂæÇGW&GVÂÇöÂç÷2ç¢“°§Ğ ¢òòw&W76—f–FFRVÒgVì:|:6òFf–6†¢Ö—2,:–FòÂÖ—26FVæ6–FòR6†VvæFòÖ—2W'Fòà¦gVæ7F–öâfVÆö6–FFUöÆ–6–Â†&6R—·&WGW&â&6R¢ƒ´u$U54õõdTÅõõ%ôU5E$TÄ§öÆ–6–ç&ö7W&Fò—Ğ¦gVæ7F–öâ6ööÆF÷våF—&ò‚—°¢6öç7BfF÷#ÔÖF‚æÖ‚‚ÛjÇºã
âµç«®ŠÁ®‰˜©z35,1-AGRESSAO_CADENCIA_POR_ESTRELA*policia.procurado);
  return (POLICIAL_COOLDOWN_MIN+Math.random()*(POLICIAL_COOLDOWN_MAX-POLICIAL_COOLDOWN_MIN))*fator;
}

// ===== O DISPARO, UM LUGAR SÃ“ =====
// Havia DUAS cÃ³pias deste cÃ³digo (a de rua e a de combate), com as mesmas alturas erradas e o mesmo
// modelo de espalhamento copiado. Duas cÃ³pias do mesmo cÃ¡lculo divergem na primeira correÃ§Ã£o â€” e
// divergiram: a de rua nem checava linha de visÃ£o antes de puxar o gatilho.
//
// A cadeia agora Ã© a de um atirador de verdade, e nÃ£o "viu â†’ acerta":
//   DETECÃ‡ÃƒO â†’ REAÃ‡ÃƒO (0,28-0,70 s, sorteada por policial) â†’ MIRA QUE ASSENTA (1,4 s) â†’ DISPARO.
// `pol.viuDesde` Ã© o relÃ³gio dessa cadeia, e ele ZERA quando a linha de visÃ£o quebra: quem se
// esconde e reaparece forÃ§a o cara a comeÃ§ar de novo, que Ã© o que dÃ¡ funÃ§Ã£o a usar cobertura.
const _origem=new THREE.Vector3(),_dir=new THREE.Vector3();
// Quanto tempo o policial mantÃ©m a mira depois de PERDER o alvo de vista. Zerar na hora era puniÃ§Ã£o
// dupla: um jogador andando de lado sai e entra do cone o tempo todo, e a cada saÃ­da a mira voltava a
// ficar fria (2,2x de erro). Medido: 7% de acerto contra alvo em movimento a 9 m, quase inatingÃ­vel.
// Meio segundo de tolerÃ¢ncia Ã© o que um atirador humano tem â€” ele nÃ£o esquece onde vocÃª estava.
const GRACA_MIRA=.6;
function tentarAtirar(pol,agora,viu,andando){
  if(!viu){
    // Perdeu de vista: a mira sÃ³ zera se ficar perdida alÃ©m da graÃ§a.
    if(pol.viuDesde&&agora-(pol.viuPor||agora)>GRACA_MIRA)pol.viuDesde=0;
    return false;
  }
  pol.viuPor=agora;
  if(!pol.viuDesde){pol.viuDesde=agora;pol.prontoEm=agora+tempoDeReacao();return false}
  if(agora<pol.prontoEm||agora<pol.proximoTiro)return false;
  if(jogadorRendido)return false;
  const dist=distXZ(pol.pos,player.position);
  if(dist>POLICIAL_ALCANCE_TIRO)return false;
  const ox=pol.pos.x,oy=pol.grupo.position.y+ALT_CANO,oz=pol.pos.z;
  // ANTECIPAÃ‡ÃƒO: mira onde o alvo VAI estar quando a bala chegar, nÃ£o onde ele estÃ¡. Sem isto, um
  // jogador andando de lado a 9 m era inatingÃ­vel â€” medido, 0% de acerto em 24 s. O fator Ã© 0,62 com
  // ruÃ­do, nÃ£o 1: um atirador humano lÃª o movimento, mas nÃ£o resolve a equaÃ§Ã£o â€” e Ã© essa imperfeiÃ§Ã£o
  // que mantÃ©m correr e trocar de direÃ§Ã£o sendo defesa de verdade.
  const voo=dist/VELOCIDADE_BALA;
  const lead=voo*(LEAD_FATOR+(Math.random()*2-1)*LEAD_RUIDO);
  const ax=player.position.x+velJogador.x*lead,
        ay=player.position.y+ALT_TORSO,
        az=player.position.z+velJogador.z*lead;
  // A linha Ã© medida do CANO ao TRONCO, que Ã© por onde a bala passa. Medir de outro par de alturas
  // deixava o policial atirar na parede achando que tinha caminho.
  if(!temLinhaDeVisao(ox,oy,oz,player.position.x,player.position.y+ALT_TORSO,player.position.z))return false;
  pol.proximoTiro=agora+cooldownTiro();pol.tiroVisualAte=agora+1.15;
  const espalhamento=espalhamentoDoTiro({
    dist,tempoMirando:agora-pol.viuDesde,policialAndando:andando,procurado:policia.procurado});
  pol.ultimoEspalhamento=espalhamento;
  _dir.set(ax-ox,ay-oy,az-oz).normalize();
  _dir.x+=(Math.random()*2-1)*espalhamento;
  _dir.y+=(Math.random()*2-1)*espalhamento*.6;
  _dir.z+=(Math.random()*2-1)*espalhamento;
  _origem.set(ox,oy,oz);
  dispararBala(_origem,_dir,false);
  tocarSomTiro('policia',_origem,'policia');
  pol.tiros=(pol.tiros||0)+1;
  return true;
}

function atualizarPolicialCombate(pol,dt,agora,vendoMemorizado=null){
  if(!pol.vivo){
    if(pol.caindo){
      pol.quedaT+=dt;pol.grupo.rotation.x=Math.min(Math.PI/2,pol.quedaT*4);
      if(pol.quedaT>1.1)pol.grupo.visible=false;
    }
    pol.barra.mostrar(false);
    return;
  }
  // ===== PERCEPÃ‡ÃƒO ANTES DE TUDO =====
  // O policial nÃ£o sabe mais onde o jogador estÃ¡ por decreto: ou ele VÃŠ (cone + linha de visÃ£o), ou
  // trabalha com o rastro do rÃ¡dio â€” a Ãºltima posiÃ§Ã£o avistada por alguÃ©m da equipe. Sem nenhum dos
  // dois ele fica no lugar, olhando em volta. Ã‰ o que separa "IA que persegue pelas coordenadas" de
  // "IA que procura".
  // ===== PERCEPÃ‡ÃƒO ANTES DE TUDO =====
  // O policial nÃ£o sabe onde o jogador estÃ¡ por decreto: ou ele VÃŠ (cone + linha de visÃ£o), ou
  // trabalha com o rastro do rÃ¡dio â€” a Ãºltima posiÃ§Ã£o avistada por alguÃ©m da equipe.
  // A patrulha jÃ¡ mediu a percepÃ§Ã£o neste quadro; reaproveita o resultado em combate.
  const vendo=vendoMemorizado===null?perceber(pol,agora):vendoMemorizado;
  const dist=distXZ(pol.pos,player.position);
  const gatilho=policialTemGatilho(pol,agora);

  // ===== ONDE ELE ACHA QUE O ALVO ESTÃ =====
  // Vendo, Ã© o jogador. Sem ver, Ã© a ÃšLTIMA POSIÃ‡ÃƒO CONHECIDA â€” nunca a atual. Ã‰ o que impede o
  // policial de continuar apontando pra alguÃ©m que jÃ¡ dobrou a esquina.
  let alvoX=null,alvoZ=null;
  if(vendo){alvoX=player.position.x;alvoZ=player.position.z}
  else if(rastroValido(agora)){alvoX=rastro.x;alvoZ=rastro.z}

  // ===== REAÃ‡ÃƒO A LEVAR TIRO =====
  // Quem estÃ¡ apanhando nÃ£o fica plantado. Perder vida liga uma janela de "pressionado", e nela o
  // policial passa a procurar cobertura independente do papel que tinha.
  if(pol.hp<pol.hpAnterior){pol.pressionadoAte=agora+3;pol.cobertura=null}
  pol.hpAnterior=pol.hp;
  const pressionado=agora<(pol.pressionadoAte||0);

  // ===== PARA ONDE ELE VAI =====
  let destino=null,querParar=false;
  if(gatilho&&alvoX===null){alvoX=player.position.x;alvoZ=player.position.z}
  if(alvoX!==null){
    const buscandoCobertura=pressionado||pol.papel===PAPEL.COBERTURA;
    if(buscandoCobertura){
      // Recalcula cobertura no mÃ¡ximo a cada 1,2 s: a varredura sÃ£o 30 testes de ponto navegÃ¡vel
      // mais linha de visÃ£o, e fazer isso por quadro por policial Ã© o tipo de coisa que engasga no
      // celular sem melhorar nada â€” cobertura nÃ£o muda de lugar em 16 ms.
      if(!pol.cobertura||agora>pol.proximaCobertura){
        pol.proximaCobertura=agora+1.2;
        pol.faseCobertura=Math.random()*Math.PI*2;
        pol.cobertura=procurarCobertura(pol,alvoX,alvoZ,
          (px,py,pz,ax,az)=>temLinhaDeVisao(px,py,pz,ax,obterElevacao(ax,az)+ALT_TORSO,az),
          (px,pz)=>obterElevacao(px,pz));
      }
      if(pol.cobertura){
        // Colado na cobertura ele ESPIA: sai pro ponto de tiro, dÃ¡ o tiro, volta. Sem isso a
        // "cobertura" vira o policial escondido pra sempre e a troca morre de tÃ©dio.
        const naCobertura=Math.hypot(pol.pos.x-pol.cobertura.x,pol.pos.z-pol.cobertura.z)<1.1;
        const espiando=naCobertura&&agora>=pol.proximoTiro-.45;
        destino=espiando?{x:pol.cobertura.saidaX,z:pol.cobertura.saidaZ}
                        :{x:pol.cobertura.x,z:pol.cobertura.z};
      }
    }
    if(!destino){
      const p=destinoDoPapel(pol,alvoX,alvoZ);
      destino=p;
      // Chegou na distÃ¢ncia que o papel quer: para de andar e trabalha a mira. Atirar parado Ã© mais
      // preciso (ver Combate.js), entÃ£o parar Ã© uma decisÃ£o tÃ¡tica, nÃ£o uma pausa de animaÃ§Ã£o.
      querParar=dist<=stoppingDistance;
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
    encararPonto(pol,alvoX,alvoZ);// olhando pra Ãºltima posiÃ§Ã£o conhecida
  }else{
    // Perdeu o rastro: varre o olhar devagar em vez de congelar encarando o nada â€” e Ã© esse giro que
    // dÃ¡ ao jogador a chance de contornar por trÃ¡s, que Ã© o ponto do cone de visÃ£o existir.
    pol.olharY+=dt*.7;pol.grupo.rotation.y=pol.olharY;
  }
  // Desencrava se acabou dentro de uma parede.
  if(colidePedestre(pol.pos.x,pol.pos.z)){
    const livre=buscarPosicaoLivre(pol.pos.x,pol.pos.z,colidePedestre);
    if(livre){pol.pos.x=livre.x;pol.pos.z=livre.z;pol.rota=null;pol.destinoRota=null}
  }
  // Acompanha o jogador pra cima da laje quando ele sobe e o policial estÃ¡ colado: sem isso ele fica
  // preso no chÃ£o atirando na sola do pÃ© de quem estÃ¡ no telhado.
  assentarPolicial(pol,dt,vendo);
  pol.barra.posicionar(pol.pos.x,pol.grupo.position.y,pol.pos.z);
  pol.barra.mostrar(pol.hp<POLICIAL_HP);
  tentarAtirar(pol,agora,vendo,andando);
}

// ===== Tiro do jogador =====
// A mira Ã© a do centro da tela (cÃ¢mera), mas a bala nasce no cano da arma â€” que fica ~1 m Ã  frente e ao
// lado da cÃ¢mera. Mirar num ponto FIXO a 60 m como antes tinha dois defeitos: esse ponto pode cair
// dentro/atrÃ¡s de uma parede, e em alvo prÃ³ximo o erro de paralaxe chega a atan(0,5/3) â‰ˆ 9,5Â°, que Ã©
// exatamente a sensaÃ§Ã£o de "errei o que estava na mira".
// CorreÃ§Ã£o: resolver o ponto visado de verdade, pelo mesmo slab test do resto da fÃ­sica.
const _dirCamera=new THREE.Vector3(),_visado=new THREE.Vector3();
// `miraNoAlvo` Ã© lido pelo HUD: Ã© o que faz a mira mudar de cor quando estÃ¡ em cima de um policial â€”
// sem esse retorno o jogador nÃ£o tem nenhuma confirmaÃ§Ã£o de pontaria antes de gastar a bala.
let miraNoAlvo=false;
function resolverPontoVisado(alcance){
  camera.getWorldDirection(_dirCamera);
  const ox=camera.position.x,oy=camera.position.y,oz=camera.position.z;
  const dx=_dirCamera.x*alcance,dy=_dirCamera.y*alcance,dz=_dirCamera.z*alcance;
  let melhorT=1;
  const parede=primeiroImpactoNoSegmento(ox,oy,oz,ox+dx,oy+dy,oz+dz);
  if(parede)melhorT=parede.t;
  miraNoAlvo=false;
  // A mira gruda no CORPO, nÃ£o na parede atrÃ¡s dele: se o alvo vier antes, Ã© ele que define o ponto.
  for(const pol of policiais){
    if(!pol.vivo||pol.caindo)continue;
    for(const zona of zonasDoPolicial(pol)){
      const t=intersectarSegmentoCaixa(zona.caixa,ox,oy,oz,dx,dy,dz);
      if(t!==null&&t<melhorT){melhorT=t;miraNoAlvo=true}
    }
  }
  // ===== O CHÃƒO TAMBÃ‰M Ã‰ ALVO =====
  // Faltava ele, e a falta tinha um custo medido: quando o raio nÃ£o achava NADA â€” nem parede nem
  // policial â€” o ponto visado ia pro alcance mÃ¡ximo da arma (120 m na pistola). Como a bala nasce no
  // cano e a mira Ã© da cÃ¢mera, as duas retas sÃ³ se encontram NESSE ponto; em qualquer distÃ¢ncia
  // menor sobra Ã¢ngulo. Medido, mirando no vazio: 0,61Â°, que Ã© 32 cm fora da mira a 30 m e 53 cm a
  // 50 m â€” mais que a largura de um tronco.
  //
  // O pior nÃ£o era o erro em si, era o PULO. Basta a mira escorregar do policial pra fora da caixa
  // dele e o ponto visado salta de 30 m pra 120 m de um quadro pro outro, e a bala muda 32 cm de
  // lugar. Movimento mÃ­nimo da mira, mudanÃ§a enorme no tiro: Ã© isso que se sente como "sem
  // precisÃ£o".
  //
  // Com o chÃ£o entrando na conta, quase todo tiro tem um alvo real atrÃ¡s do que se mira â€” e o ponto
  // visado passa a andar de forma contÃ­nua em vez de pular. A busca Ã© uma varredura simples: anda
  // pelo raio e para no primeiro passo abaixo do chÃ£o, depois refina por bisseÃ§Ã£o. Contra o chÃ£o
  // DESENHADO, que Ã© a superfÃ­cie que o jogador vÃª (ver Terrain.js).
  if(_dirCamera.y<0){
    const PASSO=2;
    let anterior=0;
    for(let d=PASSO;d<=melhorT*alcance;d+=PASSO){
      const px=ox+_dirCamera.x*d,py=oy+_dirCamera.y*d,pz=oz+_dirCamera.z*d;
      if(py<=alturaDoChaoDesenhado(px,pz)){
        // BisseÃ§Ã£o entre o Ãºltimo passo acima do chÃ£o e este, que jÃ¡ estÃ¡ abaixo.
        let lo=anterior,hi=d;
        for(let i=0;i<12;i++){
          const m=(lo+hi)/2;
          const mx=ox+_dirCamera.x*m,my=oy+_dirCamera.y*m,mz=oz+_dirCamera.z*m;
          if(my<=alturaDoChaoDesenhado(mx,mz))hi=m;else lo=m;
        }
        melhorT=Math.min(melhorT,hi/alcance);
        break;
      }
      anterior=d;
    }
  }
  // Piso de 2 m: com o jogador de nariz na parede, um t minÃºsculo inverteria a direÃ§Ã£o da bala.
  const distancia=Math.max(2,melhorT*alcance);
  return _visado.set(ox+_dirCamera.x*distancia,oy+_dirCamera.y*distancia,oz+_dirCamera.z*distancia);
}
const _dirTiro=new THREE.Vector3(),_dirChumbo=new THREE.Vector3(),_origemTiro=new THREE.Vector3();
let avisouSemMunicao=false;
export function atirar(){
  const agora=performance.now()/1000;
  // No modo drone a cÃ¢mera nÃ£o Ã© a do jogador â€” mirar por ela lanÃ§aria a bala de qualquer lugar do mapa.
  if(agora<proximoTiroJogador||jogadorRendido||droneState.ativo)return;
  const arma=armaEquipada(),restante=inventario.municao[arma.id];
  if(restante<arma.gasto){
    // Com o gatilho segurado o dedo fica no botÃ£o: sem esta trava o aviso repetiria a cada 0,9 s pra
    // sempre. Volta a false quando o gatilho solta ou quando sai um tiro vÃ¡lido.
    if(!avisouSemMunicao){avisouSemMunicao=true;mostrarAviso(`Sem muniÃ§Ã£o de ${arma.nome} â€” compre na Loja de Armas (nordeste do mapa).`,2400);tocarSomSemMunicao()}
    proximoTiroJogador=agora+.9;return;
  }
  avisouSemMunicao=false;
  proximoTiroJogador=agora+arma.cooldown;
  alertarDisparoProximo(player.position.x,player.position.z);
  inventario.municao[arma.id]-=arma.gasto;atualizarHudMunicao();
  // Resolve o alvo primeiro: alÃ©m do ponto visado, isso deixa _dirCamera preenchido com a direÃ§Ã£o da
  // cÃ¢mera, que Ã© justo pra onde o boneco tem que virar.
  const visado=resolverPontoVisado(arma.alcance);
  // Vira o boneco ANTES de ler a boca: a arma Ã© filha do braÃ§o, entÃ£o a posiÃ§Ã£o do cano depende dessa
  // rotaÃ§Ã£o â€” girar depois faria a bala nascer de onde o corpo acabou de sair.
  encararDirecao(_dirCamera.x,_dirCamera.z);
  const boca=obterBocaDaArma();
  _dirTiro.copy(visado).sub(boca).normalize();
  tocarSomTiro(arma.som,player.position,'jogador');aplicarRecuoArma();adicionarTremorCamera(.08,.018);
  // Mirando, o cone fecha pra 30%: Ã© a recompensa concreta de parar pra mirar em vez de sair
  // atirando andando. A escopeta continua espalhando (30% de 5Â° ainda Ã© 1,5Â°), sÃ³ que muito mais
  // fechada â€” o que a torna utilizÃ¡vel a mÃ©dia distÃ¢ncia sem deixar de ser escopeta.
  const cone=arma.dispersao*(1-.7*miraState.fator);
  // ===== A BALA NASCE NA RETA DA MIRA, NA ALTURA DO JOGADOR =====
  // NÃ£o na cÃ¢mera (ela fica ATRÃS do ombro, e a bala nasceria do outro lado da parede em que ele
  // estÃ¡ encostado) e nÃ£o no cano (aÃ­ volta a paralaxe que este conserto veio tirar). O ponto certo
  // Ã© a projeÃ§Ã£o do jogador SOBRE a reta da mira: estÃ¡ junto do corpo dele e jÃ¡ na linha certa.
  // A direÃ§Ã£o passa a ser a da CÃ‚MERA â€” Ã© ela que a mira desenha na tela.
  const aoJogador=_origemTiro.copy(player.position).sub(camera.position).dot(_dirCamera);
  _origemTiro.copy(camera.position).addScaledVector(_dirCamera,Math.max(.5,aoJogador));
  for(let i=0;i<arma.projeteis;i++)
    dispararBala(_origemTiro,direcaoComDispersao(_dirCamera,cone,_dirChumbo),true,boca);
}
// ===== Gatilho segurado =====
// Antes era um tiro por toque: com cooldown de 0,28 s (e 0,11 s da metralhadora) isso exigia martelar
// a tela, que Ã© metade da sensaÃ§Ã£o de "jogabilidade ruim". Quem limita a cadÃªncia Ã© o cooldown da
// arma dentro de atirar(), entÃ£o segurar nÃ£o dispara mais rÃ¡pido que 1/cooldown â€” nÃ£o existe rajada
// dependente de FPS.
let gatilhoPressionado=false;
// Avisa o boneco 3D pra ele trocar pra animaÃ§Ã£o de andar atirando. Fica aqui, e nÃ£o no Input, porque
// o gatilho tambÃ©m Ã© acionado pelo botÃ£o ğŸ”« do celular â€” este Ã© o ponto por onde os dois passam.
export function definirGatilho(v){gatilhoPressionado=v;definirArmaEmpunhada(v);if(!v)avisouSemMunicao=false;definirAnimacaoTiro(v)}
export function atualizarTiroContinuo(){if(gatilhoPressionado)atirar()}
// Cicla sÃ³ entre as armas que o jogador POSSUI. Mora aqui porque Ã© o Ãºnico mÃ³dulo que enxerga os trÃªs
// pedaÃ§os: inventario.armas (Economy), equiparArma (Weapons) e proximoTiroJogador (local).
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
// Antes esta lista era reconstruÃ­da por bala E por frame, alocando Box3 + Vector3 novos toda vez: com 6
// balas em voo e 2 policiais dava ~2.160 objetos por segundo direto no coletor de lixo â€” o padrÃ£o exato
// que produz microtravamento no meio do combate.
let alvosJogador=[],alvosPolicia=[];
function montarAlvosDoFrame(){
  alvosJogador.length=0;alvosPolicia.length=0;
  // GuarniÃ§Ã£o de rapel E polÃ­cia de rua: sem juntar as duas listas, o policial de rua seria
  // invulnerÃ¡vel â€” as balas do jogador atravessariam ele.
  for(const pol of policiaisAtingiveis()){
    if(!pol.vivo||pol.caindo)continue;
    for(const zona of zonasDoPolicial(pol)){
      // `armaEquipada()` Ã© lido DENTRO da arrow de propÃ³sito: esta lista Ã© montada por frame, mas a
      // bala sÃ³ chama aoAtingir() no frame do impacto â€” lendo fora, o dano congelaria na arma que
      // estava na mÃ£o quando a lista foi montada, nÃ£o na que disparou.
      alvosJogador.push({caixa:zona.caixa,aoAtingir:()=>atingirPolicial(pol,armaEquipada().dano*zona.multiplicador)});
    }
  }
  // ===== DENTRO DO VEÃCULO, A LATARIA SEGURA =====
  // "eles tÃ¡ conseguindo atirar em mim dentro do carro". Estava mesmo: as caixas de acerto do jogador
  // seguem a posiÃ§Ã£o dele, e a posiÃ§Ã£o dele, dirigindo, Ã© a do carro. EntÃ£o a bala achava o boneco
  // ATRAVÃ‰S da lataria â€” e no carro ele nem aparece (`motoristaVisivel:false`), entÃ£o do lado de fora
  // era levar tiro de uma coisa que nÃ£o estÃ¡ na tela.
  // Sem as caixas na lista, a bala simplesmente passa: o policial continua mirando e atirando no
  // carro, que Ã© o que ele faria, e nÃ£o acerta quem estÃ¡ dentro. Vale pra moto tambÃ©m â€” Ã© o preÃ§o de
  // ter escolhido dirigir em vez de ficar a pÃ©, e a pÃ© continua tudo como era.
  if(!jogadorRendido&&!jogadorEmVeiculo()){
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
    // Matar policial Ã© o que mais suja a ficha â€” e a ficha Ã© o que dimensiona a prÃ³xima guarniÃ§Ã£o.
    // Ã‰ uma escalada sÃ³ de ida enquanto ele estiver Ã  vista: cada baixa traz mais gente na volta, e
    // sÃ³ sumir da vista deles faz a conta descer.
    somarProcurado(1);
    // ===== Ã‰ A BAIXA QUE CHAMA O REFORÃ‡O =====
    // O reforÃ§o vinha por RELÃ“GIO: bastava o confronto durar e mais dois desciam, mesmo sem o jogador
    // ter encostado num policial. Do lado de dentro isso lÃª como "a polÃ­cia aumenta do nada" â€” e foi
    // exatamente essa a reclamaÃ§Ã£o. ReforÃ§o tem que ter CAUSA, e a causa Ã© perder gente.
    policia.baixas++;
    // Matar em plena rua Ã© avistamento na certa: o rÃ¡dio espalha a posiÃ§Ã£o na hora. Ã‰ o que impede
    // "limpar a ronda um por um sem ninguÃ©m notar".
    compartilharAvistamento(player.position.x,player.position.z,performance.now()/1000);
  }else{
    // ===== LEVOU TIRO E SOBREVIVEU: REAGE =====
    // "os policiais sÃ£o burros, se eu dou um tiro neles eles nÃ£o fazem nada, tem que esperar morrer."
    // Esta[jÇºã
âµç«®ŠÁ®‰˜©{fW†FÖVçFR76–ÒÂRòì;¦ÖW&òW&6öç7G&ævVF÷#¢F"òF—&òRì84òF"òF—&ò&öGW¦–Ğ¢òòòÖW6Öò×VæFò(	Bf–6†Â,:F–ò6ÆFòÂæ–æw\:–Òf–æFòÂ¦W&ò&Wf–FRâW7FR&Öò6–×ÆW6ÖVçFRì:6ğ¢òòW†—7F–¢<;2Ôõ%DRF–æ†6öç6W\:¦æ6–à¢òğ¢òòG,:§26ö—626öçFV6VÒÂRæVæ‡VÖFVÆ2:’&VÆRf–66&VæFò÷"Ü:v–6# ¢6öç7Bv÷&×W&f÷&Öæ6Rææ÷r‚’ó°¢òòâd”4„4ô$RÂVÖfW¢÷"öÆ–6–ÂâVÖfW¢ÂRì:6ò÷"&ÆÂ6Vì:6òW7f¦–"òVçFRçVĞ¢òò7V¦V—Fò<;2F&–f–6†Ü:†–Ö(	BòVR7V¦:’6W'F"vVçFRÂì:6òv7F"×Væœ:|:6òà¢–b‚öÂæ¦fö”fW&–Fò—·öÂæ¦fö”fW&–Fó×G'VS·6öÖ%&ö7W&Fòƒ—Ğ¢òò"âò,8D”òU5Ä„â8’òVRf¢÷2÷WG&÷2f—&VÒÂR:’F–fW&Vì:vVçG&R&VÆW2<:6ò'W'&÷2"P¢òò&WR'&’fövòæòÖV–òF'V"â6VÒ—7FòÂFf&fW&—"VÒ÷"VÒ6VÒæ–æw\:–Òæ÷F"à¢6ö×'F–Æ†$f—7FÖVçFò‡Æ–W"ç÷6—F–öâç‚ÇÆ–W"ç÷6—F–öâç¢Æv÷&“°¢òò2âTÄRÔU4Ôò¬84$RDRôäDRdT”òâì:6ò&V6—6f'&W"ò6öæRFRf—<:6òG,:2FòF—&F÷#¢ÆWf÷P¢òòF—&òÂ6Rf—&&Ì:âf—TFW6FVÖ&6VRòÇfòW7L:GV—&–FòR&öçFôVÖVæ7W'Fğ¢òòFV×òFR&V:|:6ò(	BÖ2ì:6ò&¦W&òÂVR6W&–&Wf–FRæòÖW6ÖòVG&òFòF—&òà¢öÂçf—TFW6FS×öÂçf—TFW6FWÇÆv÷&·öÂçf—U÷#Öv÷&°¢öÂç&öçFôVÓÔÖF‚æÖ–â‡öÂç&öçFôVÓóô–æf–æ—G’Æv÷&µ$T4õôÄUdõUõD•$ò“°¢öÂæöÆ†%“ÔÖF‚æFã"‡Æ–W"ç÷6—F–öâç‚×öÂç÷2ç‚ÇÆ–W"ç÷6—F–öâç¢×öÂç÷2ç¢“°¢Ğ¢òòÆ–×"òVfWF—fò–çFV—&òì:6òVæ6W'&Ö—2æF¢VÆW2föÇFÒF&6RÂVÒVÒÂæFæFòâòf—6ğ¢òòW†—7FR&VÆRVçFVæFW"VRf–6"Æ’ì:6òf’&W6öÇfW"à¢–b‡öÆ–6–—2æÆVæwF‚bgöÆ–6–—2æWfW'’‡ÃÓâÂçf—fò’¢Ö÷7G&$f—6ò‡öÆ–6–ç&ö7W&FóãÕ$ô5U$DõôÔ€¢òtÆ–×÷R'V(	BÖ27Vf–6†W7L:æòF÷òâ6öÖRFf—7FFVÆW2âp¢¢tÆ–×÷R'VâfVÒÖ—2vVçFRFFVÆVv6–(	B6÷'&R&ÆöævRârÃ3C“°§Ğ ¢òò&öæFRò†VÆ–<;7FW&òW7L:–æFòâçVÖ$D”DòöçFò:’×VF²çVÖ48tD†f–6†7V¦Â6VĞ¢òòÆçF’:’ò¦övF÷"(	BÖ2<;2VçVçFòöÌ:Ö6––æF6÷V&W"öæFRVÆRW7L:âFWö—2FP¢òò4TÕõdU%õ$õ5TÔ•"6VwVæF÷26VÒæ–æw\:–ÒVç†W&|:ÖÆòÂò†VÆ’$æò;¦ÇF–ÖòöçFò6öæ†V6–FòVÒfW ¢òòFR6öçF–çV"6öÆFòæVÆS¢6VÒ—76òò†öÆöf÷FR6W&–VÖ6öÆV—&ÂRFW7—7F"ì:6òW†—7F—&–÷ ¢òòÖ—2VRVÆR6÷'&W76RâFWföÇfRfÇ6RVæFòòÇfòFV—†÷RFRW†—7F—"†×VF6öÆ†–Fö6öæf—66F’à¦gVæ7F–öâGVÆ—¦%öçFôÇfò‚—°¢–b‡öÆ–6–æÇfõÆçF—°¢–b‡öÆ–6–æÇfõÆçFæ6öÆ†–F—·öÆ–6–æÇfõÆçFÖçVÆÃ·&WGW&âfÇ6WĞ¢öÆ–6–çöçFôÇfòçƒ×öÆ–6–æÇfõÆçFçƒ·öÆ–6–çöçFôÇfòç£×öÆ–6–æÇfõÆçFç£°¢ÖVÇ6R–b‡öÆ–6–çFV×õ6VÕfW#Å4TÕõdU%õ$õ5TÔ•"—°¢öÆ–6–çöçFôÇfòçƒ×Æ–W"ç÷6—F–öâçƒ·öÆ–6–çöçFôÇfòç£×Æ–W"ç÷6—F–öâç£°¢Ğ¢&WGW&âG'VS°§Ğ ¢òòÓÓÓÓÒÜ8T”äDRU5DDõ2ÓÓÓÓĞ¢òòôVçG&&&öFVÖfW¢æG&ç6œ:|:6ó²ôGVÆ—¦&&öF÷"g&ÖRâFöF×VFì:vFRW7FFò76÷ ¢òòG&ç6—F"‚–(	B:’òVRv&çFRò–çf&–çFRFRVRÆ–×W¦FòVæ6öçG&ò6öçFV6RçVÒÇVv"<;2à¦gVæ7F–öâG&ç6—F"†æ÷fôW7FFò—°¢–b‡öÆ–6–æW7FFóÓÓÖæ÷fôW7FFò—&WGW&ã°¢öÆ–6–æW7FFóÖæ÷fôW7FFó·öÆ–6–çFV×ôW7FFóÓ°¢U5DDõ5¶æ÷fôW7FFõÒæôVçG&#òâ‚“°§Ğ ¢òòÓÓÓÓÒò„TÄ”<95DU$òÂTRtõ$<92DTÒDô•2U5DDõ2ÓÓÓÓĞ¢òòVÆRF–æ†4UDR‡G'VÆ†Â–æFòÂ—&æFòÂ&VÂÂ6öæf—66æFòÂ6öÖ&FRÂ&V7VæFò’÷'VR6'&Vvfğ¢òòVæ6öçG&ò–çFV—&ó¢W&ò†VÆ’VRFV6–F–VæFòöÌ:Ö6–6†VvfÂVçF÷2f–æ†ÒRVæFò–Ğ¢òòVÖ&÷&âF—&Fòò,:VÂÂ—76òì:6òf¢Ö—26VçF–Fò(	BVVÒv÷fW&æò6öæg&öçFò:’ò&ö7W&FöR¢òò&÷&FvVÒÂRò†VÆ’föÇF6W"VÒ†VÆ–<;7FW&òà¢òò&öæFæFò(i"föVçG&Rv—ö–çG2Â6öÒfœ:—2&&Vvœ:6òFR×VFÖGW&Â&ö7W&æFòÆçF:|:6òà¢òòöçFæFò(i"6†÷S¢f’L:’Ì:Â—&R6VæFRò†öÆöf÷FRVÒ6–ÖFÆçFâòf—6ò:’Fò,8D”òÀ¢òòRVVÒfVÒ6öæf—66"<:6ò÷2öÆ–6–—2FR:’ÂæFæFòF&6Rà¦6öç7BU5DDõ3×°¢&öæFæFó§°¢ôVçG&"‚—°¢öÆ–6–æ6ööÆF÷väFS×W&f÷&Öæ6Rææ÷r‚’ó´4ôôÄDõtåôTåE$Uô%U443°¢öÆ–6–æFW6VÖ&'VTfV—F÷3Ó·öÆ–6–ç&÷†–ÖôFW6VÖ&'VSÓ·öÆ–6–æ†VÆ•÷W6FóÖfÇ6S°¢òò¦W&ò7&6Œ:FwV&æœ:|:6òFf–GW&§VçFó¢,;7†–Öö6÷',:¦æ6–:’÷WG&ÂRÖW&V6R÷WG&¢òòGWÆâÆ—7FVÒ6’<;2:’W7f¦–FVæFò÷2VR6ö'&&Ò¬:6:×&ÒFR6×òà¢öÆ–6–æWV—Uf–GW&Ó°¢WV—TFf–GW&ÖWV—TFf–GW&æf–ÇFW"‡Óççf—fòbgöÆ–6–—2æ–æ6ÇVFW2‡’“°¢†VÆ”Çfó×6÷'FV%v—ö–çEG'VÆ†‚“°¢ÒÀ¢ôGVÆ—¦"†GBÆv÷&—°¢6öç7BGƒÖ†VÆ”Çfòç‚Ö†VÆ’ç÷6—F–öâç‚ÆG£Ö†VÆ”Çfòç¢Ö†VÆ’ç÷6—F–öâç¢ÆCÔÖF‚æ‡—÷B†G‚ÆG¢“°¢–b†CÃ2–†VÆ”Çfó×6÷'FV%v—ö–çEG'VÆ†‚“°¢VÇ6W°¢†VÆ’ç÷6—F–öâç‚³ÖG‚öB¤„TÄ•õdTÄô4”DDR¦GC¶†VÆ’ç÷6—F–öâç¢³ÖG¢öB¤„TÄ•õdTÄô4”DDR¦GC°¢†VÆ’ç&÷FF–öâç£ÕD…$TRäÖF…WF–Ç2æ6Æ×‚ÖG¢öB¢ã3RÂÒã3RÂã3R“¶†VÆ’ç&÷FF–öâç“ÔÖF‚æFã"†G‚ÆG¢“°¢Ğ¢†VÆ’ç÷6—F–öâç“ÕD…$TRäÖF…WF–Ç2æÆW'††VÆ’ç÷6—F–öâç’Ä„TÄ•ôÅEU$õ$ôäDÆGB£"“°¢–b†v÷&ÇöÆ–6–æ6ööÆF÷väFR—&WGW&ã°¢òò$D”D¢<;2Vç†W&v×VFdÄõ$”DÂR<;276æFò÷"6–ÖFVÆâòVRVÆRf—7F:’TÒ:“²òVP¢òòVÆR76W'6VwV—":’ò4åDT•$òVÒföÇFFVÆRà¢f÷"†6öç7BÂöbÆçF2—°¢–b‚ÆçFFWFV7FfVÂ‡Â—ÇÆF—7E…¢††VÆ’ç÷6—F–öâÇÂ“ãÔDUDT44õõ$”ò–6öçF–çVS°¢òò6çFV—&òVR¬:ÆWf÷R&F–FŒ:÷V6òì:6òfÆR÷WG&¢W&FV’VRf–æ†Vç‡W'&FFP¢òòöÆ–6–—2ÂVÒÆ÷FR÷":’6öÆ†–Fòà¢–b‡ÆçF6õVV–ÖF‡Âç‚ÇÂç¢Æv÷&’–6öçF–çVS°¢öÆ–6–æÇfõÆçF6ó×ÆçF6ôVÕföÇF‡Â“°¢öÆ–6–æÇfõÆçF×Ã·öÆ–6–æ6öæf—66ôFSÓ°¢G&ç6—F"‚vöçFæFòr“°¢6öç7Bã×öÆ–6–æÇfõÆçF6òçW3°¢Ö÷7G&$f—6ò†ãã¢ö	ù¨ò†VÆ–<;7FW&ò6†÷R7VÆçF:|:6òFRG¶çÒ:—2R6†Ö÷RöÌ:Ö6–âVÆW2l:¦Ò:’(	B6÷'&R ¢¢	ù¨ò†VÆ–<;7FW&ò6†÷R7VÆçF:|:6òR6†Ö÷RöÌ:Ö6–âVÆW2l:¦Ò:’(	B6÷'&RrÃ3ƒ“°¢&WGW&ã°¢Ğ¢Ğ¢ÒÀ¢öçFæFó§°¢ôGVÆ—¦"†GBÆv÷&—°¢òòÓÓÓÓÒ$D”D4$TäDòò4åDT•$ò4$ÓÓÓÓĞ¢òòW&–b†Çfòæ6öÆ†–F’föÇF&&öæF¢6öÆ†W"TÒ:’Væ6W'&f&F–FR6öÇFfò†VÆ’&¢òò6†"ò:’FòÆFòÖV–òÖ–çWFòFWö—2âv÷&VÆR<;2Æ&vVæFòì:6ò6ö'&:’fÆ÷&–FòÆ’à¢6öç7Bf—f÷3×W5f—f÷4FÆçF6ò‚“°¢–b‚öÆ–6–æÇfõÆçF6÷ÇÂf—f÷2æÆVæwF‚—°¢Ö&6%ÆçF6ô&F–F†v÷&“°¢òò4U%dœ8tò4ôä4Å\8ÔDó¢:’V’ÂR<;2V’ÂVRwV&æœ:|:6òFf–GW&:’6†ÖFFRföÇF&ğ¢òò6'&òâçFW2FW7FRöçFòVÆW7L:G&&Æ†æFòò6çFV—&òÂRf–GW&W7W&à¢&V6öÆ†W$WV—TFf–GW&‚“°¢öÆ–6–æÇfõÆçFÖçVÆÃ·öÆ–6–æÇfõÆçF6óÖçVÆÃ·öÆ–6–æ6öæf—66ôFSÓ°¢G&ç6—F"‚w&öæFæFòr“·&WGW&ã°¢Ğ¢òòò:’FfW¢:’6V×&RVÒVR–æFW7L:VÒ:“¢6öÆ†W"òÇfòG&ö6òÇfòÂì:6òFW6f¢&F–Fà¢–b‚öÆ–6–æÇfõÆçFÇÇöÆ–6–æÇfõÆçFæ6öÆ†–FÇÂÆçFFWFV7FfVÂ‡öÆ–6–æÇfõÆçF’—°¢öÆ–6–æÇfõÆçF×f—f÷5³Ó·öÆ–6–æ6öæf—66ôFSÓ°¢Ğ¢òòò†VÆ’—&æòÔT”òFò6çFV—&òÂVR:’òVRVÆRfV–ò&FW"à¢6öç7BÇfó×öÆ–6–æÇfõÆçF6ó°¢öÆ–6–çöçFôÇfòçƒÖÇfòçƒ·öÆ–6–çöçFôÇfòç£ÖÇfòç£°¢6öç7BGƒÖÇfòç‚Ö†VÆ’ç÷6—F–öâç‚ÆG£ÖÇfòç¢Ö†VÆ’ç÷6—F–öâç¢ÆCÔÖF‚æ‡—÷B†G‚ÆG¢“°¢–b†Cä$õ…õ$”ò—°¢†VÆ’ç÷6—F–öâç‚³ÖG‚öB¤„TÄ•õdTÄô4”DDR¦GC¶†VÆ’ç÷6—F–öâç¢³ÖG¢öB¤„TÄ•õdTÄô4”DDR¦GC°¢†VÆ’ç&÷FF–öâç“ÔÖF‚æFã"†G‚ÆG¢“°¢†VÆ’ç÷6—F–öâç“ÕD…$TRäÖF…WF–Ç2æÆW'††VÆ’ç÷6—F–öâç’Ä„TÄ•ôÅEU$ôôåDäDòÆGB£"“°¢ÖVÇ6W°¢òòò†VÆ–<;7FW&ò:’ôÄ„òÂì:6òG&ç7÷'FRFRG&÷âçFW2VÆRFW66–L:’ò6Œ:6òR–æF6öÇFf¢òòÖ—2Fö—2öÆ–6–—2÷"6–ÖFwV&æœ:|:6òFf–GW&ÂgW&æFòVÇVW"FWFòFRVfWF—fòà¢òòv÷&VÆR—&ÇFòÖ&6æFòö6÷',:¦æ6–²VVÒ6†Vvæò6Œ:6òfVÒVÆ'Và¢†VÆ’ç÷6—F–öâçƒÕD…$TRäÖF…WF–Ç2æÆW'††VÆ’ç÷6—F–öâç‚ÆÇfòç‚ÃÔÖF‚æW‡‚ÓB¦GB’“°¢†VÆ’ç÷6—F–öâç£ÕD…$TRäÖF…WF–Ç2æÆW'††VÆ’ç÷6—F–öâç¢ÆÇfòç¢ÃÔÖF‚æW‡‚ÓB¦GB’“°¢†VÆ’ç&÷FF–öâç£ÕD…$TRäÖF…WF–Ç2æÆW'††VÆ’ç&÷FF–öâç¢ÃÃÔÖF‚æW‡‚ÓR¦GB’“°¢†VÆ’ç÷6—F–öâç“ÕD…$TRäÖF…WF–Ç2æÆW'††VÆ’ç÷6—F–öâç’Ä„TÄ•ôÅEU$ôôåDäDòÃÔÖF‚æW‡‚Ó"ãR¦GB’“°¢öÆ–6–æ†VÆ•÷W6FóÖfÇ6S°¢Ğ¢Ğ¢ÒÀ§Ó° ¢òòÓÓÓÓÒE%TÄ„U$ÔäTåDRÓÓÓÓĞ¦W‡÷'B6öç7Bv—ö–çG3ÕµÓ°¦f÷"†6öç7BöçFòöbv—ö–çG5f–VÆ2—v—ö–çG2çW6‚‡·ƒ§öçFòç‚Ç£§öçFòç§Ò“°¢òò÷'FFFVÆVv6–ÂÖVÖ÷&—¦FVÖfW£¢:’ò;¦æ–6òÇVv"Fò×VæFò÷"öæFRVÒöÆ–6–ÂVçG&VĞ¢òò6×òRò;¦æ–6ò÷"öæFRVÆR6’à¦6öç7Bõ%Dô$4S×·ƒ¥ôÄõ2æFVÆVv6–ç÷'Fç‚Ç£¥ôÄõ2æFVÆVv6–ç÷'Fç§Ó°¢òòÓÓÓÓÒ$ôäD4TÒÔõD•dòì84òäDäD•$\8|84òDò¤ôtDõ"ÓÓÓÓĞ¢òò÷2öçF÷2FR&öæF<:6ò÷2&V6÷2DRdU$DDR(	BRò¦övF÷"FÖ,:–ÒæFæ÷2&V6÷2â6÷'FVæFòVçG&R÷0¢òò#RöçF÷2÷"–wVÂÂVÖGWÆVRì:6òFVÒæF6öÒVÆRÖ—&Â6öÒg&W\:¦æ6–Âò&V6òVÒVRVÆP¢òòW7L:¢VÆ7'W¦òÖ÷'&ò–çFV—&òR&G,:2FVÆRâFòÆFòFRFVçG&òFò¦övò—76ò:¢òò–æF—7F–æw\:×fVÂFRW'6VwVœ:|:6òÂRfö’6VwVæFf÷FòVRò''VæòÖæF÷RF—¦VæFò'L:6òÖR6VwV–æFò"à¢òğ¢òòVçL:6ó¢VçVçFòöÌ:Ö6–ì:6òFVÒ&¬:6ò&6R–çFW&W76"÷"VÆR†f–6†g&–Â6VÒÖö6†–ÆÂ6VĞ¢òò&7G&ò’ÂòFW7F–æòFR&öæF:’6÷'FVFòÄôätRFVÆRâVÆ6öçF–çVG'VÆ†æFòòÖ÷'&òFöFò(	B<;2ì:6ğ¢òòW66öÆ†R§W7FÖVçFRòVF:vòöæFRVÆRW7L:â6RVÒFVçFF—f2ì:6ò6†"æFÆöævR†ò¦övF÷"W7L:¢òòæòÖV–òFòÖ÷'&ò’ÂfÆR;¦ÇF–Ö¢öÌ:Ö6–VR6öÖR:’–÷"VRöÌ:Ö6–VR76W'Fòà¦6öç7B$ôäDôÄôätUôDõô¤ôtDõ#Óc°¦gVæ7F–öâöçFôFU&öæF†Wf—F$¦övF÷#ÖfÇ6R—°¢6öç7Bv÷&×W&f÷&Öæ6Rææ÷r‚’ó°¢òòÓÓÓÓÒ4ôÒd”4„5T¤ÂTÄU2d45TÄ„ÒôäDRTÄRdô’d•5Dòõ"9¤ÅD”ÔòÓÓÓÓĞ¢òòV’VÆW2f67VÆ†fÒ÷2äõdRU44ôäDU$”¤õ2Â÷'VRW&&Ì:VRò¦övF÷"6÷'&–â6VĞ¢òòW66öæFW&–¦òòVæFW&\:vòFV—†÷RFRW†—7F—"ÂRÖæF"&öæF&2662FR6Æ–VçFR†òVRğ¢òò664ö65³ÖFR&W6W'ff¦–’6W&––÷"VRæF¢6W&6&–Ò§W7FÖVçFR66VÒVRVÆP¢òò&V6—6VçG&"&VçG&Vv"Â÷"VÒÖ÷F—fòVRì:6òFVÒfW"6öÒVÆRà¢òòòVR6ö'&÷R:’ò6W'FòÂR:’òVRöÌ:Ö6–FRfW&FFRf£¢&ö7W&"VÒföÇFFò;¦ÇF–ÖòÇVv"öæFP¢òòVÆR&V6WRâVçVçFòW76RöçFòW†—7F—"‡&7G&òVVçFR÷R¦æVÆFR'W66’Â&öæF6öÒf–6†¢òò7V¦6öçfW&vR&Ì:²FWö—2VRVÆRW6g&–ÂföÇFÒæF"VÆ2f–VÆ2à¢–b‡öÆ–6–ç&ö7W&Fóãbb‡&7G&õfÆ–Fò†v÷&—ÇÆVÔ'W66†v÷&’’bdÖF‚ç&æFöÒ‚“Âãb—°¢6öç7BÔÖF‚ç&æFöÒ‚’¤ÖF‚å’£"Ç#Õ%Tõd45TÄ„%õ$”ò¢‚ãB´ÖF‚ç&æFöÒ‚’¢ãb“°¢&WGW&ç·ƒ§&7G&òç‚´ÖF‚æ6÷2†’§"Ç£§&7G&òç¢´ÖF‚ç6–â†’§'Ó°¢Ğ¢ÆWBwÖçVÆÃ°¢f÷"†ÆWBCÓ·CÃ·B²²—°¢w×v—ö–çG5´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’§v—ö–çG2æÆVæwF‚•Ó°¢–b‚Wf—F$¦övF÷"–'&V³°¢–b„ÖF‚æ‡—÷B‡wç‚×Æ–W"ç÷6—F–öâç‚Çwç¢×Æ–W"ç÷6—F–öâç¢“ãÕ$ôäDôÄôätUôDõô¤ôtDõ"–'&V³°¢Ğ¢&WGW&ç·ƒ§wç‚Ç£§wç§Ó°§Ğ ¢òòÓÓÓÓÒDôDòôÄ”4”ÂTåE$TÒ4ÕòTÄõ%DDDTÄTt4”ÓÓÓÓĞ¢òòöæFV<;2:’76Fòæò–ì:Ö6–òF'F–FÂ&÷2VG&òFòGW&æò¬:W7F&VÒW7Æ†F÷2VÆffVÆ¢òòVÒfW¢FR'F–F6öÖ\:v"6öÒS2FR'Vf¦–VçVçFòVÆW26ö&VÒòÖ÷'&òâ&Vf÷,:vòR&W÷6œ:|:6ğ¢òò6V×&R6VÒF÷'FÂæFæFò(	B:’—76òVRò¦övF÷"l:¢6†Vv"à¦gVæ7F–öâ6—$F&6R†v÷&ÆöæFR—°¢ÆWBÖöæFWÇÅõ%Dô$4S°¢òòåTä4ä44U"DTåE$òDR$TDRâ÷2öçF÷2FR&öæF6VÒF27W'f2F÷2&V6÷2ÂRVÖ7W'f76¢òò&7æFòæV–æFR66(	Bæ66W"Æ’:’6öÖ\:v"f–FVæ7&fFòÂRòFW6Væ7&fF÷"<;2V×W'&¢òò36Ò÷"VG&ò6öçG&VÖ&WFVR–ç6—7FRVÒföÇF"âÖVF–Fó¢÷2VG&òFòGW&æò–æ–6–À¢òò&V6W&ÒG&fF÷2FVçG&òFR6öÆ—6÷"FR66VÒÖVæ÷2FR"Ö–çWF÷2à¢–b†6öÆ–FUVFW7G&R‡ç‚Çç¢’—°¢6öç7BÆ—g&SÖ'W66%÷6–6ôÆ—g&R‡ç‚Çç¢Æ6öÆ–FUVFW7G&RÃ’“°¢ÖÆ—g&WÇÅõ%Dô$4S°¢Ğ¢6öç7BöÃÖ7&–%öÆ–6–Â‡öÆ–6–—2æÆVæwF‚Âw'Vr“°¢öÂç÷2ç6WB‡ç‚ÃÇç¢“°¢öÂæÇGW&GVÃÖö'FW$VÆWf6ò‡ç‚Çç¢“°¢öÂæw'Wòç÷6—F–öâç6WB‡ç‚ÇöÂæÇGW&GVÂÇç¢“°¢öÂæÖöFóÒw&öæFs°¢öÂæFW7F–æõ&öæF×öçFôFU&öæF‡G'VR“°¢öÂæW7W&æFõG'VÆ†FSÓ°¢öÆ–6–—2çW6‚‡öÂ“°¢&WGW&âöÃ°§Ğ¦gVæ7F–öâFW6VÖ&&6%öÆ–6–—2†v÷&—°¢–b‡öÆ–6–æFW6VÖ&'VTfV—F÷3ãÔDU4TÔ$%TUõDGÇÆv÷&ÇöÆ–6–ç&÷†–ÖôFW6VÖ&'VR—&WGW&ã°¢6öç7B“×öÆ–6–æFW6VÖ&'VTfV—F÷2²²ÆæsÖ“ôÖF‚å“£°¢6öç7B×·ƒ¦†VÆ’ç÷6—F–öâç‚´ÖF‚æ6÷2†ær’£ã‚Ç£¦†VÆ’ç÷6—F–öâç¢´ÖF‚ç6–â†ær’£ã‡Ó°¢6öç7BöÃ×6—$F&6R†v÷&Ç“°¢òòl:6ò&òÔT”òFò6çFV—&òÂì:6ò&ò:’6÷'FVFó¢:’ò6çFV—&òVRVÆW2f–W&Ò&FW"à¢6öç7B6VçG&ó×öÆ–6–æÇfõÆçF6óó÷öÆ–6–æÇfõÆçF°¢öÂçF—óÒvFW6VÖ&'VRs·öÂæÖöFóÒvFW6VÖ&'VRs·öÂæFW7F–æõ&öæF×·ƒ¦6VçG&óòçƒó÷ç‚Ç£¦6VçG&óòç£ó÷ç§Ó°¢öÆ–6–ç&÷†–ÖôFW6VÖ&'VSÖv÷&´DU4TÔ$%TUô”åDU%dÄó°§Ğ¢òòÓÓÓÓÒuT$äœ8|84òTR4ÅDDd”EU$ÓÓÓÓĞ¢òòVV—†W&&VÆ2ì:6òL:–æFòæ2ÆçF:|:6ò"âÖVF–FòÂò,:F–ògVæ6–öæf¢6öÒò6çFV—&ò6öÆFòæ¢òò'VÂ&F–F'&RVÒBÃr2Rf–GW&Væ6÷7F2Ã’Òâò&ö&ÆVÖ:’ò&W7FòFò6Ö–æ†ò(	BÆçF:|:6ğ¢òò&ö:’ÆöævRFR'VÂRf–GW&$æ'VŒ:’òFW6Væ†òFöFó¢6'&òì:6ò6ö&Rf–VÆ’âFòÆFòFP¢òòf÷&ÂVÖf–GW&VRW7F6–öæÆöævRRì:6òf¢æF:’–æF—7F–æw\:×fVÂFRVÖVRì:6òfV–òà¢òğ¢òòVçL:6òVÆ76f¦W"òVRVÖf–GW&f£¢&ÂRwV&æœ:|:6òFW66RR6ö&R:’â8’—76òVP¢òòÆ–vò6'&òò6çFV—&òÂR:’òVRVÆRf’fW"à¢òğ¢òòFö—2ÂR<;2Fö—2÷"ö6÷',:¦æ6–†ò6öçFF÷"¦W&§VçFò6öÒòFò†VÆ’ÂVæFòò†VÆ’föÇF&&öæF’à¢òòVÆW2VçG&ÒæòVfWF—fòæ÷&ÖÂÂVçL:6òVæFò&F–F6&òGVÆ—¦$VfWF—föÖæF÷2VP¢òò6ö'&&ÒföÇF&VÒ&&6R8’(	Bæ–æw\:–ÒWf÷&ÂRì:6òf—&Vç‡W'&FFRöÆ–6–—2VRVÆR¬:¢òò&V6ÆÖ÷RVÖfW¢à¦6öç7Bd”EU$ôUT•SÓ#°¢òòVVÒ6—RFf–GW&æW7Fö6÷',:¦æ6–ÂRöæFRVÆf–6÷Râ8’W7FR"VRf¢wV&æœ:|:6òdôÅD"$ğ¢òò4%$òVÒfW¢FR—"æFæFò&&6S¢&wV&æœ:|:6òFVÒVRföÇF"&f–GW&Â6Vì:6òf’f–6 ¢òò×VÇF—Æ–6æFòöÆ–6–—2"âföÇF"&&6RFÖ,:–ÒF—&fVÆW2FòÖÂÖ2VÆ÷'FW'&F(	BR¢òòf–GW&f–6f;7&l:2Â6öÒGWÆFVÆ7VÖ–æFòFò÷WG&òÆFòFffVÆà¦ÆWBWV—TFf–GW&ÕµÒÇöçFôFf–GW&ÖçVÆÃ°¦W‡÷'BgVæ7F–öâFW6VÖ&&6$Ff–GW&‡öçFò—°¢6öç7B6VçG&ó×öÆ–6–æÇfõÆçF6óó÷öÆ–6–æÇfõÆçFóöÇfôFô¦övF÷"‚“°¢6öç7BG&4FVÆSÒöÆ–6–æÇfõÆçF6òbböÆ–6–æÇfõÆçF°¢–b‚öçF÷ÇÂ6VçG&ò—&WGW&â°¢ÆWB6—SÓ°¢öçFôFf–GW&×·ƒ§öçFòç‚Ç£§öçFòç§Ó°¢òòf–GW&ì:6ò7&–vVçFRÌ:–ÒFòFWFòFö6÷',:¦æ6–â6R¬:Œ:öÆ–6–—27Vf–6–VçFW2æ:&VÀ¢òòVÆ6öçF–çV§VFæFò6öÒò6'&òÂÖ2ì:6òÖFW&–Æ—¦VÖæ÷fGWÆà¢6öç7Bfv3ÔÖF‚æÖ‚ƒÇFWFôFôæ—fVÂ‚’×f—f÷4VÔ6×ò‚’“°¢6öç7BÆ–Ö—FSÔÖF‚æÖ–â…d”EU$ôUT•RÇöÆ–6–æWV—Uf–GW&·fv2“°¢f÷"†ÆWB“×öÆ–6–æWV—Uf–GW&¶“ÆÆ–Ö—FS¶’²²—°¢òòVÒFR6FÆFòFò6'&òÂRì:6ò÷2Fö—2æòÖW6Öò—†VÂà¢6öç7BæsÖ“ôÖF‚å“£°¢6öç7BöÃ×6—$F&6R‡W&f÷&Öæ6Rææ÷r‚’óÀ¢·ƒ§öçFòç‚´ÖF‚æ6÷2†ær’£ãbÇ£§öçFòç¢´ÖF‚ç6–â†ær’£ãgÒ“°¢öÂçF—óÒvFW6VÖ&'VRs·öÂæÖöFóÒvFW6VÖ&'VRs°¢öÂæFW7F–æõ&öæF×·ƒ¦6VçG&òç‚Ç£¦6VçG&òç§Ó°¢WV—TFf–GW&çW6‚‡öÂ“°¢6—R²³°¢Ğ¢öÆ–6–æWV—Uf–GW&³×6—S°¢–b‡6—R–Ö÷7G&$f—6ò†G&4FVÆP¢ò	ù©2f–GW&&÷RFò6WRÆFò(	BwV&æœ:|:6òFW66WRG,:2FRfö<:¢âp¢¢	ù©2f–GW&&÷Ræ'VRwV&æœ:|:6òW7L:7V&–æFò:’ârÃ3#“°¢&WGW&â6—S°§Ğ¢òò–æFFVÒÆw\:–ÒFwV&æœ:|:6òf—fòRVÒ6×óòVçVçFòF—fW"Âf–GW&ì84ò6’FòÇVv"à¦gVæ7F–öâWV—TVÔ6×ò‚—·&WGW&âWV—TFf–GW&ç6öÖR‡Óççf—fòbgöÆ–6–—2æ–æ6ÇVFW2‡’—Ğ¢òòW‡÷7Fò&òFW7FR6VwV—"wV&æœ:|:6òVÆòö&¦WFòÂRì:6ò÷"–C¢7&–%öÆ–6–ÆW6òFÖæ†òF¢òòÆ—7F6öÖò–BÂVçL:6ò–B8’$T$õdT•DDòFWö—2FRVÖ&VÖü:|:6ò(	B6VwV—"÷"–Bf¢Fö—2öÆ–6–—0¢òòF–fW&VçFW2f—&&VÒ&òÖW6Öò"RÖVFœ:|:6òW&FRò6VçF–Fòâfö’òVR6öçFV6WRæ&–ÖV—&&öFFà¦W‡÷'BgVæ7F–öâõöWV—TFf–GW&&FW7FR‚—°¢&WGW&ç·öçFó§öçFôFf–GW&À¢WV—S¦WV—TFf–GW&æÖ‡Óâ‡·ƒ¢·ç÷2ç‚çFôf—†VBƒ’Ç£¢·ç÷2ç¢çFôf—†VBƒ’À¢f—fó§çf—fòÆÖöFó§æÖöFòÆVÔ6×ó§öÆ–6–—2æ–æ6ÇVFW2‡’À¢föÇF§çöçFôFUföÇF÷·ƒ¢·çöçFôFUföÇFç‚çFôf—†VBƒ’Ç£¢·çöçFôFUföÇFç¢çFôf—†VBƒ—Ó¦çVÆÇÒ’—Ó°§Ğ¢òòÓÓÓÓÒd”EU$U5U$ò4U%dœ8tò4$"ÓÓÓÓĞ¢òò&VÆFWfRf–6"&FL:’6öæ6ÇV—"ò6W'fœ:vò÷R÷2öÌ:Ö6–2Ö÷'&W&Vâ"â2GV26öæFœ:|;VW2Âæ¢òò÷&FVÒVÒVRVÆRF—76S¢VçVçFòFVÒ6çFV—&ò6VæFò&F–FòÂVÆW7W&²6&F&F–FÂVÆ–æF¢òòW7W&GWÆföÇF"RVÖ&&6"â6R÷2Fö—2Ö÷'&VÒÂWV—TVÔ6×öf—&fÇ6òRVÆf’VÖ&÷&¢òò6÷¦–æ†(	BVR:’ò6VwVæFò66òFVÆRà¢òò4TuU$f–GW&æòöçFòVçVçFòŒ:6W'fœ:vòâò¦övF÷"ì84òVçG&V’FR&÷;76—Fó¢6RVçG&76RÀ¢òò6VwW&&f–6&–G'VRòFV×òFöFòVÒVRVÆRW7F—fW76R&ö7W&FòÂRf–GW&f–6&–6öÆF&¢òò6V×&Ræò&–ÖV—&òöçFòöæFRVÆRfö’f—7Fò(	B6VÒöFW"6W"&VFW76†FVæFòVÆRf÷76Rf—7FFğ¢òòFRæ÷fòG,:§2V'FV—,;VW2F–çFRâVVÒ7V–FF—76ò:’ò&ö6÷',:¦æ6–æF÷R"æòf–GW&æ§6à¦W‡÷'BgVæ7F–öâf–GW&W7W&æFò‚—·&WGW&âöÆ–6–æÇfõÆçF6÷ÇÆWV—TVÔ6×ò‚—Ğ¢òò6W'fœ:vò6öæ6Ç\:ÖFó¢ÖæFGWÆFRföÇF&ò6'&òâì:6ò:’&6R(	B:’÷'FFf–GW&ÂæòöçFğ¢òòW†FòöæFRVÆ&÷RRöæFRVÆ6öçF–çV&FW7W&æFòà¦gVæ7F–öâ&V6öÆ†W$WV—TFf–GW&‚—°¢–b‚öçFôFf–GW&—&WGW&ã°¢f÷"†6öç7BöÂöbWV—TFf–GW&—°¢–b‚öÂçf—f÷ÇÂöÆ–6–—2æ–æ6ÇVFW2‡öÂ’–6öçF–çVS°¢öÂæÖöFóÒwföÇFæFòs·öÂçöçFôFUföÇF×öçFôFf–GW&°¢öÂç&÷FÖçVÆÃ·öÂæFW7F–æõ&÷FÖçVÆÃ°¢Ğ§Ğ ¢òòF—&WF÷"FRö6÷',:¦æ6–¢VÒ;¦æ–6òÇVv"FV6–FRVçF÷2öÆ–6–—2öFVÒW†—7F—"à¦gVæ7F–öâf—f÷4VÔ6×ò‚—·&WGW&âöÆ–6–—2ç&VGV6R‚†âÇ“Óæâ²‡çf—fóó£’Ã—Ğ¦gVæ7F–öâFWFôFôæ—fVÂ‚—°¢–b‡öÆ–6–æÇfõÆçF6÷ÇÇöÆ–6–æÇfõÆçF—&WGW&âÖF‚æÖ–â…ôÄ”4”•5ôÔ‚Ã2“°¢–b†&÷&FvVÒæF—f—&WGW&âÖF‚æÖ–â…ôÄ”4”•5ôÔ‚Ã2“°¢6öç7Bæ—fVÃÔÖF‚æÖ‚ƒÄÖF‚æÖ–â…$ô5U$DõôÔ‚ÇöÆ–6–ç&ö7W&Fò’“°¢&WGW&âÖF‚æÖ–â…ôÄ”4”•5ôÔ‚ÄÄ”Ô•DUõõ%ôä•dTÅ¶æ—fVÅÓóôTdUD•dõô$4R“°§Ğ¢òòGWÆFf–GW&6öçFFVçG&òFòVfWF—fòÂR&—†2<;2öFVÒVF—"L:’Fö—27V'7F—GWF÷2à¢òò—76ò–×VFRçF–v666F¢BF&öæF²"Fò†VÆ’²"Ff–GW&²&W÷6œ:|;VW2à¦gVæ7F–öâVfWF—fôFW6V¦Fò‚—°¢6öç7BWV—SÖWV—TFf–GW&ç&VGV6R‚†âÇ“Óæâ²‡çf—fòbgöÆ–6–—2æ–æ6ÇVFW2‡“ó£’Ã“°¢&WGW&âÖF‚æÖ–â‡FWFôFôæ—fVÂ‚’ÄTdUD•dõô$4R¶WV—R´ÖF‚æÖ–âƒ"ÇöÆ–6–æ&—†2’“°§Ğ¦ÆWBGW&æô&W'FóÖfÇ6S°¢òò÷2VG&òFòGW&æò–æ–6–ÂÂW7Æ†F÷2VÆffVÆÖ2ÆöævRFòöçFòöæFRò¦övF÷"æ66S¢VÆRì:6ğ¢òòöFR'&—"÷2öÆ†÷26öÒVÒf&FFòæò6öÆòâ&öFVÖfW¢Âæò&–ÖV—&òVG&ò(	Bì:6òæòF÷òFğ¢òòÜ;6GVÆòÂ÷'VR:Òò×VæFò†RædÖW6‚’–æFì:6òW†—7FRà¦gVæ7F–öâ'&—%GW&æò†v÷&—°¢GW&æô&W'Fó×G'VS°¢f÷"†ÆWB“Ó¶“ÄTdUD•dõô$4S¶’²²—°¢ÆWBöæFSÖçVÆÃ°¢f÷"†ÆWBCÓ·CÃ#·B²²—°¢6öç7Bw×v—ö–çG5´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’§v—ö–çG2æÆVæwF‚•Ó°¢–b„ÖF‚æ‡—÷B‡wç‚Õ5tåõ‚Çwç¢Õ5tåõ¢“ãÓ#R—¶öæFS×w¶'&V·Ğ¢Ğ¢6—$F&6R†v÷&ÆöæFR“°¢Ğ§Ğ¢òòW‡÷7Fò&òFW7FRÖVF—"&öæF4TÒÔõD•dó¢:’F–fW&Vì:vVçG&R'76÷RW'Fò÷"66ò"R'fV–ğ¢òòG,:2FRÖ–Ò"ÂR6VÒì;¦ÖW&ò—76òf—&F—67W7<:6òFR6Vç6:|:6òà¦W‡÷'BgVæ7F–öâõ÷öçFôFU&öæF&FW7FR†Wf—F"—·&WGW&âöçFôFU&öæF†Wf—F"—Ğ¢òòÓÓÓÓÒtä4„õ2D$ä4DDRDU5DRDE$ô48|84òÓÓÓÓĞ¢òòG&ö6:’VÒ6—7FVÖFRFV×ò&VÂ6öÒ6÷'FV–òFVçG&ó¢;¦æ–6f÷&Ö†öæW7FFR6&W"6RVÆW7L:¢òò&ö:’&öF"6VçFVæ2FR6VwVæF÷2FVÆR4ôåD"âW7FW2væ6†÷2FV—†ÒòFW7FRÖöçF"VÒöÆ–6–À¢òò—6öÆFòÂVÖF—7L:&æ6–W66öÆ†–FÂR&öF"ò76òFR6öÖ&FR6VÒW7W&"VÒVæ6öçG&òFRfW&FFRà¦W‡÷'BgVæ7F–öâõ÷öÆ–6–ÄFUFW7FR‡‚Ç¢—°¢6öç7BöÃÖ7&–%öÆ–6–Â‡öÆ–6–—2æÆVæwF‚Âw&VÂr“°¢öÂç÷2ç6WB‡‚ÃÇ¢“·öÂæÇGW&GVÃÖö'FW$VÆWf6ò‡‚Ç¢“°¢öÂæw'Wòç÷6—F–öâç6WB‡‚ÇöÂæÇGW&GVÂÇ¢“°¢öÂçVÃÒvfæ6òs·öÂçVÄFSÓ°¢òòf—†ö&VvòöÆ–6–ÂæòÇVv"â6VÒ—76òVÆRfì:vL:’F—7L:&æ6–FòVÂRDôDÖVFœ:|:6òFP¢òòöçF&–6&6öçFV6VæFò2Ò(	BòFW7FRÖVF—&–6V×&RòÖW6Öò66ò6†æFòVRÖVFRVG&òà¢öÂæf—†óÖfÇ6S°¢òò¬:öÆ†æFò&ò¦övF÷#¢6VÒ—7FòòFW7FRv7F&–÷2&–ÖV—&÷26VwVæF÷2W7W&æFòòv—&òFP¢òòf'&VGW&Væ6öçG&"òÇfòÂRÖVF—&–f'&VGW&VÒfW¢FöçF&–à¢öÂæöÆ†%“ÔÖF‚æFã"‡Æ–W"ç÷6—F–öâç‚×‚ÇÆ–W"ç÷6—F–öâç¢×¢“°¢öÂæw'Wòç&÷FF–öâç“×öÂæöÆ†%“°¢öÆ–6–—2çW6‚‡öÂ“°¢&WGW&âöÃ°§Ğ¦W‡÷'BgVæ7F–öâõ÷&VÖ÷fW%öÆ–6–ÄFUFW7FR‡öÂ—°¢6öç7B“×öÆ–6–—2æ–æFW„öb‡öÂ“°¢–b†“ãÓ—·66VæRç&VÖ÷fR‡öÂæw'Wò“·öÂæ&'&æFW66'F"‚“¶FW7—%öÆ–6–Â‡öÂæ6÷'ò“·öÆ–6–—2ç7Æ–6R†’Ã—Ğ§Ğ¦W‡÷'BgVæ7F–öâõ÷76ôFT6öÖ&FU&FW7FR‡öÂÆGB—°¢6öç7Bv÷&×W&f÷&Öæ6Rææ÷r‚’ó°¢GVÆ—¦$6öÖ&FR†GB“°¢òò÷2:–—2<:6òF—7G&–'\:ÖF÷2VÒGVÆ—¦%öÆ–6–ÂVRòFW7FRì:6ò6†Ö(	B6VÒ—7Fò÷2VG&ğ¢òòf–6fÒ6öÒòVÂFR'F–FRòFW7FR'&÷ff"VRWV—RFöFf¢ÖW6Ö6ö—6à¢F—7G&–'V—%V—2‡öÆ–6–—2Æv÷&ÇÆ–W"ç÷6—F–öâç‚ÇÆ–W"ç÷6—F–öâç¢“°¢GVÆ—¦%öÆ–6–Ä6öÖ&FR‡öÂÆGBÆv÷&“°§Ğ¢òò2&Æ2<;2fì:vÒFVçG&òFRGVÆ—¦%öÆ–6–Â6öÒÆ—7FFRÇf÷2FVVÆRVG&òâòFW7FP¢òò&V6—6FòÖW6Öò"†&Æ²Çf÷2’Â6Vì:6òÖVFRF—&òVR6’RçVæ66†VvVÒæ–æw\:–Òà¦W‡÷'BgVæ7F–öâõ÷76ôFT&Æ5&FW7FR†GB—°¢òòÖöçF$Çf÷4Fôg&ÖV&öFFVçG&òFRGVÆ—¦%öÆ–6–ÂVRòFW7FRì:6ò6†Öâ6VÒVÆÆ—7FFP¢òòÇf÷2f–6f¦–RDôD&Æ76&WFò(	Bfö’òVRfW¢&–ÖV—&ÖVFœ:|:6òF"RF—&÷2RFæòà¢ÖöçF$Çf÷4Fôg&ÖR‚“°¢GVÆ—¦$&Æ2†GBÆÇf÷4F&Æ“°§Ğ¢òò6W&:|:6òFR6÷'÷2&öFFVçG&òFRGVÆ—¦%öÆ–6–ÂVRòFW7FRì:6ò6†Ö(	B6VÒW7FRvæ6†òğ¢òòFW7FRÖöçF&–VG&òöÆ–6–—2V×–Æ†F÷2R'&÷f&–"VRVÆW2f–6ÒV×–Æ†F÷2à¦W‡÷'BgVæ7F–öâõ÷6W&$6÷'÷5&FW7FR‚—·6W&$6÷'÷2‚—Ğ¢òòÓÓÓÓÒ$ä4DD2ôäD2DR$Tdõ,8tòÓÓÓÓĞ¢òòW66ÆF:’VÒ&VÌ;6v–ó¢&–ÖV—&ÆWfFW66Ræò&VÂR2÷WG&2l:¦Ò6öÒòFV×òFR6öæg&öçFòà¢òòÖVF—"—76òFRfW&FFRÆWf&–Ö–çWF÷2÷"66òÂVçL:6òòFW7FRf÷,:vòW7FFòR&öFò6öÖ&FV6öĞ¢òòW&f÷&Öæ6Rææ÷r‚–f—'GVÆ—¦Fò(	BÖW6ÖL:–6æ–6F&æ6FFG&ö6:|:6òà¦W‡÷'BgVæ7F–öâõöf÷&6$6öÖ&FU&FW7FR‚—°¢f÷"†ÆWB“×öÆ–6–—2æÆVæwF‚Ó¶“ãÓ¶’ÒÒ—&VÖ÷fW%öÆ–6–Â†’“°¢öÆ–6–æ&—†3Ó·öÆ–6–ç&W÷6–6ôVÓÓ·öÆ–6–æ6ÆÖ&–FSÓ·öÆ–6–ç&ö7W&FóÓ3°¢fV6†$&÷&FvVÒ‚“°¢GW&æô&W'Fó×G'VS²òòì:6ò'&RòGW&æò–æ–6–Â÷"6–ÖFò6Vì:&–òÖöçFFòVÆòFW7FP¢6öç7Bv÷&×W&f÷&Öæ6Rææ÷r‚’ó°¢f÷"†ÆWB“Ó¶“ÄTdUD•dõô$4S¶’²²—°¢6öç7BæsÖ’ôTdUD•dõô$4R¤ÖF‚å’£#°¢6—$F&6R†v÷&Ç·ƒ§Æ–W"ç÷6—F–öâç‚´ÖF‚æ6÷2†ær’£’Ç£§Æ–W"ç÷6—F–öâç¢´ÖF‚ç6–â†ær’£—Ò“°¢Ğ§Ğ¢òòVÒ76òFòÆ:vò–çFV—&òFG'VÆ††VfWF—fò²&÷&FvVÒ²6FöÆ–6–Â’ÂVR:’öæFRÖ÷&GVFòğ¢òòVR÷2FW7FW2FR&—FÖòÖVF–ÒæòçF–vòW7FFòv6öÖ&FRrà¦W‡÷'BgVæ7F–öâõ÷76ôFô6öÖ&FTFôW7FFò†GB—°¢òò¤U$òõ,8tÔTåDòDR¢Â÷'VRW7FRvæ6†ò&W&W6VçFVÒTE$ò”åDT•$òRVVÒ¦W&FRfW&FFR:¢òòGVÆ—¦%öÆ–6–ÂVRòFW7FRì:6ò6†Öâ6VÒ—7FòÂ6Ö–æ†÷4æW7FUVG&öf–6fG&fFòVÒ¢òòFWö—2Fò&–ÖV—&ò76òRäTä…TÒ&WÆæV¦ÖVçFò6öçFV6–æò&W7FòFÖVFœ:|:6ò(	BòFW7FRÖVF–VĞ¢òò¦övò6VÒ¢ÂRÖRFWR#ƒRF÷2VG&÷2&'&F÷2"çVÒ×VæFòVÒVRòì;¦ÖW&ò:’÷WG&òà¢6Ö–æ†÷4æW7FUVG&óÓ°¢GVÆ—¦%G'VÆ††GBÇW&f÷&Öæ6Rææ÷r‚’ó“°§Ğ¦W‡÷'BgVæ7F–öâõö6öçF%öÆ–6–—2‚—·&WGW&ç¶VÔ6×ó§öÆ–6–—2æf–ÇFW"‡Óççf—fò’æÆVæwF‚À¢&—†3§öÆ–6–æ&—†2ÆFW6V¦Fó¦VfWF—fôFW6V¦Fò‚’ÇFWFó¥ôÄ”4”•5ôÔ‚Æ&6S¤TdUD•dõô$4W×Ğ¢òòdU$•"6VÒÖF"ÂVR:’ò66òFVV—†¢&F÷RVÒF—&òæVÆW2RVÆW2ì:6òf¦VÒæFÂFVÒVRW7W& ¢òòÖ÷'&W""â76VÆòÔU4ÔòF–æv—%öÆ–6–ÆVR&ÆW6(	BFW7F"÷"VÒ6Ö–æ†ò&ÆVÆò&÷f&–¢òòò6Ö–æ†ò&ÆVÆòà¦W‡÷'BgVæ7F–öâõ÷öÆ–6–ÄÇfõ&FW7FR‚—°¢6öç7BöÃ×öÆ–6–—2æf–æB‡Óççf—fò“°¢&WGW&âöÃ÷¶‡¢·öÂæ‡çFôf—†VBƒ’Çƒ¢·öÂç÷2ç‚çFôf—†VBƒ’Ç£¢·öÂç÷2ç¢çFôf—†VBƒ’ÆÖöFó§öÂæÖöF÷Ó¦çVÆÃ°§Ğ¦W‡÷'BgVæ7F–öâõöfW&—%öÆ–6–Å&FW7FR†Fæò—°¢6öç7BöÃ×öÆ–6–—2æf–æB‡Óççf—fò“°¢–b‡öÂ–F–æv—%öÆ–6–Â‡öÂÆFæò“°¢&WGW&âöÃ°§Ğ¦W‡÷'BgVæ7F–öâõ÷¦W&$f–6†&FW7FR‚—·öÆ–6–ç&ö7W&FóÓ·&7G&òæF—fóÖfÇ6S·&7G&òæ'W66FSÓ·VÇF–Öõf—7FóÖçVÆÇĞ¢òò&æ6FFòöÆ†òFR'V¢VÒöÆ–6–Â$DòçVÒöçFòW66öÆ†–FòÂRòÖÆ–×òF÷2÷WG&÷2â&Fğ¢òò÷'VRW&wVçF:’6ö'&RÆ6æ6RR&VFR(	B6öÒVÆRæFæFòWRÖVF—&–&öæFÂì:6òf—7Fà¦W‡÷'BgVæ7F–öâõöÆ–×%öÆ–6–—5&FW7FR‚—°¢f÷"†ÆWB“×öÆ–6–—2æÆVæwF‚Ó¶“ãÓ¶’ÒÒ—&VÖ÷fW%öÆ–6–Â†’“°¢GW&æô&W'Fó×G'VS²òòì:6òFV—†òGW&æò–æ–6–Âæ66W"÷"6–ÖFò6Vì:&–ğ§Ğ¦W‡÷'BgVæ7F–öâõ÷ÆçF%öÆ–6–Å&FW7FR‡‚Ç¢—°¢6öç7BöÃÖ7&–%öÆ–6–Â‡öÆ–6–—2æÆVæwF‚Âw'Vr“°¢öÂç÷2ç6WB‡‚ÃÇ¢“·öÂæÇGW&GVÃÖö'FW$VÆWf6ò‡‚Ç¢“°¢öÂæw'Wòç÷6—F–öâç6WB‡‚ÇöÂæÇGW&GVÂÇ¢“°¢öÂæÖöFóÒw&öæFs·öÂæFW7F–æõ&öæF×·‚Ç§Ó²òòFW7F–æò:’öæFRVÆR¬:W7L:¢f–6&Fğ¢öÆ–6–—2çW6‚‡öÂ“°¢&WGW&ç·ƒ¢·‚çFôf—†VBƒ’Ç£¢·¢çFôf—†VBƒ—Ó°§Ğ¦W‡÷'BgVæ7F–öâõ÷föÇF$†VÆ•&&öæF&FW7FR‚—·G&ç6—F"‚w&öæFæFòr—Ğ¢òò&VvòöÆ–6–ÂæòÇVv"ÂVG&òVG&òâFW7F–æõ&öæFöçFæFò&ò,;7&–ò:’ì84ò6VwW&¢ğ¢òò&6†Vv""Â&öæF6÷'FV–÷WG&òFW7F–æòRVÆR6’æFæFòâfö’76–ÒVRò66òF&VFRFWRfÇ6ğ¢òò÷6—F—fò(	BVÆRæFfL:’væ†"Æ–æ†FRf—<:6òR6†fÆçF÷2bÃB2ÂRWRFW&–6öæ6Ç\:ÖFğ¢òòVR&VFRì:6òFæFà¦W‡÷'BgVæ7F–öâõöÖçFW%öÆ–6–Å&Fò‡‚Ç¢ÆöÆ†æFõ&ô¦övF÷#ÖfÇ6R—°¢6öç7BöÃ×öÆ–6–—5³Ó°¢–b‚öÂ—&WGW&ã°¢öÂç÷2ç6WB‡‚ÃÇ¢“·öÂæÇGW&GVÃÖö'FW$VÆWf6ò‡‚Ç¢“°¢öÂæw'Wòç÷6—F–öâç6WB‡‚ÇöÂæÇGW&GVÂÇ¢“°¢öÂæFW7F–æõ&öæF×·‚Ç§Ó·öÂç&÷FÖçVÆÃ·öÂæFW7F–æõ&÷FÖçVÆÃ°¢òòÓÓÓÓÒRDTÒTRôÄ„"$TÄRÂ4RòDU5DRdõ"4ô%$RdU"ÓÓÓÓĞ¢òò&VvFòæòÇVv"ÂòöÆ–6–Âf–66öÒòöÆ†%–Fò;¦ÇF–ÖòFW7F–æò(	BRòFW7F–æò:’ò,;7&–ò:’À¢òòVçL:6òVÆRöÆ†&µ¢RæFÖ—2âVÒÇfò2ÒDRÄDòf–6f÷&Fò6öæRRf—VçVæ6Æ–và¢òòfö’76–ÒVRòFW7FRFòFV6–ÖVçFòF—76R&6öÒöÆ–6–ÂfVæFòÂW7G&VÆ6’–wVÂ#¢ì:6ò†f–¢òòöÆ–6–ÂfVæFòÂ†f–öÆ–6–ÂFR6÷7F2âVVÒVW"ÖVF—"f—<:6òVFRÖ—&W‡Æ–6—FÖVçFRà¢–b†öÆ†æFõ&ô¦övF÷"—öÂæöÆ†%“ÔÖF‚æFã"‡Æ–W"ç÷6—F–öâç‚×‚ÇÆ–W"ç÷6—F–öâç¢×¢“°§Ğ¢òò&FRVÒöÆ–6–ÂVÒ6×òÂ&òFW7FRÖVF—"VRò&Vf÷,:vò<;2fVÒDUô•2FRVÖ&—†à¦W‡÷'BgVæ7F–öâõö&FW%VÕ&FW7FR‚—°¢6öç7Bf—fó×öÆ–6–—2æf–æB‡Óççf—fò“°¢–b‡f—fò–F–æv—%öÆ–6–Â‡f—fòÅôÄ”4”Åô…£2“°¢&WGW&âf—fó°§Ğ¢òò&VæFRò¦övF÷"æÖ'&Â&òFW7FRÖVF—"òVR4ôåDT4RVæFòVÆRÖ÷'&R6VÒ&V6—6"ÆWf ¢òòF—&òFRfW&FFR÷"G&–çF6VwVæF÷2à¦W‡÷'BgVæ7F–öâõ÷&VæFW$¦övF÷%&FW7FR‚—·&V6V&W$Fæô¦övF÷"ƒ“““’—Ğ¢òò;VRf–6†çVÒì:×fVÂW66öÆ†–FòÂ&òFW7FRFòFV6–ÖVçFòì:6òFWVæFW"FR&FW"öÆ–6–Â‡VP¢òòÖ—7GW&òFV6–ÖVçFò6öÒ&Vf÷,:vòÂ×Væœ:|:6òR6L:¦æ6–(	BVG&ò6ö—62çVÖÖVF–F<;2’à¦W‡÷'BgVæ7F–öâõöFVf–æ—%&ö7W&Fõ&FW7FR†â—·öÆ–6–ç&ö7W&FóÖã·öÆ–6–çFV×õ6VÕfW#Ó·öÆ–6–çFV×ôæ—fVÃÓĞ¦W‡÷'BgVæ7F–öâõöf–6†&FW7FR‚—·&WGW&ç·&ö7W&Fó§öÆ–6–ç&ö7W&FòÇ&7G&ôF—fó§&7G&òæF—fòÀ¢FV×õ6VÕfW#¢·öÆ–6–çFV×õ6VÕfW"çFôf—†VBƒ’ÇFV×ôæ—fVÃ¢·öÆ–6–çFV×ôæ—fVÂçFôf—†VBƒ’À¢'W66FS§&7G&òæ'W66FRÆf–6†VVçFS¢·6VwVæF÷4FTf–6†VVçFR‚’çFôf—†VBƒ’À¢6†ÖFVæ6ó¦6†ÖFVæ6ò‚’À¢&÷&FvVÓ¦&÷&FvVÒæF—fÆ&÷&FvVÕfVæFó¦&÷&FvVÒçfVæFòÀ¢&¦ó¢·6VwVæF÷4F&÷&FvVÒ‚’çFôf—†VBƒ—×Ğ¦W‡÷'BgVæ7F–öâõ÷'V&FW7FR‚—·&WGW&âöÆ–6–—2æÖ‡Óâ‡¶–C§æ–BÇƒ¢·ç÷2ç‚çFôf—†VBƒ’Ç£¢·ç÷2ç¢çFôf—†VBƒ’À¢f—fó§çf—fòÆÖöFó§æÖöFòÇf—S¢çf—RÀ¢FW7F–æó§æFW7F–æõ&öæF÷·ƒ¢·æFW7F–æõ&öæFç‚çFôf—†VBƒ’Ç£¢·æFW7F–æõ&öæFç¢çFôf—†VBƒ—Ó¦çVÆÇÒ’—Ğ¢òò&6RÂ&òFW7FR6öæfW&—"VRFöFò&Vf÷,:vò6’FV’RFRæVæ‡VÒ÷WG&òÇVv"à¦W‡÷'BgVæ7F–öâõö&6U&FW7FR‚—·&WGW&ç·ƒ¥õ%Dô$4Rç‚Ç£¥õ%Dô$4Rç§×Ğ¦W‡÷'BgVæ7F–öâõö&ÖGW&&FW7FR‚—·&WGW&â&ÖGW&¦övF÷'Ğ¦W‡÷'BgVæ7F–öâõ÷¦W&$&ÖGW&&FW7FR‚—¶&ÖGW&¦övF÷#ÓĞ¦W‡÷'BgVæ7F–öâõ÷f–F¦övF÷%&FW7FR‚—·&WGW&â6VFT¦övF÷'Ğ¦W‡÷'BgVæ7F–öâõö7W&$¦övF÷%&FW7FR‚—°¢òò¦W&DÔ,8”Òò&VæF–Fó¢6VÒ—76òÂò&–ÖV—&ò66òFòFW7FRÖFfò¦övF÷"ÂVÆRf–6f&VæF–FòÂP¢òòFöF÷2÷266÷26VwV–çFW2ÖVF–Ò¦W&ò(	B÷'VRöÆ–6–Âì:6òF—&VÒVVÒ¬:6RVçG&Vv÷Rà¢6VFT¦övF÷#Ô¤ôtDõ%ô…ôÔƒ¶&ÖGW&¦övF÷#Ó¶¦övF÷%&VæF–FóÖfÇ6S¶GVÆ—¦$‡VE6VFR‚“°§Ğ¦W‡÷'BgVæ7F–öâõöW7FFôFT6öÖ&FR‚—°¢&WGW&âöÆ–6–—2æf–ÇFW"‡Óççf—fò’æÖ‡Óâ‡·VÃ§çVÂÇF—&÷3§çF—&÷2À¢W7Æ†ÖVçFó¢²‡çVÇF–ÖôW7Æ†ÖVçF÷ÇÃ’çFôf—†VBƒB’ÇFVÔ6ö&W'GW&¢æ6ö&W'GW&À¢F—7C¢¶F—7E…¢‡ç÷2ÇÆ–W"ç÷6—F–öâ’çFôf—†VBƒ—Ò’“°§Ğ¢òòÓÓÓÓÒ$õ$DtTÒÓÓÓÓĞ¢òò'&RVæFòÆw\:–Òl:¢Öö6†–Æâì84ò&Væ÷fò&¦ò6FVG&òVÒVR6öçF–çVfVæFó¢ò&¦ò:¢òòFòÖöÖVçFòVÒVRVÆRfö’fÆw&FòÂR&Væ÷f"6–væ–f–6&–çVæ6W7F÷W&"à¦gVæ7F–öâ'&—$&÷&FvVÒ†v÷&—°¢–b†&÷&FvVÒæF—f—&WGW&ã°¢&÷&FvVÒæF—f×G'VS°¢&÷&FvVÒæFSÖv÷&µ$¤õô$õ$DtTÓ°¢&÷&FvVÒæf–Ô'W66Ó°¢&÷&FvVÒçƒ×Æ–W"ç÷6—F–öâçƒ¶&÷&FvVÒç£×Æ–W"ç÷6—F–öâç£°¢Ö÷7G&$f—6ò‚	ùâFRf—&Ò6öÒÖö6†–Æâ6öÖRFf—7FrÃ3“°§Ğ¦gVæ7F–öâfV6†$&÷&FvVÒ‚—¶&÷&FvVÒæF—fÖfÇ6S¶&÷&FvVÒçfVæFóÖfÇ6S¶&÷&FvVÒæf–Ô'W66ÓĞ¢òòVçFòfÇFFò&¦òÂ&òf—6òæFVÆâ¦W&òVæFòæ–æw\:–ÒW7L:fVæFò(	BR:’W76&FVRf ¢òògVv—"fÆW"Væà¦W‡÷'BgVæ7F–öâ6VwVæF÷4F&÷&FvVÒ‚—°¢–b‚&÷&FvVÒæF—fÇÂ&÷&FvVÒçfVæFò—&WGW&â°¢&WGW&âÖF‚æÖ‚ƒÆ&÷&FvVÒæFR×W&f÷&Öæ6Rææ÷r‚’ó“°§Ğ¦W‡÷'BgVæ7F–öâW7F6VæFô&÷&FFò‚—·&WGW&â&÷&FvVÒæF—fĞ¦gVæ7F–öâGVÆ—¦$&÷&FvVÒ†v÷&—°¢–b‚&÷&FvVÒæF—f—&WGW&ã°¢òò6öÒf–6†7V¦&÷&FvVÒì:6òW†—7FRÖ—3¢:Ò¬::’W'6VwVœ:|:6òÂRVÆFVÒ&Vw&2,;7&–2à¢–b‡öÆ–6–ç&ö7W&Fóã—¶fV6†$&÷&FvVÒ‚“·&WGW&çĞ¢òòVçG&Vv÷RÂfVæFWR÷RW&FWRò6÷FRæòÖV–ó¢6&÷RòfÆw&çFRÂ6&÷R&÷&FvVÒà¢–b‚ÆWfæFõ6÷FR‚’—¶fV6†$&÷&FvVÒ‚“¶Ö÷7G&$f—6ò‚u6VÒÖö6†–ÆÂì:6òŒ:òVRFR7W6"ârÃ##“·&WGW&çĞ¢6öç7BfVæFó×öÆ–6–—2ç6öÖR‡ÃÓçÂçf—fòbgÂçf—R“°¢–b‡fVæFò—°¢òòföÇF÷R&V6W"FWö—2FRFW"7VÖ–Fó¢&¦òäõdòâgVv—"ì:6òöFR<;2V×W'&"ò&ö&ÆVÖà¢–b‚&÷&FvVÒçfVæFò–&÷&FvVÒæFSÖv÷&µ$¤õô$õ$DtTÓ°¢&÷&FvVÒçfVæFó×G'VS¶&÷&FvVÒæf–Ô'W66Ó°¢&÷&FvVÒçƒ×Æ–W"ç÷6—F–öâçƒ¶&÷&FvVÒç£×Æ–W"ç÷6—F–öâç£°¢–b†v÷&ãÖ&÷&FvVÒæFR—°¢fV6†$&÷&FvVÒ‚“°¢VÆWf%&ö7W&Fòƒ“°¢Ö÷7G&$f—6ò‚	ùâf–6÷R&FòFVÖ—2âv÷&:’&ö7W&FòârÃ3#“°¢Ğ¢&WGW&ã°¢Ğ¢òò7VÖ—RFf—7F¢VÆW2l:6òL:’ò;¦ÇF–ÖòöçFòRf67VÆ†Òâ6RòFV×ò6&"ÂföÇFGVFò:&öæF(	@¢òò6VÒW7G&VÆæVæ‡VÖâ8’ò'6RWR6÷'&W"ÂVÆW2FW6—7FVÒ"à¢–b†&÷&FvVÒçfVæFò—¶&÷&FvVÒçfVæFóÖfÇ6S¶&÷&FvVÒæf–Ô'W66Öv÷&´%U44ô$õ$DtT×Ğ¢–b†v÷&ãÖ&÷&FvVÒæf–Ô'W66—¶fV6†$&÷&FvVÒ‚“¶Ö÷7G&$f—6ò‚ufö<:¢FW7—7F÷RâVÆW2föÇF&Ò&&öæFârÃ#C—Ğ§Ğ ¢òòFW7—%öÆ–6–ÆF—&òÖ—†W"FÆ—7FFRGVÆ—¦:|:6òâ6VÒ—76òòÖ—†W"FRVÒöÆ–6–Â¬:&VÖ÷f–Fğ¢òòF6Væ6öçF–çV6VæFòfì:vFò6FVG&òÂ&6V×&R(	B:’òÖW6Öòf¦ÖVçFòVR2vVöÖWG&–0¢òò÷"öÆ–6–Â¬:6W6&ÒVÖfW¢æW7FR'V—fòÂ<;2VRVÒ5RVÒfW¢FRe$Òà¦gVæ7F–öâ&VÖ÷fW%öÆ–6–Â†’—°¢6öç7BöÃ×öÆ–6–—5¶•Ó°¢66VæRç&VÖ÷fR‡öÂæw'Wò“·öÂæ&'&æFW66'F"‚“¶FW7—%öÆ–6–Â‡öÂæ6÷'ò“°¢öÆ–6–—2ç7Æ–6R†’Ã“°§Ğ ¢òòÓÓÓÓÒòTdUD•dòÓÓÓÓĞ¦gVæ7F–öâGVÆ—¦$VfWF—fò†GBÆv÷&—°¢6öç7Bf—f÷3×öÆ–6–—2ç&VGV6R‚†âÇÂ“Óæâ²‡Âçf—fóó£’Ã“°¢6öç7BÇfóÖVfWF—fôFW6V¦Fò‚“°¢–b‡f—f÷3ÆÇfòbfv÷&ã×öÆ–6–ç&W÷6–6ôVÒ—°¢6—$F&6R†v÷&“°¢öÆ–6–ç&W÷6–6ôVÓÖv÷&µ$Uõ4”4õôU5U$°¢Ğ¢òòVçVçFòŒ:6öæg&öçFòò&VÌ;6v–òF6ÆÖ&–f–66VæFòV×W'&Fò&g&VçFRà¢–b‡öÆ–6–ç&ö7W&FóãÇÆ&÷&FvVÒæF—f—öÆ–6–æ6ÆÖ&–FSÖv÷&´4ÄÔ$”°¢VÇ6R–b‡öÆ–6–æ&—†3ãbfv÷&çöÆ–6–æ6ÆÖ&–FR—öÆ–6–æ&—†3Ó°¢òò6ö'&æFòvVçFS¢VÒFR6FfW¢föÇF&&6R8’R6öÖRÌ:FVçG&òâæ–æw\:–ÒWf÷&æg&VçFP¢òòFVÆR(	BWf÷&":’ÖW6ÖVV'&FR–ÇW<:6òVR&V6W"FòæFà¢–b‡f—f÷3æÇfò—°¢òòuT$äœ8|84òDd”EU$ì84òTåE$äU5DR4õ%DT”òâVÆ:’W†6VFVçFR÷"FVf–æœ:|:6ò(	B:’§W7FÖVçFP¢òò÷"—76òVRVÆW7L:VÒ6×ò(	BRW7FRG&V6†òVvfVÆRÖæFfæFæFò&FVÆVv6–æğ¢òòÖV–òFò6W'fœ:vòâÖVF–Fó¢÷2Fö—27VÖ–ÒÃbÒF÷'FF&6RRcrÃÒFf–GW&VP¢òòFWfW&–W7F"W7W&æFò÷"VÆW2âf–GW&f–6f&FwV&FæFòVÒ6'&òf¦–òÂRò ¢òò&FW66RFò6'&òò6ö&Ræò6'&ò"çVæ6fV6†fâVVÒ6†ÖVÆW2FRföÇF:’òf–ÒF&F–FÀ¢òòVÆò&V6öÆ†W$WV—TFf–GW&ÂRòFW7F–æò:’÷'FFò6'&òà¢6öç7BW‡G&×öÆ–6–—2æf–æB‡ÃÓçÂçf—fòbgÂæÖöFòÓÒwföÇFæFòrbbWV—TFf–GW&æ–æ6ÇVFW2‡Â’“°¢–b†W‡G&—¶W‡G&æÖöFóÒwföÇFæFòs¶W‡G&ç&÷FÖçVÆÃ¶W‡G&æFW7F–æõ&÷FÖçVÆÇĞ¢Ğ§Ğ ¢òòÓÓÓÓÒòÄ8tòDRDôDòôÄ”4”ÂÓÓÓÓĞ¢òòVÖÆ—7F<;2âçFW2W&ÒGV2(	BwV&æœ:|:6òFR,:VÂ†6öævVÆFf÷&FòW7FFòFR6öÖ&FR’R¢òòöÌ:Ö6–FR'V†–çFW&Ö—FVçFR’(	BRÖWFFRF÷26–çFöÖ2f–æ†FR2GV2ì:6ò6öçfW'6&VÒâV’ğ¢òòÖW6ÖòöÆ–6–Â&öæFÂ&÷&FÂf67VÆ†÷RG&ö6F—&ò6öæf÷&ÖR6—GV:|:6òÂ6VÒæ66W"æVÒÖ÷'&W ¢òò÷"6W6F—76òà¦gVæ7F–öâGVÆ—¦%G'VÆ††GBÆv÷&—°¢–b‚GW&æô&W'Fò–'&—%GW&æò†v÷&“°¢GVÆ—¦$VfWF—fò†GBÆv÷&“°¢GVÆ—¦$&÷&FvVÒ†v÷&“°¢6öç7B'&–v×öÆ–6–ç&ö7W&Fóã°¢f÷"†ÆWB“×öÆ–6–—2æÆVæwF‚Ó¶“ãÓ¶’ÒÒ—°¢6öç7BöÃ×öÆ–6–—5¶•Ó°¢–b‚öÂçf—fò—°¢öÂçVVFB³ÖGC·öÂæw'Wòç&÷FF–öâçƒÔÖF‚æÖ–â„ÖF‚å’ó"ÇöÂçVVFB£B“°¢öÂæ&'&æÖ÷7G&"†fÇ6R“°¢–b‡öÂçVVFCä4õ%õôEU$4ò—&VÖ÷fW%öÆ–6–Â†’“°¢6öçF–çVS°¢Ğ¢6öç7BfVæFó×W&6V&W"‡öÂÆv÷&“°¢òòöÆ†"VÒföÇFG,:2FRÆçF:|:6òf¢'FRF&öæFÂR&öFåDU2FòFW7f–òFR6öÖ&FS¢6RVÆP¢òòW7L:æòÖV–òFRVÒF—&÷FV–òÂöÆ–6–ÄöÆ†ÆçF66’æ&–ÖV—&Æ–æ†‡<;2öÆ†VÒ&öæF’à¢öÆ–6–ÄöÆ†ÆçF2‡öÂÆv÷&“°¢òò4ôÒd”4„5T¤:’ò6öÖ&FRFR6V×&S¢:–—2Â6ö&W'GW&Âfì:vòRF—&òà¢–b†'&–v—¶GVÆ—¦%öÆ–6–Ä6öÖ&FR‡öÂÆGBÆv÷&ÇfVæFò“¶6öçF–çVWĞ ¢ÆWBFW7F–æóÖçVÆÂÆVæ6&#ÖçVÆÃ°¢–b‡öÂæÖöFóÓÓÒwföÇFæFòr—°¢òòöçFôFUföÇF:’÷'FFd”EU$Â&wV&æœ:|:6òVR6—RFVÆ²VVÒì:6òFVÒföÇF&&6RÀ¢òò6öÖò6V×&Rfö’â6öÖRò6†Vv"æ÷2Fö—266÷2(	BVçG&"æò6'&òRVçG&"æò÷'L:6òF&6P¢òò<:6òÖW6Ö6ö—6FV’FRf÷&¢æ–æw\:–ÒWf÷&æg&VçFRFò¦övF÷"à¢6öç7B66×öÂçöçFôFUföÇFÇÅõ%Dô$4S°¢–b†F—7E…¢‡öÂç÷2Æ66“Å%Tô4„TtD—·&VÖ÷fW%öÆ–6–Â†’“¶6öçF–çVWĞ¢FW7F–æóÖ66°¢ÖVÇ6R–b†&÷&FvVÒæF—f—°¢òòl:¦Òæò'VÖòFVÆRæFæFòÂ6VÒF—&"â&"7F÷–ætF—7Fæ6V:’òVRf¢&÷&FvVÒÆW ¢òò6öÖò&÷&FvVÒ(	B6†Vv"6öÆFò6W&–V×W',:6òà¢FW7F–æóÖ&÷&FvVÒçfVæFó÷·ƒ§Æ–W"ç÷6—F–öâç‚Ç£§Æ–W"ç÷6—F–öâç§Ó§·ƒ¦&÷&FvVÒç‚Ç£¦&÷&FvVÒç§Ó°¢–b†&÷&FvVÒçfVæFòbfF—7E…¢‡öÂç÷2ÇÆ–W"ç÷6—F–öâ“Ã×7F÷–ætF—7Fæ6R–Væ6&#ÖFW7F–æó°¢ÖVÇ6R–b‡öÆ–6–æÇfõÆçFbböÆ–6–æÇfõÆçFæ6öÆ†–F—°¢òò$D”D8“¢ò†VÆ’Ö&6÷RÂVÆW26Ö–æ†ÒL:’Ì:Rò6öæf—66ò<;26÷'&R6öÒÆw\:–ÒVÒ6–Öà¢6öç7BÃ×öÆ–6–æÇfõÆçF°¢FW7F–æó×·ƒ§Âç‚Ç£§Âç§Ó°¢–b†F—7E…¢‡öÂç÷2ÇÂ“Ã"ã"—°¢Væ6&#ÖFW7F–æó°¢–b‚öÆ–6–æ6öæf—66ôFR—öÆ–6–æ6öæf—66ôFSÖv÷&´4ôäd•44õôEU$4ó°¢VÇ6R–b†v÷&ã×öÆ–6–æ6öæf—66ôFR—°¢òò6öæf—66U5DR:’R'FR&ò,;7†–ÖòFòÖW6Öò6çFV—&òâçFW2Âò&–ÖV—&ò6öæf—66ğ¢òò¦W&fòÇfòR6&f&F–F(	BöÌ:Ö6–ÆWff:’FR3R–VÖ&÷&à¢6öæf—66%ÆçF‡Â“·öÆ–6–æ6öæf—66ôFSÓ°¢6öç7B&W7FÓ×W5f—f÷4FÆçF6ò‚“°¢öÆ–6–æÇfõÆçF×&W7FÕ³×ÇÆçVÆÃ°¢Ö÷7G&$f—6ò‡&W7FÒæÆVæwF€¢ööÌ:Ö6–6öæf—66÷RVÒ:’(	BfÇFÒG·&W7FÒæÆVæwF‡Òæò6çFV—&òæ ¢¢töÌ:Ö6–6öæf—66÷R7VÆçF:|:6òârÃ#c“°¢Ğ¢Ğ¢ÖVÇ6R–b‡&7G&õfÆ–Fò†v÷&’–FW7F–æó×·ƒ§&7G&òç‚Ç£§&7G&òç§Ó°¢VÇ6R–b†VÔ'W66†v÷&’–FW7F–æó×öçFôFT'W66‡öÂÆv÷&“°¢VÇ6W°¢–b‡öÂæW7W&æFõG'VÆ†FSæv÷&–Væ6&#×öÂæFW7F–æõ&öæF°¢VÇ6W°¢FW7F–æó×öÂæFW7F–æõ&öæF°¢òòÓÓÓÓÒDU4•5D•"DòDU5D”äò8’%DRD$ôäDÓÓÓÓĞ¢òò9¦ÇF–Öò&V7W'6òÂRòVRv&çFRVRæVæ‡VÖG&fGW&&6V×&S¢–ç6—7F–æFòE$dDõõ$ğ¢òòDU4•5D•"VG&÷26VÒ6—"FòÇVv"ÂòöçFòFR&öæF:’G&ö6Fòâ8’òVRVÖW76öf¢(	@¢òò&ì:6òL:&—"÷"V’Âf÷R&÷WG&òÇVv""â6VÒ—7FòÂVÒFW7F–æòVRò6÷'òì:6òÆ6ì:v¢òò†ædÖW6‚&÷f76vVç226ÒÖ—2W7G&V—F2VRòöÆ–6–Â’&VæFRVÆR–æFVf–æ–FÖVçFS ¢òòÖVF–FòÂs’2æòÖW6ÖòöçFòÖW6Öò¬:6öçF÷&ææFòà¢–b‡öÂçG&fFóãÕE$dDõõ$ôDU4•5D•"—°¢öÂæFW7F–æõ&öæF×öçFôFU&öæF‡G'VR“°¢öÂç&÷FÖçVÆÃ·öÂæFW7F–æõ&÷FÖçVÆÃ·öÂçG&fFóÓ°¢FW7F–æó×öÂæFW7F–æõ&öæF°¢ÖVÇ6R–b†F—7E…¢‡öÂç÷2ÆFW7F–æò“Å%Tô4„TtD—°¢öÂæW7W&æFõG'VÆ†FSÖv÷&³2´ÖF‚ç&æFöÒ‚’£#°¢öÂæFW7F–æõ&öæF×öçFôFU&öæF‡G'VR“°¢Ğ¢Ğ¢Ğ ¢ÆWBæFæFóÖfÇ6S°¢–b†Væ6&"—°¢öÂçfVÆö6—G’ç6WBƒÃÃ“¶Væ6&%öçFò‡öÂÆVæ6&"ç‚ÆVæ6&"ç¢“°¢ÖVÇ6R–b†FW7F–æò—°¢6öç7BÇfóÖÇfôFTÖ÷f–ÖVçFò‡öÂÆv÷&ÆFW7F–æòç‚ÆFW7F–æòç¢“°¢òò&Vf÷,:vò6†ÖFòæòÖV–òFRVÒ6öæg&öçFòfVÒ4õ%$TäDó²&öæF:’&öæFà¢6öç7BfVÃ×fVÆö6–FFUöÆ–6–Â…%TõdTÄô4”DDR¢†&÷&FvVÒæF—fóã#S£’¢‡öÂæÖöFóÓÓÒvFW6VÖ&'VRsóã“£’“°¢76õöÆ–6–Â‡öÂÆGBÆÇfòç‚ÆÇfòç¢ÇfVÂ“°¢æFæFó×G'VS°¢Ğ¢–b†6öÆ–FUVFW7G&R‡öÂç÷2ç‚ÇöÂç÷2ç¢’—°¢6öç7BÆ—g&SÖ'W66%÷6–6ôÆ—g&R‡öÂç÷2ç‚ÇöÂç÷2ç¢Æ6öÆ–FUVFW7G&R“°¢–b†Æ—g&R—·öÂç÷2çƒÖÆ—g&Rçƒ·öÂç÷2ç£ÖÆ—g&Rç£·öÂç&÷FÖçVÆÃ·öÂæFW7F–æõ&÷FÖçVÆÇĞ¢Ğ¢76VçF%öÆ–6–Â‡öÂÆGBÇfVæFò“°¢öÂæ&'&ç÷6–6–öæ"‡öÂç÷2ç‚ÇöÂæw'Wòç÷6—F–öâç’ÇöÂç÷2ç¢“°¢öÂæ&'&æÖ÷7G&"‡öÂæ‡ÅôÄ”4”Åô…“°¢òòf÷&FR'&–væ–æw\:–ÒF—&âG'VÆ†FR&÷F–æì:6ògW¦–ÆVVÒ76æ'VÂR&÷&FvVÒ:¢òò&÷&FvVÒ(	BòF—&ò<;2VçG&VæFò¬:W†—7FRf–6†à¢FVçF$F—&"‡öÂÆv÷&ÆfÇ6RÆæFæFò“°¢Ğ§Ğ¢òòÇf÷2F2&Æ2Fò¦övF÷"–æ6ÇVVÒöÌ:Ö6–FR'V(	B6VÒ—76òVÆ6W&––çgVÆæW,:fVÂà¦W‡÷'BgVæ7F–öâöÆ–6–—4F–æv—fV—2‚—·&WGW&âöÆ–6–—7Ğ ¢òòÓÓÓÓÒU5DDò$ò4dRÓÓÓÓĞ¢òòFöÆW&çFRÆ—†ò÷"6öçG&Fó¢VÒ6fRçF–vòÂGVÇFW&Fò÷R6öÒ6×òfÇFæFòì:6òöFRÆì:v"(	@¢òòVVÒ6†Ö:’ò6'&VvÖVçFòÂRVÖW†6\:|:6òV’FV—†&–ò¦övF÷"6öÒFVÆ&WFà¢òòò6öÆWFRd•<8ÕdTÂ6VwVR&ÖGW&WV—FÖ—2÷26öÆWFW2VÒW7F÷VS¢fW7F–FòVçVçFò†÷WfW ¢òò&÷F\:|:6òÂ6öÖRVæFò;¦ÇF–Ö6&†÷RVæFòò¦övF÷":’&VæF–Fò’âVVÒFW6Væ†:’òÆ–W#°¢òòV’<;26RW‡;VR6öæFœ:|:6òÂVR:’W7FFòFR6öÖ&FRà¦W‡÷'BgVæ7F–öâ¦övF÷$6öÔ6öÆWFR‚—·&WGW&â¦övF÷%&VæF–Fòbb†&ÖGW&¦övF÷#ãÇÆ–çfVçF&–òæ6öÆWFSã—Ğ¢òòÖö6†–Æ:’òdÄu$åDS¢&V6RVçVçFò†÷WfW"6÷FRR:’fVæFòVÆVRöÌ:Ö6–FV6–FP¢òò&÷&F"†6†ÖFVæ6ö’â&VæF–FòÂ6öÖR§VçFò6öÒ6&v&VVæF–Fà¦W‡÷'BgVæ7F–öâ¦övF÷$6öÔÖö6†–Æ‚—·&WGW&â¦övF÷%&VæF–Fòbf–çfVçF&–òç6÷FSãĞ¢òòÓÓÓÓÒtä4„õ2Dò$"RD$•TT•$ÓÓÓÓĞ¢òòf–6ÒV’÷'VR6;¦FRR&ö7W&FòÖ÷&ÒV’ÂRV6öæö×’ì:6òöFR–×÷'F"òW7FFò–çFW&æòF¢òòöÌ:Ö6–6VÒfV6†"6–6Æò…öÆ–6R¬:–×÷'F–çfVçF&–öFRV6öæö×’’à¢òò&V&W"æò&"&V7WW&f–F¢:’;¦æ–67W&–ç7FçL:&æVFò¦övò(	B&VvVæW&:|:6òæ÷&ÖÂ<;26÷'&RVĞ¢òòG'VÆ†‡fW"òf–ÒFRGVÆ—¦%öÆ–6–’ÂVçL:6òVVÒæ†VÒW'6VwVœ:|:6òì:6òFVÒ6öÖò6&"à¦W‡÷'BgVæ7F–öâ7W&$¦övF÷"‡öçF÷2—°¢–b†¦övF÷%&VæF–F÷ÇÇ6VFT¦övF÷#ãÔ¤ôtDõ%ô…ôÔ‚—&WGW&âfÇ6S°¢òò6VÒ&wVÖVçFò7W&GVFò†F÷6RFò&"“²6öÒ&wVÖVçFò7W&òFçFòVF–Fò†6öÖ–FR:wVFğ¢òòÖW&6Fò’âVÒ<;26Ö–æ†ò&ÖW†W"æf–FFò¦övF÷"Wf—FGV2föçFW2FRfW&FFR&òÖW6Öò…à¢6VFT¦övF÷#ÔÖF‚æÖ–â„¤ôtDõ%ô…ôÔ‚ÇöçF÷3÷6VFT¦övF÷"·öçF÷3¤¤ôtDõ%ô…ôÔ‚“°¢GVÆ—¦$‡VE6VFR‚“·&WGW&âG'VS°§Ğ¦W‡÷'BgVæ7F–öâ¦övF÷%&V6—67W&"‚—·&WGW&â¦övF÷%&VæF–Fòbg6VFT¦övF÷#Ä¤ôtDõ%ô…ôÔ‡Ğ§&Vv—7G&$7W&†÷7—FÂ†7W&$¦övF÷"“°¢òòfVæFW"æ&—VV—&:’fVæFä%TÂ:f—7FFRFöFò×VæFó¢6ö&RVÖW7G&VÆà¦W‡÷'BgVæ7F–öâFVçVæ6–$&ö6‚—·6öÖ%&ö7W&Fòƒ“¶Ö÷7G&$f—6ò‚ufVæFW&ÒæGV6&âöÌ:Ö6–6÷V&RârÃ#c—Ğ¢òòVçG&Vv÷2væ6†÷2&V6öæö×’æòÖöÖVçFòVÒVRW7FRÜ;6GVÆò:’fÆ–Fòâ8’ò6VçF–FòFP¢òòFWVæL:¦æ6–VR¬:W†—7F–…öÆ–6RÓâV6öæö×’“²ò6öçG,:&–òfV6†&–6–6ÆòRW‡ÆöF—&–æòDE ¢òòF6öç7B–çfVçF&–öà§&Vv—7G&$væ6†÷5öÆ–6–‡¶7W&#¦7W&$¦övF÷"Ç&V6—67W&#¦¦övF÷%&V6—67W&"ÆFVçVæ6–#¦FVçVæ6–$&ö6ÆWV—$6öÆWFS¦WV—$6öÆWFT6ö×&FòÆ6öÆWFTVÕW6÷Ò“°¢òòò6fRwV&Fò$U5DòFf–6†VVçFRÂVÒ6VwVæF÷2(	Bì:6òVÒ–ç7FçFR'6öÇWFòâW&f÷&Öæ6Rææ÷r‚– ¢òò¦W&6F6'&VvÖVçFòF:v–æÂVçL:6òw&f"ò&¦òVÒFV×òFRÜ:V–æf&–FöFf–6†¢òò6ÇffVæ6W"æò–ç7FçFRVÒVRò¦övò&V'&Rà¢òò&ÖGW&WV—FFÖ,:–Ò:’W'6—7F–F¢ò6öÆWFRFò–çfVçL:&–ò:’6öç7VÖ–FòòfW7F—"ÂVçL:6ò6Çf ¢òòVæ2–çfVçF&–òæ6öÆWFVf¦–ò6öÆWFRFW6&V6W"ò6—"RVçG&"æ÷fÖVçFRà¢òò6fRçF–vòöFRG&¦W"W7FFòFR†VÆ’VRì:6òW†—7FRÖ—2‚wG'VÆ†rÂw&VÂrÂv6öÖ&FRrâââ’à¢òòæFF—76ò:’6Çfò†ö¦RÂÖ2wV&Ff–6¢W7FFòFW66öæ†V6–Fò6’VÒw&öæFæFòrVÒfW¢FP¢òòW7F÷W&"VÒU5DDõ5·öÆ–6–æW7FFõÒæôGVÆ—¦&à¦–b‚U5DDõ5·öÆ–6–æW7FFõÒ—öÆ–6–æW7FFóÒw&öæFæFòs°¦W‡÷'BgVæ7F–öâW7FFõöÆ–6–&6fR‚—·&WGW&ç·&ö7W&Fó§öÆ–6–ç&ö7W&FòÆf–6†VVçFS§6VwVæF÷4FTf–6†VVçFR‚’Æ&ÖGW&¦&ÖGW&¦övF÷'×Ğ¦W‡÷'BgVæ7F–öâÆ–6$W7FFõöÆ–6–Fõ6fR‡2—°¢G'—°¢6öç7BãÔÖF‚æfÆö÷"„çVÖ&W"‡2bg2ç&ö7W&Fò’“°¢öÆ–6–ç&ö7W&FóÔçVÖ&W"æ—4f–æ—FR†â“ôÖF‚æÖ–â…$ô5U$DõôÔ‚ÄÖF‚æÖ‚ƒÆâ’“£°¢òò4dRåD”tòTåE$Ä”Õòâò&ööÆVæò¦fö•&W6öW&U$ÔäTåDRRì:6òwV&FfVæFò&—<:6ğ¢òò6öçFV6WR(	BöFRFW"6–FòŒ:G,:§26W7<;VW2â6öçfW'L:¢ÖÆòçVÖf–6†VVçFR4„T”†fö’&–ÖV—&¢òòfW'<:6òFW7FÖ–w&:|:6ò’f¢ò¦övF÷"'&—"ò¦övòRÆWf"6–æ6òÖ–çWF÷2FRW'6VwVœ:|:6ò÷"Ævğ¢òòVRVÆRì:6òfW¢æW7F6W7<:6òRì:6òFVÒ6öÖòfW#¢:’W†FÖVçFRò&öÌ:Ö6–L:ÖR6VwV–æFò6VÒWP¢òòFW"fV—FòæF"FRæ÷fòÂ<;2VRv÷&f–æFòFò6'&VvÖVçFòà¢òò6fRæ÷fòG&¢ò&¦ò&W7FçFRRVÆR:’&W7V—FFó²6fRfVÆ†ò6öÖ\:vFò¦W&òà¢6öç7B&W7FóÔçVÖ&W"‡2bg2æf–6†VVçFR“°¢6öç7B&W7FçFSÔçVÖ&W"æ—4f–æ—FR‡&W7Fò“ôÖF‚æÖ‚ƒÄÖF‚æÖ–â„d”4„õTTåDRÇ&W7Fò’“£°¢6öç7B&ÓÔçVÖ&W"‡2bg2æ&ÖGW&“°¢&ÖGW&¦övF÷#ÔçVÖ&W"æ—4f–æ—FR†&Ò“ôÖF‚æÖ–â„¤ôtDõ%ô$ÔEU$ôÔ‚ÄÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†&Ò’’“£°¢òòÖ–w&6fW2çF–v÷2VR7V×VÆfÒ6öÆWFW3¢6R¬:Œ:&ÖGW&WV—FÂì:6òW†—7FRVÖ6VwVæF¢òòVæ–FFRW66öæF–Fæò–çfVçL:&–òâò¦övòG&&Æ†6öÒæòÜ:†–ÖòVÒ6öÆWFRF÷FÂà¢–b†&ÖGW&¦övF÷#ã—¶–çfVçF&–òæ6öÆWFSÓ¶FVf–æ—$6öÆWFUf—6—fVÂ‡G'VR—ÖVÇ6W¶FVf–æ—$6öÆWFUf—6—fVÂ†fÇ6R—Ğ¢f–v–FôFS×W&f÷&Öæ6Rææ÷r‚’ó·&W7FçFS°¢Ö6F6‚†R—·öÆ–6–ç&ö7W&FóÓ·f–v–FôFSÓĞ§Ğ ¦W‡÷'BgVæ7F–öâGVÆ—¦%öÆ–6–†GB—°¢6öç7Bv÷&×W&f÷&Öæ6Rææ÷r‚’ó°¢Æ–W"æ†5vVöäWV—VCÖ†5vVöäWV—VB‚“°¢FVf–æ—$&Öf—6—fVÂ‡Æ–W"æ†5vVöäWV—VCÓÓ×G'VR“°¢f÷"†6öç7BöÂöböÆ–6–—4F–æv—fV—2‚’––b‡öÂçf—fòbfF—7E…¢‡öÂç÷2ÇÆ–W"ç÷6—F–öâ“ÃÒãsb—¶ÆW'F$6öÆ—6õöÆ–6–Â‚“¶'&V·Ğ¢6Ö–æ†÷4æW7FUVG&óÓ²òò¦W&ò÷,:vÖVçFòFR¢FW7FRVG&ğ¢òòfVÆö6–FFRFò¦övF÷"ÂW6FVÆöçF&–¢Çfò6÷'&VæFò:’Ö—2F–l:Ö6–ÂFR6W'F"à¢GVÆ—¦$6öÖ&FR†GB“°¢òò:–—2FWV—Râ&VfÆ–F÷26FãR2†ò,;7&–òF—7G&–'V—%V—26VwW&ò–çFW'fÆò’ÂR<;0¢òòVæFòŒ:Çfó¢F—7G&–'V—"gVì:|:6ò6VÒæ–æw\:–Ò&6W&6":’v7Fò÷"æFà¢–b‡öÆ–6–—2æÆVæwF‚bb‡öÆ–6–ç&ö7W&FóãÇÇ&7G&õfÆ–Fò†v÷&’’¢F—7G&–'V—%V—2‡öÆ–6–—2Æv÷&À¢&7G&õfÆ–Fò†v÷&“÷&7G&òçƒ§Æ–W"ç÷6—F–öâç‚Ç&7G&õfÆ–Fò†v÷&“÷&7G&òç£§Æ–W"ç÷6—F–öâç¢“°¢òò&÷F÷"6V×&Rv—&æFòRÇW¦W2—66æFòÂVÒVÇVW"W7FFò(	Bò†VÆ–<;7FW&òçVæ6&FW6Æ–v"à¢&÷F÷%&–æ6—Âç&÷FF–öâç’³ÖGB£#c·&÷F÷$6VFç&÷FF–öâç‚³ÖGB£C°¢6öç7B—66ÔÖF‚æfÆö÷"†v÷&£2’S#ÓÓÓ¶ÇW¥bæÖFW&–ÂæVÖ—76—fT–çFVç6—G“×—66óãc¢ã¶ÇW¤æÖFW&–ÂæVÖ—76—fT–çFVç6—G“×—66òã£ãc° ¢òòÓÓÓÓÒd”4„DU44R4ôÒòDTÕò4TÒ4U$TÒDR4„"ÓÓÓÓĞ¢òòFö—2&VÌ;6v–÷2VÒ<:—&–RÂR:’÷&FVÒFVÆW2VRf¢ÖV<:&æ–6gVæ6–öæ# ¢òòFV×õ6VÕfW"(i"÷2‚2wV&æœ:|:6òVÒ6×òW&FRò&7G&òR&V7V…4TÕõdU%õ$õ5TÔ•"“°¢òòFV×ôæ—fVÂ(i"<92DUô•2D•54òÂ6F2vTÔW7G&VÆ…4TÕõdU%õõ%ôä•dTÂ’à¢òò&V6W"FRæ÷fò¦W&÷2Fö—2â8’ò'76÷RVÒFV×òì:6ò6†÷RÂf’7VÖ–æFò2W7G&VÆ2"à¢òğ¢òò,8”uT8’öÂçf—VÂRVÆ:’6W'F÷'VR:’ÔU4ÔVRFV6–FR6RF—&ÒVÒfö<:£¢6RW7G&VÆ¢òò6:×76R÷"÷WG&ÖVF–F†F—7L:&æ6–Â÷"W†V×Æò’ÂF&–&f–6†Æ–×"6öÒVÒöÆ–6–ÂFP¢òòg&VçFR&ò¦övF÷"F—&æFòâ<;2öÆ–6–Âd•dò6öçF(	BÖ÷'Fòì:6òl:¢ÂRì:6òöFR6VwW&"f–6†à¢6öç7Bf—7Fó×öÆ–6–—2ç6öÖR‡ÃÓçÂçf—fòbgÂçf—R“°¢–b‡f—7Fò—°¢òòföÇF÷R&V6W#¢6RVÆR¬:W7Fff÷&Fò&F"FVÆW2Â6:vFvæ†ÆwVç26VwVæF÷2FP¢òò&W7—&òçFW2FR&VVævF"(	B6VÒ—76òò†VÆ–<;7FW&òVævFæòÖW6Öòg&ÖRVÒVRVÆR&V&V6Rà¢–b‡öÆ–6–çFV×õ6VÕfW#ãÕ4TÕõdU%õ$õ5TÔ•"—öÆ–6–ç&WFöÖ$66VÓÖv÷&´44ôE$4ó°¢öÆ–6–çFV×õ6VÕfW#Ó·öÆ–6–çFV×ôæ—fVÃÓ°¢ÖVÇ6W°¢öÆ–6–çFV×õ6VÕfW"³ÖGC°¢–b‡öÆ–6–çFV×õ6VÕfW#ãÕ4TÕõdU%õ$õ5TÔ•"—°¢–b†&÷&FvVÒæF—fÇÇ&7G&õfÆ–Fò†v÷&’—°¢fV6†$&÷&FvVÒ‚“·&7G&òæF—fóÖfÇ6S·&7G&òæ'W66FSÓ°¢Ö÷7G&$f—6ò‚ufö<:¢FW7—7F÷R(	BöÌ:Ö6–W&FWRò&7G&òârÃ#ƒ“°¢Ğ¢–b‡öÆ–6–ç&ö7W&Fóã—°¢öÆ–6–çFV×ôæ—fVÂ³ÖGC°¢–b‡öÆ–6–çFV×ôæ—fVÃãÕ4TÕõdU%õõ%ôä•dTÂ—°¢öÆ–6–çFV×ôæ—fVÃÓ·öÆ–6–ç&ö7W&FòÒÓ°¢òòf–6†Æ–×vòVæFW&\:vó¢6VÒ—76ò2f–GW&26öçF–çV&–Òf67VÆ†æFòòÇVv"öæFP¢òòVÆRfö’f—7FòÖV–†÷&G,:2Â&ö7W&æFòVÒ6–FL:6ò6VÒf–6†à¢–b‡öÆ–6–ç&ö7W&FóÓÓÓ—·VÇF–Öõf—7FóÖçVÆÃ¶Ö÷7G&$f—6ò‚tf–6†Æ–×âW6g&–÷RârÃ#c—Ğ¢Ğ¢ÖVÇ6RöÆ–6–çFV×ôæ—fVÃÓ°¢Ğ¢Ğ ¢U5DDõ5·öÆ–6–æW7FFõÒæôGVÆ—¦"†GBÆv÷&“°¢GVÆ—¦%G'VÆ††GBÆv÷&“°¢6W&$6÷'÷2‚“°¢òòVÒVG&òFRæ–Ö:|:6ò÷"öÆ–6–Âd•dòâÖ÷'Fòì:6òæ–Ö¢VÆRW7L:FöÖ&æFò÷"&÷F:|:6òFòw'WòÀ¢òòRFV—†"ò6Æ—RFRæF"6÷'&VæFò÷"6–Öf&–ò6÷'ò6:ÖFò6öçF–çV"FæFò76÷2à¢f÷"†6öç7BöÂöböÆ–6–—2––b‡öÂçf—fòbgöÂæ6÷'ò–GVÆ—¦$6÷'õöÆ–6–Â‡öÂæ6÷'òÆGBÇöÂçfVÆö6–FFTæFæF÷ÇÃÆv÷&Â‡öÂçF—&õf—7VÄFWÇÃ’“° ¢ÖöçF$Çf÷4Fôg&ÖR‚“°¢GVÆ—¦$&Æ2†GBÆÇf÷4F&Æ“° ¢òò†öÆöf÷FS¢&öæFæFòÂf'&Rò6Œ:6òÆövò&—†òFò†VÆ“²6†÷RÆçF:|:6òÂE$däÕTDâVÆR¬:¢òò6VwV—Rò¤ôtDõ"(	BW&ÆV—GW&f—7VÂF6:vF:—&VÂVRFV—†÷RFRW†—7F—"âv÷&òf6†ò<;0¢òòöçFÆçFÂVR:’;¦æ–66ö—6VRW7FR†VÆ–<;7FW&ò&ö7W&à¢6öç7BG&fFó×öÆ–6–æW7FFóÓÓÒvöçFæFòrbböÆ–6–æÇfõÆçF°¢6öç7Bfö6õƒ×G&fFó÷öÆ–6–çöçFôÇfòçƒ¦†VÆ’ç÷6—F–öâçƒ°¢6öç7Bfö6õ£×G&fFó÷öÆ–6–çöçFôÇfòç£¦†VÆ’ç÷6—F–öâç£°¢6öç7B6†ô&—†óÖö'FW$VÆWf6ò†fö6õ‚Æfö6õ¢“°¢†öÆöf÷FTÇfòç÷6—F–öâç6WB†fö6õ‚Æ6†ô&—†òÆfö6õ¢“°¢6öç7BÇGW&fV—†SÖ†VÆ’ç÷6—F–öâç’Ö6†ô&—†ó°¢fV—†Rç÷6—F–öâç6WB‚††VÆ’ç÷6—F–öâç‚¶fö6õ‚’ó"Â††VÆ’ç÷6—F–öâç’¶6†ô&—†ò’ó"Â††VÆ’ç÷6—F–öâç¢¶fö6õ¢’ó"“°¢fV—†Rç66ÆRç6WB†ÇGW&fV—†R¢ã3"ÆÇGW&fV—†RÆÇGW&fV—†R¢ã3"“° ¢òòf–F&VvVæW&FWfv"f÷&FR6öÖ&FS²…TBFRÆW'FöFW7—7FRÂ×Væœ:|:6òRÖ—&FR6öÖ&FRà¢f—6$fÆ÷&6ò‚“¶6öæfW&—$6öÆWFR‚“¶GVÆ—¦$‡VD×Væ–6ò‚“°¢–b‚VÔ6öæg&öçFò‚’bg6VFT¦övF÷#Ä¤ôtDõ%ô…ôÔ‚bb¦övF÷%&VæF–Fò—·6VFT¦övF÷#ÔÖF‚æÖ–â„¤ôtDõ%ô…ôÔ‚Ç6VFT¦övF÷"¶GB¤¤ôtDõ%õ$TtTâ“¶GVÆ—¦$‡VE6VFR‚—Ğ¢6öç7BVÔÆW'FÖVÔ6öæg&öçFò‚“°¢òòì:×fVÂFR&ö7W&FòVÒW7G&VÆ3¢ò¦övF÷"&V6—6dU"&'&7V&—"&VçFVæFW"VR6RW66öæFW ¢òò6W'f—R&ÆwVÖ6ö—6âW67&—Fò<;2VæFò×VFÂVÆòÖW6ÖòÖ÷F—fòFò66†RF×Væœ:|:6òà¢òòG,:§2W7FF÷2Âì:6òFö—3¢U%4TuT”äDò†Æw\:–ÒW7L:FRfVæFò’Â$ô5U$äDò‡W&FW&ÒFRf—7FÖ2¢òò'W666÷'&R’RÆ–×òâò¦övF÷"&V6—6Vç†W&v"VÒVÂW7L:(	B:’òVRG&ç6f÷&Ö7VÖ—"FRf—7F¢òòçVÖ¦övFÂVÒfW¢FRçVÒ66òà¢6öç7BW'6VwV–æFó×&7G&òæF—fó°¢6öç7B&ö7W&æFóÒW'6VwV–æFòbfVÔ'W66†v÷&“°¢6öç7B6†fTÆW'FÖG·öÆ–6–ç&ö7W&F÷×ÂG¶VÔÆW'F×ÂG·öÆ–6–—2æÆVæwF‡×ÂG·W'6VwV–æF÷×ÂG·&ö7W&æF÷Ö°¢–b†6†fTÆW'FÓÖÆW'F66†R—°¢ÆW'F66†SÖ6†fTÆW'F°¢ÆW'FVÂç7G–ÆRæF—7Æ“Ò†VÔÆW'FÇÇöÆ–6–ç&ö7W&Fóã“òv&Æö6²s¢væöæRs°¢ÆW'FVÂæ6Æ74Æ—7BçFövvÆR‚w&ö7W&æFòrÇ&ö7W&æFò“°¢6öç7Bf—f÷3×öÆ–6–—2æf–ÇFW"‡Óççf—fò’æÆVæwFƒ°¢6öç7BW7G&VÆ3ÖG²~)ˆRrç&WVB‡öÆ–6–ç&ö7W&Fò—ÒG²~)ˆbrç&WVB…$ô5U$DõôÔ‚×öÆ–6–ç&ö7W&Fò—Ö°¢ÆW'FVÂçFW‡D6öçFVçCÒ‡&ö7W&æFóö	ùJb$ô5U$äDòG¶W7G&VÆ7Ö¦	ù¨$ô5U$DòG¶W7G&VÆ7Ö¢²‡f—f÷3ö+r	ùâG·f—f÷7Ö¢rr“°¢Ğ¢òòÓÓÓÓÒõ"TRôÌ8Ô4”U5L8DRôÄ„òÓÓÓÓĞ¢òò$öÌ:Ö6–L:ÖR6VwV–æFò6VÒWRFW"fV—FòæF"fö’&VÆFFòG,:§2fW¦W2ÂRæ2G,:§2&W7÷7F¢òòFWfRVR6W"4dDæò<;6F–vòÂ÷'VRæFVÆì:6ò†f–F–fW&Vì:væVæ‡VÖVçG&RVÖGWÆVP¢òò76FR&öæFRVÖVRfV–òG,:2FVÆRâv÷&W†—7FS¢VæFòöÌ:Ö6–FVÒ&¬:6òÂVÆ:’F—FÂP¢òò6öÒò&¦òâVæFòW7FRf—6òW7L:vFòÂVVÒ76÷RFòÆFòW7FfFR&öæF(	BR—76ò:’VÖ¢òò–æf÷&Ö:|:6òL:6ò;§F–ÂVçFò÷WG&à¢–b‡öÆ–6–ç&ö7W&Fóã–FVæ6ôVÂç7G–ÆRæF—7Æ“ÒvæöæRs°¢VÇ6W°¢6öç7B6Vs×6VwVæF÷4FTf–6†VVçFR‚“°¢ÆWBÖ÷F—fóÒrs°¢–b†&÷&FvVÒæF—f—°¢òòò$¤òäDTÄ8’ÔT<8$ä”4â6VÒòì;¦ÖW&ò6÷'&VæFòÂ&f–6&FòVRf—&&ö7W&Fò":’VÖ¢òò&Vw&–çf—<:×fVÃ¢ò¦övF÷"<;2FW66ö'&RVRW†—7F–FWö—2FRÆWf"W7G&VÆà¢6öç7BfÇF×6VwVæF÷4F&÷&FvVÒ‚“°¢Ö÷F—fóÖ&÷&FvVÒçfVæFğ¢ö	ùâDRd•$Ò4ôÒÔô4„”Ä(	B4õ%$R+rG´ÖF‚æÖ‚ƒÄÖF‚æ6V–Â†fÇF’—×6 ¢¢	ùJbW7L:6òFR&ö7W&æFò(	Bì:6ò&\:vs°¢ÖVÇ6R–b†ÆWfæFõ6÷FR‚’–Ö÷F—fóÒ	øé"Öö6†–Æ:f—7F(	BöÌ:Ö6–&W&s°¢VÇ6R–b‡6Vsã–Ö÷F—fóÖ	ùf–6†VVçFR+rG´ÖF‚æfÆö÷"‡6Vróc—Ó¢Gµ7G&–ær„ÖF‚æfÆö÷"‡6VrSc’’çE7F'Bƒ"Âsr—Ö°¢–b†Ö÷F—fòÓÖFVæ6ô66†R—¶FVæ6ô66†SÖÖ÷F—fó¶FVæ6ôVÂçFW‡D6öçFVçCÖÖ÷F—fó¶FVæ6ôVÂç7G–ÆRæF—7Æ“ÖÖ÷F—fóòv&Æö6²s¢væöæRwĞ¢Ğ¢òòÓÓÓÓÒò”äD”4Dõ"DRDU5•5DRÓÓÓÓĞ¢òòVÆRW&ò–æF–6F÷"FòW66öæFW&–¦ò‚$dT4„Rõ%D$4RU44ôäDU""’âòW66öæFW&–¦ò6—RÂÖ2¢òòW&wVçFVRò¦övF÷"f¢6öçF–çVÖW6ÖR6öçF–çV6VæFòÖ—2–×÷'FçFRFgVv¢&VÆW0¢òò–æFW7L:6òÖRfVæFòÂRVçFòfÇF&6—"VÖW7G&VÆò"â6VÒ—76òÂòFV6–ÖVçFò÷"FV×ò:¢òò–çf—<:×fVÂ(	BVÆR–6÷'&W"æòW67W&ò6VÒ6&W"6RW7FfF–çFæFòÆwVÖ6ö—6à¢òğ¢òòG,:§2W7FF÷2ÂRF–fW&Vì:vVçG&RVÆW2:’òVRVç6–æÖV<:&æ–66VÒGWF÷&–Ã ¢òòf–6†Æ–×(i"6öÖRFFVÆ°¢òòFRfVæFò(i"	ùVçF2W7G&VÆ2ÂRVRVçVçFò—76òæF6“°¢òòf÷&Ff—7FFVÆW2(i"	úºRò&VÌ;6v–ò6÷'&VæFòL:’,;7†–ÖW7G&VÆà¢–b‡öÆ–6–ç&ö7W&FóÃÓ—&VgVv–ôVÂç7G–ÆRæF—7Æ“ÒvæöæRs°¢VÇ6W°¢&VgVv–ôVÂç7G–ÆRæF—7Æ“Òv&Æö6²s°¢6öç7BW7G&VÆ3Ò~)ˆRrç&WVB‡öÆ–6–ç&ö7W&Fò“°¢–b‡öÆ–6–çFV×õ6VÕfW#Å4TÕõdU%õ$õ5TÔ•"—°¢òòVçVçFòÆw\:–ÒVç†W&vÂòì;¦ÖW&òVR–×÷'Fì:6ò:’òFW7G&VÆ(	B:’VçFòfÇF&VÆW0¢òòFRW&FW&VÒFRf—7Fâ¦W&òVæFòW7L:6òFRfVæFòv÷&à¢6öç7B6öÖSÔÖF‚æÖ‚ƒÄÖF‚æ6V–Â…4TÕõdU%õ$õ5TÔ•"×öÆ–6–çFV×õ6VÕfW"’“°¢&VgVv–ôVÂçFW‡D6öçFVçCÖ	ùG¶W7G&VÆ7Ò+rFR6†ÒŒ:G·6öÖW×6°¢ÖVÇ6R&VgVv–ôVÂçFW‡D6öçFVçCÖ	úºRDU5•5DõR+rG¶W7G&VÆ7Ò6’VÒG´ÖF‚æÖ‚ƒÄÖF‚æ6V–Â…4TÕõdU%õõ%ôä•dTÂ×öÆ–6–çFV×ôæ—fVÂ’—×6°¢Ğ¢6öç7BVÔ6öÖ&FS×öÆ–6–ç&ö7W&Fóã°¢6öç7BFVÔ&ÖÖ–çfVçF&–òæ×Væ–6õ¶–D&ÖWV—F‚•Óã°¢òòÖ—&f–6æFVÆ4TÕ$RVRL:&F—&"(	BçFW2<;2&V6–æòW7FFòv6öÖ&FRrÂVRW†–vP¢òòÆçF"ÂW7W&"×VFfÆ÷&—"Âò†VÆ’6†"RFW66W"FR&VÂâf÷&FW76¦æVÆò&÷L:6òFRF—&ğ¢òò6öçF–çVf6Æ–<:fVÂRv7Ff&ÆFRfW&FFR6VÒæVæ‡VÖ–æF–6:|:6òFR&öæFR6RW7Ff¢òòÖ—&æFòâ6öÖR<;2æòG&öæR†<:&ÖW&ì:6ò:’Fò¦övF÷"’Â&VæF–FòÂ÷R6öÒÖ—&FRÆçF–òF—fà¢6öç7BöFTÖ—&#×FVÔ&ÖbbG&öæU7FFRæF—fòbb¦övF÷%&VæF–Fòbb—4–çfVçF&–ô&W'Fò‚“°¢Ö—&6öÖ&FTVÂç7G–ÆRæF—7Æ“×öFTÖ—&#òv&Æö6²s¢væöæRs°¢–b‡öFTÖ—&"—°¢òò&W6öÇfW"òöçFòf—6Fò÷"g&ÖRFÖ,:–ÒÆ–ÖVçFÖ—&æôÇfö¢:’òVRL:ò&WF÷&æòFP¢òòöçF&–†Ö—&fW&ÖVÆ†w&æFRVÒ6–ÖFò6÷'ò’VRçFW2ì:6òW†—7F–à¢&W6öÇfW%öçFõf—6Fò†&ÖWV—F‚’æÆ6æ6R“°¢Ö—&6öÖ&FTVÂæ6Æ74Æ—7BçFövvÆR‚væôÇfòrÆÖ—&æôÇfò“°¢òòÖ—&dT4„DæòÖöFòFRÖ—&¢7'W¢Væ6öÆ†R§VçFò6öÒò6öæRFRF—7W'<:6òÂVçL:6òòFÖæ†ğ¢òòFVÆæFVÆ6öçFfW&FFR6ö'&R&V6—<:6òVÒfW¢FR6W"VæfV—FRà¢Ö—&6öÖ&FTVÂæ6Æ74Æ—7BçFövvÆR‚vfV6†FrÆÖ—&7FFRæF—fò“°¢Ğ¢òòò&÷L:6ò&V6RVæFòŒ:×Væœ:|:6ò&v7F"õRöÌ:Ö6–VÒ6×ó¢6Vì:6òò¦övF÷"çVæ6f–VP¢òòW†—7FR&Öæò¦övòâf÷&Fò6öÖ&FRVÆRf–6W6ÖV6–FòÂ–æF–6æFòVRì:6òŒ:VÒVVÒF—&"à¢f—&T'Fâç7G–ÆRæF—7Æ“Ò†VÔÆW'FÇÇFVÔ&Ö“òvfÆW‚s¢væöæRs°¢f—&T'Fâç7G–ÆRæ÷6—G“ÖVÔ6öÖ&FRbgFVÔ&Öòss¢rãCRs°¢–b†f—&U6V6öæF'’–f—&U6V6öæF'’ç7G–ÆRæF—7Æ“Ò‡öFTÖ—&"bb†VÔÆW'FÇÇFVÔ&Ö’bfÖF6„ÖVF–‚r‡ö–çFW#¢6ö'6R’r’æÖF6†W2“òvfÆW‚s¢væöæRs°¢òòæòF÷V6‚Âò¦÷—7F–6²F—&V—Fò7V'7F—GV’ò&÷L:6òFRF—&òRòÇFW&æF÷"FRÖ—&¢ò,;7&–òvW7Fğ¢òòöçFRÖçL:–ÒòvF–Æ†ò&W76–öæFòÂ6öÖòæ÷2¦öv÷2Gv–â×7F–6²à¢–b†–Ô&6R––Ô&6Rç7G–ÆRæF—7Æ“Ò‡öFTÖ—&"bb†VÔÆW'FÇÇFVÔ&Ö’bfÖF6„ÖVF–‚r‡ö–çFW#¢6ö'6R’r’æÖF6†W2“òv&Æö6²s¢væöæRs°¢òòò&÷L:6òFRÖ—&6ö×æ†òFRF—&ó¢Ö—&"6VÒFW"VÒVRF—&"ì:6òf¢6VçF–Fòâf–6DUô•2FP¢òòf—&T'Fâç7G–ÆRæF—7Æ’6W"W67&—FòÂ6Vì:6ò6÷–&–òfÆ÷"Fòg&ÖRçFW&–÷"à¢–b†Ö—&'Fâ—°¢Ö—&'Fâæ6Æ74Æ—7BçFövvÆR‚vöârÆÖ—&7FFRæF—fò“°¢Ö—&'Fâç7G–ÆRæF—7Æ“Öf—&T'Fâç7G–ÆRæF—7Æ“°¢–b‚öFTÖ—&"bfÖ—&7FFRæF—fò–Ö—&7FFRæF—fóÖfÇ6S²òòVçG&÷RæòG&öæRö–çfVçL:&–òÖ—&æFğ¢Ğ¢òòÓÓÓÓÒò$õL84òDRE$ô4"$Ôì84òôDRDUTäDU"DòDRD•$"ÓÓÓÓĞ¢òòVÆRFWVæF–ÂR—76òW&VÖ&ÖF–Æ†fV6†FâFVÔ&Ö6–væ–f–6'FVÒ×Væœ:|:6òä$Ô¢òòUT•D#²6VÒ×Væœ:|:6òÂf—&T'Fæ6öÖR(	BRò&÷L:6òFRG&ö67VÖ–§VçFòâ÷R6V¦¢6&÷R&Æ¢òòF—7FöÆRò¦övF÷"f–6f$U4òæVÆÂ6VÒæVæ‡VÒ¦V—FòFR76"&ò&–fÆR6'&VvFòVP¢òòW7Ffæò–çfVçL:&–òâæò6VÇVÆ"ÂöæFRì:6òW†—7FRFV6ÆÓBÂ—76ò:’òf–ÒFÆ–æ†à¢òòv÷&;¦æ–66öæFœ:|:6ò:’VR6V×&RfW¢6VçF–Fó¢FW"Ö—2FRVÖ&Ö&ÇFW&æ"à¢–b†&Ö'Fâ—°¢6öç7BFVÕG&ö6Ôõ$DTÕô$Ô2æf–ÇFW"†–CÓæ–çfVçF&–òæ&Ö5¶–EÒ’æÆVæwFƒã°¢&Ö'Fâç7G–ÆRæF—7Æ“Ò‡FVÕG&ö6bbG&öæU7FFRæF—fòbb¦övF÷%&VæF–Fòbb—4–çfVçF&–ô&W'Fò‚’“òvfÆW‚s¢væöæRs°¢Ğ§Ğ ¢òòvF–Æ†ò4TuU$Dó¢ö–çFW&F÷vâÆ–vÂR÷2VG&òWfVçF÷2FR6öÇGW&FW6Æ–vÒâò6WEö–çFW$6GW&R:¢òòö'&–vL;7&–ò(	B6VÒVÆRÂòFVFòFW6Æ—¦æFò&f÷&Fò&÷L:6òf¢òö–çFW'W6—"æ÷WG&òVÆVÖVçFòRğ¢òòvF–Æ†òf–6&W6òÆ–vFòÂF—&æFòL:’6&"×Væœ:|:6òâÖW6ÖòG&FÖVçFòVRò¦÷—7F–6²¬:W6à¦f—&T'FãòæFDWfVçDÆ—7FVæW"‚wö–çFW&F÷vârÆSÓç°¢–b†Rçö–çFW%G—RÓÒvÖ÷W6Rr—&WGW&ã°¢Rç&WfVçDFVfVÇB‚“¶f—&T'Fâç6WEö–çFW$6GW&Sòâ†Rçö–çFW$–B“°¢FVf–æ—$vF–Æ†ò‡G'VR“¶F—&"‚“²òòF—&ò–ÖVF–Fó¢ò&–ÖV—&òF—7&òì:6òöFRW7W&"ò,;7†–Öòg&ÖP§Ò“°¦f÷"†6öç7BWböe²wö–çFW'WrÂwö–çFW&6æ6VÂrÂvÆ÷7Gö–çFW&6GW&RuÒ–f—&T'FãòæFDWfVçDÆ—7FVæW"†WbÂ‚“ÓæFVf–æ—$vF–Æ†ò†fÇ6R’“°¦FDWfVçDÆ—7FVæW"‚v&ÇW"rÂ‚“ÓæFVf–æ—$vF–Æ†ò†fÇ6R’“²òòÇB×F"6öÒòFVFò÷FV6Æ&W6÷0¦&Ö'FãòæFDWfVçDÆ—7FVæW"‚wö–çFW&F÷vârÆSÓç¶Rç&WfVçDFVfVÇB‚“·G&ö6$&Ö‚—Ò“°¢òòÖ—&æò6VÇVÆ":’ÅDU$äDõ"Âì:6ò'6VwW&"#¢òöÆVv"F—&V—Fò¬:W7L:ö7WFò6öÒòvF–Æ†òÂP¢òò6VwW&"÷2Fö—2òÖW6ÖòFV×ò:’òVRì:6òL:&f¦W"çVÖFVÆâæòFV6ÆFòöÖ÷W6R:’6VwW& ¢òò‡fW"–çWBæ§2’ÂVR:’òvW7FòW7W&FòÆ’à¦Ö—&'FãòæFDWfVçDÆ—7FVæW"‚wö–çFW&F÷vârÆSÓç¶Rç&WfVçDFVfVÇB‚“¶Ö—&7FFRæF—fóÒÖ—&7FFRæF—f÷Ò“°¦W‡÷'BgVæ7F–öâFVf–æ—$Ö—&‡b—¶Ö—&7FFRæF—fó×gĞ ¦W‡÷'G¶†VÆ’ÇöÆ–6–—2ÇöÆ–6–Ó° 