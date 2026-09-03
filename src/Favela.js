// ===== A FAVELA: rede de ruas, lotes e construção =====
//
// Este módulo nasceu depois de a favela anterior ser apagada por inteiro. As duas gerações que
// morreram tinham o mesmo defeito de fundo — eram TABULEIRO. A primeira era grade fixa; a segunda,
// fileiras empacotadas com becos sorteados. Das duas dava pra ver a grade invisível de cima.
//
// Aqui o desenho começa pela RUA, não pelo lote. Uma via principal torta sobe o morro, becos nascem
// dela, e o lote é o que sobra entre eles — que é a ordem em que uma favela cresce de verdade.
//
// ===== TRÊS NÚMEROS QUE NÃO SÃO GOSTO, SÃO LIMITE DE MOTOR =====
// Eles decidem o que dá pra construir, então estão no topo do arquivo e não escondidos no meio.
//
// 1. BECO NÃO PODE TER 1 m. A NavMesh (NavMesh.js) rasteriza obstáculos numa grade de 0,45 m e a
//    polícia só acha rota onde sobra uma célula inteira livre — 1,4 m de vão, na conta que está
//    documentada lá. Com beco de 1 m a polícia simplesmente NUNCA entra, e patrulhar o labirinto é
//    metade da graça. 2,0 m é o mínimo que ainda lê como apertado e deixa a polícia passar em fila.
//
// 2. LAJE VIZINHA NO MÁXIMO 1,40 m ACIMA. É o alcance do pulo (v²/2g = 8,2²/48, ver Player.js). Fugir
//    de laje em laje só existe se o degrau entre telhados couber num pulo, então a geração LIMITA a
//    diferença de altura entre vizinhas em vez de torcer pra dar certo.
//
// 3. TIJOLO APARENTE NÃO PODE SAIR DA TINTA DA CASA. `material.color` multiplica o mapa inteiro: um
//    remendo de tijolo pintado junto com a parede sairia azul numa casa azul. Então o tijolo é
//    GEOMETRIA SEPARADA num material sem tinta — e, como todos os remendos do mapa usam o mesmo
//    material, eles se fundem num único draw call.
export const BECO_MIN=2.0;
export const PULO_ALCANCE=1.40;
import*as THREE from'three';
import{obterElevacao}from'./Terrain.js';

// ===== SORTEIO DETERMINÍSTICO =====
// Nada aqui usa Math.random na GERAÇÃO. O jogador decora o caminho pelo morro, e um mapa que muda a
// cada carregamento tornaria isso impossível — além de tornar qualquer bug irreproduzível.
export function hashInt(a,b){let h=(Math.imul(a|0,73856093)^Math.imul(b|0,19349663))>>>0;h^=h>>>13;return h>>>0}
export const sorteio=(a,b)=>(hashInt(a,b)%100000)/100000;

// ===== A REDE DE RUAS =====
// Uma via principal que sobe o morro em S, uma via de baixo que contorna, e becos que ramificam das
// duas. As curvas são CatmullRomCurve3 com tensão .5: tensão alta com pontos de controle próximos
// produz laço, e laço numa rua vira casa dentro de casa.
export const VIA_LARGURA=5.2;
const ramais=[];

export const viaPrincipal=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-48,0, 10),
  new THREE.Vector3(-31,0, -3),
  new THREE.Vector3(-34,0,-21),
  new THREE.Vector3(-17,0,-34),
  new THREE.Vector3(  3,0,-31),
  new THREE.Vector3( 12,0,-15),
  new THREE.Vector3( 28,0,-10),
  new THREE.Vector3( 40,0,-26),
  new THREE.Vector3( 45,0,-45),
],false,'catmullrom',.5);

export const viaBaixa=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-53,0,-31),
  new THREE.Vector3(-35,0,-47),
  new THREE.Vector3(-11,0,-51),
  new THREE.Vector3( 12,0,-45),
  new THREE.Vector3( 27,0,-34),
  new THREE.Vector3( 35,0,-17),
  new THREE.Vector3( 31,0,  1),
],false,'catmullrom',.5);

// ===== O BECO =====
// Sai da via mãe DEPOIS da fileira de casas dela (senão nasceria por dentro das casas), entra no
// morro e torce. Três pontos de controle: o pé, um meio deslocado do eixo — é esse deslocamento que
// faz o beco serpentear em vez de ser um espeto — e a ponta.
function criarBeco(mae,u,lado,comprimento,semente,recuoDaMae){
  const p0=mae.getPointAt(u),t=mae.getTangentAt(u);
  const n=new THREE.Vector3(-t.z*lado,0,t.x*lado).normalize();
  const pe=p0.clone().addScaledVector(n,recuoDaMae);
  // ===== O BECO TEM QUE TORCER, E ISSO DEPENDE DE DOIS DESVIOS INDEPENDENTES =====
  // A versão anterior tinha UM sorteio só, aplicado ao meio (x1) e à ponta (x1,8), com o meio a 55% do
  // comprimento. Faça a conta: pra três pontos serem colineares, o desvio do meio teria que ser
  // 0,55 x 1,8 = 0,99 do desvio da ponta. Era 1,00. Ou seja, TODO beco do morro saía numa reta —
  // e visto de cima o bairro era uma estrela de espetos, não um labirinto. O código dizia "serpenteia"
  // e a aritmética dizia o contrário; ninguém olhou de cima até agora.
  //
  // Com dois desvios sorteados SEPARADAMENTE não existe combinação que caia numa reta por acidente, e
  // a ponta puxando pra soma dos dois fecha a curva em S em vez de deixá-la abrindo pra sempre.
  const a=(sorteio(semente,7)-.5)*comprimento*.42;
  const b=(sorteio(semente,23)-.5)*comprimento*.50;
  const emQ=(fn,ft)=>pe.clone().addScaledVector(n,comprimento*fn).addScaledVector(t,ft);
  return new THREE.CatmullRomCurve3(
    [pe,emQ(.34,a),emQ(.67,b),emQ(1,(a+b)*.55)],false,'catmullrom',.5);
}

// ===== O LOTE =====
// Um lote é DADO, não malha: posição, giro, largura, profundidade e alturas dos andares. Toda a
// construção (visual e física) sai daqui.
//
// É a separação que o projeto já pagou caro pra aprender: enquanto o colisor era medido da MALHA
// (`Box3().setFromObject`), fundir geometria pra ganhar draw call apagava o colisor junto, e uma
// fusão mal calibrada chegou a emparedar as nove portas de esconderijo sem nenhum erro aparecer.
// Com o colisor saindo do LOTE, dá pra fundir o visual à vontade que a física não se mexe.
export const lotes=[];

// Casa de morro é ESTREITA. Com 4,4-7,2 m de frente e 5 m de fundo saíam 84 sobrados espaçados num
// terreno de 100 x 60 m, e de cima lia como condomínio, não como favela. A frente encolheu pra
// 3,6-5,8 e o fundo pra 4,4: mais casas no mesmo morro, cada uma menor, encostada na vizinha.
const PROF=3.9;                       // profundidade da casa, da rua pro fundo
const LARG_MIN=3.3,LARG_MAX=5.2;
const FOLGA=.05;                      // respiro entre vizinhas na mesma fileira
const ENCOSTO=.88;                    // quanto do vão a vizinha pode invadir (parede dividida)
const FOLGA_FATIA=.16;                // erro da aproximação do retângulo girado por 4 fatias
// AABB de um retângulo w x d girado de `a`: é ela que decide o espaçamento e o recuo da rua.
export const aabbGirada=(w,d,a)=>{const c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
  return{W:w*c+d*s,D:w*s+d*c}};

// Sobreposição entre dois retângulos GIRADOS (teorema do eixo separador). Usar AABB aqui descartaria
// vizinhas legítimas: a AABB de uma casa girada 40° é quase o dobro dela, e numa curva duas casas
// lado a lado "colidiriam" sem se tocar — foi o que derrubou a densidade de 115 pra 52 na tentativa
// anterior. São 4 eixos e 8 produtos escalares por par, uma vez na geração.
const eixosDe=r=>{const c=Math.cos(r.giro),s=Math.sin(r.giro);return[[c,-s],[s,c]]};
const projeta=(r,ex,ez)=>{const c=Math.cos(r.giro),s=Math.sin(r.giro);
  return Math.abs(c*ex-s*ez)*r.lw/2+Math.abs(s*ex+c*ez)*r.ld/2};
export function retangulosSeTocam(a,b,folga=.15){
  const dx=b.x-a.x,dz=b.z-a.z;
  for(const r of[a,b])for(const[ex,ez]of eixosDe(r))
    if(Math.abs(dx*ex+dz*ez)>projeta(a,ex,ez)+projeta(b,ex,ez)+folga)return false;
  return true;
}

// Distância do centro de uma AABB W x D até a borda dela NA DIREÇÃO (dx,dz). É a função suporte da
// caixa, e é ela — não a meia-profundidade — que diz quanto a casa avança pra um lado qualquer.
const suporteAABB=(W,D,dx,dz)=>(W/2)*Math.abs(dx)+(D/2)*Math.abs(dz);
// A mesma pergunta, mas pro retângulo GIRADO: quanto a casa avança na direção (dx,dz)? Os eixos
// próprios dela no mundo são (cos,-sen) e (sen,cos) — os mesmos de `noLote`.
const suporteGirado=(larg,prof,giro,dx,dz)=>{
  const c=Math.cos(giro),sn=Math.sin(giro);
  return (larg/2)*Math.abs(dx*c-dz*sn)+(prof/2)*Math.abs(dx*sn+dz*c);
};

