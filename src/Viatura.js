// ===== AS VIATURAS: DUAS, NA RUA E NOS BECOS QUE CABEM =====
//
// O Bruno levantou o problema antes de eu chegar nele: "o problema é os colisores e as paredes, eles
// vão bater né". Ele estava certo sobre o RISCO, e a resposta continua sendo a mesma: a viatura anda
// sobre CURVAS PRONTAS (a via, e agora também o beco), nunca navegando livre. Ela não tem para onde
// errar. A malha de PEDESTRE, com 25 cm de folga, continua fora de questão pra um carro.
//
// ===== O QUE MUDOU, E POR QUE O QUE ESTAVA ESCRITO AQUI ESTAVA ERRADO =====
// Este comentário dizia "a viatura NUNCA SAI DA RUA", justificando com um número só: o beco mais
// apertado tem 2,45 m. Ele mediu o PIOR beco e concluiu sobre TODOS — que é a pergunta errada. O
// Bruno viu na hora: "quero a viatura andando nos becos tbm, tem uns que dá pra andar sim eu ando".
//
// Medido beco por beco, varrendo o corpo dela (0,86 x 1,90) deitado na tangente contra o mesmo
// `colideObstaculoXZ` que barra o carro no jogo:
//     passagem mais estreita 2,10 m · viatura 0,86 m de largura · sobra 0,62 m de cada lado
//     19 de 19 becos passam de ponta a ponta
// (a régua foi validada antes: um corpo de 5 m é barrado em 17 dos 19, e o centro de uma casa bate.
// Régua que aprova tudo não estava medindo nada.)
//
// O que impedia não era largura, era COMO SAIR — beco é sem saída, e voltar de ré é a queixa que
// criou o anel. A mesma medição deu a resposta: as pontas mortas dos becos não terminam em parede,
// terminam no morro livre, com 6 m de folga. Então ela sobe, DÁ O RETORNO LÁ EM CIMA e desce.
// Ver `montarDesvios` mais abaixo.
//
// ===== A ROTA É UM ANEL, E ISSO NÃO É ENFEITE =====
// A primeira versão punha uma viatura em cada via, indo até a ponta e VOLTANDO. O Bruno viu na hora:
// "eles vai certinho mais volta de ré kkkk — tenta melhorar a rota delas pra ter mais espaço que elas
// possam andar". Ele estava vendo duas coisas ao mesmo tempo:
//   1. o bug: eu invertia o sentido do `u` e não virava o nariz, então na volta ela andava de ré;
//   2. o aperto: cada uma ficava presa numa linha só, batendo cabeça nas duas pontas.
//
// Dava pra tapar o (1) somando 180° no rumo. Mas aí ela faria uma meia-volta parada no fim da rua,
// toda vez, pra sempre — o (2) continuaria lá. O conserto que resolve os dois é NÃO TER PONTA: a rota
// vira um circuito fechado, e quem anda em círculo nunca precisa dar ré.
//
// Medido antes de desenhar (scratchpad/qrota.mjs, qoeste.mjs, qcusp.mjs, qarco.mjs):
//   · as duas vias JÁ SE CRUZAM em (35,-16.7) — 0,3 m entre elas. O mapa sempre teve um cruzamento;
//     ninguém estava usando. É ele que fecha o anel de graça: no cruzamento a viatura sai de uma rua
//     e entra na outra virando só 24°, que é uma esquina normal.
//   · faltava UMA amarração, a oeste, entre as duas pontas soltas (-48,10) e (-53,-31). A reta batia
//     em 20 pontos; varrendo 800 desvios, 264 passam limpo, e o mais curto contorna por (-52,-2):
//     41,8 m, zero batidas, ladeira de até 8°.
//
// O QUE EU TENTEI ANTES E JOGUEI FORA, porque é o tipo de coisa que volta se não estiver escrita:
// um anel MAIOR, que incluía também as duas pontas de rua sem saída (a do sudeste, (45,-45), e a do
// norte, (31,1)), amarradas por uma corda leste. A corda passava limpo, mas o anel ficava com dois
// GRAMPOS — nas pontas ele dobrava 180° com raio de 0,13 m. Isso não é dirigir, é o traçado se
// dobrando em cima de si mesmo, e o teste pegou: 5 quadros de ré, um por volta. Num bico, andar pra
// frente no `u` é andar pra trás no mapa — ou seja, eu teria devolvido pro Bruno a MESMA queixa dele
// numa embalagem nova. Procurei retornos de raio 3 m pra arredondar (existem, e em chão livre), mas
// no norte a corda chega quase em cima da própria via baixa, então o retorno não emenda: ele te
// devolve paralelo, e paralelo ali é dentro da rua que você acabou de sair.
// Ficam de fora ~48 m de rua sem saída. É o preço, e é barato: o anel liso vale mais que dois becos
// a mais com a viatura manobrando dentro deles.
//
// O anel tem ~282 m e passa pelo miolo da favela duas vezes (as duas ruas se cruzam). As duas
// viaturas rodam nele pra sempre, meia volta uma da outra, sem nunca parar pra manobrar.
import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{scene}from'./core.js';
import{obterElevacao,alturaDoChaoDesenhado}from'./Terrain.js';
import{viaPrincipal,viaBaixa,becos}from'./Favela.js';
import{registrarCaixa,marcarObstaculoMovel,colideParedeXZ}from'./Physics.js';

const COMPRIMENTO=1.90,LARGURA=.86,ALTURA_COLISAO=.85;
const ENTRE_EIXOS=.70;
const ALTURA_ASSENTO=-.02;// mesmo motivo dos outros veículos: o chão desenhado fica abaixo da curva
// A que distância da ocorrência ela considera que chegou. Não é zero: ela para NA RUA, no ponto mais
// perto da plantação, e daí os policiais seguem a pé — que é o desenho todo.
const CHEGOU=2.0;

