// ===== AS VIATURAS: DUAS, E SÓ NA RUA =====
//
// O Bruno levantou o problema antes de eu chegar nele: "o problema é os colisores e as paredes, eles
// vão bater né". Ele estava certo, e os números do mapa confirmam:
//     via principal 5,20 m livres · via baixa 5,35 m · beco mais apertado 2,45 m
// A viatura tem 1,90 m de comprimento. Nas ruas sobra espaço; num beco de 2,45 m ela nem consegue
// fazer a curva de entrada — o raio de giro de um carro é muito maior que isso. E pior: a polícia
// navega pela malha de PEDESTRE, calculada com 25 cm de folga. Um carro nela cortaria quina e
// atravessaria parede.
//
// A saída não é melhorar o desvio: é a viatura NUNCA SAIR DA RUA. Ela anda sobre a própria curva da
// via (`viaPrincipal` e `viaBaixa`, que já existem no traçado), então não há como bater — ela não
// tem para onde errar. É também o que acontece de verdade: viatura não sobe viela, quem sobe é o
// policial a pé, e isso o jogo já faz.
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
import{obterElevacao}from'./Terrain.js';
import{viaPrincipal,viaBaixa}from'./Favela.js';
import{registrarCaixa,marcarObstaculoMovel}from'./Physics.js';

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
function montarPerfil(latMax,vMax){
  const v=new Float32Array(N_PERFIL);
  for(let i=0;i<N_PERFIL;i++){
    const u=i/N_PERFIL;
    const a=ROTA.getTangentAt(u),b=ROTA.getTangentAt((u+2/N_PERFIL)%1);
    const ang=Math.abs(Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z));
    const raio=ang>1e-6?(2*PASSO_PERFIL)/ang:1e9;
    v[i]=Math.min(vMax,Math.sqrt(latMax*raio));
  }
  for(let passada=0;passada<2;passada++)
    for(let k=N_PERFIL-1;k>=0;k--){
      const prox=v[(k+1)%N_PERFIL];
      v[k]=Math.min(v[k],Math.sqrt(prox*prox+2*FREIO*PASSO_PERFIL));
    }
  return v;
}
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
  return{grupo,u:u0,luzes,caixa,piscaT:0,vel:0,mao:MAO,atendendo:false,desembarcou:false};
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
  const eixo=ROTA.getPointAt(v.u),t=ROTA.getTangentAt(v.u);
  // A frente do jogo é (-sen, -cos) do yaw. Igualando à tangente do anel sai o yaw direto — e como o
  // `u` só ANDA PRA FRENTE, o nariz nunca fica ao contrário. Era daí que vinha o "volta de ré".
  const rumo=Math.atan2(-t.x,-t.z);
  // Sai do eixo pra faixa em que ela está agora. A perpendicular da tangente, sempre pro mesmo lado
  // do anel inteiro — duas viaturas no mesmo sentido ficam na mesma mão, como carro de verdade.
  const p={x:eixo.x-t.z*v.mao,z:eixo.z+t.x*v.mao};
  const fx=t.x,fz=t.z;
  const yF=obterElevacao(p.x+fx*ENTRE_EIXOS,p.z+fz*ENTRE_EIXOS);
  const yT=obterElevacao(p.x-fx*ENTRE_EIXOS,p.z-fz*ENTRE_EIXOS);
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

// Quanto do anel falta, indo PRA FRENTE, entre `de` e `ate`. Sempre positivo: o anel é de mão única.
function faltaAte(de,ate){let d=ate-de;if(d<0)d+=1;return d*COMPRIMENTO_DA_ROTA}