// Pendura lotes nos dois lados de uma curva.
//
// O RECUO USA A FUNÇÃO SUPORTE DA AABB, e a diferença entre isso e "meia-AABB" custou 15 escadões.
//
// A versão anterior deslocava o lote por `D/2` ao longo da normal da rua, com o argumento de que
// assim a AABB pararia na borda do corredor. Isso vale numa rua que corre em X ou em Z, e SÓ nelas:
// a AABB é alinhada aos eixos do MUNDO, a normal aponta pra qualquer lado, e numa rua a 45° a caixa
// avança (W+D)/(2·√2) na direção da normal — bem mais que D/2. O resultado é a quina da AABB
// entrando na rua, e como a AABB é o colisor, a rua fecha.
//
// Não era teoria: 15 dos 40 escadões do morro terminavam sem chão livre numa das pontas — escada de
// beco dando em parede. Com a função suporte, a largura livre passa a ser garantida por construção
// em QUALQUER ângulo, que é o que a versão anterior afirmava fazer e não fazia.
function pendurarLotes(curva,larguraDaVia,semente){
  const total=curva.getLength();
  for(const lado of[-1,1]){
    // Os dois lados começam em pontos diferentes, senão as fileiras nascem espelhadas e o beco vira
    // um corredor de casas pareadas — o defeito que matou as duas gerações anteriores.
    let s=2.2+sorteio(semente,lado+11)*3.5;
    for(let k=0;k<70&&s<total-3;k++){
      const sem=hashInt(semente*997+k,lado);
      const larg=LARG_MIN+((sem%1000)/1000)*(LARG_MAX-LARG_MIN);
      const u=s/total;
      const p=curva.getPointAt(u),t=curva.getTangentAt(u);
      const nx=-t.z*lado,nz=t.x*lado;
      // A FRENTE olha pra rua: o +z local da casa aponta pra curva, ou seja, a normal invertida.
      //
      // ...MAS SÓ ATÉ A METADE DO CAMINHO. O colisor é a AABB da casa girada, e AABB de retângulo a
      // 45° é 1,45x o retângulo — numa rua diagonal isso vira recuo enorme, espaçamento enorme, e o
      // morro esvazia (medido: 109 casas caíram pra 50 quando o corredor passou a ser respeitado de
      // verdade). Torcer a casa METADE do ângulo da rua corta esse inchaço pela metade.
      //
      // E o resultado LÊ MELHOR, não pior: casa de morro não é paralela ao beco: cada uma está um
      // pouco atravessada, porque foi levantada no terreno que sobrou. A casa continua de frente pra
      // rua (no máximo 22,5° fora dela) e o quarteirão ganha o desalinho que o alinhamento perfeito
      // não tinha.
      const giroRua=Math.atan2(-nx,-nz);
      const cardeal=Math.round(giroRua/(Math.PI/2))*(Math.PI/2);
      const giro=(giroRua+cardeal)/2;
      const{W,D}=aabbGirada(larg,PROF,giro);
      // O recuo é o quanto a CASA avança na direção da rua, mais a folga da aproximação por fatias.
      //
      // Ele já foi D/2 (errado: D é da AABB, alinhada ao mundo, e a rua aponta pra qualquer lado) e
      // depois o suporte da AABB (certo, mas caro — a AABB é 57 cm maior que a casa de cada lado, e
      // recuar por ela empurra a fileira inteira pra longe da rua). Agora que o COLISOR são fatias que
      // seguem o retângulo girado, o recuo pode ser o do próprio retângulo: é onde a parede está.
      //
      // E não é PROF/2: a casa é torcida METADE do ângulo da rua, então ela não olha exatamente pra
      // ela — chega a 22,5° de diferença, o que soma 71 cm ao avanço. Usar PROF/2 aqui derrubou a
      // favela de 127 casas pra 6 num teste, porque toda casa invadia o próprio corredor.
      const off=larguraDaVia/2+suporteGirado(larg,PROF,giro,nx,nz)+FOLGA_FATIA;
      lotes.push({x:p.x+nx*off,z:p.z+nz*off,giro,larg,prof:PROF,W,D,curva,u,lado,sem});
      // Avança pelo que a casa ocupa NA DIREÇÃO DA RUA, vezes ENCOSTO. O fator existe porque casa de
      // favela DIVIDE PAREDE com a vizinha, e avançar pelo vão inteiro deixava uma fresta de terra
      // batida entre cada duas casas: de cima o morro lia como loteamento, não como morro.
      s+=2*suporteGirado(larg,PROF,giro,t.x,t.z)*ENCOSTO+FOLGA;
    }
  }
}

// ===== MONTA A REDE E OS LOTES =====
export const becos=[];
// Cada via e cada beco com a LARGURA que foi usada pra pendurar lote nele. É essa lista que a poda
// consulta pra manter o corredor aberto — ver `corredorInvadido`.
export const corredores=[];

// ===== BECO PRECISA DE TERRA PRA CHAMAR DE SUA =====
// Uma medição, e ela decidiu o desenho do morro: com 59 corredores e 1.233 m de rua numa área de
// 100 x 70 m, 246 dos 318 lotes gerados morriam por invadir corredor. Sobravam 62 casas espalhadas —
// tudo rua, nenhum quarteirão. Não era a poda que estava errada: era a REDE.
//
// Uma faixa de beco ocupa ~13 m: 2,4 m de passagem mais uma casa de cada lado. Dois becos a menos que
// isso um do outro não formam dois becos com casas, formam um descampado com duas trilhas. Então o
// beco novo só entra se mantiver distância dos que já existem — e o pé dele não conta, porque o pé
// nasce colado na via mãe por definição.
//
// 8 m é o número medido, não o número da conta. Varrendo de 10,5 a 6,6 m: em 10,5 são 13 becos e 102
// casas; em 8,0 são 19 becos e 111 casas; abaixo disso a rede para de crescer (o próprio traçado não
// tem onde pôr mais beco) e só a poda por corredor sobe. 8 m é o ponto em que o morro tem o maior
// número de becos que ainda cabem COM casa dos dois lados.
const ESPACO_ENTRE_BECOS=8.0;
const AMOSTRAS_BECO=9;
// `mae` fica de fora da conta: é NELA que o beco nasce, e agora ele nasce ENCOSTADO nela. Medir
// distância até a mãe rejeitava justamente os becos bem plantados — a densidade caiu de 21 corredores
// pra 14 e de 119 casas pra 86 no primeiro teste depois que a boca passou a encostar na rua.
function becoCabe(candidato,jaAceitos,mae){
  for(let i=Math.ceil(AMOSTRAS_BECO*.25);i<=AMOSTRAS_BECO;i++){
    const p=candidato.getPointAt(i/AMOSTRAS_BECO);
    for(const{curva,meia}of jaAceitos){
      if(curva===mae)continue;
      const n=Math.max(2,Math.round(curva.getLength()/2));
      for(let k=0;k<=n;k++){
        const q=curva.getPointAt(k/n);
        // A via é larga, então a distância mínima até ela cresce junto: encostar num beco a 10,5 m é
        // uma coisa, encostar na via principal a 10,5 m deixa meia casa de fileira.
        if(Math.hypot(q.x-p.x,q.z-p.z)<ESPACO_ENTRE_BECOS+(meia-BECO_MIN/2))return false;
      }
    }
  }
  return true;
}
{
  // Becos ramificando das duas vias, alternando de lado.
  //
  // O PÉ DO BECO ENCOSTA NA RUA. Ele começava 9 m adiante — a largura da via mais uma casa inteira —
  // "pra não nascer por dentro da fileira da via mãe". O efeito, visto de cima, é que nenhum beco do
  // morro tocava a rua: cada um começava atrás de uma casa, com uma faixa de terra batida no meio.
  // Beco que não desemboca na rua não é beco.
  // O medo que gerou aquele recuo já não existe: a poda protege TODO corredor contra TODO lote (ver
  // `corredorInvadido`), então a casa da via que estivesse na boca do beco simplesmente não nasce — e
  // o que sobra é o vão entre duas casas, que é exatamente como uma boca de beco se parece.
  //
  // Gera MUITO candidato e aceita poucos: sortear posição boa de primeira num traçado em curva é
  // difícil, e testar é barato. Os aceitos ficam espalhados ao longo da via em vez de amontoados.
  const recuo=VIA_LARGURA/2+.6;
  const aceitos=[{curva:viaPrincipal,meia:VIA_LARGURA/2},{curva:viaBaixa,meia:VIA_LARGURA/2}];
  for(const[mae,quantos,marca]of[[viaPrincipal,32,0],[viaBaixa,26,500]]){
    for(let i=0;i<quantos;i++){
      const u=.08+(i/(quantos-1))*.84+(sorteio(i+marca,31)-.5)*.04;
      const b=criarBeco(mae,u,(i%2)?1:-1,13+sorteio(i+marca,53)*15,i+marca,recuo);
      if(!becoCabe(b,aceitos,mae))continue;
      becos.push(b);aceitos.push({curva:b,meia:BECO_MIN/2});
    }
  }
}
const BECO_LARGURA=BECO_MIN+.4;
// BECO QUE SAI DE BECO. Um morro não tem só ruas e travessas — tem a travessa da travessa, que é
// como o miolo do quarteirão fica acessível em vez de virar um bloco maciço. Sai do MEIO do beco mãe,
// curto, e alterna de lado.
{
  const aceitos=[{curva:viaPrincipal,meia:VIA_LARGURA/2},{curva:viaBaixa,meia:VIA_LARGURA/2},
                 ...becos.map(c=>({curva:c,meia:BECO_MIN/2}))];
  for(let i=0;i<becos.length;i++){
    const b=becos[i];
    if(b.getLength()<11)continue;
    const filho=criarBeco(b,.5,(i%2)?1:-1,7+sorteio(i,71)*7,i+900,BECO_MIN/2+.5);
    if(!becoCabe(filho,aceitos,b))continue;
    becos.push(filho);aceitos.push({curva:filho,meia:BECO_MIN/2});
  }
}
pendurarLotes(viaPrincipal,VIA_LARGURA,1);
pendurarLotes(viaBaixa,VIA_LARGURA,2);
becos.forEach((b,i)=>pendurarLotes(b,BECO_LARGURA,100+i));
corredores.push({curva:viaPrincipal,meia:VIA_LARGURA/2},{curva:viaBaixa,meia:VIA_LARGURA/2});
for(const b of becos)corredores.push({curva:b,meia:BECO_LARGURA/2});

// ===== O CORREDOR NÃO PODE SER TAPADO =====
// `pendurarLotes` afasta cada lote da SUA curva, então o corredor dela nasce livre. O que ele não
// sabe é que existem outras 23 curvas: uma casa da via principal não tinha nada que a impedisse de
// nascer bem em cima de um beco que passa atrás dela.
//
// O efeito não era sutil — 15 dos 40 escadões terminavam sem chão livre em uma das pontas, ou seja
// escada de beco que dá numa parede. É o contrário do "favela totalmente acessível, todos os cantos"
// que foi pedido, e nenhum teste pegava porque nenhum teste andava por um beco.
//
// A conta é a mesma da rua: o corredor tem que sobrar livre CONTRA A AABB do lote, que é o que a
// física enxerga. A margem de 5 cm é o que impede o lote de rejeitar o próprio corredor por erro de
// arredondamento — ele nasce encostando exatamente na borda dele.
const AMOSTRA_CORREDOR=1.0;
const amostrasCorredor=[];
for(const{curva,meia}of corredores){
  const total=curva.getLength(),n=Math.max(2,Math.round(total/AMOSTRA_CORREDOR));
  for(let i=0;i<=n;i++){const p=curva.getPointAt(i/n);amostrasCorredor.push(p.x,p.z,meia-.05)}
}
// A distância é a EUCLIDIANA até a caixa, não "cabe na caixa inflada em cada eixo". Inflar os dois
// eixos em r faz a quina da caixa alcançar r·√2, e com isso todo lote de rua diagonal rejeitava o
// próprio corredor — a poda passou de 109 casas pra 8. O corredor é um TUBO de raio r em volta do
// eixo da rua, e tubo se testa com distância, não com retângulo.
function corredorInvadido(l){
  // Distância ao RETÂNGULO GIRADO, que é onde a parede está de verdade agora que o colisor a segue por
  // fatias. Contra a AABB o teste era conservador demais e sozinho derrubava a densidade do morro.
  const c=Math.cos(l.giro),sn=Math.sin(l.giro),hw=l.larg/2+FOLGA_FATIA,hd=l.prof/2+FOLGA_FATIA;
  for(let i=0;i<amostrasCorredor.length;i+=3){
    const px=amostrasCorredor[i]-l.x,pz=amostrasCorredor[i+1]-l.z,r=amostrasCorredor[i+2];
    const lx=px*c-pz*sn,lz=px*sn+pz*c;
    const dx=Math.max(0,Math.abs(lx)-hw),dz=Math.max(0,Math.abs(lz)-hd);
    if(dx*dx+dz*dz<r*r)return true;
  }
  return false;
}