// ===== O ANEL =====
// Montado a partir das ruas que já existem, e não desenhado à mão: amostro as duas vias de 4 em 4
// metros e emendo com as duas amarrações medidas. Amostrar em vez de copiar os pontos de controle
// importa — com pontos espaçados demais, a CatmullRom que passa por eles corta a curva por dentro e
// a viatura sai pela calçada. 4 m é curto o bastante pra o anel colar no traçado original.
// Sentido: via principal de P0(-48,10) até o CRUZAMENTO (u 0,81), lá emenda na via baixa e desce por
// ela até B0(-53,-31), e a amarração oeste fecha de volta em P0.
const U_CRUZAMENTO_PRINCIPAL=.81,U_CRUZAMENTO_BAIXA=.86;
// TUDO É AMOSTRADO NO MESMO PASSO, rua e amarração. Não é capricho: a CatmullRom fecha a curva pro
// lado onde os pontos estão mais juntos, então um canto com 4 m de um lado e 29 m do outro vira uma
// curva de 0,62 m de raio — a viatura pivotando no lugar. Medido, e foi assim que apareceu.
const PASSO=4;
function amostrar(curva,de,ate){
  const n=Math.max(2,Math.ceil(curva.getLength()*Math.abs(ate-de)/PASSO));
  const pts=[];
  for(let i=0;i<=n;i++)pts.push(curva.getPointAt(de+(ate-de)*(i/n)));
  return pts;
}
function amostrarRetas(cantos){
  const pts=[];
  for(let k=0;k+1<cantos.length;k++){
    const a=cantos[k],c=cantos[k+1];
    const n=Math.max(1,Math.round(Math.hypot(c.x-a.x,c.z-a.z)/PASSO));
    for(let i=k?1:0;i<=n;i++)
      pts.push(new THREE.Vector3(a.x+(c.x-a.x)*i/n,0,a.z+(c.z-a.z)*i/n));
  }
  return pts;
}
// ===== A ENTRADA OESTE É UM FILETE, NÃO UMA QUINA =====
// A amarração sobe de sul pra norte e a via principal sai pra leste: 109° de diferença. Encostar as
// duas num ponto e deixar a CatmullRom se virar dá curva de 0,63 m de raio, que não é dirigir, é
// girar no lugar. Varri 1400 jeitos de "amaciar com pontos soltos" e o melhor deu 0,98 m — pouco.
// O que resolve é o que se faz em rua de verdade: um ARCO TANGENTE às duas retas. Sem quina, por
// construção. Raio 8 m e a perna subindo em x=-56 foi o que passou com mais folga (1,74 m) — e com
// ele o ponto mais fechado do anel inteiro deixa de ser aqui e passa a ser o cruzamento das ruas,
// com 2,53 m, que é geometria do mapa e não coisa que eu inventei.
function filete(A,d1,B,d2,R){
  const den=d1.x*d2.z-d1.z*d2.x;
  const t=((B.x-A.x)*d2.z-(B.z-A.z)*d2.x)/den;
  const I={x:A.x+d1.x*t,z:A.z+d1.z*t};// onde as duas retas se cruzariam
  const ang=Math.acos(Math.max(-1,Math.min(1,-(d1.x*d2.x+d1.z*d2.z))));
  const rec=R/Math.tan(ang/2);// recuo da quina até cada ponto de tangência
  const T1={x:I.x-d1.x*rec,z:I.z-d1.z*rec},T2={x:I.x+d2.x*rec,z:I.z+d2.z*rec};
  let nx=-d1.z,nz=d1.x;
  if((T2.x-T1.x)*nx+(T2.z-T1.z)*nz<0){nx=-nx;nz=-nz}
  const C={x:T1.x+nx*R,z:T1.z+nz*R};
  const a1=Math.atan2(T1.z-C.z,T1.x-C.x),a2=Math.atan2(T2.z-C.z,T2.x-C.x);
  let d=a2-a1;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
  const n=Math.max(2,Math.ceil(Math.abs(d)*R/PASSO)),pts=[];
  for(let i=0;i<=n;i++){const a=a1+d*(i/n);pts.push(new THREE.Vector3(C.x+Math.cos(a)*R,0,C.z+Math.sin(a)*R))}
  return{T1,T2,pts};
}
function uMaisPertoDe(curva,alvo){
  let mu=0,md=Infinity;
  for(let i=0;i<=400;i++){const q=curva.getPointAt(i/400);
    const d=Math.hypot(q.x-alvo.x,q.z-alvo.z);if(d<md){md=d;mu=i/400}}
  return mu;
}
const PERNA_X=-56,RAIO_ENTRADA=8;
const _p0=viaPrincipal.getPointAt(0),_t0=viaPrincipal.getTangentAt(0);
const ENTRADA=filete({x:PERNA_X,z:-10},{x:0,z:1},{x:_p0.x,z:_p0.z},{x:_t0.x,z:_t0.z},RAIO_ENTRADA);
const U_ENTRADA=uMaisPertoDe(viaPrincipal,ENTRADA.T2);
const ROTA=new THREE.CatmullRomCurve3([
  ...amostrar(viaPrincipal,U_ENTRADA,U_CRUZAMENTO_PRINCIPAL),
  // `slice(1)` porque os dois pontos do cruzamento estão a 0,3 m um do outro: dois pontos colados
  // numa CatmullRom viram um nó, e o nó reaparece como solavanco no rumo da viatura.
  ...amostrar(viaBaixa,U_CRUZAMENTO_BAIXA,0).slice(1),
  // contorno oeste: sobe de B0(-53,-31) pela perna em x=-56 até o começo do filete...
  ...amostrarRetas([{x:-53,z:-31},{x:PERNA_X,z:-24},ENTRADA.T1]).slice(1),
  // ...e o filete entrega ela na via principal já no rumo dela.
  ...ENTRADA.pts.slice(1,-1),
],true,'catmullrom',.5);
const COMPRIMENTO_DA_ROTA=ROTA.getLength();
// Exposto pro teste medir o anel por fora, e pro modo debug poder desenhá-lo um dia.
export function __rota(){return ROTA}