// `alvo` é o centro da plantação sendo batida, ou null. Vem do `main` pra este módulo não precisar
// conhecer a polícia — quem já sabe dos dois é o laço do jogo.
// DEVOLVE o ponto onde uma viatura acabou de estacionar numa ocorrência (uma vez só, no quadro da
// chegada) ou null. Quem faz alguma coisa com isso é o `main`: é ele que sabe da polícia. Foi assim
// que o alvo entrou, e é assim que a resposta sai — este módulo continua só dirigindo.
let despachada=null,ocorrenciaAtendida=false;
// `segurar` vem do main: é a polícia dizendo "ainda tem serviço" — tem canteiro sendo batido, ou a
// guarnição ainda está em campo voltando pro carro. Enquanto for true a despachada NÃO sai do lugar.
export function atualizarViaturas(dt,alvo,segurar){
  if(!modelo)return null;
  let desembarque=null;
  // ===== QUEM ATENDE É A MAIS PERTO, SÓ ELA, E SÓ UMA VEZ =====
  // Três regras, e cada uma tapou um buraco que o teste mostrou:
  //
  //  · SÓ UMA VAI. As duas largarem a ronda pelo mesmo canteiro é o que polícia nenhuma faz — some
  //    viatura da rua inteira por causa de uma ocorrência. Vai a que chega primeiro (menor distância
  //    PELA FRENTE, a única que ela pode andar) e a outra segue rondando o lado oposto do anel.
  //  · UMA VEZ ESCOLHIDA, É ELA. Sem travar, dava rodízio: a despachada parava a 2 m do destino, a
  //    outra ia se aproximando na ronda, em algum momento ficava mais perto QUE a parada, virava a
  //    despachada, e a primeira era solta. Medido: duas guarnições desembarcadas na mesma batida,
  //    aos 9,9 s e aos 32,8 s.
  //  · FICA ATÉ O SERVIÇO ACABAR. Ela larga o ponto quando a batida termina E a guarnição já
  //    embarcou (ou morreu) — os dois casos que o Bruno pediu, nas palavras dele: "ela deve ficar
  //    parada até concluir o serviço ou os polícias morreren". Quem sabe isso é a polícia, e chega
  //    aqui pelo `segurar`. (A versão anterior esperava 4 s e caía fora; ficava a viatura rodando
  //    tranquila enquanto a dupla dela trabalhava sozinha do outro lado do morro.)
  if(!alvo&&!segurar){despachada=null;ocorrenciaAtendida=false}
  else if(alvo&&!despachada&&!ocorrenciaAtendida){
    const destino=uMaisPerto(alvo);
    let melhor=Infinity;
    for(const v of viaturas){
      const d=faltaAte(v.u,destino);
      if(d<melhor){melhor=d;despachada=v}
    }
    if(despachada){despachada.destino=destino;despachada.desembarcou=false}
  }
  for(const v of viaturas){
    const atendendo=v===despachada;
    v.atendendo=atendendo;

    // ===== O TETO DE VELOCIDADE DESTE PEDAÇO DE RUA =====
    let teto=tetoEm(atendendo?PERFIL_ATENDENDO:PERFIL_RONDA,v.u);
    let falta=Infinity;
    if(atendendo){
      falta=faltaAte(v.u,v.destino);
      // PARAR DIREITO. `v² = 2·freio·distância` é o quanto ela pode estar correndo pra ainda caber a
      // frenagem até o ponto de parada. Sem isto ela chegaria a 14 m/s e viraria estátua num quadro,
      // que é o que a versão anterior fazia — e é exatamente a cara de coisa que não é carro.
      teto=Math.min(teto,Math.sqrt(Math.max(0,2*FREIO*Math.max(0,falta-CHEGOU))));
    }
    // Acelera ou freia até o teto, respeitando o que o motor e o freio dão. É daqui que sai a
    // sensação de peso: ela não muda de velocidade de um quadro pro outro.
    const limite=teto>v.vel?ACEL*dt:FREIO*dt;
    v.vel+=Math.max(-limite,Math.min(limite,teto-v.vel));
    if(v.vel<0)v.vel=0;
    // Anda, sem nunca passar do ponto de parada.
    const anda=Math.min(v.vel*dt,atendendo?Math.max(0,falta-CHEGOU):Infinity);
    v.u=(v.u+anda/COMPRIMENTO_DA_ROTA)%1;

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
      if(!v.desembarcou&&falta-CHEGOU<=.05&&v.vel<.3){
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
    piscando:v.luzes[0].material.emissiveIntensity>1||v.luzes[1].material.emissiveIntensity>1,
    caixa:{minX:v.caixa.min.x,minY:v.caixa.min.y,minZ:v.caixa.min.z,
           maxX:v.caixa.max.x,maxY:v.caixa.max.y,maxZ:v.caixa.max.z}}));
}
