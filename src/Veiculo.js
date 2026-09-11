// ===== A MECÂNICA DE VEÍCULO, UMA VEZ SÓ =====
//
// Isto nasceu de dentro do `Moto.js`. Quando o carro entrou, a escolha era copiar duzentas linhas de
// física, colisão e assentamento — ou tirar do lugar o que já estava provado e passar a configurar.
// Copiar tinha um preço conhecido: cada conserto que a moto levou hoje (o sinal do analógico, o corpo
// que gira, a batida que tira velocidade, a câmera que vai atrás, o modelo virado ao contrário) teria
// que ser feito DUAS vezes, e a segunda seria esquecida.
//
// O que autorizou o movimento foi a bateria de testes da moto: `moto`, `motodedo`, `motocamera`,
// `motochao`, `motofrente`, `motopiloto` e `motocabe`. Refatorar sem rede é aposta; com rede é
// trabalho. Se algum deles ficar vermelho depois desta extração, a extração está errada.
//
// Cada veículo é uma CONFIGURAÇÃO: tamanho, força, esterço, e onde o motorista senta. O que não muda
// entre eles — e o que custou caro pra descobrir — mora aqui.
import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{player,topoAndavelAbaixo}from'./Player.js';
import{scene}from'./core.js';
import{obterElevacao,alturaDoChaoDesenhado}from'./Terrain.js';
import{separarRodas}from'./Rodas.js';
import{levanteContraQuina,PASSO_DA_FITA}from'./WorldGenerator.js';
import{colideObstaculoXZ,registrarCaixa,marcarObstaculoMovel,buscarPosicaoLivre}from'./Physics.js';
import{PLAYER_LIMIT}from'./WorldBounds.js';

// O limite antigo de 124 m fazia carro e moto ignorarem a expansão do mapa, mesmo quando o jogador
// a pé já conseguia chegar muito mais longe. Todos os modos agora usam a mesma borda jogável.
const LIMITE_MUNDO=PLAYER_LIMIT,ZONA_MORTA=.12;
// O quanto a roda mais funda pode ficar ABAIXO do chão depois de plantar as outras. É o ÚNICO botão
// da troca, e ela é assimétrica: roda enterrada não se vê (o pneu some no barro), roda no ar abre
// fresta de luz e foi o que ele fotografou. Por isso o valor é generoso — 14 cm afunda quase meio
// pneu no pior canto do morro mais torcido do mapa, em troca de nenhuma roda levantada em lugar
// nenhum. Não é o tamanho do passo, é o teto do RESULTADO — ver o
// comentário em `assentar`, que essa distinção já custou uma medida errada.
const TETO_AFUNDAR=.14;
// O quanto a roda da frente vira na tela, no esterço cheio. É VISUAL: quem faz o carro curvar é o
// `esterco` da ficha, e este ângulo só precisa LER como volante virado. 32° é o batente de um carro
// de rua; mais que isso lê como kart.
const ESTERCO_VISUAL=.56;
// ===== SÓ SE DIRIGE UM DE CADA VEZ =====
// Com dois veículos no mapa, nada impedia entrar no carro e depois montar na moto: os dois passariam
// a mover o `player` no mesmo quadro, cada um com a sua velocidade, e o jogador sairia arrastado numa
// direção que não é de nenhum dos dois. A trava é do módulo, e não de cada veículo, porque a pergunta
// é sobre o conjunto — um veículo sozinho não tem como saber do outro.
let emUso=null;
// A mesma trava responde uma segunda pergunta, e é de graça: O JOGADOR ESTÁ DENTRO DE ALGUM VEÍCULO?
// Quem quer saber é a polícia — ver o comentário do `montarAlvosDoFrame` no Police.js.
export function jogadorEmVeiculo(){return emUso!==null}
const _box=new THREE.Box3(),_size=new THREE.Vector3(),_center=new THREE.Vector3();
const _frente=new THREE.Vector3();

function aviso(txt){
  const el=document.getElementById('avisoPolicia');if(!el)return;
  el.textContent=txt;el.style.display='block';el.style.opacity='1';
  clearTimeout(el._veicT);
  el._veicT=setTimeout(()=>{el.style.opacity='0';setTimeout(()=>{el.style.display='none'},300)},1800);
}

