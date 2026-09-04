// ===== TROCAÇÃO: alturas, pontaria, aquisição de alvo, papéis de equipe e cobertura =====
//
// Este módulo nasceu de um bug de UMA LINHA que tornava a polícia inofensiva: eles miravam em
// `player.position.y + 1.1`. O jogador tem 0,9 m de altura e a cabeça dele termina em 0,81 m — o tiro
// saía 29 cm ACIMA da cabeça, sempre, em qualquer distância. E o cano ficava em `+1,15`, 40 cm acima
// da própria cabeça do policial. Nenhum espalhamento salva uma mira que erra por construção.
//
// A raiz não é a linha, é a origem dela: essas alturas foram escritas quando o personagem media
// 1,75 m, e ficaram para trás quando ele virou 0,9 m (PLAYER_SCALE). Por isso NADA aqui é número
// solto — toda altura sai de PLAYER_HEIGHT e das MESMAS frações que definem as zonas de acerto. Se o
// personagem mudar de tamanho de novo, o combate acompanha sozinho.
import*as THREE from'three';
import{player,PLAYER_HEIGHT}from'./Player.js';
import{pontoNavegavel}from'./NavMesh.js';
import{COMBATE,ZONAS_ACERTO,FAIXAS_DISTANCIA as FAIXAS_CONFIG}from'./Config.js';
import{obterPontoNascimento,atualizarPosicaoJogador,atualizarPortasHospital,atualizarLuzesEmergencia}from'./Hospital.js';

// ===== ALTURAS DO CORPO =====
// As frações são as de ZONAS_JOGADOR/ZONAS_POLICIAL: tronco de .313 a .657, cabeça de .657 a .9.
// Mirar no CENTRO DO TRONCO é o que um atirador faz — é a maior área e a que perdoa erro vertical.
export const ALT_TORSO=PLAYER_HEIGHT*.485;
// Olho um pouco abaixo do topo da cabeça. É de onde sai o raio de visão e para onde ele aponta.
export const ALT_OLHO=PLAYER_HEIGHT*.80;
// Cano da arma na altura da mão, não da testa: é de onde a bala sai de verdade, e a diferença
// aparece em tiro rasante por cima de mureta.
export const ALT_CANO=PLAYER_HEIGHT*.52;

// ===== VELOCIDADE DO JOGADOR =====
// Alvo correndo é mais difícil de acertar que alvo parado — é metade do que faz a troca ter ritmo.
// Medida aqui e não no Player pra o combate não depender de o Player expor estado interno.
const VEL_REF=4.5;// escala do quanto o movimento atrapalha; não é um limite
let ultimaPos=new THREE.Vector3(),velocidadeJogador=0,iniciado=false;
// Vetor de velocidade, não só o módulo: é dele que sai a ANTECIPAÇÃO do tiro (mirar onde o alvo VAI
// estar, não onde ele está). Sem antecipar, um jogador andando de lado a 9 m era inatingível — medi
// 0% de acerto em 24 s de troca, e alvo impossível é tão ruim quanto alvo fácil.
export const velJogador=new THREE.Vector3();
export function atualizarCombate(dt){
  if(!iniciado){ultimaPos.copy(player.position);iniciado=true;return}
  const vx=dt>0?(player.position.x-ultimaPos.x)/dt:0;
  const vz=dt>0?(player.position.z-ultimaPos.z)/dt:0;
  // Média corrida: sem ela um único quadro engasgado (comum no celular) marcaria o jogador como
  // parado e a polícia ficaria certeira exatamente no pior momento.
  const k=Math.min(1,dt*6);
  velJogador.x+=(vx-velJogador.x)*k;
  velJogador.z+=(vz-velJogador.z)*k;
  velocidadeJogador=Math.hypot(velJogador.x,velJogador.z);
  ultimaPos.copy(player.position);
  // Atualiza posição para o hospital saber quando abrir/fechar portas
  atualizarPosicaoJogador(player.position.x,player.position.z);
}
export function velocidadeDoJogador(){return velocidadeJogador}
// Quanto da antecipação perfeita o policial acerta. 1 seria um robô que nunca erra o cálculo; 0,62
// com ruído é um atirador humano que lê o movimento, mas não perfeitamente — e é o que mantém correr
// e trocar de direção como defesa de verdade.
export const LEAD_FATOR=.62,LEAD_RUIDO=.28;