// ===== PODA =====
// A rede gera de propósito MAIS lote do que cabe, e aqui o excesso cai. É como um gerador de cidade
// trabalha: gerar demais e podar é muito mais simples do que tentar acertar de primeira num traçado
// em curva, onde duas ruas podem se cruzar.
//
// Cada lote reserva TRÊS retângulos, e é a folga da porta que mais importa: sem ela, uma casa de
// outro beco nasce colada na entrada e o esconderijo fica inacessível — cinco dos nove ficaram assim
// na tentativa anterior, sem nenhum erro aparecer.
const FOLGA_PORTA=1.9;
const corpoDe=l=>({x:l.x,z:l.z,giro:l.giro,lw:l.larg,ld:l.prof});
// O RETÂNGULO QUE A FÍSICA ENXERGA, que NÃO é o corpo da casa. O colisor é a AABB do retângulo
// girado (ver o bloco de colisores lá embaixo), e ela é maior que a casa. Testar a folga da porta
// contra o corpo deixava passar vizinha cuja casa não encosta na entrada mas cujo COLISOR encosta —
// e o efeito é exatamente o que o teste `entrar.mjs` pegou: um dos nove esconderijos com a porta
// emparedada por uma casa que, olhando, está claramente afastada dela.
const colisorDe=l=>({x:l.x,z:l.z,giro:0,lw:l.W,ld:l.D});
const portaDe=l=>({x:l.x+Math.sin(l.giro)*(l.prof/2+FOLGA_PORTA/2),
                   z:l.z+Math.cos(l.giro)*(l.prof/2+FOLGA_PORTA/2),
                   giro:l.giro,lw:1.8,ld:FOLGA_PORTA});
// Contagem de quem morre em cada regra. "A favela ficou vazia" sem esta conta vira chute sobre qual
// das três podas apertar — e as três apertam por motivos diferentes.
export const diagnosticoDaPoda={gerados:0,porCorredor:0,porVizinha:0,porPorta:0,aceitos:0};
{
  const aceitos=[];
  diagnosticoDaPoda.gerados=lotes.length;
  for(const l of lotes){
    l.corpo=corpoDe(l);
    const porta=portaDe(l);
    if(corredorInvadido(l)){diagnosticoDaPoda.porCorredor++;continue}
    // FOLGA NEGATIVA: duas casas podem se INTERPENETRAR 12 cm. Não é descuido — é parede dividida, que
    // é como a casa de morro encosta na vizinha. Com folga positiva sobrava sempre uma fresta de terra
    // entre cada duas casas, e 40 lotes bons morriam por "encostar" em quem eles deviam encostar.
    if(aceitos.some(a=>retangulosSeTocam(l.corpo,a.corpo,-.12))){diagnosticoDaPoda.porVizinha++;continue}
    if(aceitos.some(a=>retangulosSeTocam(porta,colisorDe(a),0)
                     ||retangulosSeTocam(portaDe(a),colisorDe(l),0))){diagnosticoDaPoda.porPorta++;continue}
    aceitos.push(l);
  }
  diagnosticoDaPoda.aceitos=aceitos.length;
  lotes.length=0;lotes.push(...aceitos);
}

// ===== ONDE O BECO VIRA ESCADÃO =====
// A escadaria não é mais um apêndice colado na lateral de uma casa. Essa era a ideia antiga e ela
// não sobrevive a terreno orgânico: medi o jogador andando SOBRE A SAIA da escada em vez dos degraus,
// e a laje ficando 3 m acima do fim da subida.
// Agora o degrau é DA RUA. Onde o próprio beco sobe mais que ESCADAO_DECLIVE por metro, aquele trecho
// vira escadão de concreto — que é como o morro resolve isso na vida real, e o que o jogador espera
// ver. Como o escadão é chão, ele entra em `superficiesAndaveis` e a NavMesh continua enxergando
// passagem: a polícia sobe atrás.
export const escadoes=[];
const ESCADAO_DECLIVE=.30,ESCADAO_PASSO=1.1;
for(const beco of becos){
  const total=beco.getLength(),passos=Math.max(2,Math.round(total/ESCADAO_PASSO));
  let trecho=null;
  for(let i=0;i<passos;i++){
    const a=beco.getPointAt(i/passos),b=beco.getPointAt((i+1)/passos);
    const ha=obterElevacao(a.x,a.z),hb=obterElevacao(b.x,b.z);
    const d=Math.hypot(b.x-a.x,b.z-a.z)||1;
    const declive=Math.abs(hb-ha)/d;
    if(declive>ESCADAO_DECLIVE){
      if(!trecho)trecho={de:a.clone(),hDe:ha,ate:b.clone(),hAte:hb};
      else{trecho.ate=b.clone();trecho.hAte=hb}
    }else if(trecho){escadoes.push(trecho);trecho=null}
  }
  if(trecho)escadoes.push(trecho);
}

// ===== OS ANDARES: PUXADINHO, NÃO CUBO =====
// Cada casa tem de 1 a 3 volumes empilhados, e o de cima é sempre MENOR e RECUADO — é o recuo que
// cria a laje/varanda que a referência mostra, e é ele que dá a silhueta de puxadinho em vez de
// caixa. O recuo vai sempre pro fundo, então a frente dos andares fica alinhada na rua e a laje sobra
// atrás, olhando o morro.
//
// A TRAVA DO PULO. O jogador alcança 1,40 m (v²/2g, ver Player.js), e fugir de laje em laje só existe
// se o degrau entre telhados vizinhos couber nisso. Então a altura de cada casa não é sorteada solta:
// ela é sorteada e depois PUXADA pra perto da vizinha mais próxima já resolvida, até caber no pulo.
// Sem isso o parkour seria sorte, e sorte que falha em silêncio é o pior tipo de defeito.
const ANDAR_ALT=2.55,RECUO_ANDAR=1.15;
export function alturaDaLaje(l){return l.baseY+l.andares*ANDAR_ALT+.12}
// A soleira precisa ser recalculada sempre que o lote muda de orientação. Os esconderijos são
// alinhados a um eixo cardeal depois da primeira seleção; usar a cota calculada antes dessa rotação
// deixa a porta numa cota antiga e faz a casa parecer flutuar ou afundar no barranco.
function baseYDaSoleira(l){
  let soleira=-Infinity;
  for(const u of[-.5,-.25,0,.25,.5])for(const fora of[0,1.0]){
    const p=noLote(l,u*l.larg,l.prof/2+fora);
    soleira=Math.max(soleira,obterElevacao(p.x,p.z));
  }
  return soleira;
}
{
  for(const l of lotes){
    // A casa se assenta pela SOLEIRA, não pelo centro: numa encosta de 19° o centro pode estar mais
    // de um metro acima do terreno na frente da porta, e o passo do jogador é 0,22 m — a porta ficava
    // intransponível. Medido: 1,34 m de degrau na soleira antes desta correção.
    //
    // E pelo PONTO MAIS ALTO da soleira, não pelo ponto do meio dela. Com um ponto só, a casa afundava
    // no barranco quando o terreno subia logo à frente: numa foto o térreo inteiro tinha sumido na
    // terra e sobrava o telheiro saindo do chão, sem porta nenhuma embaixo. Sete amostras ao longo da
    // fachada, e uma delas 1 m à frente da porta — a soleira fica acima de todas, e o desnível do
    // outro lado quem resolve é o `afundar` da parede.
    l.baseY=baseYDaSoleira(l);
    l.andares=1+(l.sem%100<42?0:l.sem%100<82?1:2);// 42% térrea, 40% dois, 18% três
  }
  // Puxa a altura pra caber no pulo, do lote mais baixo pro mais alto.
  const porAltura=[...lotes].sort((a,b)=>a.baseY-b.baseY);
  for(let i=0;i<porAltura.length;i++){
    const l=porAltura[i];
    let vizinha=null,melhor=Infinity;
    for(let j=0;j<i;j++){
      const o=porAltura[j],d=Math.hypot(o.x-l.x,o.z-l.z);
      if(d<9&&d<melhor){melhor=d;vizinha=o}
    }
    if(!vizinha)continue;
    const alvo=alturaDaLaje(vizinha);
    // Escolhe o número de andares cuja laje fica mais perto da vizinha, sem passar do pulo.
    let melhorN=l.andares,melhorDif=Infinity;
    for(let n=1;n<=3;n++){
      const dif=Math.abs((l.baseY+n*ANDAR_ALT+.12)-alvo);
      if(dif<melhorDif){melhorDif=dif;melhorN=n}
    }
    if(melhorDif<=PULO_ALCANCE)l.andares=melhorN;
  }
}

// ===== O QUE OS OUTROS MÓDULOS LEEM =====
// Pontos de ronda amostrados nas CURVAS DE VERDADE. Já existiu aqui uma lista de quatro corredores
// com coordenada fixa no código; quando o traçado mudou, morador e polícia passaram meses rondando
// linhas que só existiam no arquivo. Amostrar a curva é o que impede isso de voltar.
export const pontosDeRonda=[];
function amostrar(curva){
  const total=curva.getLength(),n=Math.max(2,Math.round(total/6));
  for(let i=0;i<=n;i++){const p=curva.getPointAt(i/n);pontosDeRonda.push({x:p.x,z:p.z})}
}
amostrar(viaPrincipal);amostrar(viaBaixa);becos.forEach(amostrar);

// ===== CONSTRUÇÃO =====
// A regra de ouro do projeto: VISUAL COMPLEXO ≠ FÍSICA COMPLEXA. Aqui isso é literal — nada do que
// vem abaixo cria colisor. A física sai dos LOTES, mais adiante, e por isso a geometria pode ser
// fundida à vontade.
//
// Duas técnicas, cada uma onde é a certa:
//   · mergeGeometries pro que VARIA de tamanho (paredes, lajes, muretas, remendos de tijolo): vira
//     uma malha por material, com a posição já assada nos vértices.
//   · InstancedMesh pro que é IDÊNTICO e se repete (porta, janela, caixa d'água, telha ondulada):
//     uma malha e uma matriz por cópia.
// Sem isso a favela anterior chegou a 2.116 malhas na cena com 2.110 geometrias distintas.
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import{matReboco,matTelha,tijolo,concreto,janela,janelaAcesa,molduraJanela,porta,agua,posteMat,
  matMadeira,graffiteMat,bmat,uvPorMetro}from'./Materials.js';

export const favela=new THREE.Group();

// Acumuladores por material: a geometria entra aqui e no fim vira UMA malha por lista.
// Duas pilhas, não uma. A ANDÁVEL é o que o jogador pisa (laje, escadão) e vira `superficiesAndaveis`,
// onde o Player.js dispara um raycast pra baixo TODO QUADRO. Separar não é organização: é o que faz
// esse raio testar ~1.300 triângulos de laje em vez dos ~40.000 do bairro inteiro fundido junto.
const pilhas=new Map(),pilhasAndaveis=new Map();
// Materiais que projetam sombra. Marcar por material (e não por malha) porque depois da fusão só
// existe UMA malha por material — a decisão tem que ser tomada aqui, antes.
const MAT_SOMBRA=new Set();
function acumularPronta(material,geo,andavel=false){
  const alvo=andavel?pilhasAndaveis:pilhas;
  if(!alvo.has(material))alvo.set(material,[]);
  alvo.get(material).push(geo);
}
function acumular(material,geo,x,y,z,giro=0,andavel=false,mpm=2){
  uvPorMetro(geo,mpm);
  if(giro)geo.rotateY(giro);
  geo.translate(x,y,z);
  acumularPronta(material,geo,andavel);
}
// Caixa girada em torno de Y, posicionada no mundo. É o tijolo básico de tudo aqui.
function caixa(material,lw,lh,ld,x,y,z,giro,andavel=false,mpm=2){
  acumular(material,new THREE.BoxGeometry(lw,lh,ld),x,y,z,giro,andavel,mpm);
}
// Ponto local (à direita, à frente) de um lote convertido pro mundo.
function noLote(l,dx,dz){
  const c=Math.cos(l.giro),s=Math.sin(l.giro);
  return{x:l.x+dx*c+dz*s,z:l.z-dx*s+dz*c};
}
// Caixa posicionada em coordenadas LOCAIS do lote (dx à direita, dz à frente, y absoluto).
function caixaNoLote(l,material,lw,lh,ld,dx,dz,y,andavel=false,mpm=2){
  const p=noLote(l,dx,dz);
  caixa(material,lw,lh,ld,p.x,y,p.z,l.giro,andavel,mpm);
}

