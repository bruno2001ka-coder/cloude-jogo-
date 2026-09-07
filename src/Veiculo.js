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
import{player}from'./Player.js';
import{scene}from'./core.js';
import{obterElevacao,alturaDoChaoDesenhado}from'./Terrain.js';
import{colideObstaculoXZ,registrarCaixa,marcarObstaculoMovel,buscarPosicaoLivre}from'./Physics.js';
import{PLAYER_LIMIT}from'./WorldBounds.js';

// O limite antigo de 124 m fazia carro e moto ignorarem a expansão do mapa, mesmo quando o jogador
// a pé já conseguia chegar muito mais longe. Todos os modos agora usam a mesma borda jogável.
const LIMITE_MUNDO=PLAYER_LIMIT,ZONA_MORTA=.12;
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
  function assentar(x,z,rumo){
    const fx=-Math.sin(rumo),fz=-Math.cos(rumo);
    const lx=Math.cos(rumo),lz=-Math.sin(rumo);
    const yF=alturaDoChaoDesenhado(x+fx*cfg.entreEixos,z+fz*cfg.entreEixos);
    const yT=alturaDoChaoDesenhado(x-fx*cfg.entreEixos,z-fz*cfg.entreEixos);
    const yD=alturaDoChaoDesenhado(x+lx*cfg.meiaBitola,z+lz*cfg.meiaBitola);
    const yE=alturaDoChaoDesenhado(x-lx*cfg.meiaBitola,z-lz*cfg.meiaBitola);
    grupo.position.set(x,(yF+yT)/2+cfg.alturaAssento,z);
    grupo.rotation.y=rumo;
    // Girando em torno do X local, ângulo positivo LEVANTA o bico; subtrair o peso baixa ele.
    grupo.rotation.x=Math.atan2(yF-yT,cfg.entreEixos*2)-cfg.pesoNaFrente;
    return Math.atan2(yD-yE,cfg.meiaBitola*2);// rolamento do terreno, pra somar com o de curva
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
    assentar(player.position.x+cfg.nascePerto,player.position.z+cfg.nascePerto,0);
    atualizarCaixa();// já nasce sendo obstáculo: chega parado, e parado ele tem corpo
    grupo.visible=true;
  },undefined,err=>console.warn(`Quintal 3D: ${cfg.nome} não carregou`,err));

  const perto=()=>Math.hypot(grupo.position.x-player.position.x,grupo.position.z-player.position.z)<=cfg.raioMontar;
  const limitar=v=>Math.abs(v)<ZONA_MORTA?0:THREE.MathUtils.clamp(v,-1,1);

  function atualizarVelocidade(dt,acelerador){
    if(acelerador>0){
      if(velocidade<0)velocidade=Math.min(0,velocidade+cfg.freio*dt);
      else velocidade=Math.min(cfg.maxVel,velocidade+acelerador*cfg.aceleracao*dt);
    }else if(acelerador<0){
      if(velocidade>0)velocidade=Math.max(0,velocidade+acelerador*cfg.freio*dt);
      else velocidade=Math.max(-cfg.maxRe,velocidade+acelerador*cfg.aceleracaoRe*dt);
    }else if(Math.abs(velocidade)>0){
      const perda=Math.min(Math.abs(velocidade),cfg.atrito*dt);
      velocidade-=Math.sign(velocidade)*perda;
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

  function atualizar(dt,keys,joyX=0,joyY=0){
    if(!carregado)return montado;
    // Mostrar/esconder o botão é decisão de QUADRO (o jogador anda, a distância muda), mas escrever
    // no DOM 60 vezes por segundo pra dizer a mesma coisa não é. Só toca quando VIRA.
    const deveAparecer=montado||perto();
    if(deveAparecer!==botaoVisivel){botaoVisivel=deveAparecer;atualizarBotao()}
    if(!montado){
      // PARADO TAMBÉM PRECISA DE QUADRO. Sem isto o veículo largado fica com a pose do instante em
      // que foi solto — nivelado, mesmo num barranco. E é parado que ele tem colisor, então é aqui
      // que a caixa é mantida em dia.
      assentar(grupo.position.x,grupo.position.z,grupo.rotation.y);
      grupo.rotation.z=0;// sem motorista não há inclinação de curva; só o que o chão manda
      atualizarCaixa();
      return false;
    }

    // ===== O SINAL DO ANALÓGICO, E POR QUE ELE É NEGATIVO =====
    // `Input.js` calcula `joyY=(clientY-centro)/max`, e a coordenada Y da TELA cresce PRA BAIXO.
    // Empurrar o dedo pra FRENTE dá `joyY` NEGATIVO. O andar a pé já sabe disso (`Player.js` soma
    // `joyY` no eixo que aponta pra TRÁS), mas o teclado usa a convenção contrária (`KeyW` = +1 =
    // frente): uma variável, duas convenções.
    // Medido no jogo antes do conserto: analógico pra frente andava -4,7 m (ré) e pra trás +10,2 m,
    // enquanto o W andava +16,5 m. No celular o veículo fazia o contrário do dedo. O `-` abaixo é o
    // conserto, e este comentário existe pra ninguém inverter de novo às cegas: foram quatro commits
    // seguidos tentando adivinhar esse sinal.
    const teclado=(keys.KeyW?1:0)-(keys.KeyS?1:0);
    // Soma em vez de `teclado||joyY`: com o `||`, uma tecla encostada anulava o analógico inteiro.
    const acelerador=limitar(teclado-joyY);
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

    const rolamentoDoChao=assentar(player.position.x,player.position.z,player.rotation.y);
    // Inclinação de curva, visual, sem alterar a colisão. Somada ao rolamento do terreno: numa encosta
    // de través o veículo tomba pro lado de baixo, e é isso que mantém as rodas no chão.
    const inclinacao=direcao*rapidez*cfg.inclinacaoNaCurva;
    grupo.rotation.z=THREE.MathUtils.lerp(grupo.rotation.z,rolamentoDoChao-inclinacao,1-Math.exp(-10*dt));
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

  return{grupo,alternar,atualizar,montado:()=>montado,velocidade:()=>velocidade};
}