// ===== COMO UM CARRO ANDA (e não como um trenzinho) =====
// A primeira versão empurrava a viatura pelo anel a 5,5 m/s FIXOS. Anel liso ou curva fechada, chuva
// ou sol, era sempre a mesma velocidade — e é isso que faz parecer peça de carrossel em vez de carro.
// O Bruno: "estuda melhor sobre ia de veículos, quero mais real possível a ronda deles".
//
// O jeito que se faz isso de verdade (é o mesmo cálculo de linha de corrida) tem duas partes:
//
//  1. TETO POR CURVA. Numa curva de raio R, o carro só segura até v = raiz(aceleração_lateral × R).
//     Passou disso, derrapa. Então cada pedacinho do anel ganha um teto vindo da SUA curvatura: reta
//     longa do oeste = cruzeiro; cruzamento das ruas (raio 2,5 m) = bem devagar.
//  2. FREAR ANTES, NÃO EM CIMA. Só respeitar o teto no ponto da curva não adianta: ela chegaria a 8
//     m/s na boca e teria que sumir com 5 m/s instantaneamente. Então o perfil leva uma passada DE
//     TRÁS PRA FRENTE, onde cada ponto também obedece "dá pra frear daqui até o próximo":
//         v[i] = min(v[i], raiz(v[i+1]² + 2 × freio × distância))
//     Duas passadas porque o anel é fechado e a última influencia a primeira.
//
// O resultado é o que se vê da janela: ela acelera na reta do oeste, alivia entrando na favela e
// passa devagar no cruzamento. Nada disso é animação — sai da geometria da rua.
const N_PERFIL=600,PASSO_PERFIL=COMPRIMENTO_DA_ROTA/N_PERFIL;
const VEL_CRUZEIRO=9,ACEL=3.2,FREIO=5.5;
// Quanto ela "segura" de lado. 4,5 m/s² é carro de patrulha andando com cuidado; 8 é ele com pressa,
// que é o que a gente usa quando tem ocorrência. É esta constante, e não a velocidade, que define o
// quanto ela corre — velocidade sozinha faria ela cortar a esquina.
const LATERAL_RONDA=4.5,LATERAL_ATENDENDO=8;
const VEL_ATENDENDO=14;
// O perfil vale pra QUALQUER caminho, não só pro anel — é o que deixa o desvio de beco herdar a
// mesma física de freio e curva em vez de ganhar uma velocidade inventada. `fechado` diz se o
// caminho volta nele mesmo (o anel volta; o desvio de beco começa e acaba na rua).
function montarPerfilDe(curva,comprimento,latMax,vMax,fechado=true){
  const passo=comprimento/N_PERFIL;
  const v=new Float32Array(N_PERFIL);
  for(let i=0;i<N_PERFIL;i++){
    const u=i/N_PERFIL,u2=Math.min(1,u+2/N_PERFIL);
    const a=curva.getTangentAt(fechado?u:Math.min(u,.999)),b=curva.getTangentAt(fechado?(u+2/N_PERFIL)%1:u2);
    const ang=Math.abs(Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z));
    const raio=ang>1e-6?(2*passo)/ang:1e9;
    v[i]=Math.min(vMax,Math.sqrt(latMax*raio));
  }
  // Caminho aberto tem que CHEGAR PARADO? Não: ele desemboca na rua, então o fim herda a velocidade
  // de rua. O que ele não pode é entrar rápido demais numa curva mais adiante — e disso a passada de
  // trás pra frente já cuida.
  for(let passada=0;passada<2;passada++)
    for(let k=N_PERFIL-1;k>=0;k--){
      const prox=fechado?v[(k+1)%N_PERFIL]:(k+1<N_PERFIL?v[k+1]:v[N_PERFIL-1]);
      v[k]=Math.min(v[k],Math.sqrt(prox*prox+2*FREIO*passo));
    }
  return v;
}
const montarPerfil=(latMax,vMax)=>montarPerfilDe(ROTA,COMPRIMENTO_DA_ROTA,latMax,vMax,true);
const PERFIL_RONDA=montarPerfil(LATERAL_RONDA,VEL_CRUZEIRO);
const PERFIL_ATENDENDO=montarPerfil(LATERAL_ATENDENDO,VEL_ATENDENDO);
const tetoEm=(perfil,u)=>perfil[Math.min(N_PERFIL-1,Math.floor(((u%1)+1)%1*N_PERFIL))];

// ===== ELA ANDA NA MÃO DELA =====
// O anel é o EIXO da rua; carro de verdade não anda em cima da faixa central. Deslocar pra direita
// deixa a rua com cara de rua e sobra espaço do outro lado. 1,0 m numa via de 5,2 m com um carro de
// 0,86 m ainda deixa mais de um metro até o meio-fio — e o teste confere isso quina por quina.
const MAO=1.0;
// ===== E DESVIA DA QUE ESTÁ PARADA =====
// Agora que a viatura fica parada na ocorrência até o serviço acabar (podem ser minutos), a outra
// passa por cima dela a cada volta — 283 m de anel a ~8 m/s dá uma passagem a cada meia dúzia de
// dezenas de segundos, e duas viaturas ocupando o mesmo pedaço de rua é pior que qualquer bug de
// rota. Chegando perto, quem está passando muda de faixa: -0,6 contra +1,0 são 1,6 m entre os
// centros, e com 0,86 m de largura cada uma sobra 0,74 m de vão. Volta pra mão dela depois.
const MAO_DESVIANDO=-.6,PERTO_PRA_DESVIAR=9,TROCA_DE_FAIXA=2.5;