// ===== A CASA =====
// Volumes empilhados, o de cima recuado pro fundo. Cada andar leva reboco tingido com a cor da casa;
// os REMENDOS DE TIJOLO entram como geometria separada no material `tijolo`, que não tem tinta — é a
// única forma de ter tijolo vermelho de verdade numa casa pintada de azul.
// Paleta da referência: rosa-salmão, azul-piscina desbotado, verde-menta, creme, amarelo-ovo,
// cimento cru. Os tons escuros e terrosos que estavam aqui (0x7d6b57, 0x8a6f5a) multiplicavam o mapa
// de reboco e a parede saía CAMUFLAGEM marrom — o defeito que o Bruno apontou duas vezes.
// Tinta de morro é barata e clara; o que escurece a parede é a sujeira, e essa já vem da textura.
const CORES_PAREDE=[0xd9a08c,0xa9c4c6,0xb9c7a4,0xdcd0b4,0xd8c47e,0xc0bcb2,0xcf9f9a,0x9fb4c4];
const CORES_TELHA=[0xb8b2a8,0xa8a49c,0xc0b09c,0x9e9a92,0xb0a08c];
const ESP_MURETA=.14,ALT_MURETA=.5;

// Instâncias: acumuladas como matrizes e viradas em InstancedMesh no fim.
const instancias=new Map();
function instanciar(chave,geo,material,matriz){
  if(!instancias.has(chave))instancias.set(chave,{geo,material,ms:[]});
  instancias.get(chave).ms.push(matriz.clone());
}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_s=new THREE.Vector3(1,1,1);
function matrizEm(x,y,z,giro,escala=1){
  _e.set(0,giro,0);_q.setFromEuler(_e);_v.set(x,y,z);_s.set(escala,escala,escala);
  return _m.compose(_v,_q,_s);
}

const GEO_JANELA=new THREE.BoxGeometry(.92,.78,.06);
const GEO_MOLDURA=new THREE.BoxGeometry(1.06,.92,.05);
const GEO_CAIXA_DAGUA=new THREE.CylinderGeometry(.36,.36,.6,10);
[GEO_JANELA,GEO_MOLDURA].forEach(uvPorMetro);

function construirCasa(l){
  const cor=CORES_PAREDE[l.sem%CORES_PAREDE.length];
  const corTelha=CORES_TELHA[(l.sem>>3)%CORES_TELHA.length];
  const reboco=matReboco(cor),telha=matTelha(corTelha);
  MAT_SOMBRA.add(reboco);MAT_SOMBRA.add(telha);
  let larg=l.larg,prof=l.prof,y=l.baseY,recuoAcumulado=0;

  for(let andar=0;andar<l.andares;andar++){
    const alt=ANDAR_ALT;
    // ===== O ANDAR NASCE EM TIJOLO OU EM REBOCO =====
    // Esta é a leitura número um da referência, e ela não vem de textura nova: metade de um morro de
    // verdade NUNCA foi rebocada. A casa sobe, o dinheiro acaba, e o andar fica em tijolo à vista por
    // anos — é comum o térreo estar pintado e o de cima cru, porque foi levantado depois.
    //
    // O tijolo é o material `tijolo`, que NÃO tem tinta (0xffffff). Isso é obrigatório: `material.color`
    // multiplica o mapa inteiro, então tijolo pintado com a cor da casa sairia azul numa casa azul.
    // Como todo tijolo do morro divide o mesmo material sem tinta, tudo isso é UM draw call.
    // O andar de cima tem chance MAIOR de estar cru que o térreo, que é a ordem em que se constrói.
    const cru=((l.sem>>(andar*5))%100)<(andar===0?30:58);
    const pele=cru?tijolo:reboco;
    const MPM_PAREDE=1.4;// ladrilho de 1,4 m: a 2 m a placa de reboco caída virava mancha de camuflagem
    // O andar de cima recua PRO FUNDO: a frente segue alinhada na rua e sobra laje atrás.
    const centro=noLote(l,0,-recuoAcumulado/2);
    // A parede do térreo desce até o ponto mais baixo do lote — é o que impede a casa de flutuar no
    // barranco, e o que vira "pilar/parede de tijolo descendo até o chão" visto de fora.
    let alturaParede=alt,centroY=y+alt/2;
    if(andar===0){
      // A PAREDE DESCE ATÉ ABAIXO DO CHÃO EM VOLTA, não até a quina do lote.
      //
      // Amostrar só as quatro quinas dava casa BOIANDO no barranco — e foi o que apareceu na foto: a
      // fiada de tijolo terminando no ar, com o morro caindo por baixo. O terreno não para na divisa
      // do lote; ele continua descendo, e num barranco de 19° cada metro a mais come 34 cm.
      // Amostrando um anel 1,4 m PRA FORA da casa, a parede alcança o chão que o jogador vê ao lado
      // dela. Custa 12 consultas de altura por casa, uma vez, no carregamento.
      let menor=y;
      for(const sx of[-1,1])for(const sz of[-1,1])for(const fora of[0,1.4]){
        const p=noLote(l,sx*(larg/2+fora),sz*(prof/2+fora));
        menor=Math.min(menor,obterElevacao(p.x,p.z));
      }
      for(const[dx,dz]of[[0,prof/2+1.4],[0,-prof/2-1.4],[larg/2+1.4,0],[-larg/2-1.4,0]]){
        const p=noLote(l,dx,dz);menor=Math.min(menor,obterElevacao(p.x,p.z));
      }
      const afundar=Math.max(0,y-menor)+.25;
      alturaParede=alt+afundar;centroY=y+alt/2-afundar/2;
    }
    caixa(pele,larg,alturaParede,prof,centro.x,centroY,centro.z,l.giro,false,MPM_PAREDE);

    // REMENDOS DE TIJOLO. Placas finas coladas na fachada, sorteadas por andar. Material sem tinta,
    // então o vermelho é vermelho em qualquer casa — e todas as placas do mapa viram um draw call.
    // ===== AS QUATRO FACES, NÃO SÓ A DA RUA =====
    // Remendo, infiltração e janela só existiam na fachada. De dentro do beco isso não aparece — mas
    // do barranco ao lado a casa era um bloco liso de uma cor só, e foi assim que ela apareceu na
    // foto. Casa de morro não tem "fundo": o vizinho de trás vê a mesma parede encardida que a rua vê.
    //
    // `ponto(u,fora)` devolve o mundo a partir de coordenadas DA FACE: u corre ao longo dela, `fora`
    // afasta da parede. Com isso o mesmo código serve pras quatro sem repetir a conta do giro.
    const faces=[
      {giro:l.giro,          eixo:'z',sinal: 1,vao:larg,rua:true },// fachada, olhando a rua
      {giro:l.giro+Math.PI,  eixo:'z',sinal:-1,vao:larg,rua:false},// fundo
      {giro:l.giro+Math.PI/2,eixo:'x',sinal: 1,vao:prof,rua:false},// lateral direita
      {giro:l.giro-Math.PI/2,eixo:'x',sinal:-1,vao:prof,rua:false},// lateral esquerda
    ];
    // Os andares superiores recuam para o fundo. Todas as peças aplicadas na fachada precisam usar
    // exatamente o mesmo deslocamento; sem isso janelas, molduras e remendos ficam suspensos à frente
    // da parede recuada, sobretudo no terceiro andar.
    const recuoDaFace=-recuoAcumulado/2;
    const pontoDaFace=(f,u,fora)=>f.eixo==='z'
      ? noLote(l,u*f.sinal,f.sinal*(prof/2+fora)+recuoDaFace)
      : noLote(l,f.sinal*(larg/2+fora),-u*f.sinal+recuoDaFace);

    // REMENDOS. Numa parede rebocada é o tijolo aparecendo onde o reboco caiu; numa parede crua é o
    // contrário, a mancha de reboco de quem começou a rebocar e parou. Os dois lados da mesma moeda,
    // e é essa alternância que impede o morro de virar duas listas de casas iguais.
    const remendo=cru?reboco:tijolo;
    for(let fi=0;fi<faces.length;fi++){
      const f=faces[fi];
      const nRemendos=(l.sem>>(andar*3+fi))%3;// 0 a 2 por face: nem toda parede tem remendo
      for(let r=0;r<nRemendos;r++){
        const h=hashInt(l.sem+andar*31+fi*97,r*7);
        const lw=.6+((h%100)/100)*Math.min(1.3,f.vao*.5),lh=.5+(((h>>5)%100)/100)*1.1;
        const pu=(((h>>11)%100)/100-.5)*Math.max(.2,f.vao-lw-.3);
        const py=y+.2+(((h>>17)%100)/100)*Math.max(.2,alt-lh-.4);
        const p=pontoDaFace(f,pu,.025);
        caixa(remendo,lw,lh,.05,p.x,py+lh/2,p.z,f.giro,false,MPM_PAREDE);
      }
      // Infiltração: faixa escura rente ao chão do andar, nas quatro faces. É o que dá o "pé sujo"
      // que toda parede de alvenaria térrea tem.
      const b=pontoDaFace(f,0,.02);
      caixa(concreto,f.vao*.96,.35,.04,b.x,y+.17,b.z,f.giro);
    }

    // Porta só no térreo, e só na fachada.
    if(andar===0){
      // A PORTA VAI PELA FUSÃO, NÃO PELA INSTANCIAÇÃO — e isso foi medido, não escolhido.
      //
      // Instanciada, ela saía PRETA (RGB 1,1,1) numa fachada clara. O diagnóstico levou quatro passos:
      // a malha estava no lugar (troquei o material por um MeshBasic vermelho e ela ficou vermelha);
      // o material era o certo e estava íntegro (mapas carregados, uv1 presente, metalness efetiva
      // 0,009); e não era sombra (desliguei projetar e receber, continuou preta). Ou seja: geometria
      // certa, material certo, e zero luz chegando.
      //
      // A porta era a ÚNICA InstancedMesh do jogo com material PBR texturizado completo — todas as
      // outras instâncias (janela, moldura, caixa d'água, poste, cadeira) usam material liso. Não
      // fechei o mecanismo exato dentro do three; o que está medido é que a MESMA porta, no MESMO
      // lugar, com o MESMO material, sai preta pelo caminho instanciado e sai de madeira pelo caminho
      // fundido (54,38,30). Como são ~119 portas idênticas, fundir custa um draw call — o mesmo que
      // instanciar — então não há o que defender do outro lado.
      const p=noLote(l,0,prof/2+.05);
      caixa(porta,.95,2.05,.09,p.x,y+1.025,p.z,l.giro);
      // Telheiro de zinco sobre a porta, inclinado pra frente. É o detalhe que mais aparece na
      // referência depois do tijolo, e na horizontal não lê como telheiro — lê como prateleira.
      //
      // E de perfil ele LIA como prateleira mesmo: 6 cm de chapa saindo da parede sem nada segurando,
      // visto de lado no barranco, é uma tábua flutuando. Chapa mais grossa e DUAS MÃOS-FRANCESAS
      // embaixo resolvem — é o que sustenta um telheiro de verdade, e é o que o olho procura.
      const t=noLote(l,0,prof/2+.47);
      const gt=new THREE.BoxGeometry(1.6,.09,.95);
      uvPorMetro(gt);gt.rotateX(.2);
      gt.rotateY(l.giro);gt.translate(t.x,y+2.34,t.z);
      acumularPronta(telha,gt);
      const madeira=matMadeira(0x6b4a30);
      for(const sx of[-.62,.62]){
        const m=noLote(l,sx,prof/2+.26);
        const gm=new THREE.BoxGeometry(.07,.07,.62);
        uvPorMetro(gm);gm.rotateX(-.72);// escora em diagonal, da parede pra ponta do telheiro
        gm.rotateY(l.giro);gm.translate(m.x,y+2.12,m.z);
        acumularPronta(madeira,gm);
      }
    }
    // JANELAS: duas na fachada sempre; nas outras faces uma, e só se a parede tiver vão pra ela e o
    // sorteio mandar. Janela em toda face de toda casa deixa o morro com cara de prédio de escritório
    // — e são 119 casas x 3 andares, então o que se sorteia aqui aparece muito.
    for(const f of faces){
      const posicoes=f.rua?[-.28,.28]:(((hashInt(l.sem+andar,Math.round(f.giro*10))%100)<58&&f.vao>2.6)?[0]:[]);
      for(const frac of posicoes){
        const p=pontoDaFace(f,frac*f.vao,.025);
        const acesa=((hashInt(l.sem+andar,Math.round(f.giro*10)+(frac>0?1:0)))%100)<22;
        instanciar('moldura',GEO_MOLDURA,molduraJanela,matrizEm(p.x,y+alt*.62,p.z,f.giro));
        const v=pontoDaFace(f,frac*f.vao,.035);
        instanciar(acesa?'janelaAcesa':'janela',GEO_JANELA,acesa?janelaAcesa:janela,
          matrizEm(v.x,y+alt*.62,v.z,f.giro));
      }
    }

    y+=alt;
    // Laje do andar: é ela que o jogador pisa. Some do último andar? Não — todo andar tem laje, e é
    // a do topo que serve de telhado.
    const laje=noLote(l,0,-recuoAcumulado/2);
    caixa(telha,larg+.14,.12,prof+.14,laje.x,y+.06,laje.z,l.giro,true);

    // Encolhe pro próximo andar.
    if(andar<l.andares-1){larg=Math.max(2.6,larg-.5);prof=Math.max(2.8,prof-RECUO_ANDAR);recuoAcumulado+=RECUO_ANDAR}
  }

  // Mureta em volta da laje do topo, e caixa d'água.
  const topo=noLote(l,0,-recuoAcumulado/2);
  const yTopo=y+.12;
  for(const[dx,dz,mw,md]of[[0,prof/2,larg+.14,ESP_MURETA],[0,-prof/2,larg+.14,ESP_MURETA],
                            [larg/2,0,ESP_MURETA,prof+.14],[-larg/2,0,ESP_MURETA,prof+.14]]){
    const p=noLote(l,dx,dz-recuoAcumulado/2);
    caixa(telha,mw,ALT_MURETA,md,p.x,yTopo+ALT_MURETA/2,p.z,l.giro);
  }
  const cd=noLote(l,larg*.24,-prof*.2-recuoAcumulado/2);
  instanciar('caixaDagua',GEO_CAIXA_DAGUA,agua,matrizEm(cd.x,yTopo+.3,cd.z,l.giro));
  l.lajeY=yTopo;
}