export function criarVeiculo(cfg){
  const grupo=new THREE.Group();grupo.name=cfg.nome;grupo.visible=false;scene.add(grupo);
  // ORDEM DE EULER 'YXZ', E NÃO A PADRÃO. Com a ordem padrão ('XYZ') a inclinação seria aplicada nos
  // eixos do MUNDO antes do giro, e o veículo virado pro leste tombaria pro lado em vez de empinar.
  // Em 'YXZ' o giro vem primeiro e a inclinação acontece nos eixos DELE.
  grupo.rotation.order='YXZ';
  let montado=false,carregado=false,velocidade=0;
  let botaoVisivel=null;// null = ainda não decidido, pra o primeiro quadro sempre escrever
  // A parcela de CURVA da rolagem, guardada à parte pra poder ser amortecida sozinha, sem arrastar a
  // do terreno junto (ver o fim do `atualizar`). Só o veículo com `rolagemDoTerrenoDireta` usa.
  let inclinacaoDeCurva=0;
  // As rodas, se o modelo permitir separá-las (ver `Rodas.js`). `null` = modelo sem recorte, e aí o
  // veículo anda como sempre andou, com a roda desenhada parada.
  let rodas=null;

  // ===== O CORPO PRECISA GIRAR COM O VEÍCULO =====
  // A física do jogo é AABB pura (`Physics.js`): uma caixa fixa mede sempre o mesmo nos eixos do
  // MUNDO, aponte o veículo pra onde apontar. Com a moto virada pro leste ela tinha 1,35 m de
  // comprimento em X contra 0,68 m de caixa (o guidão entrava na parede) e 0,47 m de largura em Z
  // contra 1,40 m de caixa (93 cm de fantasma raspando dos lados).
  // A solução não é OBB, que a física não tem: são DISCOS na linha do meio do veículo, cada um
  // testado como uma caixinha quadrada. Quadrado gira igual a si mesmo, então o conjunto acompanha o
  // volante de graça. O número de discos sai do comprimento, com sobreposição garantida — um veículo
  // comprido com três discos deixaria vão entre eles, e vão é parede atravessada.
  const raio=cfg.raioDisco;
  const util=Math.max(0,cfg.comprimento/2-raio);
  const nDiscos=Math.max(2,Math.ceil(util*2/(raio*1.5))+1);
  const discos=[];
  for(let i=0;i<nDiscos;i++)discos.push(-util+(util*2)*i/(nDiscos-1));

  function colide(x,z,rumo=0){
    const fx=-Math.sin(rumo),fz=-Math.cos(rumo);// frente do jogo: yaw 0 aponta pra -Z
    for(let i=0;i<discos.length;i++){
      const px=x+fx*discos[i],pz=z+fz*discos[i];
      if(colideObstaculoXZ(px,pz,obterElevacao(px,pz)+.03,raio,raio,cfg.alturaColisao))return true;
    }
    return false;
  }
  function moverComColisao(dx,dz,rumo){
    const x=THREE.MathUtils.clamp(player.position.x+dx,-LIMITE_MUNDO,LIMITE_MUNDO);
    const z=THREE.MathUtils.clamp(player.position.z+dz,-LIMITE_MUNDO,LIMITE_MUNDO);
    // Resolve cada eixo separadamente pro veículo conseguir raspar e contornar paredes, em vez de
    // travar completamente quando encosta num canto.
    if(!colide(x,player.position.z,rumo))player.position.x=x;
    if(!colide(player.position.x,z,rumo))player.position.z=z;
    player.position.y=obterElevacao(player.position.x,player.position.z);
  }

  // ===== ELE SE DEITA NO CHÃO, EM VEZ DE FLUTUAR =====
  // Copiar a altura do centro e ficar nivelado quer dizer, num mapa que é um morro, uma roda enterrada
  // e a outra no ar em quase todo lugar. Sem simulação de suspensão, o jeito honesto num terreno de
  // altura é AMOSTRAR O CHÃO onde as rodas estão: a inclinação sai da diferença entre a frente e a
  // traseira, o rolamento da diferença entre um lado e o outro, e a altura da média das duas pontas.
  // ===== A RODA ASSENTA NO CHÃO QUE SE VÊ, NÃO NA CURVA =====
  // Estas quatro amostras usavam `obterElevacao`, a curva ANALÍTICA. Mas a roda é desenhada contra a
  // MALHA do chão, que interpola reto entre vértices de 1,55 m: em terreno convexo ela fica abaixo da
  // curva, em côncavo acima — medido ao longo da via principal, a diferença chega a 8,9 cm.
  //
  // Ou seja: o veículo já entrava no chão visível, e o `alturaAssento:-.02` da moto era um remendo
  // médio pra isso ("Assentar exatamente na curva deixava 4,8 cm de folga mediana", diz o comentário
  // de lá). Na terra batida quase não se notava, porque roda e chão têm cor parecida. Com asfalto
  // escuro embaixo virou a queixa: "as rodas dos carros entra no asfalto, ele encosta só na parte da
  // terra".
  //
  // Amostrando a MESMA superfície que a placa de vídeo desenha, a roda encosta onde o olho espera —
  // na terra e no asfalto igualmente, porque a fita da rua também assenta nela.
  // Só o ASSENTAMENTO muda. Colisão e desmonte continuam na curva analítica, que é o que o jogador a
  // pé usa: misturar as duas na física faria veículo e pedestre discordarem de onde é o chão.
  // ===== AS AMOSTRAS VÃO ONDE AS RODAS ESTÃO, NÃO NUMA CRUZ =====
  // "lugar é inclinado aí ele fica com uma 2 roda no chão e as outras levanta."
  //
  // A versão anterior media o chão em QUATRO PONTOS EM CRUZ: frente, trás e os dois lados, todos
  // passando pelo centro do carro. Só que as rodas não estão na cruz, estão nas QUINAS. Num terreno
  // torcido o plano que passa pela cruz não é o plano que passa pelas quinas, e a diferença aparece
  // como roda no ar.
  //
  // Medido no morro da foto dele — 27.636 casos, posição x rumo, folga de cada roda contra o chão
  // desenhado:
  //     em cruz : mediana 3,1 cm · 90% 5,8 · 99% 8,7 · PIOR 12,7 · 16,9% acima de 5 cm
  //     nas quinas: mediana 2,8 cm · 90% 4,7 · 99% 6,9 · PIOR 9,8 ·  7,7% acima de 5 cm
  // Um pneu tem 33 cm: 12,7 cm de folga é um terço de roda no ar.
  // ===== ONDE O PNEU APOIA: O MAIS ALTO DE TRÊS COISAS =====
  // Isto respondia só a primeira, e as outras duas eram as queixas dele:
  //
  //  1. O CHÃO DESENHADO. A malha do terreno, que é o que a placa de vídeo mostra.
  //  2. A FITA DA RUA. Ela não assenta no terreno cru: sobe pelas quinas do chão pra o morro não
  //     furar o asfalto (ver `levanteContraQuina` no Favela.js), até uns 4,5 cm. O veículo apoiava no
  //     terreno cru — ou seja, ABAIXO do asfalto que ele vê. "no asfalto tem vários lugares que ele
  //     entra dentro." A mesma regra da fita, aplicada aqui, faz os dois concordarem por construção.
  //     Fora da rua ela vale zero em chão plano e uns centímetros na quina, que não se vê.
  //  3. A SUPERFÍCIE ANDÁVEL. Escadão, laje, piso de casa oca, chão de hospital — tudo que o
  //     jogador a pé pisa e o carro atravessava como se não existisse. "no hospital ele entra pra
  //     dentro." É a MESMA consulta do jogador (`topoAndavelAbaixo`), compartilhada e não copiada.
  //
  // O RAIO COMEÇA LOGO ACIMA DO VEÍCULO, e não numa altura fixa. Fixa alta agarraria a laje sob a
  // qual ele está passando e o teleportaria pro telhado; a altura atual dele é a referência certa,
  // porque subir rampa é gradual. `ALCANCE_APOIO` é a folga pra ele conseguir SUBIR num degrau.
  // ===== A ORIGEM DO RAIO NÃO PODE SER A ALTURA DO PRÓPRIO CARRO =====
  // A primeira versão usava `max(grupo.position.y, chao) + alcance`, e isso é uma CATRACA: perto de
  // um degrau, uma quina agarra a laje, o corpo inteiro sobe um pouco, a origem do raio sobe junto,
  // e no quadro seguinte mais quinas alcançam — o carro vai escalando sozinho. Medido na varredura
  // do morro: p99 de 7,3 cm de folga, mas um extremo de 45 cm, que é o carro escalado meio degrau.
  //
  // A referência certa é o APOIO DAQUELA QUINA no quadro anterior, guardado por quina. Ele acompanha
  // a superfície (subir rampa continua funcionando, degrau por degrau) sem realimentar a inclinação
  // do corpo, que é o que fechava o laço.
  //
  // E o alcance caiu de 70 pra 35 cm: é a guia que um carro sobe de verdade. Com 70 ele montava em
  // qualquer mureta que passasse perto.
  // ===== E A MEMÓRIA PRECISA DE TETO, SENÃO ELA ENVELHECE =====
  // Só a memória por quina não bastava: ela nunca descia sozinha. Numa queda rápida — ou na
  // varredura do teste, que TELEPORTA o veículo — a quina continuava com a altura do lugar
  // ANTERIOR, o raio partia de lá de cima, e agarrava uma laje metros acima do veículo. Medido em
  // (-30,-15): terreno a 7,22 m, laje a 10,11 m, e a moto pendurada no meio, a 9,33 m. E a altura
  // mudava conforme o RUMO testado antes — assinatura de memória velha, não de geometria.
  //
  // O teto NÃO pode ser a altura do próprio veículo. Tentei, e é o mesmo laço de sempre com outra
  // roupa: corpo alto deixa o teto alto, o teto alto agarra a laje de novo, e o corpo nunca desce.
  // Ficou na medição: a moto MONTADA parada a 5,32 m com o piloto a 2,73 — dois metros e meio acima
  // de quem estava pilotando.
  //
  // O teto é a altura de QUEM MANDA na posição, que é a mesma referência que já decide o x,z: o
  // piloto quando alguém está montado, o próprio veículo quando está estacionado (aí não há mais
  // ninguém pra discordar). O piloto tem a lógica de chão dele, que já resolve laje e escadão — e
  // com isso o veículo não tem como ficar num andar diferente do motorista.
  // Como entra por `Math.min`, só ENCURTA o alcance: nunca devolve a escalada que a memória por
  // quina resolveu.
  const ALCANCE_APOIO=.35;
  const _apoioAnterior=[-Infinity,-Infinity,-Infinity,-Infinity];
  let _tetoApoio=0;
  function alturaDeApoio(x,z,quina){
    const chao=levanteContraQuina(x,z,PASSO_DA_FITA);
    const base=Math.min(Math.max(_apoioAnterior[quina],chao),_tetoApoio);
    const sup=topoAndavelAbaixo(x,z,base+ALCANCE_APOIO,chao-.35);
    const apoio=sup!==null&&sup>chao?sup:chao;
    _apoioAnterior[quina]=apoio;
    return apoio;
  }
  const _quinas=[[1,-1],[-1,-1],[1,1],[-1,1]];// (lado, frente/trás) em unidades de meiaBitola/entreEixos
  const _alt=[0,0,0,0];
  const _eulerQuina=new THREE.Euler(),_quatQuina=new THREE.Quaternion(),_vetQuina=new THREE.Vector3();
  function assentar(x,z,rumo,refY){
    _tetoApoio=refY;
    const cy=Math.cos(rumo),sy=Math.sin(rumo);
    // ===== UMA PASSADA SÓ, E ISSO FOI MEDIDO =====
    // Tentei refinar: amostrar as quinas no plano, ajustar, e reamostrar ONDE as rodas ficam depois de
    // inclinar (numa ladeira de 30° a quina traseira anda 36 cm na horizontal). Parecia mais correto e
    // saiu PIOR em tudo — espalhamento mediano de 2,7 pra 5,2 cm, roda no ar de 3,9 pra 7,2, erro
    // contra a normal de 1,7° pra 3,7°.
    // O motivo é realimentação: mais arfagem afasta as quinas morro acima, quinas mais afastadas dão
    // mais desnível, que dá mais arfagem. A amostra no plano é a estimativa estável, e é também a mais
    // fiel ao que acontece de verdade — o corpo é que pivota, a roda fica onde está.
    for(let i=0;i<4;i++){
      const lx=_quinas[i][0]*cfg.meiaBitola,lz=_quinas[i][1]*cfg.entreEixos;
      _alt[i]=alturaDeApoio(x+lx*cy+lz*sy,z-lx*sy+lz*cy,i);
    }
    const[DD,DE,TD,TE]=_alt;
    // Plano de mínimos quadrados por cima das quatro: num retângulo isso é exatamente a média de cada
    // par. Arfagem pela diferença frente/trás, rolagem pela diferença direita/esquerda.
    const arfagem=Math.atan2((DD+DE)/2-(TD+TE)/2,cfg.entreEixos*2)-cfg.pesoNaFrente;
    const rolagem=Math.atan2((DD+TD)/2-(DE+TE)/2,cfg.meiaBitola*2);
    let py=(DD+DE+TD+TE)/4+cfg.alturaAssento;

    grupo.rotation.y=rumo;
    grupo.rotation.x=arfagem;// ângulo positivo LEVANTA o bico; o peso na frente já veio subtraído

    // ===== E AGORA DESCE ATÉ NENHUMA RODA FICAR NO AR =====
    // O que sobra depois do ajuste é a TORÇÃO do terreno, e plano nenhum resolve: corpo rígido sobre
    // chão torcido levanta roda mesmo — carro de verdade resolve com suspensão, e aqui o modelo é uma
    // malha só, sem rodas separadas (conferido no GLB: um nó de malha e mais nada).
    //
    // Mas o olho não vê os dois erros igual. Roda ENTERRADA alguns centímetros é invisível; roda NO
    // AR abre uma fresta de luz embaixo do pneu, e foi isso que ele fotografou. Então o alvo não é
    // erro zero, é FOLGA POSITIVA ZERO: desce o corpo até a roda mais alta encostar.
    if(cfg.plantarAsQuatroRodas){
      // A conta do giro é do THREE, não minha. Escrevi esta altura à mão com os dois sinais e as duas
      // discordaram da medição — o erro não era de álgebra, era de CONVENÇÃO: a ordem 'YXZ' não
      // compõe as matrizes na sequência que eu assumia. Aplicando o quaternion de verdade, a conta
      // fecha seja qual for a convenção, por quatro multiplicações de vetor no quadro.
      _eulerQuina.set(arfagem,rumo,rolagem,grupo.rotation.order);
      _quatQuina.setFromEuler(_eulerQuina);
      let maiorFolga=-Infinity,menorFolga=Infinity;
      for(let i=0;i<4;i++){
        _vetQuina.set(_quinas[i][0]*cfg.meiaBitola,0,_quinas[i][1]*cfg.entreEixos)
          .applyQuaternion(_quatQuina);
        const folga=py+_vetQuina.y-_alt[i];
        if(folga>maiorFolga)maiorFolga=folga;
        if(folga<menorFolga)menorFolga=folga;
      }
      // ===== O TETO É NO RESULTADO, NÃO NO PASSO =====
      // A primeira versão limitava o quanto o corpo DESCE. Errado: a roda mais funda já estava
      // `espalhamento` abaixo da mais alta, então o afundamento final é espalhamento + descida —
      // medido, deu 13,8 cm com um teto de 6. Limitar o passo não limita o resultado.
      if(maiorFolga>0)py-=Math.min(maiorFolga,Math.max(0,TETO_AFUNDAR+menorFolga));
    }
    grupo.position.set(x,py,z);
    return rolagem;// rolamento do terreno, pra somar com o de curva
  }

  // ===== COLISOR DO VEÍCULO PARADO =====
  // Enquanto ele é só desenho, jogador, polícia e morador atravessam como fumaça. A caixa é MÓVEL
  // porque ele anda: a fusão de colisores congelaria ele no primeiro lugar em que parou.
  // E ela SÓ EXISTE PARADO. Dirigindo, o veículo É o jogador: um colisor ali seria o corpo batendo em
  // si mesmo, e `colide` travaria no primeiro quadro.
  const caixa=new THREE.Box3(new THREE.Vector3(0,-9999,0),new THREE.Vector3(.01,-9998.99,.01));
  marcarObstaculoMovel(registrarCaixa(caixa,cfg.nome));
  const sumirCaixa=()=>{caixa.min.set(0,-9999,0);caixa.max.set(.01,-9998.99,.01)};
  function atualizarCaixa(){
    const c=Math.abs(Math.cos(grupo.rotation.y)),sn=Math.abs(Math.sin(grupo.rotation.y));
    // AABB do retângulo GIRADO: a física é alinhada aos eixos, então a caixa do veículo de lado é
    // mais larga que ele — e é o preço certo por um obstáculo que ninguém empurra.
    const meiaX=(cfg.comprimento*sn+cfg.largura*c)/2;
    const meiaZ=(cfg.comprimento*c+cfg.largura*sn)/2;
    const y=obterElevacao(grupo.position.x,grupo.position.z);
    caixa.min.set(grupo.position.x-meiaX,y-.1,grupo.position.z-meiaZ);
    caixa.max.set(grupo.position.x+meiaX,y+cfg.alturaColisao,grupo.position.z+meiaZ);
  }

  // ===== DE QUE LADO É A FRENTE DO MODELO =====
  // Não se supõe: mede-se, e depois se diz aqui. A moto veio com a frente em -X e o comentário do
  // arquivo dizia +X — ela andou de rabo até alguém fotografar. `giroDoModelo` é o conserto, em
  // radianos, e a conta é: girando Y por θ, o ponto (-1,0,0) vai pra (0,0,-1) com θ = -90°, que é a
  // frente do jogo.
  function ajustarModelo(root){
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    _box.setFromObject(root);_box.getSize(_size);
    const maior=Math.max(_size.x,_size.y,_size.z)||1;
    root.scale.setScalar(cfg.comprimento/maior);
    _box.setFromObject(root);_box.getCenter(_center);
    root.position.sub(_center);
    root.position.y+=_size.y*.5/maior*cfg.comprimento;
    root.rotation.y=cfg.giroDoModelo;
  }
  new GLTFLoader().load(cfg.arquivo,gltf=>{
    ajustarModelo(gltf.scene);grupo.add(gltf.scene);carregado=true;
    // DEPOIS do `ajustarModelo`: ele escala, centra e gira a raiz, e as rodas entram como filhas da
    // malha, herdando tudo isso. Separar antes daria peças na escala crua do arquivo.
    if(cfg.rodasQueGiram)rodas=separarRodas(gltf.scene,cfg.rodasQueGiram);
    assentar(player.position.x+cfg.nascePerto,player.position.z+cfg.nascePerto,0,player.position.y);
    atualizarCaixa();// já nasce sendo obstáculo: chega parado, e parado ele tem corpo
    grupo.visible=true;
  },undefined,err=>console.warn(`Quintal 3D: ${cfg.nome} não carregou`,err));

  const perto=()=>Math.hypot(grupo.position.x-player.position.x,grupo.position.z-player.position.z)<=cfg.raioMontar;
  const limitar=v=>Math.abs(v)<ZONA_MORTA?0:THREE.MathUtils.clamp(v,-1,1);

  // ===== O DEDO PEDE VELOCIDADE, NÃO ACELERAÇÃO =====
  // "coloque velocidade no carro tipo prá mim controlar melhor ele por causa que e favela, carro vai
  // precisar andar devagar tbm."
  //
  // O que havia aqui usava a posição do dedo só como MULTIPLICADOR DA ACELERAÇÃO, e o teto era sempre
  // `cfg.maxVel`. Medido no jogo antes da mudança, com o dedo sustentado por 6 s: 0,25 de dedo deu
  // 13,07 m/s, 0,5 deu 14,00 e 0,75 deu 14,00 — ou seja, meio dedo ia EXATAMENTE tão rápido quanto
  // dedo cheio, só demorava mais pra chegar. Não havia como cruzar devagar, e num beco de 2,45 m
  // livres o carro chegava aos 50 km/h em 1,6 s.
  //
  // O `Input.js` já entrega o analógico inteiro (`joyY` = deslocamento sobre o raio, com corte
  // circular no aro). A informação de "quanto" sempre existiu; ela é que era descartada aqui.
  //
  // Agora o dedo define a velocidade ALVO e a aceleração é só o quanto se corre atrás dela.
  // A TAXA CONTINUA ESCALADA POR `|acelerador|`, e isso não é sobra do código velho: sem a escala,
  // meio dedo daria um TRANCO até o cruzeiro baixo. Com ela, o tempo pra chegar no alvo fica
  // constante (~1,55 s) em qualquer posição do dedo — 0,5 busca 7 m/s a 4,5 m/s², 0,15 busca 2,1 m/s
  // a 1,35 m/s². O carro responde igual, só que a menos.
  //
  // Freio e ré ficaram COMO ESTAVAM, a pedido dele: puxar pra trás freia forte e, passando do zero,
  // engata a ré. O que mudou de graça é que agora dá pra frear só ALIVIANDO o dedo — cair pra 30%
  // desce macio até 30% da máxima, em vez de não fazer nada.
  function atualizarVelocidade(dt,acelerador){
    const alvo=acelerador>=0?acelerador*cfg.maxVel:acelerador*cfg.maxRe;
    if(velocidade<alvo){
      // Ganhar velocidade pra frente. Vindo da ré isto é FREADA, não aceleração: quem tira o carro de
      // ré é o freio, e usar `aceleracao` aqui deixaria a inversão de sentido lerda.
      const taxa=velocidade<0?cfg.freio:cfg.aceleracao*Math.abs(acelerador);
      velocidade=Math.min(alvo,velocidade+taxa*dt);
    }else if(velocidade>alvo){
      // Perder velocidade. Duas coisas bem diferentes moram aqui, e é a distinção que dá o controle:
      //   · o dedo pedindo o CONTRÁRIO (puxou pra trás) -> freio de verdade;
      //   · o dedo só ALIVIOU (ainda pra frente, mas menos) -> atrito, o freio-motor. É o gesto de
      //     quem vai entrar num beco, e tem que ser macio, não uma freada.
      const taxa=velocidade>0
        ?(acelerador<0?cfg.freio:cfg.atrito)
        :cfg.aceleracaoRe*Math.abs(acelerador);// já em ré: acelerando pra trás
      velocidade=Math.max(alvo,velocidade-taxa*dt);
    }
  }

  // ===== O BOTÃO SÓ EXISTE QUANDO SERVE PRA ALGUMA COISA =====
  // "os botão de carro e moto devem aparecer só quando estiver perto do veículo."
  // Eram dois botões fixos no meio da tela, o tempo todo, ocupando o espaço bom do polegar — e a
  // única coisa que faziam longe do veículo era responder "você está longe". Agora aparecem quando
  // dá pra usar: perto o bastante pra montar, ou já dirigindo (aí ele é o botão de DESCER).
  // `raioMontar` é a MESMA distância que o `alternar` cobra, então o botão nunca aparece mentindo.
  function atualizarBotao(){
    const b=document.getElementById(cfg.botaoId);
    if(!b)return;
    b.textContent=montado?cfg.rotuloSair:cfg.rotuloEntrar;
    b.hidden=!(montado||(carregado&&perto()));
  }

  function alternar(){
    if(!carregado){aviso(cfg.avisoCarregando);return}
    if(montado){
      // ===== DESCER É SAIR DE DENTRO DELE =====
      // Como o veículo parado TEM colisor, desmontar em cima dele emparedaria o jogador dentro do
      // próprio veículo — ele desce exatamente na posição dele. Um passo pro lado esquerdo; se aquele
      // lado estiver contra um muro, `buscarPosicaoLivre` acha o ponto livre mais próximo.
      montado=false;emUso=null;velocidade=0;player.visible=true;
      cfg.aoDescer?.();
      player.rotation.x=0;player.rotation.z=0;// desfaz o tombo que ele pegou do veículo
      const lx=Math.cos(player.rotation.y),lz=-Math.sin(player.rotation.y);
      let px=player.position.x-lx*cfg.passoPraDescer,pz=player.position.z-lz*cfg.passoPraDescer;
      const corpo=(x,z)=>colideObstaculoXZ(x,z,obterElevacao(x,z)+.1,.35,.35,1.6);
      const livre=buscarPosicaoLivre(px,pz,corpo,4);
      if(livre){px=livre.x;pz=livre.z}
      player.position.set(px,obterElevacao(px,pz),pz);
      atualizarCaixa();
      grupo.visible=true;atualizarBotao();aviso(cfg.avisoDescer);return;
    }
    if(emUso&&emUso!==cfg.nome){aviso('Você já está dirigindo. Desça primeiro.');return}
    if(!perto()){aviso(cfg.avisoLonge);return}
    // ===== O MOTORISTA APARECE OU NÃO, POR VEÍCULO =====
    // Na MOTO ele tem que aparecer: sem ele a moto desce a rua sozinha, que foi o defeito que o Bruno
    // apontou. No CARRO ele pediu o contrário — dentro de uma lataria fechada o boneco quase não se
    // vê, e o que aparece é a cabeça pelo para-brisa. Então quem manda é a ficha do veículo.
    montado=true;emUso=cfg.nome;velocidade=0;grupo.visible=true;
    player.visible=cfg.motoristaVisivel!==false;
    player.rotation.y=grupo.rotation.y;
    cfg.aoMontar?.();
    aviso(cfg.avisoMontar);atualizarBotao();
  }

  function atualizar(dt,keys,joyX=0,joyY=0,alavanca=0,reSegurada=false){
    if(!carregado)return montado;
    // Mostrar/esconder o botão é decisão de QUADRO (o jogador anda, a distância muda), mas escrever
    // no DOM 60 vezes por segundo pra dizer a mesma coisa não é. Só toca quando VIRA.
    const deveAparecer=montado||perto();
    if(deveAparecer!==botaoVisivel){botaoVisivel=deveAparecer;atualizarBotao()}
    if(!montado){
      // PARADO TAMBÉM PRECISA DE QUADRO. Sem isto o veículo largado fica com a pose do instante em
      // que foi solto — nivelado, mesmo num barranco. E é parado que ele tem colisor, então é aqui
      // que a caixa é mantida em dia.
      // ===== PARADO TAMBÉM ROLA COM O MORRO =====
      // Aqui estava `grupo.rotation.z=0`, com o comentário dizendo "só o que o chão manda" — e
      // mandando ZERO. O `assentar` calculava a rolagem do terreno e a linha de baixo jogava fora.
      //
      // É ESTA a foto que o Bruno mandou: carro PARADO num barranco, duas rodas no chão e duas no ar.
      // Eu tinha medido o problema só com o carro MONTADO, onde a rolagem é aplicada, e por isso o
      // erro contra a normal do terreno dava 1,4° e parecia que estava tudo certo. Parado, medido
      // agora em 7.200 casos no morro dele: 21,5° de erro e até 23 cm de roda no ar.
      //
      // Sem motorista não há inclinação de CURVA (não há curva), mas a do CHÃO continua existindo —
      // são coisas diferentes, e foi somá-las numa variável só que deixou a segunda ser apagada com
      // a primeira.
      grupo.rotation.z=assentar(grupo.position.x,grupo.position.z,grupo.rotation.y,grupo.position.y);
      atualizarCaixa();
      return false;
    }

    // ===== O ANALÓGICO NÃO ACELERA MAIS. SÓ DIRIGE. =====
    // (Morreu aqui o comentário do SINAL do `joyY`, que explicava por que o acelerador levava um `-`:
    //  a coordenada Y da tela cresce pra baixo, então dedo pra frente dava valor negativo, e acertar
    //  esse sinal custou quatro commits. Ele não vale mais porque o `joyY` saiu da conta de
    //  velocidade — e deixar comentário descrevendo código que não existe é pior que não ter nenhum.
    //  Quem ainda depende desse sinal é o andar a pé, no `Player.js`, e lá a explicação continua.)
    // "não quero que o análogo freia não enquanto tô virando."
    //
    // Ele estava certo e a causa era estrutural: o acelerador saía do EIXO Y do analógico, e o
    // analógico é UM SÓ. Empurrar na diagonal pra virar encolhe a componente pra frente — com o corte
    // circular no aro, diagonal cheia dá joyY ≈ -0,707. Medido no jogo: dedo cheio reto = 14,0 m/s,
    // dedo cheio na diagonal = 9,9 m/s. Virar custava 30% da velocidade, e ia custar enquanto as duas
    // funções dividissem o mesmo dedo. Não dava pra ajustar isso; dava pra separar.
    //
    // Agora o acelerador tem alavanca própria (`Acelerador.js`) e `joyY` NÃO ENTRA MAIS NA CONTA da
    // velocidade — some da linha de baixo de propósito, e este comentário existe pra ninguém somar
    // ele de volta "pra funcionar no celular". No celular quem acelera é a alavanca.
    //
    // O TECLADO CONTINUA INTEIRO: W acelera, S freia e dá ré. Quem joga no PC não perde nada, e o
    // `Math.max` deixa os dois caminhos conviverem sem um anular o outro.
    const reAtiva=reSegurada||!!keys.KeyS;
    const acelerador=reAtiva?-1:Math.max(keys.KeyW?1:0,Math.max(0,Math.min(1,alavanca)));
    const direcao=limitar((keys.KeyD?1:0)-(keys.KeyA?1:0)+joyX);
    atualizarVelocidade(dt,acelerador);

    const rapidez=Math.min(1,Math.abs(velocidade)/cfg.maxVel);
    if(Math.abs(velocidade)>.08&&direcao){
      // Leve ao manobrar devagar e firme em velocidade; na ré o sentido do esterço inverte sozinho.
      // A convenção do jogo usa -Z como frente: com ela, diminuir o yaw é a curva pra direita.
      const taxa=cfg.esterco+rapidez*cfg.estercoPorVelocidade;
      player.rotation.y-=direcao*taxa*dt*Math.sign(velocidade);
    }

    _frente.set(-Math.sin(player.rotation.y),0,-Math.cos(player.rotation.y));
    const distancia=velocidade*dt;
    // ===== BATEU? MEDE O QUE ANDOU, NÃO O QUE FOI BLOQUEADO =====
    // Perguntar "os dois eixos foram bloqueados?" NUNCA dá verdadeiro: indo reto contra uma parede no
    // eixo -Z, o passo em X é ZERO — e um passo de zero sempre "cabe". Depois de encostar no muro
    // sobravam 9,58 m/s dos 11 possíveis. Comparar o que ANDOU com o que PEDIU pra andar não tem esse
    // ponto cego, e ainda pega a batida de raspão em qualquer ângulo.
    const antesX=player.position.x,antesZ=player.position.z;
    moverComColisao(_frente.x*distancia,_frente.z*distancia,player.rotation.y);
    const pedido=Math.abs(distancia);
    if(pedido>1e-4){
      const andou=Math.hypot(player.position.x-antesX,player.position.z-antesZ);
      // Perde quase toda a inércia, como bater de verdade. Sobra um resto pra não ficar grudado na
      // parede — com zero, um toque de raspão deixaria o veículo morto encostado no muro.
      if(andou<pedido*.35)velocidade*=.15;
    }

    // ===== AS RODAS GIRAM E AS DA FRENTE ESTERÇAM =====
    // O giro sai da distância percorrida, não de um número inventado: `distância / raio` é o ângulo
    // que uma roda que NÃO PATINA percorre. Assim a roda acompanha a velocidade sozinha, inclusive na
    // ré (distância negativa gira ao contrário) e na freada.
    //
    // O sinal foi deduzido e conferido: o pneu roda em torno do eixo mais fino dele, e um ponto no
    // FUNDO da roda tem que andar pra TRÁS em relação ao carro — é isso que "rolar sem patinar"
    // quer dizer. Com a frente do modelo no lado negativo do eixo comprido, isso dá ângulo crescente.
    if(rodas){
      // ===== CADA RODA COM O SEU RAIO =====
      // Era um ângulo só, do `rodas[0]`, pra todas. Num carro dá no mesmo (as quatro são iguais), mas
      // a moto tem 22 cm na frente contra 19,4 atrás — 13% de diferença, que numa roda grande ao lado
      // de uma pequena se vê. `distância / raio` é o ângulo de quem rola SEM PATINAR, e ele depende
      // do raio de cada uma.
      // ===== O SINAL DO ESTERÇO, DERIVADO E NÃO CHUTADO =====
      // "eu viro pra direita, as rodas vão pra esquerda, mas o carro vai na direção certa."
      //
      // Era `direcao*ESTERCO_VISUAL`, positivo. A conta que manda está seis linhas acima:
      //     player.rotation.y -= direcao*taxa*dt*Math.sign(velocidade)
      // ou seja, `direcao` POSITIVO faz o yaw DIMINUIR, e o comentário de lá diz o que isso quer
      // dizer: "diminuir o yaw é a curva pra direita". Logo, virar pra direita é yaw NEGATIVO, e a
      // roda tem que acompanhar o carro — com o sinal positivo ela apontava pro lado contrário.
      //
      // O pivô é neto da raiz, que leva um giro de -90° em Y. Giro em Y compõe somando com giro em Y,
      // então o sinal local é o mesmo do mundo — não há inversão escondida no caminho.
      const esterco=-direcao*ESTERCO_VISUAL;
      for(const r of rodas){
        r.angulo=(r.angulo||0)+distancia/Math.max(.05,r.raio);
        r.malha.rotation[r.eixoGiro]=r.angulo;
        // Só as da frente esterçam; as de trás ficam retas, como em qualquer carro.
        if(r.dianteira)r.pivo.rotation.y=esterco;
      }
    }

    const rolamentoDoChao=assentar(player.position.x,player.position.z,player.rotation.y,player.position.y);
    // Inclinação de curva, visual, sem alterar a colisão. Somada ao rolamento do terreno: numa encosta
    // de través o veículo tomba pro lado de baixo, e é isso que mantém as rodas no chão.
    const inclinacao=direcao*rapidez*cfg.inclinacaoNaCurva;
    // ===== SÃO DUAS ROLAGENS, COM TEMPOS DIFERENTES =====
    // Elas estavam somadas dentro do MESMO amortecimento, e por isso a geometria herdou um atraso que
    // não era dela. A constante era 0,1 s; a 14 m/s isso é 1,4 m de estrada — quase um entre-eixos
    // inteiro. Medido: parado o espalhamento entre as quatro rodas é 2–3 cm, andando no talo vai a
    // 7,4 cm. O atraso TRIPLICA o defeito.
    //
    //  · a do TERRENO é geometria: onde o chão está agora, e não onde estava há um décimo de segundo.
    //    Vai direto, igual à arfagem, que sempre foi direta.
    //  · a de CURVA é peso do carro se transferindo, e é o atraso que a faz LER como peso. Continua
    //    amortecida.
    //
    // A moto fica de fora: nela a rolagem é o piloto deitando na curva, e tirar o atraso deixaria a
    // moto rígida. Por isso a separação é por ficha (`rolagemDoTerrenoDireta`) e não pra todo mundo.
    if(cfg.rolagemDoTerrenoDireta){
      inclinacaoDeCurva=THREE.MathUtils.lerp(inclinacaoDeCurva,-inclinacao,1-Math.exp(-10*dt));
      grupo.rotation.z=rolamentoDoChao+inclinacaoDeCurva;
    }else{
      grupo.rotation.z=THREE.MathUtils.lerp(grupo.rotation.z,rolamentoDoChao-inclinacao,1-Math.exp(-10*dt));
    }
    sumirCaixa();// dirigindo, o veículo é o jogador: colisor aqui seria ele batendo em si mesmo

    // ===== O MOTORISTA ANDA JUNTO =====
    // O grupo `player` (que carrega o boneco 3D) copia a pose do veículo — inclinação do terreno e
    // tombo de curva incluídos. Sem isto ele ficaria de pé e nivelado enquanto o veículo empina.
    player.rotation.order='YXZ';
    player.rotation.x=grupo.rotation.x;
    player.rotation.z=grupo.rotation.z;
    cfg.aoQuadro?.(dt);
    return true;
  }

  const btn=document.getElementById(cfg.botaoId);
  btn?.addEventListener('pointerdown',e=>{e.preventDefault();alternar()});
  if(cfg.tecla)addEventListener('keydown',e=>{
    if(e.code===cfg.tecla&&!e.repeat){e.preventDefault();alternar()}
  });
  atualizarBotao();

  // ===== ONDE ELE ESTÁ, PRO RADAR =====
  // "marque o carro e a moto no mapa também, quando fico longe custo achar eles."
  // Mora AQUI, na mecânica compartilhada, e não em Carro.js/Moto.js: os dois arquivos são fichas, e
  // regra de veículo escrita duas vezes é regra que diverge no primeiro ajuste.
  // Devolve null em dois casos, e os dois importam:
  //   · ANTES DO GLB CARREGAR o grupo está em (0,0,0) e invisível — marcar ali poria uma bolinha
  //     falsa no meio do mapa, apontando pra um carro que ainda não existe em lugar nenhum;
  //   · MONTADO, porque aí o veículo está debaixo do jogador. Marca em cima do próprio jogador não
  //     informa nada e ainda tapa o ponto dele. O OUTRO veículo continua marcado, que é o que serve.
  const marcaNoMapa=()=>carregado&&!montado?{x:grupo.position.x,z:grupo.position.z}:null;
  return{grupo,alternar,atualizar,montado:()=>montado,velocidade:()=>velocidade,marcaNoMapa,
    // O teto em m/s. Quem precisa é a alavanca de acelerador: as marcas dela são em km/h e a escada
    // é filtrada pelo teto do veículo que está sendo dirigido (o carro chega a 50, a moto a 40).
    maxVel:()=>cfg.maxVel};
}