// ===== E ELA ENTRA NOS BECOS =====
// "quero a viatura andando nos becos tbm, tem uns que dá pra andar sim eu ando." Ele está certo, e o
// comentário no alto deste arquivo estava errado — ele decidiu que NENHUM beco servia medindo UM
// número, o do beco mais apertado (2,45 m). Isso responde "o pior cabe?", não "quais cabem?".
//
// Medido beco por beco, varrendo o corpo dela (0,86 x 1,90) deitado na tangente contra o mesmo
// `colideObstaculoXZ` que barra o carro no jogo:
//     passagem mais estreita 2,10 m · viatura 0,86 m · sobra 0,62 m de cada lado
//     19 de 19 becos passam de ponta a ponta com 12 cm de folga
// (a régua foi validada antes de eu acreditar nela: um corpo de 5 m é barrado em 17 dos 19, e o
// centro de uma casa bate. Régua que aprova tudo não estava medindo nada.)
//
// O QUE FALTAVA NÃO ERA LARGURA, ERA COMO SAIR. Beco é sem saída: nenhum tem as duas pontas na rua,
// e voltar de ré é justamente a queixa antiga dele ("eles vai certinho mais volta de ré kkkk"), que
// é a razão de o anel existir. A medida deu a resposta de graça: as pontas mortas dos becos NÃO
// terminam em parede — terminam no morro livre, com 6 m de folga. Onde cabe 6 m cabe retorno.
// Conferido nos 11 becos que têm boca na rua: todos os 11 aceitam um retorno de 2,5 m de raio (um
// deles precisa de 3). Então ela SOBE, DÁ A VOLTA LÁ EM CIMA e DESCE. Zero ré, e a promessa do anel
// segue de pé.
const BECO_BOCA_MAX=4;        // até onde a boca do beco pode estar da rua pra servir de entrada
const BECO_APROXIMACAO=11;    // quanto de rua entra no desvio antes e depois da boca
// A subida e a descida usam o MESMO eixo do beco. Cheguei a deslocar 30 cm pra cada lado, e o teste
// reprovou: o retorno lá em cima não emendava com as duas pernas deslocadas e sobrava um bico —
// 1 quadro de ré em 8 dos 11 desvios. Num vão de 2,1 m ela anda no meio de qualquer jeito.
const BECO_LATERAL=2.2,BECO_VEL=4.5;// ela anda DEVAGAR no beco: é a única velocidade honesta ali
// COM QUE FREQUÊNCIA ELA PEGA UM DESVIO. Não é gosto, é medido: com 0,4 ela passou 195 s dos 360 s
// de ronda dentro de beco — mais da metade do tempo, ou seja, deixaria de ser patrulha de rua e
// viraria patrulha de beco. O anel tem 283 m a ~8 m/s (35 s por volta) e são 5 bocas; a 0,12 ela
// pega um beco a cada duas voltas, que é o que faz a coisa ser um acontecimento e não uma rotina.
// O que importa é o tempo TOTAL dentro de beco, não a chance por porta: quando a conferência ficou
// determinística e depois mais fina, o número de becos aceitos foi 5 -> 9 -> 5, e esta constante
// acompanhou. Com 5 desvios, 0,12 dá um beco a cada duas voltas.
const BECO_CHANCE=.12;
const RETORNO_RAIOS=[2.5,3,3.5,4,5];
// O corpo dela cabe neste ponto, com este rumo? Mesma pergunta que o teste faz, feita aqui dentro
// pra o desvio se recusar sozinho se o mapa mudar — melhor perder um beco do que ganhar uma viatura
// dentro de uma parede.
// `colideParedeXZ` e não `colideObstaculoXZ`: aqui se PLANEJA uma rota, e rota não pode depender de
// onde os carros estavam no instante do planejamento. O teste completo inclui as caixas móveis — a
// outra viatura, o carro e a moto do jogador — e com elas o conjunto de becos aceitos mudava de
// rodada pra rodada. Foi assim que uma conferência MAIS DURA aceitou MAIS becos (7 contra 5), que é
// o tipo de resultado que denuncia aleatoriedade em vez de medida.
function corpoCabe(cx,cz,rumo,folga=.12){
  const y=alturaDoChaoDesenhado(cx,cz)+.1;
  const L=LARGURA/2+folga,C=COMPRIMENTO/2+folga;
  const sx=Math.sin(rumo),cs=Math.cos(rumo);
  for(const[dl,dc]of[[-L,-C],[L,-C],[-L,C],[L,C],[-L,0],[L,0]])
    if(colideParedeXZ(cx+cs*dl+sx*dc,cz-sx*dl+cs*dc,y,.02,.02,.9))return false;
  return true;
}
// ===== O RETORNO É UMA GOTA, E O MEIO-CÍRCULO NÃO SERVE =====
// A primeira versão fazia meio-círculo: vira 180° e pronto. O teste reprovou 8 dos 11 desvios com
// "1 quadro de ré", e a causa é geométrica, não de código: um meio-círculo de raio R devolve o carro
// PARALELO, mas deslocado 2R de lado. Pra R=2,5 são 5 m — e o beco tem 2,1 m de largura. A curva
// tinha que se dobrar pra voltar ao eixo, e curva que se dobra é bico: o `u` cresce e o mapa anda
// pra trás. É o mesmo defeito que matou o anel grande, registrado no comentário do alto deste
// arquivo. O teste pegou de novo, e a lição é a mesma: o bico não se conserta afinando o passo.
//
// A manobra certa é a que motorista faz numa rua sem saída larga: entra na área livre, gira 270°
// pra um lado e 90° pro outro. A conta fecha em zero — o desvio lateral do primeiro arco é desfeito
// pelo segundo — e ela sai DE VOLTA NO EIXO do beco, 2R atrás do ponto onde entrou, com o nariz
// apontando pra descida. Nenhum quadro andando pra trás.
//   arco 1: 270° pra um lado, raio R    -> chega a 2R de lado e R pra frente
//   arco 2:  90° pro outro, raio R      -> devolve ao eixo, virada 180° no total
// Devolve os pontos e quanto do beco a descida tem que pular (2R), ou null se não couber.
function retornoNoAlto(fim,rumo,lado,R){
  // ===== INTEGRADA, NÃO DERIVADA =====
  // A conta fecha no papel (270° − 90° = 180° de virada, e o deslocamento lateral do primeiro arco é
  // desfeito pelo segundo), mas eu errei o SINAL do segundo arco escrevendo à mão e o teste devolveu
  // "1 quadro de ré" em 7 dos 8 desvios. É exatamente a armadilha que já está no CLAUDE.md: ângulo
  // derivado por convenção não é confiável. Então aqui o caminho é ANDADO, não deduzido — a cada
  // passo eu giro o rumo e avanço na direção dele, que é o que o carro faz. Não tem sinal pra errar.
  const PASSO_ANG=Math.PI/12;// 15°
  let x=fim.x,z=fim.z,h=rumo;
  const pts=[];
  const trecho=(voltas,sentido)=>{
    for(let a=0;a<voltas-1e-9;a+=PASSO_ANG){
      h+=sentido*PASSO_ANG;
      x+=Math.sin(h)*R*PASSO_ANG;z+=Math.cos(h)*R*PASSO_ANG;
      if(!corpoCabe(x,z,h))return false;
      pts.push(new THREE.Vector3(x,0,z));
    }
    return true;
  };
  if(!trecho(Math.PI*1.5,lado))return null;// 270° pra um lado
  if(!trecho(Math.PI*.5,-lado))return null;// 90° pro outro: devolve ela no eixo, virada 180°
  return{pts,recuo:2*R};
}
// Monta um desvio por beco: rua -> boca -> sobe -> retorno -> desce -> rua, de novo.
function montarDesvios(){
  const lista=[];
  for(const beco of becos){
    const A=beco.getPointAt(0),B=beco.getPointAt(1);
    const uA=uMaisPerto(A),uB=uMaisPerto(B);
    const pA=ROTA.getPointAt(uA),pB=ROTA.getPointAt(uB);
    const dA=Math.hypot(pA.x-A.x,pA.z-A.z),dB=Math.hypot(pB.x-B.x,pB.z-B.z);
    if(Math.min(dA,dB)>BECO_BOCA_MAX)continue;// nenhuma ponta encosta na rua: não dá pra entrar
    const bocaEmA=dA<=dB,uBoca=bocaEmA?uA:uB;
    // sobe da boca até a ponta morta
    const nSub=Math.max(6,Math.ceil(beco.getLength()/1.2));
    const eixo=[],normal=[],tangente=[];
    for(let k=0;k<=nSub;k++){
      const t0=bocaEmA?k/nSub:1-k/nSub;
      const p=beco.getPointAt(t0),tg=beco.getTangentAt(t0);
      // Se a boca é a ponta B, ela percorre o beco AO CONTRÁRIO: a tangente de marcha inverte, e com
      // ela a normal. Guardar as duas explicitamente em vez de derivar uma da outra na hora — derivar
      // ângulo por convenção é a armadilha que mais mordeu neste projeto (ver o sinal do esterço).
      const sinal=bocaEmA?1:-1;
      const tx=tg.x*sinal,tz=tg.z*sinal;
      eixo.push(p);tangente.push({x:tx,z:tz});normal.push({x:-tz,z:tx});
    }
    const fim=eixo[eixo.length-1],tgFim=tangente[tangente.length-1];
    // `corpoCabe` põe o comprimento no eixo (sin rumo, cos rumo), então rumo = atan2(tx,tz).
    const rumoFim=Math.atan2(tgFim.x,tgFim.z);
    let arco=null,recuo=0;
    for(const R of RETORNO_RAIOS){
      for(const lado of[1,-1]){const t=retornoNoAlto(fim,rumoFim,lado,R);if(t){arco=t.pts;recuo=t.recuo;break}}
      if(arco)break;
    }
    if(!arco)continue;// sem retorno lá em cima, ela ficaria presa: este beco não entra
    const pts=[];
    const uEntra=(uBoca-BECO_APROXIMACAO/COMPRIMENTO_DA_ROTA+1)%1;
    const uSai=(uBoca+BECO_APROXIMACAO/COMPRIMENTO_DA_ROTA)%1;
    const passos=Math.ceil(BECO_APROXIMACAO/1.5);
    for(let k=0;k<=passos;k++)pts.push(ROTA.getPointAt((uEntra+(k/passos)*(BECO_APROXIMACAO/COMPRIMENTO_DA_ROTA))%1));
    // SOBE pelo eixo do beco...
    for(let k=0;k<eixo.length;k++)pts.push(new THREE.Vector3(eixo[k].x,0,eixo[k].z));
    for(const a of arco)pts.push(a);
    // ...e DESCE pelo mesmo eixo. A gota devolve ela 2R atrás do fim, então a descida começa daí —
    // repetir os pontos que a manobra já cobriu poria dois pontos colados na CatmullRom, e dois
    // pontos colados viram nó (é o mesmo motivo do `slice(1)` no cruzamento das duas vias).
    let pular=0,somado=0;
    for(let k=eixo.length-1;k>0&&somado<recuo;k--){
      somado+=Math.hypot(eixo[k].x-eixo[k-1].x,eixo[k].z-eixo[k-1].z);pular++;
    }
    for(let k=eixo.length-1-pular;k>=0;k--)pts.push(new THREE.Vector3(eixo[k].x,0,eixo[k].z));
    for(let k=0;k<=passos;k++)pts.push(ROTA.getPointAt((uBoca+(k/passos)*(BECO_APROXIMACAO/COMPRIMENTO_DA_ROTA))%1));
    const curva=new THREE.CatmullRomCurve3(pts,false,'catmullrom',.5);
    const comp=curva.getLength();
    // ===== E ELA SÓ ACEITA O DESVIO SE DIRIGIR ELE INTEIRO =====
    // Montar o caminho não prova nada: a CatmullRom ARREDONDA a boca do beco, e boca de beco é quina
    // de casa — o teste pegou 3 desvios raspando parede e 4 com um quadro de ré na manobra. Não dá
    // pra confiar na lista de becos que "cabem": o que tem que caber é ESTE traçado.
    // Então a recusa mora aqui, e não no teste. Duas cobranças, as mesmas que o teste faz:
    //   · o corpo dela passa em todo ponto do desvio;
    //   · ela nunca anda pra trás (produto escalar do passo com a tangente).
    // Beco que não passa simplesmente não vira desvio. Perder um beco é barato; entregar a viatura
    // dentro de uma parede, ou dando ré, não é — ré é a queixa original dele.
    // O PASSO E A FOLGA DA CONFERÊNCIA TÊM QUE SER MAIS DUROS QUE OS DA RONDA.
    // Estavam em 0,4 m e 10 cm, e o teste de ronda pegou o desvio 1 raspando SEMPRE no mesmo ponto,
    // entre 9,2 e 10,1 m: uma janela de 90 cm que caía entre duas amostras da conferência. Conferir
    // com a mesma frouxidão com que se anda é não conferir nada — a margem tem que sobrar.
    // 0,15 m de passo e 18 cm de folga, que é a espessura de uma parede: se a diferença entre passar
    // e bater for menos que uma parede, o beco não serve.
    // O PASSO TEM QUE SER MENOR QUE O RAIO DA MANOBRA. Fui de 0,4 pra 0,25 e ainda escapavam coisas:
    // com 0,15 apareceram um ponto raspando aos 45,7 m num desvio e dois bicos de verdade em outros
    // dois — e sumiu um "bico" que era só corda grossa perto do ápice da gota (raio 2,5 m). Amostrar
    // mais fino que a curva é a única forma de a conferência valer alguma coisa; a conferência do
    // módulo tem que ser pelo menos tão dura quanto o teste que julga ela.
    const n=Math.max(60,Math.ceil(comp/.15));
    // A TANGENTE DE COMPARAÇÃO É A DE ONDE O PASSO COMEÇOU, não a de onde ele termina.
    // Eu conferia contra a tangente do ponto de CHEGADA e o teste contra a de SAÍDA — a mesma
    // pergunta feita de dois jeitos, e perto do ápice da gota elas discordam por uma rotação de
    // passo. Duas dessas passavam aqui e reprovavam lá. A física é a de saída: o carro aponta pra
    // onde estava apontando quando o passo começou, e é contra isso que "andou pra trás" se mede.
    let serve=true,ant=curva.getPointAt(0),tAnt=curva.getTangentAt(0);
    for(let k=1;k<=n&&serve;k++){
      const u=k/n,p=curva.getPointAt(u),t=curva.getTangentAt(u);
      if(!corpoCabe(p.x,p.z,Math.atan2(t.x,t.z),.18))serve=false;
      if((p.x-ant.x)*tAnt.x+(p.z-ant.z)*tAnt.z<0)serve=false;
      ant=p;tAnt=t;
    }
    if(!serve)continue;
    lista.push({curva,comp,uEntra,uSai,
      perfil:montarPerfilDe(curva,comp,BECO_LATERAL,BECO_VEL,false)});
  }
  return lista;
}
// ===== MONTADOS TARDE, DE PROPÓSITO =====
// Na carga deste módulo os colisores ainda não foram FUNDIDOS (Physics.otimizarObstaculos junta
// caixas que compartilham topo, e a caixa fundida é MAIOR que as duas). Montando aqui, um desvio
// passava na conferência e batia no jogo — o teste pegou: 2 pontos raspando logo no primeiro metro.
// Então a montagem espera o primeiro quadro, quando o mundo já está inteiro e fundido. É uma vez só.
let DESVIOS=null;
function desvios(){if(DESVIOS===null)DESVIOS=montarDesvios();return DESVIOS}
export function __desvios(){return desvios().map(d=>({comp:+d.comp.toFixed(1),uEntra:+d.uEntra.toFixed(4),uSai:+d.uSai.toFixed(4)}))}
export function __curvaDesvio(i){return desvios()[i]?.curva??null}