// ===== LOTES COM PAPEL: refúgio, bar, biqueira =====
// Escolhidos ANTES de construir, porque o papel muda o que se constrói e o que vira colisor.
//
// O REFÚGIO É ALINHADO AOS EIXOS DO MUNDO, DE PROPÓSITO. A física do jogo é AABB pura (Physics.js:
// só Box3, sem OBB). Uma parede fina de 5 m girada 40° tem AABB de 3,9 x 3,4 m — quase um cubo
// sólido. Foi assim que a geração anterior "abriu" nove esconderijos que na prática eram blocos
// maciços, e é literalmente o "não tô conseguindo entrar nas portas dos esconderijos".
//
// Então o refúgio só sai de lote que JÁ está a menos de 0,30 rad (17°) de um eixo cardeal, e recebe o
// alinhamento exato. São 9 casas entre ~110: no meio de uma fileira torta ninguém percebe 17° a
// menos, e em troca a casa é oca de verdade e a porta é uma porta.
const REFUGIO_ALVO=9,REFUGIO_DIST_MIN=16;
const lotesRefugio=[];
for(const l of lotes){
  if(lotesRefugio.length>=REFUGIO_ALVO)break;
  const k=Math.round(l.giro/(Math.PI/2));
  if(Math.abs(l.giro-k*Math.PI/2)>.30)continue;
  if(l.larg<4.3)continue;// menos que isso e a casa oca não tem interior utilizável
  if(lotesRefugio.some(o=>Math.hypot(o.x-l.x,o.z-l.z)<REFUGIO_DIST_MIN))continue;
  l.giro=k*Math.PI/2;
  // O giro foi normalizado para abrir o refúgio de verdade; a base precisa acompanhar a nova fachada.
  l.baseY=baseYDaSoleira(l);
  const ab=aabbGirada(l.larg,l.prof,l.giro);l.W=ab.W;l.D=ab.D;
  l.papel='refugio';lotesRefugio.push(l);
}
// ===== AS CASAS DE CLIENTE =====
// Mesma casca oca do refúgio, papel diferente: o cliente mora DENTRO, e a porta abre e fecha. Foi o
// pedido dele, e a razão é concreta — a entrega na laje existe mas a laje não tem acesso, então o
// jogador ficava pulando pra tentar entregar. Entrega tem que ser um lugar em que se ENTRA.
//
// As mesmas duas exigências geométricas do refúgio valem aqui, e pelo mesmo motivo (física é AABB
// pura): a casa precisa estar perto de um eixo cardeal, senão a parede girada vira bloco maciço e a
// porta não abre; e precisa ter largura pra ter interior.
//
// A terceira exigência é de jogo: LONGE DAS PORTAS DE ESCONDERIJO. A Manus tinha posto os quatro
// clientes a 68 cm da porta de um refúgio, com zona de raio 2,15 — a zona engolia a porta. Entregar
// dispara `alertarEntregaIlegal`, ou seja, dava motivo pra polícia olhar exatamente a porta em que o
// jogador precisa entrar pra se salvar.
const CLIENTE_ALVO=4,CLIENTE_DIST_MIN=18,CLIENTE_LONGE_DO_REFUGIO=16;
const lotesCliente=[];
for(const l of lotes){
  if(lotesCliente.length>=CLIENTE_ALVO)break;
  if(l.papel)continue;
  const k=Math.round(l.giro/(Math.PI/2));
  if(Math.abs(l.giro-k*Math.PI/2)>.30)continue;
  if(l.larg<4.3)continue;
  if(lotesRefugio.some(o=>Math.hypot(o.x-l.x,o.z-l.z)<CLIENTE_LONGE_DO_REFUGIO))continue;
  if(lotesCliente.some(o=>Math.hypot(o.x-l.x,o.z-l.z)<CLIENTE_DIST_MIN))continue;
  l.giro=k*Math.PI/2;
  l.baseY=baseYDaSoleira(l);
  const ab=aabbGirada(l.larg,l.prof,l.giro);l.W=ab.W;l.D=ab.D;
  l.papel='cliente';lotesCliente.push(l);
}

// Bar e biqueira na via principal, longe um do outro: são os dois destinos do morro e ter os dois na
// mesma esquina apagaria metade do trajeto.
let loteBar=null,loteBiqueira=null;
{
  const naVia=lotes.filter(l=>l.curva===viaPrincipal&&!l.papel&&l.larg>4.6);
  if(naVia.length>4){
    loteBar=naVia[Math.floor(naVia.length*.26)];loteBar.papel='bar';
    loteBiqueira=naVia[Math.floor(naVia.length*.68)];loteBiqueira.papel='biqueira';
  }
}

// ===== O CHÃO DA RUA =====
// Fita de concreto colada no relevo. Não é superfície andável: ela nasce 5 cm acima do terreno e o
// jogador anda no terreno. É acabamento — o que separa "rua" de "morro pelado" aos olhos.
function fitaDaVia(curva,largura){
  const total=curva.getLength(),n=Math.max(4,Math.round(total/2));
  const pos=[],nor=[],uv=[],idx=[];
  for(let i=0;i<=n;i++){
    const u=i/n,p=curva.getPointAt(u),t=curva.getTangentAt(u);
    const nx=-t.z,nz=t.x;
    for(const s of[-1,1]){
      const x=p.x+nx*s*largura/2,z=p.z+nz*s*largura/2;
      pos.push(x,obterElevacao(x,z)+.05,z);nor.push(0,1,0);uv.push(s>0?largura/2:0,u*total/2);
    }
  }
  // Enrolamento anti-horário visto de cima: com a ordem trocada a rua some (backface culling) e o
  // sintoma é um buraco no chão que não aparece em nenhum log.
  for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+1,a+2, a+1,a+3,a+2)}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  const auv=new THREE.Float32BufferAttribute(uv,2);
  g.setAttribute('uv',auv);g.setAttribute('uv1',auv);
  g.setIndex(idx);
  return g;
}

// ===== O ESCADÃO =====
// A subida é uma RAMPA de colisão com degraus DESENHADOS por cima. É a solução clássica e é o oposto
// do que este projeto tentou antes: escada feita de caixas de verdade, onde o jogador subia pela saia
// lateral, encravava no degrau ou caía no vão. A rampa é uma superfície contínua — não tem como
// falhar — e o degrau desenhado dá a leitura visual.
//
// Todas as rampas do morro se fundem numa malha só, que é a ÚNICA coisa que entra em
// `superficiesAndaveis` além das lajes.
const ESCADAO_ESPELHO=.17;// altura de um degrau desenhado
function construirEscadao(t){
  const dx=t.ate.x-t.de.x,dz=t.ate.z-t.de.z;
  const corrida=Math.hypot(dx,dz);if(corrida<.9)return;
  const subida=t.hAte-t.hDe;
  const rumo=Math.atan2(dx,dz),inclinacao=Math.atan2(subida,corrida);
  const comp=Math.hypot(corrida,subida),larg=BECO_MIN+.3;
  // A rampa: caixa deitada, inclinada em X local e depois girada em Y. A ordem importa — Ry·Rx é o
  // Euler 'YXZ', que é "aponta pro rumo e depois sobe". Invertida, a rampa sai torcida.
  const geo=new THREE.BoxGeometry(larg,.22,comp);
  uvPorMetro(geo);
  geo.rotateX(-inclinacao);geo.rotateY(rumo);
  geo.translate((t.de.x+t.ate.x)/2,(t.hDe+t.hAte)/2-.02,(t.de.z+t.ate.z)/2);
  acumularPronta(concreto,geo,true);
  // Degraus desenhados: um espelho vertical a cada ESCADAO_ESPELHO de subida.
  const n=Math.max(1,Math.round(Math.abs(subida)/ESCADAO_ESPELHO));
  for(let i=1;i<n;i++){
    const f=i/n;
    const x=t.de.x+dx*f,z=t.de.z+dz*f,y=t.hDe+subida*f;
    caixa(concreto,larg,.14,.09,x,y+.06,z,rumo);
  }
  // Corrimão de um lado só: dois lados fecham a leitura do beco e dobram a geometria.
  const nx=Math.cos(rumo),nz=-Math.sin(rumo);
  for(let i=0;i<=n;i+=Math.max(1,Math.round(n/4))){
    const f=i/n,x=t.de.x+dx*f+nx*larg/2,z=t.de.z+dz*f+nz*larg/2,y=t.hDe+subida*f;
    caixa(posteMat,.05,.9,.05,x,y+.45,z,rumo);
  }
}