// ===== PONTARIA POR CONTEXTO =====
// Um número fixo de precisão é o que faz IA parecer sorteio. Aqui o erro sai de uma situação:
// distância, quem está se mexendo, há quanto tempo o cara está com o alvo na mira, e a ficha.
//
// As faixas de distância são a coisa mais importante do arquivo, porque são elas que decidem se a
// troca é justa: de PERTO o policial é ameaça real (se você deixa ele chegar a 4 m, você apanha), na
// MÉDIA é um duelo de verdade (acerta e erra), e de LONGE é fogo de pressão, não execução.
const FAIXAS=[
  {ate:4 ,erro:.012},// encostado: quase não erra — é o preço de deixar chegar perto
  {ate:9 ,erro:.034},// média: acerta bem, mas erra o suficiente pra dar pra jogar
  // A 0,070 o policial a 13 m acertava 4% dos tiros em 45 s de troca — isso não é "pressão", é
  // enfeite. A 0,048 fica em ~15%: ele te obriga a sair de onde está, sem te executar de longe.
  {ate:14,erro:.048},// longa: pressão de verdade, ameaça baixa
  {ate:1e9,erro:.085},
];
// Tempo com o alvo na mira até a pontaria assentar por completo.
export const MIRA_CHEIA=1.4;
// Quanto o erro é multiplicado no instante em que ele acabou de encostar o olho: 2,2x. É o que faz o
// primeiro tiro de um encontro ser o mais perdoável, como na vida.
const MIRA_FRIA=2.2;
export function espalhamentoDoTiro({dist,tempoMirando,policialAndando,procurado}){
  let erro=FAIXAS.find(f=>dist<=f.ate).erro;
  // Alvo em movimento: até +55% de erro. Era +80%, e somado à antecipação imperfeita deixava
  // jogador andando de lado INATINGÍVEL — 0% em 24 s de troca. Alvo impossível é tão ruim quanto fácil.
  erro*=1+Math.min(1,velocidadeJogador/VEL_REF)*.55;
  // Atirar andando é pior que atirar plantado — e é o que dá sentido a eles pararem pra atirar.
  if(policialAndando)erro*=1.55;
  // Mira que assenta: de MIRA_FRIA até 1,0 ao longo de MIRA_CHEIA.
  const t=THREE.MathUtils.clamp(tempoMirando/MIRA_CHEIA,0,1);
  erro*=MIRA_FRIA+(1-MIRA_FRIA)*t;
  // Ficha alta traz gente melhor: -7% de erro por estrela.
  erro*=Math.max(.55,1-.07*(procurado||0));
  return THREE.MathUtils.clamp(erro,.004,.26);
}
// Tempo de REAÇÃO entre ver e estar pronto pra atirar. Sorteado por policial pra a equipe não
// disparar toda no mesmo quadro, que é o que mais denuncia bot.
export function tempoDeReacao(){return .28+Math.random()*.42}

// ===== PAPÉIS NA EQUIPE =====
// Cinco policiais fazendo a mesma coisa ao mesmo tempo é o que faz a troca parecer script. Cada um
// recebe uma FUNÇÃO, e as funções são reavaliadas de tempos em tempos — quem estava avançando pode
// virar quem segura o fogo depois que outro morreu ou o jogador mudou de lugar.
export const PAPEL={PRESSAO:'pressao',AVANCO:'avanco',FLANCO:'flanco',COBERTURA:'cobertura'};
// Reavaliar todo quadro faria o policial mudar de ideia no meio do passo e andar em ziguezague.
const PAPEL_DURACAO=5;
// Distâncias que cada função quer manter do jogador.
export const DIST_PAPEL={pressao:11,avanco:3.5,flanco:8,cobertura:9};
export function distribuirPapeis(policiais,agora,alvoX,alvoZ){
  const vivos=policiais.filter(p=>p.vivo);
  if(!vivos.length)return;
  if(vivos[0].papelAte&&agora<vivos[0].papelAte)return;
  // Ordena por distância: quem já está perto avança, quem está longe segura o fogo. É a decisão que
  // um esquadrão de verdade toma sozinho, sem ninguém coordenar.
  vivos.sort((a,b)=>Math.hypot(a.pos.x-alvoX,a.pos.z-alvoZ)-Math.hypot(b.pos.x-alvoX,b.pos.z-alvoZ));
  vivos.forEach((pol,i)=>{
    // Com 1 policial ele avança (senão fica um sujeito sozinho fazendo fogo de pressão contra
    // ninguém). Com 2, um avança e um pressiona. Com 3+, entra flanco e cobertura.
    // A tabela tinha um buraco: com TRÊS policiais o do meio caía em `i%2===1` e virava flanco, então
    // NINGUÉM usava cobertura — e três é o tamanho mais comum de guarnição. Agora o terceiro homem é
    // sempre o que usa parede, que é o papel que faz a troca durar.
    let papel;
    if(vivos.length===1)papel=PAPEL.AVANCO;
    else if(i===0)papel=PAPEL.AVANCO;
    else if(i===vivos.length-1)papel=PAPEL.PRESSAO;
    else if(vivos.length===3)papel=PAPEL.COBERTURA;
    else papel=(i%2)?PAPEL.FLANCO:PAPEL.COBERTURA;
    pol.papel=papel;
    // Lado do flanco alternado por índice: dois flanqueadores pro mesmo lado é uma fila, não um cerco.
    pol.ladoFlanco=(i%2)?1:-1;
    pol.papelAte=agora+PAPEL_DURACAO*(.8+Math.random()*.4);
  });
}