const viaturas=[];
let modelo=null;

function criarViatura(u0){
  const grupo=new THREE.Group();grupo.name='viatura';grupo.rotation.order='YXZ';
  grupo.visible=false;scene.add(grupo);
  // Giroflex: dois blocos emissivos que piscam alternados quando ela está atendendo. É o que faz o
  // jogador OUVIR e VER a viatura chegando antes de ela aparecer na esquina, e transforma "correr pro
  // beco" numa decisão em vez de um susto.
  // A altura vem de medida, não de chute: o modelo ocupa y de 0 a 0,797 no referencial do grupo
  // (x ±0,428 · z ±0,95, que é a largura e o comprimento das constantes lá em cima, conferindo). Os
  // giroflex nasceram em 0,42 e a foto mostrou os dois ENTERRADOS dentro da lataria — 0,83 põe eles
  // em cima do teto, encaixados na barra que o próprio modelo já tem.
  const barra=new THREE.Group();barra.position.set(0,.83,0);grupo.add(barra);
  const lampada=(cor,x)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(.16,.07,.16),
      new THREE.MeshStandardMaterial({color:cor,emissive:cor,emissiveIntensity:.2}));
    m.position.set(x,0,0);barra.add(m);return m;
  };
  const luzes=[lampada(0x3366ff,-.18),lampada(0xff3322,.18)];
  const caixa=new THREE.Box3(new THREE.Vector3(0,-9999,0),new THREE.Vector3(.01,-9998.99,.01));
  marcarObstaculoMovel(registrarCaixa(caixa,'viatura'));
  return{grupo,u:u0,luzes,caixa,piscaT:0,vel:0,mao:MAO,atendendo:false,desembarcou:false,
    // Desvio de beco em curso: qual, e quanto dele já andou (em metros). `u` fica CONGELADO na
    // boca enquanto isso, pra a conta de despacho continuar sabendo onde ela está no anel.
    desvio:null,sDesvio:0};
}