// ===== POSTES E A GAMBIARRA DE FIOS =====
// O emaranhado é assinatura do lugar. Fio é caixa fina com CATENÁRIA de 3 tramos: uma linha reta
// entre postes lê como cabo de teleférico, não como gato.
const GEO_POSTE=new THREE.CylinderGeometry(.1,.13,6.4,6);
function fioEntre(a,b,cor){
  const tramos=3,barriga=.55+((hashInt(a.x*13|0,b.z*7|0)%100)/100)*.7;
  let px=a.x,py=a.y,pz=a.z;
  for(let i=1;i<=tramos;i++){
    const f=i/tramos;
    const qx=a.x+(b.x-a.x)*f,qz=a.z+(b.z-a.z)*f;
    const qy=a.y+(b.y-a.y)*f-Math.sin(f*Math.PI)*barriga;
    const d=Math.hypot(qx-px,qz-pz),h=qy-py,comp=Math.hypot(d,h);
    const g=new THREE.BoxGeometry(.035,.035,comp);
    uvPorMetro(g);
    g.rotateX(-Math.atan2(h,d));g.rotateY(Math.atan2(qx-px,qz-pz));
    g.translate((px+qx)/2,(py+qy)/2,(pz+qz)/2);
    acumularPronta(cor,g);
    px=qx;py=qy;pz=qz;
  }
}
function postesDaVia(curva,passo){
  const total=curva.getLength(),n=Math.max(2,Math.round(total/passo));
  let anterior=null;
  for(let i=0;i<=n;i++){
    const p=curva.getPointAt(i/n),t=curva.getTangentAt(i/n);
    const lado=(i%2)?1:-1;
    const x=p.x-t.z*lado*(VIA_LARGURA/2+.5),z=p.z+t.x*lado*(VIA_LARGURA/2+.5);
    const y=obterElevacao(x,z);
    instanciar('poste',GEO_POSTE,posteMat,matrizEm(x,y+3.2,z,0));
    const topo={x,y:y+5.9,z};
    if(anterior){fioEntre(anterior,topo,posteMat);
      // O segundo e o terceiro fio saem do MESMO par de postes com barrigas diferentes: é o que faz
      // o emaranhado, e custa 6 caixinhas.
      fioEntre({x:anterior.x+.12,y:anterior.y-.25,z:anterior.z+.12},{x:topo.x+.12,y:topo.y-.25,z:topo.z+.12},posteMat);
      fioEntre({x:anterior.x-.1,y:anterior.y-.45,z:anterior.z-.1},{x:topo.x-.1,y:topo.y-.45,z:topo.z-.1},posteMat);
    }
    anterior=topo;
  }
}

// ===== O REFÚGIO: casa oca com porta que abre e fecha =====
// A regra é ENTRAR E FECHAR: com a porta fechada e o jogador dentro, polícia e helicóptero perdem
// ele (Police.js). Por isso o refúgio é a única construção da favela que NÃO é fundida — a folha da
// porta gira, e geometria fundida não gira.
import{registrarObstaculo,registrarCaixa,marcarSemFusao,marcarObstaculoMovel,superficiesAndaveis}from'./Physics.js';

export const ESP_PAREDE=.18,PORTA_ALTURA=2.35,VAO_PORTA=1.8,PORTA_ABERTA_RAD=1.9;
export const refugios=[];
const refugioMat=new THREE.MeshStandardMaterial({color:0xb5342a,roughness:.7,emissive:0x5a1712,emissiveIntensity:.35});
// Verde da casa de cliente, na mesma cor da zona de entrega (DeliveryPoints): é o que liga a placa
// na fachada ao círculo no chão sem precisar de tutorial.
const clienteMat=new THREE.MeshStandardMaterial({color:0x2f9c6e,roughness:.7,emissive:0x11402c,emissiveIntensity:.35});
// Malha solta (fora das pilhas), já posicionada no mundo.
function pecaSolta(geo,material,x,y,z,giro,pai,sombra=true){
  uvPorMetro(geo);
  const m=new THREE.Mesh(geo,material);
  m.position.set(x,y,z);m.rotation.y=giro;
  m.castShadow=sombra;m.receiveShadow=true;
  pai.add(m);return m;
}
// Casca oca com porta que abre: serve pro ESCONDERIJO e pra CASA DE CLIENTE. A diferença entre os
// dois é papel, não geometria — o que muda é a placa na fachada e o que o jogo deixa fazer lá dentro
// (só o esconderijo baixa a ficha; ver `estaEscondido`).
function construirCasaOca(l){
  const g=new THREE.Group();favela.add(g);
  const cor=CORES_PAREDE[l.sem%CORES_PAREDE.length];
  const reboco=matReboco(cor),telha=matTelha(CORES_TELHA[(l.sem>>3)%CORES_TELHA.length]);
  const larg=l.larg,prof=l.prof,y0=l.baseY,alt=ANDAR_ALT+.25;
  const P=(dx,dz)=>noLote(l,dx,dz);
  // O piso usa a cota da soleira, mas o morro pode descer vários centímetros (ou metros) atrás
  // dela. Se as paredes começarem em `y0`, a parte de baixo fica no ar. A casa comum já corrige isso
  // com `afundar`; o refúgio precisa aplicar a mesma regra à sua casca oca.
  let menorTerreno=y0;
  for(const sx of[-1,1])for(const sz of[-1,1])for(const fora of[0,1.4]){
    const p=P(sx*(larg/2+fora),sz*(prof/2+fora));
    menorTerreno=Math.min(menorTerreno,obterElevacao(p.x,p.z));
  }
  for(const[dx,dz]of[[0,prof/2+1.4],[0,-prof/2-1.4],[larg/2+1.4,0],[-larg/2-1.4,0]]){
    const p=P(dx,dz);menorTerreno=Math.min(menorTerreno,obterElevacao(p.x,p.z));
  }
  const afundar=Math.max(0,y0-menorTerreno)+.25;
  const casca=[];
  const parede=(lw,ld,dx,dz,h,dy,descer=true)=>{const p=P(dx,dz);
    const altura=h+(descer?afundar:0),base=y0+dy-(descer?afundar:0);
    casca.push(pecaSolta(new THREE.BoxGeometry(lw,altura,ld),reboco,p.x,base+altura/2,p.z,l.giro,g))};
  parede(larg,ESP_PAREDE,0,-prof/2,alt,0);                 // fundo
  parede(ESP_PAREDE,prof,-larg/2,0,alt,0);                 // lateral esquerda
  parede(ESP_PAREDE,prof, larg/2,0,alt,0);                 // lateral direita
  const aba=(larg-VAO_PORTA)/2;
  parede(aba,ESP_PAREDE,-(larg+VAO_PORTA)/4,prof/2,alt,0); // fachada, à esquerda do vão
  parede(aba,ESP_PAREDE, (larg+VAO_PORTA)/4,prof/2,alt,0); // fachada, à direita do vão
  // A verga não pode descer com as paredes: ela começa no topo do vão e, se for estendida para baixo,
  // transforma a porta em uma parede maciça justamente quando o terreno exige mais afundamento.
  parede(VAO_PORTA,ESP_PAREDE,0,prof/2,alt-PORTA_ALTURA,PORTA_ALTURA,false);// verga sobre a porta
  // Laje: é telhado e é piso de quem está em cima.
  const c=P(0,0);
  const laje=pecaSolta(new THREE.BoxGeometry(larg+.14,.12,prof+.14),telha,c.x,y0+alt+.06,c.z,l.giro,g);
  superficiesAndaveis.push(laje);
  for(const[dx,dz,mw,md]of[[0,prof/2,larg+.14,ESP_MURETA],[0,-prof/2,larg+.14,ESP_MURETA],
                            [larg/2,0,ESP_MURETA,prof+.14],[-larg/2,0,ESP_MURETA,prof+.14]]){
    const p=P(dx,dz);pecaSolta(new THREE.BoxGeometry(mw,ALT_MURETA,md),telha,p.x,y0+alt+.12+ALT_MURETA/2,p.z,l.giro,g);
  }
  // A PLACA É O QUE DIFERENCIA OS DOIS DE LONGE. Vermelha = esconderijo; verde = casa de cliente, na
  // mesma cor da zona de entrega, pra o jogador ligar uma coisa na outra sem precisar de tutorial.
  const ehCliente=l.papel==='cliente';
  {const p=P(0,prof/2+.32);
   pecaSolta(new THREE.BoxGeometry(1.5,.12,.5),ehCliente?clienteMat:refugioMat,p.x,y0+2.3,p.z,l.giro,g,false)}

  // A PORTA. Pivô na quina do vão, folha deslocada meia-largura: girar o pivô gira a folha em torno
  // da dobradiça, que é o único jeito de uma porta parecer porta.
  const dobra=P(-VAO_PORTA/2,prof/2);
  const pivo=new THREE.Group();pivo.position.set(dobra.x,y0,dobra.z);pivo.rotation.y=l.giro;g.add(pivo);
  const folha=pecaSolta(new THREE.BoxGeometry(VAO_PORTA-.06,PORTA_ALTURA-.05,.07),porta,
    (VAO_PORTA-.06)/2,(PORTA_ALTURA-.05)/2,0,0,pivo);

  // A CASCA VAI PRA FÍSICA SEM FUSÃO. A fusão de colisores (Physics.otimizarObstaculos) junta caixas
  // que compartilham topo; com a verga e as duas abas da fachada compartilhando topo, a união desceu
  // e EMPAREDOU o vão — os nove esconderijos ficaram lacrados sem um erro sequer aparecer.
  casca.forEach(m=>marcarSemFusao(registrarObstaculo(m,'parede')));

  // A AABB da folha FECHADA é medida uma vez, com ela fechada. Medir na hora de fechar pegaria a
  // folha no meio da animação e o colisor sairia torto.
  pivo.rotation.y=l.giro;folha.updateWorldMatrix(true,false);
  const caixaFechada=new THREE.Box3().setFromObject(folha);
  pivo.rotation.y=l.giro+PORTA_ABERTA_RAD;// nasce aberta
  const cx=new THREE.Box3();sumirCaixa(cx);
  registrarCaixa(cx,'porta');
  marcarObstaculoMovel(cx);// o conteúdo muda; na grade espacial o índice ficaria errado

  // O recuo do interior cobre a parede MAIS a meia-largura do corpo do jogador: com o recuo justo da
  // parede, um ponto "interior" colado na lateral já deixava a hitbox dentro do tijolo, e fechar a
  // porta ali prendia o jogador no próprio colisor.
  const recuo=ESP_PAREDE+.25;
  const r={x:l.x,z:l.z,y:y0,giro:l.giro,pivo,folha,caixa:cx,caixaFechada,aberta:true,
    papel:ehCliente?'cliente':'esconderijo',
    fechadaRad:l.giro,abertaRad:l.giro+PORTA_ABERTA_RAD,
    meiaLarg:larg/2-recuo,meiaProf:prof/2-recuo,larg,prof,alt,
    // Onde o PISO realmente está. A casca não tem piso: o interior é o morro, e numa casa cravada no
    // barranco ele desce bem abaixo da soleira — é justamente o que `afundar` mede pra a parede
    // alcançar o chão. Sem este número, o teste de "está dentro" pela altura barrava o jogador que
    // entrou de verdade (medido: 8 de 13 casas, com o chão até 1,57 m abaixo da soleira).
    piso:y0-afundar};
  refugios.push(r);
  l.lajeY=y0+alt+.12;
  return r;
}
// A caixa da porta ABERTA não pode ser Box3 vazia: vazio em three é ±Infinity, e Infinity entra na
// rasterização da NavMesh e no slab test das balas virando NaN. Caixa minúscula a 10 km é finita.
export function sumirCaixa(b){b.min.set(0,-9999,0);b.max.set(.01,-9998.99,.01)}
export function alternarPortaRefugio(r){
  r.aberta=!r.aberta;
  if(r.aberta)sumirCaixa(r.caixa);else r.caixa.copy(r.caixaFechada);
  return r.aberta;
}
// Em qual refúgio o ponto está (ou null). É o teste do INTERIOR, não de proximidade: antes bastava
// chegar a 2,8 m da casa, o que fazia o esconderijo valer também na viela e na calçada.
export function refugioEmQueEsta(pos){
  for(const r of refugios){
    const dx=pos.x-r.x,dz=pos.z-r.z,c=Math.cos(r.giro),sn=Math.sin(r.giro);
    const lx=dx*c-dz*sn,lz=dx*sn+dz*c;
    if(Math.abs(lx)>r.meiaLarg||Math.abs(lz)>r.meiaProf)continue;
    // ===== E TEM QUE ESTAR NA ALTURA DO CÔMODO =====
    // O teste era só de X e Z, e por isso quem estava EM CIMA DA LAJE contava como estando dentro da
    // casa. Duas consequências reais: dava pra se esconder da polícia de pé no telhado (a ficha
    // descia com o jogador exposto ao céu), e a entrega em cima da laje devolvia o contexto do
    // refúgio em vez do cliente, escondendo o botão de entregar — foi assim que o teste da entrega
    // na laje pegou isto.
    // A faixa começa 60 cm ABAIXO da soleira porque a casca oca não tem piso: o interior é o morro,
    // e ele pode estar mais baixo que a soleira num canto.
    if(Number.isFinite(pos.y)&&(pos.y<r.piso-.3||pos.y>r.y+r.alt))continue;
    return r;
  }
  return null;
}
// SÓ O ESCONDERIJO ESCONDE. A casa de cliente tem a mesma casca e a mesma porta, mas se ela também
// baixasse a ficha o jogador entregaria e ficaria limpo no mesmo cômodo — a entrega deixaria de ter
// risco, que é a única coisa que a torna uma decisão.
export function estaEscondido(pos){
  const r=refugioEmQueEsta(pos);
  return !!r&&!r.aberta&&r.papel==='esconderijo';
}
// Só as casas de cliente, pra quem monta os pontos de entrega. Preenchida logo depois da construção
// (ver o laço que chama `construirCasaOca`), porque `refugios` só existe cheia depois dela.
export const casasCliente=[];
export function atualizarRefugios(dt){
  const k=1-Math.exp(-9*dt);
  for(const r of refugios){
    const alvo=r.aberta?r.abertaRad:r.fechadaRad;
    if(Math.abs(r.pivo.rotation.y-alvo)>.001)r.pivo.rotation.y+=(alvo-r.pivo.rotation.y)*k;
  }
}

