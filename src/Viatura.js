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
// Duas, uma por via, porque foi o que ele pediu e porque é o que cobre o mapa: as duas curvas juntas
// passam perto de quase tudo.
import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{viaPrincipal,viaBaixa}from'./Favela.js';
import{registrarCaixa,marcarObstaculoMovel}from'./Physics.js';

const COMPRIMENTO=1.90,LARGURA=.86,ALTURA_COLISAO=.85;
const VEL_RONDA=5.5,VEL_ATENDENDO=10;// atendendo ocorrência ela acelera, e dá pra ouvir chegando
const ENTRE_EIXOS=.70;
const ALTURA_ASSENTO=-.02;// mesmo motivo dos outros veículos: o chão desenhado fica abaixo da curva
// A que distância da ocorrência ela considera que chegou. Não é zero: ela para NA RUA, no ponto mais
// perto da plantação, e daí os policiais seguem a pé — que é o desenho todo.
const CHEGOU=2.0;

const viaturas=[];
let modelo=null;

function criarViatura(curva,u0){
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
  return{grupo,curva,u:u0,luzes,caixa,piscaT:0,vaiVoltando:false,comprimentoDaVia:curva.getLength()};
}

// Onde na curva fica o ponto mais perto de um alvo. Amostragem simples: 120 pontos numa via de ~160 m
// dá 1,3 m de resolução, e o que se quer aqui é "em que altura da rua eu paro", não precisão de
// milímetro. Devolve o `u` de 0 a 1.
function uMaisPerto(curva,alvo){
  let melhor=0,dist=Infinity;
  for(let i=0;i<=120;i++){
    const u=i/120,p=curva.getPointAt(u);
    const d=(p.x-alvo.x)**2+(p.z-alvo.z)**2;
    if(d<dist){dist=d;melhor=u}
  }
  return melhor;
}

function assentar(v){
  const p=v.curva.getPointAt(v.u),t=v.curva.getTangentAt(v.u);
  // A frente do jogo é (-sen, -cos) do yaw. Igualando à tangente da via sai o yaw direto.
  const rumo=Math.atan2(-t.x,-t.z);
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

viaturas.push(criarViatura(viaPrincipal,.15),criarViatura(viaBaixa,.6));

// `alvo` é o centro da plantação sendo batida, ou null. Vem do `main` pra este módulo não precisar
// conhecer a polícia — quem já sabe dos dois é o laço do jogo.
export function atualizarViaturas(dt,alvo){
  if(!modelo)return;
  for(const v of viaturas){
    if(alvo){
      // ATENDENDO: vai até a altura da rua mais perto da plantação e PARA ali. Não sai da via em
      // momento nenhum — quem entra no beco é o policial a pé.
      const destino=uMaisPerto(v.curva,alvo);
      let d=destino-v.u;
      // A via não é um circuito fechado, então não há caminho "pela volta": anda no sentido do sinal.
      const passo=VEL_ATENDENDO*dt/v.comprimentoDaVia;
      if(Math.abs(d)*v.comprimentoDaVia>CHEGOU)v.u+=Math.sign(d)*Math.min(passo,Math.abs(d));
      // Giroflex piscando: alterna a cada 0,25 s.
      v.piscaT+=dt;
      const liga=Math.floor(v.piscaT*4)%2;
      v.luzes[0].material.emissiveIntensity=liga?2.4:.15;
      v.luzes[1].material.emissiveIntensity=liga?.15:2.4;
    }else{
      // RONDA: percorre a via de ponta a ponta e volta. `vaiVoltando` inverte no fim, porque a via é
      // aberta — seguir em frente sairia do traçado.
      v.u+=(v.vaiVoltando?-1:1)*VEL_RONDA*dt/v.comprimentoDaVia;
      if(v.u>=1){v.u=1;v.vaiVoltando=true}
      if(v.u<=0){v.u=0;v.vaiVoltando=false}
      v.piscaT=0;
      for(const l of v.luzes)l.material.emissiveIntensity=.2;
    }
    assentar(v);
  }
}
// Exposto pro teste: posição, rumo, estado do giroflex e o COLISOR de cada viatura, sem precisar
// cavar na cena. O colisor vem daqui e não da lista da física de propósito: depois da fusão,
// `obstaculos` e `categoriasObstaculo` não andam mais em paralelo, e casar por índice devolveria a
// caixa errada — a que manda é esta referência, que é a mesma que a física recebeu.
export function __viaturas(){
  return viaturas.map(v=>({x:+v.grupo.position.x.toFixed(2),z:+v.grupo.position.z.toFixed(2),
    rumo:+v.grupo.rotation.y.toFixed(3),u:+v.u.toFixed(3),
    piscando:v.luzes[0].material.emissiveIntensity>1||v.luzes[1].material.emissiveIntensity>1,
    caixa:{minX:v.caixa.min.x,minY:v.caixa.min.y,minZ:v.caixa.min.z,
           maxX:v.caixa.max.x,maxY:v.caixa.max.y,maxZ:v.caixa.max.z}}));
}