// Onde no anel fica o ponto mais perto de um alvo. 300 amostras em ~283 m dá 0,9 m de resolução, e o
// que se quer aqui é "em que altura da rua eu paro", não precisão de milímetro. Devolve `u` de 0 a 1.
function uMaisPerto(alvo){
  let melhor=0,dist=Infinity;
  for(let i=0;i<300;i++){
    const u=i/300,p=ROTA.getPointAt(u);
    const d=(p.x-alvo.x)**2+(p.z-alvo.z)**2;
    if(d<dist){dist=d;melhor=u}
  }
  return melhor;
}

function assentar(v){
  // O CAMINHO ATUAL, que nem sempre é o anel. No desvio de beco ela anda numa curva própria, e é ela
  // que manda na posição e no rumo — o resto daqui pra baixo não muda uma linha.
  const emDesvio=v.desvio!==null;
  const via=emDesvio?v.desvio.curva:ROTA;
  const t01=emDesvio?Math.min(1,Math.max(0,v.sDesvio/v.desvio.comp)):v.u;
  const eixo=via.getPointAt(t01),t=via.getTangentAt(t01);
  // A frente do jogo é (-sen, -cos) do yaw. Igualando à tangente do anel sai o yaw direto — e como o
  // `u` só ANDA PRA FRENTE, o nariz nunca fica ao contrário. Era daí que vinha o "volta de ré".
  const rumo=Math.atan2(-t.x,-t.z);
  // Sai do eixo pra faixa em que ela está agora. A perpendicular da tangente, sempre pro mesmo lado
  // do anel inteiro — duas viaturas no mesmo sentido ficam na mesma mão, como carro de verdade.
  // No beco ela anda no EIXO: a mão de 1,0 m é de via de 5,2 m; num beco de 2,1 m ela poria a
  // viatura com a lateral dentro da parede. O deslocamento de subida/descida já está na curva.
  const p={x:eixo.x-t.z*(emDesvio?0:v.mao),z:eixo.z+t.x*(emDesvio?0:v.mao)};
  const fx=t.x,fz=t.z;
  // Assenta no chão DESENHADO, igual aos veículos do jogador (ver o comentário longo em
  // `assentar`, no Veiculo.js): a curva analítica difere da malha visível em até 8,9 cm, e a viatura
  // roda a vida inteira na via principal — onde o asfalto escuro denuncia a roda enterrada.
  // O COLISOR abaixo continua na curva, junto com o resto da física.
  const yF=alturaDoChaoDesenhado(p.x+fx*ENTRE_EIXOS,p.z+fz*ENTRE_EIXOS);
  const yT=alturaDoChaoDesenhado(p.x-fx*ENTRE_EIXOS,p.z-fz*ENTRE_EIXOS);
  v.grupo.position.set(p.x,(yF+yT)/2+ALTURA_ASSENTO,p.z);
  v.grupo.rotation.y=rumo;
  v.grupo.rotation.x=Math.atan2(yF-yT,ENTRE_EIXOS*2);// acompanha a ladeira da rua
  // Colisor: AABB do retângulo girado, como nos outros veículos. A física do jogo é alinhada aos
  // eixos, então de lado a caixa é maior que o carro — e é o preço certo por um obstáculo parado.
  const c=Math.abs(Math.cos(rumo)),sn=Math.abs(Math.sin(rumo));
  const meiaX=(COMPRIMENTO*sn+LARGURA*c)/2,meiaZ=(COMPRIMENTO*c+LARGURA*sn)/2;
  const y=obterElevacao(p.x,p.z);
  v.caixa.min.set(p.x-meiaX,y-.1,p.z-meiaZ);
  v.caixa.max.set(p.x+meiaX,y+ALTURA_COLISAO,p.z+meiaZ);
}

new GLTFLoader().load('assets/viatura.glb',gltf=>{
  modelo=gltf.scene;
  modelo.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  const b=new THREE.Box3().setFromObject(modelo),tam=b.getSize(new THREE.Vector3());
  const maior=Math.max(tam.x,tam.y,tam.z)||1;
  modelo.scale.setScalar(COMPRIMENTO/maior);
  const c=b.getCenter(new THREE.Vector3());
  modelo.position.sub(c);modelo.position.y+=tam.y*.5/maior*COMPRIMENTO;
  // A FRENTE APONTA PRA -X, medido no visualizador: da câmera em -X aparecem a grade, o quebra-mato e
  // o giroflex. -90° leva (-1,0,0) pra (0,0,-1), que é a frente do jogo. Mesmo caso do carro e da moto
  // — e a moto andou de rabo justamente por supor isso em vez de medir.
  modelo.rotation.y=-Math.PI/2;
  // `SkeletonUtils` não faz falta aqui: sem esqueleto, `clone()` comum já serve, e a geometria e a
  // textura seguem compartilhadas entre as duas.
  for(let i=0;i<viaturas.length;i++){
    const copia=i?modelo.clone():modelo;
    viaturas[i].grupo.add(copia);
    viaturas[i].grupo.visible=true;
    assentar(viaturas[i]);
  }
},undefined,err=>console.warn('Quintal 3D: viatura não carregou',err));

// Meia volta uma da outra: assim, de qualquer ponto do mapa, sempre tem uma viatura a no máximo meio
// anel de distância — e passam uma pela outra no cruzamento de vez em quando, que é bonito de ver.
viaturas.push(criarViatura(0),criarViatura(.5));

// O passo deste quadro passou por cima de `marca`? O anel dá a volta em 1, então um passo que cruza
// o zero (de 0,99 pra 0,01) não é "andou pra trás" — é a volta fechando. Sem tratar isso, o desvio
// que fica logo depois do zero nunca dispararia.
function cruzou(de,ate,marca){
  if(ate>=de)return marca>de&&marca<=ate;
  return marca>de||marca<=ate;
}
// Quanto do anel falta, indo PRA FRENTE, entre `de` e `ate`. Sempre positivo: o anel é de mão única.
function faltaAte(de,ate){let d=ate-de;if(d<0)d+=1;return d*COMPRIMENTO_DA_ROTA}