// ===== O BAR =====
// Azulejo branco encardido, porta de aço MEIO ABERTA (o vão embaixo é a coisa toda: bar de morro não
// tem porta escancarada nem fechada, tem a portinhola levantada até a altura do ombro), luz amarela
// dura vazando por baixo, mesa e cadeira de plástico na calçada.
export const BAR={x:0,y:0,z:0,raio:0};
// Calcula quanto a fundação precisa descer para alcançar o relevo mais baixo sob a construção.
// O topo permanece na cota da soleira; apenas a base é enterrada, sem mover balcão, porta ou telhado.
function afundarEstrutura(l,larg,prof,y0){
  let menor=y0;
  for(const sx of[-1,1])for(const sz of[-1,1])for(const fora of[0,1.4]){
    const p=noLote(l,sx*(larg/2+fora),sz*(prof/2+fora));
    menor=Math.min(menor,obterElevacao(p.x,p.z));
  }
  for(const[dx,dz]of[[0,prof/2+1.4],[0,-prof/2-1.4],[larg/2+1.4,0],[-larg/2-1.4,0]]){
    const p=noLote(l,dx,dz);menor=Math.min(menor,obterElevacao(p.x,p.z));
  }
  return Math.max(0,y0-menor)+.25;
}
const GEO_CADEIRA=new THREE.BoxGeometry(.42,.06,.42);
const GEO_PERNA=new THREE.BoxGeometry(.05,.42,.05);
const GEO_ENCOSTO=new THREE.BoxGeometry(.42,.42,.05);
const GEO_MESA=new THREE.CylinderGeometry(.36,.36,.05,8);
function construirBar(l){
  const azulejo=matReboco(0xe6e2d6),telha=matTelha(0xa8a49c);
  MAT_SOMBRA.add(azulejo);MAT_SOMBRA.add(telha);
  const larg=l.larg,prof=l.prof,y0=l.baseY,alt=2.9,afundar=afundarEstrutura(l,larg,prof,y0);
  const yParede=y0+alt/2-afundar/2,altParede=alt+afundar;
  const P=(dx,dz)=>noLote(l,dx,dz);
  // Caixa fechada nos três lados; a frente vira o vão da portinhola. A fundação desce até o relevo.
  caixaNoLote(l,azulejo,larg,altParede,ESP_PAREDE,0,-prof/2,yParede);
  for(const sx of[-1,1])caixaNoLote(l,azulejo,ESP_PAREDE,altParede,prof,sx*larg/2,0,yParede);
  // Interior escuro atrás do vão: sem isto o bar é uma caixa vazia com o morro aparecendo do outro lado.
  caixaNoLote(l,bmat(0x17140f),larg-.3,altParede,.1,0,-prof/2+.5,yParede);
  // Balcão.
  caixaNoLote(l,concreto,larg*.8,1.05,.55,0,prof/2-1.1,y0+.52);
  // A PORTA DE AÇO, meio levantada. Ela ocupa a metade de cima do vão; o resto é o vão por onde a luz
  // sai e por onde o jogador enxerga o balcão.
  const ALTURA_VAO=2.1,ABERTURA=.95;// 95 cm de vão livre embaixo
  {const p=P(0,prof/2);
   caixa(bmat(0x5c5a52),larg-.2,ALTURA_VAO-ABERTURA,.07,p.x,y0+ABERTURA+(ALTURA_VAO-ABERTURA)/2,p.z,l.giro);
   // Trilhos laterais, o detalhe que faz ler como porta de enrolar e não como painel colado.
   for(const sx of[-1,1])caixaNoLote(l,bmat(0x3b3833),.09,ALTURA_VAO,.11,sx*(larg/2-.14),prof/2,y0+ALTURA_VAO/2);
   caixa(azulejo,larg,alt-ALTURA_VAO,.14,p.x,y0+ALTURA_VAO+(alt-ALTURA_VAO)/2,p.z,l.giro);}
  // Laje.
  {const c=P(0,0);caixa(telha,larg+.16,.14,prof+.16,c.x,y0+alt+.07,c.z,l.giro,true)}
  // Luz do bar: é o farol do morro à noite. Uma PointLight só, sem sombra (sombra de ponto são 6
  // passes de cubemap — o custo mais caro que existe por lâmpada).
  {const p=P(0,prof/2-1.6);
   const luz=new THREE.PointLight(0xffb95c,2.2,11);luz.position.set(p.x,y0+2.3,p.z);favela.add(luz);
   caixa(janelaAcesa,.7,.06,.24,p.x,y0+2.45,p.z,l.giro);}
  // Mesa e duas cadeiras na calçada.
  for(const sx of[-1,1]){
    const m=P(sx*larg*.32,prof/2+1.5),ym=obterElevacao(m.x,m.z);
    instanciar('mesa',GEO_MESA,bmat(0xd9d4c6),matrizEm(m.x,ym+.74,m.z,0));
    instanciar('perna',GEO_PERNA,bmat(0xd9d4c6),matrizEm(m.x,ym+.36,m.z,0));
    for(let k=0;k<2;k++){
      const a=l.giro+k*Math.PI+sx*.4;
      const cx=m.x+Math.sin(a)*.8,cz=m.z+Math.cos(a)*.8,yc=obterElevacao(cx,cz);
      instanciar('cadeira',GEO_CADEIRA,bmat(0xbe4436),matrizEm(cx,yc+.44,cz,a));
      instanciar('encosto',GEO_ENCOSTO,bmat(0xbe4436),matrizEm(cx-Math.sin(a)*.19,yc+.66,cz-Math.cos(a)*.19,a));
      for(const px of[-.16,.16])for(const pz of[-.16,.16])
        instanciar('perna',GEO_PERNA,bmat(0xbe4436),matrizEm(cx+px,yc+.21,cz+pz,0));
    }
  }
  const frente=P(0,prof/2+1.2);
  BAR.x=frente.x;BAR.z=frente.z;BAR.y=y0;BAR.raio=3.4;
  l.lajeY=y0+alt+.14;
}

// ===== A BIQUEIRA =====
// Boca de beco: muro baixo pichado, engradado empilhado, lâmpada nua. Não é loja — é um canto onde
// alguém está. O ponto de interação fica NA BOCA, do lado da rua, e não dentro do barraco.
export const BIQUEIRA={x:0,y:0,z:0,raio:0};
function construirBiqueira(l){
  const reboco=matReboco(0x7d7466),telha=matTelha(0x9e9a92);
  MAT_SOMBRA.add(reboco);MAT_SOMBRA.add(telha);
  const larg=l.larg,prof=l.prof,y0=l.baseY,alt=2.5,afundar=afundarEstrutura(l,larg,prof,y0);
  const yParede=y0+alt/2-afundar/2,altParede=alt+afundar;
  const P=(dx,dz)=>noLote(l,dx,dz);
  caixaNoLote(l,reboco,larg,altParede,prof,0,0,yParede);
  {const c=P(0,0);caixa(telha,larg+.16,.14,prof+.16,c.x,y0+alt+.07,c.z,l.giro,true)}
  // Muro baixo na frente: é atrás dele que a boca funciona, e é ele que dá o "canto" sem fechar o beco.
  {const p=P(-larg*.15,prof/2+1.25);
   caixa(reboco,larg*.7,1.15+afundar,.2,p.x,y0+.58-afundar/2,p.z,l.giro);
   // Pichação: geometria SEPARADA num material sem tinta, colada 2 cm à frente do muro.
   const q=P(-larg*.15,prof/2+1.37);
   caixa(graffiteMat,larg*.62,.85,.02,q.x,y0+.62,q.z,l.giro);}
  // Engradados.
  for(let k=0;k<4;k++){
    const h=hashInt(l.sem,k*13);
    const p=P(larg*.28+((h%40)/100-.2),prof/2+.5+((h>>7)%50)/100);
    caixa(matMadeira(0x8a5a2f),.42,.3,.42,p.x,y0+.15+(k%2)*.3,p.z,l.giro+((h>>13)%100)/100);
  }
  // Lâmpada nua na quina, o brilho que marca a boca no escuro.
  {const p=P(larg*.42,prof/2+.1);
   const luz=new THREE.PointLight(0xd9c6ff,1.5,8);luz.position.set(p.x,y0+2.6,p.z);favela.add(luz);
   caixa(janelaAcesa,.16,.16,.16,p.x,y0+2.6,p.z,0);}
  const frente=P(-larg*.15,prof/2+1.9);
  BIQUEIRA.x=frente.x;BIQUEIRA.z=frente.z;BIQUEIRA.y=y0;BIQUEIRA.raio=3.2;
  l.lajeY=y0+alt+.14;
}