// ===== PARA ONDE CADA UM VAI =====
// O destino sai do papel, não da posição do jogador. É o que troca "todos correm em linha reta pra
// cima de você" por gente ocupando ângulos diferentes.
const _v=new THREE.Vector3();
export function destinoDoPapel(pol,alvoX,alvoZ){
  const dx=pol.pos.x-alvoX,dz=pol.pos.z-alvoZ;
  const d=Math.hypot(dx,dz)||1;
  const querendo=DIST_PAPEL[pol.papel]||9;
  if(pol.papel===PAPEL.FLANCO){
    // Gira em torno do jogador em vez de encurtar a distância: o ângulo é a arma dele.
    const ang=Math.atan2(dx,dz)+pol.ladoFlanco*.85;
    const px=alvoX+Math.sin(ang)*querendo,pz=alvoZ+Math.cos(ang)*querendo;
    // Só flanqueia por onde DÁ pra andar. Sem esta checagem o flanqueador anda contra a parede de um
    // quarteirão a manhã inteira, que é pior que não flanquear.
    if(pontoNavegavel(px,pz))return{x:px,z:pz};
    return{x:alvoX,z:alvoZ};// sem caminho: volta a pressionar de frente
  }
  // Os outros papéis se posicionam na distância que querem, na direção em que já estão.
  const alvoD=querendo;
  return{x:alvoX+dx/d*alvoD,z:alvoZ+dz/d*alvoD};
}

// ===== COBERTURA =====
// Cobertura de verdade é um ponto de onde o jogador NÃO te vê, colado num de onde ele vê. Sem a
// segunda metade, "cobertura" vira o policial se escondendo pra sempre e a troca morre.
const DIR_COBERTURA=10,RAIOS_COBERTURA=[2.2,4,6];
const PASSO_SAIDA=1.3;
export function procurarCobertura(pol,alvoX,alvoZ,temLinhaDeVisao,alturaEm){
  let melhor=null,melhorD=Infinity;
  for(const raio of RAIOS_COBERTURA){
    for(let i=0;i<DIR_COBERTURA;i++){
      const ang=(i/DIR_COBERTURA)*Math.PI*2+pol.faseCobertura;
      const px=pol.pos.x+Math.sin(ang)*raio,pz=pol.pos.z+Math.cos(ang)*raio;
      if(!pontoNavegavel(px,pz))continue;
      const py=alturaEm(px,pz)+ALT_OLHO;
      // Protegido aqui...
      if(temLinhaDeVisao(px,py,pz,alvoX,alvoZ))continue;
      // ...e com um passo ao lado de onde dá pra atirar. É o que permite espiar e voltar.
      const perp=ang+Math.PI/2;
      const sx=px+Math.sin(perp)*PASSO_SAIDA,sz=pz+Math.cos(perp)*PASSO_SAIDA;
      if(!pontoNavegavel(sx,sz))continue;
      if(!temLinhaDeVisao(sx,alturaEm(sx,sz)+ALT_OLHO,sz,alvoX,alvoZ))continue;
      const d=Math.hypot(px-pol.pos.x,pz-pol.pos.z);
      if(d<melhorD){melhorD=d;melhor={x:px,z:pz,saidaX:sx,saidaZ:sz}}
    }
    if(melhor)break;// o raio menor já serve: cobertura longe é cobertura que não dá tempo de alcançar
  }
  return melhor;
}