// `alvo` é o centro da plantação sendo batida, ou null. Vem do `main` pra este módulo não precisar
// conhecer a polícia — quem já sabe dos dois é o laço do jogo.
// DEVOLVE o ponto onde uma viatura acabou de estacionar numa ocorrência (uma vez só, no quadro da
// chegada) ou null. Quem faz alguma coisa com isso é o `main`: é ele que sabe da polícia. Foi assim
// que o alvo entrou, e é assim que a resposta sai — este módulo continua só dirigindo.
// QUANTAS viaturas largam a ronda. Uma na batida de canteiro; as duas numa perseguição de ficha 3+.
const PERSEGUICAO_DUAS=3;
// Vasculhando (endereço frio), ela passa devagar pela área em vez de parar: 3 m/s é passo de quem
// está olhando pros becos, não de quem está indo a algum lugar. O raio é o pedaço de anel em volta
// do ponto onde ela alivia.
const VASCULHA_VEL=3,VASCULHA_RAIO=22;
const despachadas=[];
let ocorrenciaAtendida=false,alvoAtendido=null;
// Quanto a ocorrência precisa andar pra virar OUTRA ocorrência. Canteiro não anda; jogador anda.
const OCORRENCIA_ANDOU=12;
// `segurar` vem do main: é a polícia dizendo "ainda tem serviço" — tem canteiro sendo batido, ou a
// guarnição ainda está em campo voltando pro carro. Enquanto for true a despachada NÃO sai do lugar.
export function atualizarViaturas(dt,alvo,segurar){
  if(!modelo)return null;
  let desembarque=null;
  // ===== QUEM ATENDE É A MAIS PERTO, SÓ ELA, E SÓ UMA VEZ =====
  // Três regras, e cada uma tapou um buraco que o teste mostrou:
  //
  //  · NUMA BATIDA, SÓ UMA VAI. As duas largarem a ronda pelo mesmo canteiro é o que polícia nenhuma
  //    faz — some viatura da rua inteira por causa de uma ocorrência. Vai a que chega primeiro (menor
  //    distância PELA FRENTE, a única que ela pode andar) e a outra segue rondando o lado oposto.
  //    NUMA PERSEGUIÇÃO DE FICHA ALTA (3+), VÃO AS DUAS. Isso é o oposto do caso do canteiro, e de
  //    propósito: canteiro é serviço de rotina, foragido de três estrelas é o que tira todo mundo da
  //    rotina. Medido antes: em 120 s de ficha 3 e ficha 5, NUNCA houve duas atendendo — a segunda
  //    seguia a ronda como se nada acontecesse. E como elas rodam meia volta uma da outra, elas
  //    chegam pelos dois lados do anel sem eu ter que escrever uma linha de cerco.
  //  · UMA VEZ ESCOLHIDA, É ELA. Sem travar, dava rodízio: a despachada parava a 2 m do destino, a
  //    outra ia se aproximando na ronda, em algum momento ficava mais perto QUE a parada, virava a
  //    despachada, e a primeira era solta. Medido: duas guarnições desembarcadas na mesma batida,
  //    aos 9,9 s e aos 32,8 s.
  //  · FICA ATÉ O SERVIÇO ACABAR. Ela larga o ponto quando a batida termina E a guarnição já
  //    embarcou (ou morreu) — os dois casos que o Bruno pediu, nas palavras dele: "ela deve ficar
  //    parada até concluir o serviço ou os polícias morreren". Quem sabe isso é a polícia, e chega
  //    aqui pelo `segurar`. (A versão anterior esperava 4 s e caía fora; ficava a viatura rodando
  //    tranquila enquanto a dupla dela trabalhava sozinha do outro lado do morro.)
  // Quantas vão. `alvo.perseguicao` e `alvo.nivel` vêm na ficha da ocorrência (ver `ocorrenciaAtual`
  // no Police.js) — este módulo continua sem conhecer a polícia, só lê a ficha que recebe.
  const querem=alvo&&alvo.perseguicao&&(alvo.nivel??0)>=PERSEGUICAO_DUAS?2:1;
  if(!alvo&&!segurar){despachadas.length=0;ocorrenciaAtendida=false;alvoAtendido=null}
  // ===== A OCORRÊNCIA ANDOU: É OUTRA =====
  // Canteiro fica onde está, mas o JOGADOR corre. Sem isto, a viatura despachada atrás dele ficava
  // grudada pra sempre no primeiro ponto onde ele foi visto — ele já estava três quarteirões adiante
  // e ela parada, o que é a mesma cara de "não faz nada" que este conserto veio tirar.
  // Só solta com a guarnição RECOLHIDA (`segurar` falso): largar o carro com a dupla no chão é
  // exatamente o defeito que o `viatura.mjs` já mediu — dupla trabalhando sozinha do outro lado do
  // morro enquanto a viatura dela roda tranquila.
  else if(alvo&&alvoAtendido&&!segurar&&
          Math.hypot(alvo.x-alvoAtendido.x,alvo.z-alvoAtendido.z)>OCORRENCIA_ANDOU){
    despachadas.length=0;ocorrenciaAtendida=false;alvoAtendido=null;
  }
  if(alvo&&despachadas.length<querem&&!ocorrenciaAtendida){
    const destino=uMaisPerto(alvo);
    let melhor=Infinity,escolhida=null;
    for(const v of viaturas){
      // QUEM ESTÁ NO BECO NÃO ATENDE. O destino é um `u` do ANEL, e ela não está no anel — despachar
      // ela seria mandar frear pra um ponto que não existe no caminho em que está. Ela termina o
      // desvio (são poucos segundos) e a outra vai. Se as duas estiverem em beco, a ocorrência espera
      // o primeiro que sair, que é o comportamento certo e não um travamento.
      if(v.desvio||despachadas.includes(v))continue;
      const d=faltaAte(v.u,destino);
      if(d<melhor){melhor=d;escolhida=v}
    }
    if(escolhida){
      escolhida.destino=destino;escolhida.desembarcou=false;
      despachadas.push(escolhida);alvoAtendido={x:alvo.x,z:alvo.z};
    }
  }
  // O endereço é FRIO? Então ninguém para em cima dele. Ver o comentário de `PARA_NO_PONTO`.
  const paraNoPonto=!alvo||alvo.quente!==false;
  for(const v of viaturas){
    const atendendo=despachadas.includes(v);
    v.atendendo=atendendo;

    // ===== NO BECO ELA ANDA NO CAMINHO DO BECO =====
    // Mesma física de sempre — teto por curvatura, acelera e freia com limite. O que muda é o
    // caminho e o perfil dele. Sai do desvio quando acaba a curva, e volta pro anel no `uSai`, que é
    // adiante da boca: ela desemboca na rua já no rumo do anel, sem manobra.
    if(v.desvio){
      const tetoB=v.desvio.perfil[Math.min(N_PERFIL-1,Math.floor(v.sDesvio/v.desvio.comp*N_PERFIL))];
      const lim=tetoB>v.vel?ACEL*dt:FREIO*dt;
      v.vel+=Math.max(-lim,Math.min(lim,tetoB-v.vel));
      if(v.vel<0)v.vel=0;
      v.sDesvio+=v.vel*dt;
      if(v.sDesvio>=v.desvio.comp){v.u=v.desvio.uSai;v.desvio=null;v.sDesvio=0}
      v.mao+=Math.max(-TROCA_DE_FAIXA*dt,Math.min(TROCA_DE_FAIXA*dt,MAO-v.mao));
      v.piscaT=0;for(const l of v.luzes)l.material.emissiveIntensity=.2;
      assentar(v);
      continue;
    }
    // ===== O TETO DE VELOCIDADE DESTE PEDAÇO DE RUA =====
    let teto=tetoEm(atendendo?PERFIL_ATENDENDO:PERFIL_RONDA,v.u);
    let falta=Infinity;
    if(atendendo){
      falta=faltaAte(v.u,v.destino);
      // ===== PARA NO PONTO, OU VASCULHA A ÁREA =====
      // Com endereço QUENTE ela para: é onde ele está agora, pelo que se sabe.
      // Com endereço FRIO (o rastro esfriou e sobrou só o último lugar em que ele foi visto), parar
      // em cima do ponto velho é a cara de burrice que ele apontou — medido: a despachada ficou com
      // velocidade 0,0 enquanto o jogador corria 200 m. Aí ela não freia: passa devagar pela área,
      // dá a volta no anel e passa de novo. É ronda de busca, e é o que polícia faz quando perdeu.
      if(paraNoPonto)
        // `v² = 2·freio·distância` é o quanto ela pode estar correndo pra ainda caber a frenagem até
        // o ponto de parada. Sem isto ela chegaria a 14 m/s e viraria estátua num quadro.
        teto=Math.min(teto,Math.sqrt(Math.max(0,2*FREIO*Math.max(0,falta-CHEGOU))));
      else if(falta<VASCULHA_RAIO||falta>COMPRIMENTO_DA_ROTA-VASCULHA_RAIO)
        teto=Math.min(teto,VASCULHA_VEL);// passando pela área: devagar, procurando
    }
    // Acelera ou freia até o teto, respeitando o que o motor e o freio dão. É daqui que sai a
    // sensação de peso: ela não muda de velocidade de um quadro pro outro.
    const limite=teto>v.vel?ACEL*dt:FREIO*dt;
    v.vel+=Math.max(-limite,Math.min(limite,teto-v.vel));
    if(v.vel<0)v.vel=0;
    // Anda, sem nunca passar do ponto de parada — a não ser que não haja ponto de parada.
    const anda=Math.min(v.vel*dt,atendendo&&paraNoPonto?Math.max(0,falta-CHEGOU):Infinity);
    const uAntes=v.u;
    v.u=(v.u+anda/COMPRIMENTO_DA_ROTA)%1;
    // ===== ENTROU NO BECO? =====
    // Só de ronda (com ocorrência ela tem mais o que fazer), só se a outra não estiver naquele mesmo
    // beco (duas viaturas num vão de 2,1 m é pior que qualquer bug de rota), e por sorteio — beco
    // toda volta viraria trenzinho de novo.
    if(!atendendo&&!alvo){
      for(const d of desvios()){
        if(!cruzou(uAntes,v.u,d.uEntra))continue;
        if(viaturas.some(o=>o!==v&&o.desvio===d))break;
        if(Math.random()<BECO_CHANCE){v.desvio=d;v.sDesvio=0;v.u=d.uEntra}
        break;
      }
    }

    // ===== DESVIA DE QUEM ESTÁ PARADO NA RUA =====
    // A que está parada mantém a mão dela; a que está passando muda de faixa, e volta depois. Suave,
    // porque pular de faixa num quadro é teletransporte lateral — a viatura tem que sair e voltar
    // como carro sai e volta.
    let maoAlvo=MAO;
    if(!atendendo)for(const outra of viaturas){
      if(outra===v||outra.vel>.3)continue;// só quem está de fato parada atrapalha
      const d=Math.min(faltaAte(v.u,outra.u),faltaAte(outra.u,v.u));
      if(d<PERTO_PRA_DESVIAR){maoAlvo=MAO_DESVIANDO;break}
    }
    v.mao+=Math.max(-TROCA_DE_FAIXA*dt,Math.min(TROCA_DE_FAIXA*dt,maoAlvo-v.mao));

    if(atendendo){
      // Giroflex piscando: alterna a cada 0,25 s.
      v.piscaT+=dt;
      const liga=Math.floor(v.piscaT*4)%2;
      v.luzes[0].material.emissiveIntensity=liga?2.4:.15;
      v.luzes[1].material.emissiveIntensity=liga?.15:2.4;
      // CHEGOU E PAROU: é a hora de a guarnição saltar. Parada de verdade (velocidade quase zero),
      // não "encostou no raio" — policial pulando de carro andando é pior que não ter carro.
      if(paraNoPonto&&!v.desembarcou&&falta-CHEGOU<=.05&&v.vel<.3){
        v.desembarcou=true;
        desembarque={x:v.grupo.position.x,z:v.grupo.position.z};
      }
    }else{
      v.piscaT=0;
      for(const l of v.luzes)l.material.emissiveIntensity=.2;
    }
    assentar(v);
  }
  return desembarque;
}
// Exposto pro teste: posição, rumo, estado do giroflex e o COLISOR de cada viatura, sem precisar
// cavar na cena. O colisor vem daqui e não da lista da física de propósito: depois da fusão,
// `obstaculos` e `categoriasObstaculo` não andam mais em paralelo, e casar por índice devolveria a
// caixa errada — a que manda é esta referência, que é a mesma que a física recebeu.
export function __viaturas(){
  return viaturas.map(v=>({x:+v.grupo.position.x.toFixed(2),z:+v.grupo.position.z.toFixed(2),
    rumo:+v.grupo.rotation.y.toFixed(3),u:+v.u.toFixed(4),
    vel:+v.vel.toFixed(2),atendendo:v.atendendo,mao:+v.mao.toFixed(2),
    desvio:v.desvio?desvios().indexOf(v.desvio):null,sDesvio:+v.sDesvio.toFixed(1),
    piscando:v.luzes[0].material.emissiveIntensity>1||v.luzes[1].material.emissiveIntensity>1,
    caixa:{minX:v.caixa.min.x,minY:v.caixa.min.y,minZ:v.caixa.min.z,
           maxX:v.caixa.max.x,maxY:v.caixa.max.y,maxZ:v.caixa.max.z}}));
}