// ===== CONSTRÓI O MORRO =====
for(const l of lotes){
  if(l.papel==='refugio'||l.papel==='cliente')construirCasaOca(l);
  else if(l.papel==='bar')construirBar(l);
  else if(l.papel==='biqueira')construirBiqueira(l);
  else construirCasa(l);
}
// A lista de casas de cliente só pode ser montada AQUI: `refugios` recebe os dois papéis durante a
// construção, e antes deste laço ela está vazia.
for(const r of refugios)if(r.papel==='cliente')casasCliente.push(r);
acumularPronta(concreto,fitaDaVia(viaPrincipal,VIA_LARGURA));
acumularPronta(concreto,fitaDaVia(viaBaixa,VIA_LARGURA));
for(const b of becos)acumularPronta(concreto,fitaDaVia(b,BECO_MIN+.4));
for(const e of escadoes)construirEscadao(e);
postesDaVia(viaPrincipal,15);
postesDaVia(viaBaixa,17);

// ===== FUSÃO E INSTANCIAÇÃO =====
// É aqui que 2.000 malhas viram algumas dezenas. Duas técnicas, cada uma onde é a certa:
//   · mergeGeometries pro que VARIA de tamanho e nunca se move — a posição fica assada nos vértices;
//   · InstancedMesh pro que é IDÊNTICO e se repete — uma geometria, uma matriz por cópia.
// A favela anterior tinha 2.116 malhas e 2.110 geometrias distintas na cena. O número final está no
// console no boot, porque "otimizei" sem número medido é a forma mais fácil de mentir pra si mesmo.
export const malhasFundidas=[];
function fundirPilha(mapa,andavel){
  for(const[material,lista]of mapa){
    if(!lista.length)continue;
    const geo=mergeGeometries(lista,false);
    if(!geo)continue;// materiais com atributos incompatíveis: melhor perder a peça que travar o boot
    lista.forEach(g=>g.dispose());
    const m=new THREE.Mesh(geo,material);
    m.castShadow=andavel||MAT_SOMBRA.has(material);
    m.receiveShadow=true;
    favela.add(m);malhasFundidas.push(m);
    if(andavel)superficiesAndaveis.push(m);
  }
  mapa.clear();
}
fundirPilha(pilhas,false);
fundirPilha(pilhasAndaveis,true);
for(const[chave,{geo,material,ms}]of instancias){
  const im=new THREE.InstancedMesh(geo,material,ms.length);
  for(let i=0;i<ms.length;i++)im.setMatrixAt(i,ms[i]);
  im.instanceMatrix.needsUpdate=true;
  im.receiveShadow=true;
  // Só o que tem corpo projeta sombra: poste e caixa d'água passam; vidro, moldura, cadeira e perna
  // de mesa não — sombra de peça de 5 cm ninguém enxerga, e o passe de sombra redesenha tudo.
  im.castShadow=chave==='poste'||chave==='caixaDagua';
  // A esfera de contorno do InstancedMesh sai da GEOMETRIA (que está na origem), não das instâncias:
  // com culling ligado, o bairro inteiro sumiria quando a origem saísse da tela.
  im.frustumCulled=false;
  favela.add(im);
}
const totalInstanciadas=instancias.size;
instancias.clear();

// ===== COLISORES: SAEM DO LOTE, NUNCA DA MALHA =====
// Este é o contrato que torna a fusão acima segura. Enquanto o colisor era medido da MALHA
// (`Box3().setFromObject`), fundir geometria pra ganhar draw call mexia na física junto — e uma fusão
// mal calibrada chegou a emparedar as nove portas de esconderijo sem nenhum erro aparecer.
//
// Uma caixa por casa. A AABB é a do retângulo GIRADO, que é maior que a casa — e é de propósito: foi
// exatamente com essa AABB que o lote se afastou da rua lá em `pendurarLotes`, então a largura livre
// da rua já está garantida por construção. O refúgio é a exceção: ele registra a própria casca oca.
export const CHAO_PROFUNDIDADE=4;

// ===== UMA CAIXA SÓ NÃO SERVE: A CASA VIRA FATIAS =====
// A AABB de uma casa girada é MUITO maior que a casa. Com 4,5 x 3,9 m a 22,5°, ela mede 5,65 x 5,33 —
// sobram 57 cm de PAREDE INVISÍVEL de cada lado. Num beco de 2 m isso é metade da passagem, e o
// sintoma que o Bruno fotografou é o mais feio possível: a câmera de terceira pessoa recua pra dentro
// de uma parede que não existe e a tela inteira fica preta.
//
// A física do jogo é AABB pura, então a saída não é OBB — é picar. O retângulo girado é convexo, e um
// convexo é bem aproximado por FATIAS alinhadas ao eixo: cada fatia cobre uma faixa de X e vai do
// menor ao maior Z do polígono dentro dela.
//
// QUANTAS FATIAS: 12, e o número foi MEDIDO, não estimado. Aqui dizia "com 4 fatias o erro cai pra
// ~14 cm"; medindo a área que o colisor ocupa fora do retângulo da casa, em todas as 88 casas, 4
// fatias deixam 22,9% da casa em parede invisível e passam da parede em até 1,34 m. A conta completa:
//     fatias   caixas   área sobrando   pior excesso
//        4       352        22,9%          1,34 m
//        8       704        12,1%          0,75 m
//       12      1056         8,2%          0,46 m
//       20      1760         5,1%          0,32 m
// E o preço disso na consulta de colisão, medido no jogo rodando: 0,28 µs por consulta com 4 fatias
// contra 0,48 µs com 12 — 0,011 contra 0,019 ms por quadro. Um quadro de 60 fps tem 16,7 ms, então
// são 0,1% dele. Por isso 12: é onde o pior caso cai abaixo de meio metro sem que o custo apareça.
// (Também medi escolher o MELHOR EIXO por casa em vez de cortar sempre em X: 22,9% → 21,6%. Não paga
// a complicação, porque as casas nascem a menos de 22,5° de um eixo e os dois cortes erram igual.)
//
// Como o polígono é CONVEXO, o mínimo e o máximo de Z dentro de uma faixa só podem estar nas bordas
// da faixa ou num vértice dentro dela — não precisa recortar polígono, basta olhar esses pontos.
const FATIAS_CASA=12;
function fatiarRetangulo(cx,cz,w,d,giro){
  const c=Math.cos(giro),sn=Math.sin(giro);
  const cantos=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]]
    .map(([lx,lz])=>({x:cx+lx*c+lz*sn,z:cz-lx*sn+lz*c}));
  const xs=cantos.map(p=>p.x),x0=Math.min(...xs),x1=Math.max(...xs);
  const fatias=[];
  for(let i=0;i<FATIAS_CASA;i++){
    const a=x0+(x1-x0)*i/FATIAS_CASA,b=x0+(x1-x0)*(i+1)/FATIAS_CASA;
    let minZ=Infinity,maxZ=-Infinity;
    const anota=z=>{if(z<minZ)minZ=z;if(z>maxZ)maxZ=z};
    for(const p of cantos)if(p.x>=a-1e-9&&p.x<=b+1e-9)anota(p.z);
    for(let k=0;k<4;k++){
      const p=cantos[k],q=cantos[(k+1)%4];
      if(p.x===q.x)continue;
      for(const xf of[a,b]){
        const t=(xf-p.x)/(q.x-p.x);
        if(t>=0&&t<=1)anota(p.z+(q.z-p.z)*t);
      }
    }
    if(minZ<=maxZ)fatias.push({x0:a,x1:b,z0:minZ,z1:maxZ});
  }
  return fatias;
}
// Calcula os colisores a partir do retângulo físico da casa, não de uma malha visual fundida.
// `l.larg` e `l.prof` são as dimensões do lote/casa; `l.giro` é aplicado antes da divisão em fatias.
// Assim, cada caixa representa uma faixa do volume real e não a AABB de uma geometria agregada.
export function calcularColisoresCasa(l){
  // Casca oca (refúgio e casa de cliente) registra as próprias paredes: um bloco maciço aqui lacraria
  // a casa por fora, e foi assim que os nove esconderijos já ficaram fechados uma vez.
  if(l.papel==='refugio'||l.papel==='cliente')return [];
  const yBaixo=l.baseY-CHAO_PROFUNDIDADE;
  const yAlto=(l.lajeY??l.baseY+2.5)-.02;
  return fatiarRetangulo(l.x,l.z,l.larg,l.prof,l.giro).map(f=>
    new THREE.Box3(new THREE.Vector3(f.x0,yBaixo,f.z0),
                   new THREE.Vector3(f.x1,yAlto,f.z1)));
}

// AS FATIAS DE UMA CASA NÃO FUNDEM, E ISSO É O PONTO DELAS.
// A escada de fatias É a forma da casa girada. A fusão junta caixas cujas faces batem dentro de 6 cm
// e ainda tolera 30 cm de vão entre elas — o que, num degrau de 10 a 15 cm, junta os degraus de volta
// e devolve parte da parede invisível que as fatias existem pra tirar. Medido: com a fusão ligada, o
// teste de colisão acusa 13 divergências de comportamento contra a lista original.
let colisoresCasa=0;
for(const l of lotes){
  for(const box of calcularColisoresCasa(l)){
    marcarSemFusao(registrarCaixa(box,'casa'));
    colisoresCasa++;
  }
}
// AS MURETAS NÃO VIRAM COLISOR, E ISSO É DECISÃO DE JOGO. Parapeito de 50 cm é alto demais pro passo
// (0,216 m) e baixo demais pro pulo servir de algo: como colisor ele TRANCA o telhado, que é
// justamente o caminho de fuga de laje em laje. Fica desenhado, some da física.

// ===== O QUE OS OUTROS MÓDULOS LEEM =====
// `casasPos` alimenta o traçado das quadras no radar e o sorteio da laje do cliente.
// `w`/`d` são a caixa ALINHADA AO MUNDO (é o que o radar desenha); `larg`/`prof`/`giro` são a casa
// de verdade, girada. Quem quer só pintar um retângulo no radar usa os primeiros; quem precisa achar
// a FRENTE da casa — pra pôr alguém na porta, por exemplo — precisa dos segundos. Faltavam, e por
// isso o gerador de pontos de entrega caiu nos refúgios: era a única lista que trazia `giro`.
export const casasPos=lotes.map(l=>({x:l.x,z:l.z,w:l.W,d:l.D,
  larg:l.larg,prof:l.prof,giro:l.giro,papel:l.papel||null,
  h:(l.lajeY??l.baseY+2.5)-l.baseY,laje:l.lajeY??l.baseY+2.5}));
// Ronda de morador e polícia: os pontos saem das CURVAS DE VERDADE (ver `pontosDeRonda`).
export const BECOS=pontosDeRonda;

console.info('[favela] lotes=%d becos=%d escadoes=%d refugios=%d | malhas fundidas=%d instanciadas=%d | colisores de casa=%d',
  lotes.length,becos.length,escadoes.length,refugios.length,
  malhasFundidas.length,totalInstanciadas,colisoresCasa);
