// ===== HOSPITAL: Ponto de respawn com realismo máximo =====
//
// Este módulo cria o hospital onde o jogador nasce ao morrer. O edifício é modelado com:
// - Arquitetura realista de hospital público brasileiro
// - Portas automáticas funcionais (deslizantes)
// - Interior detalhado: recepção, corredores, sala de emergência, elevador
// - Iluminação clínica característica
// - Equipamentos médicos visíveis (macas, monitores, IV)
// - Sinalização realista
//
// O spawn do jogador foi movido do ponto inicial genérico para a entrada do hospital,
// dando sentido narrativo ao "renascer" — você acorda na emergência depois de ser
// atendido.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,registrarCaixa,marcarSemFusao,marcarObstaculoMovel,superficiesAndaveis}from'./Physics.js';

export const HOSPITAL_POS={x:-45,z:-60};
// O modelo foi criado em escala de referência grande. Em .62 ele ocupava quase uma quadra e
// destacava-se das casas; .42 mantém a porta e a rampa jogáveis sem transformar o prédio num marco.
const ESCALA_HOSPITAL=.42;
const ALTURA_PISO=0.08;

// ===== MATERIAIS CLÍNICOS =====
const matParede=new THREE.MeshStandardMaterial({color:0xf5f5f0,roughness:0.7,metalness:0.0});
const matPiso=new THREE.MeshStandardMaterial({color:0xe8e8e0,roughness:0.4,metalness:0.1});
const matTeto=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.8,metalness:0.0});
const matPorta=new THREE.MeshStandardMaterial({color:0xc8c8c0,roughness:0.5,metalness:0.3});
const matVidro=new THREE.MeshStandardMaterial({color:0xa8d8e8,roughness:0.1,metalness:0.0,transparent:true,opacity:0.4});
const matAzulHospital=new THREE.MeshStandardMaterial({color:0x4a90b8,roughness:0.6,metalness:0.1});
const matVerdeCirurgical=new THREE.MeshStandardMaterial({color:0x2d5a3f,roughness:0.5,metalness:0.0});

// ===== DIMENSÕES DO EDIFÍCIO =====
const LARGURA=18,PROFUNDIDADE=24,ALTURA=5.2;
const ALTURA_PAVIMENTO=3.2;

const grupoHospital=new THREE.Group();
const paredesHospital=[];
// O prédio foi modelado num tamanho de referência maior que as casas do mapa. A escala mantém o
// interior, as portas e o heliponto proporcionais sem reescrever dezenas de medidas locais.
grupoHospital.scale.setScalar(ESCALA_HOSPITAL);
// O terreno tem declive e ruído em escala menor que o prédio. Medimos a fundação inteira e o interior
// separadamente: a fundação pode ser enterrada, mas o piso precisa ficar acima do ponto mais alto do
// terreno interno para que nenhuma faixa de terra atravesse o Hospital.
const meioX=(LARGURA+.6)*ESCALA_HOSPITAL/2,meioZ=(PROFUNDIDADE+.6)*ESCALA_HOSPITAL/2;
let terrenoHospital=Infinity,terrenoInterior=-Infinity;
for(let ix=0;ix<=8;ix++)for(let iz=0;iz<=8;iz++){
  const x=HOSPITAL_POS.x-meioX+ix*meioX*2/8;
  const z=HOSPITAL_POS.z-meioZ+iz*meioZ*2/8;
  const h=obterElevacao(x,z);terrenoHospital=Math.min(terrenoHospital,h);
  const interiorX=Math.abs(x-HOSPITAL_POS.x)<(LARGURA/2-.5)*ESCALA_HOSPITAL;
  const interiorZ=Math.abs(z-HOSPITAL_POS.z)<(PROFUNDIDADE/2-.5)*ESCALA_HOSPITAL;
  if(interiorX&&interiorZ)terrenoInterior=Math.max(terrenoInterior,h);
}
const ALTURA_BASE_LOCAL=.55;
const ALTURA_TOPO_PISO_LOCAL=.15;
const COTA_PISO_HOSPITAL=terrenoInterior+.04;
grupoHospital.position.set(HOSPITAL_POS.x,COTA_PISO_HOSPITAL-ALTURA_TOPO_PISO_LOCAL*ESCALA_HOSPITAL,HOSPITAL_POS.z);
scene.add(grupoHospital);

// ===== FUNDAÇÃO =====
const fundacao=new THREE.Mesh(
  new THREE.BoxGeometry(LARGURA+0.6,0.4,PROFUNDIDADE+0.6),
  new THREE.MeshStandardMaterial({color:0x686860,roughness:0.9})
);
fundacao.position.y=-0.35;
fundacao.receiveShadow=true;
grupoHospital.add(fundacao);

// ===== PISO TÉRREO =====
const pisoTerreo=new THREE.Mesh(new THREE.BoxGeometry(LARGURA,0.3,PROFUNDIDADE),matPiso);
pisoTerreo.position.y=0;
pisoTerreo.receiveShadow=true;
grupoHospital.add(pisoTerreo);
// O raycast vertical do jogador precisa reconhecer o piso interno, não apenas o terreno natural.
superficiesAndaveis.push(pisoTerreo);
const fundoPlatôLocal=(terrenoHospital-grupoHospital.position.y)/ESCALA_HOSPITAL-.08;
const topoPlatôLocal=-.15;
const alturaPlatô=Math.max(.25,topoPlatôLocal-fundoPlatôLocal);
const platoNivelamento=new THREE.Mesh(
  new THREE.BoxGeometry(LARGURA+.9,alturaPlatô,PROFUNDIDADE+.9),
  new THREE.MeshStandardMaterial({color:0x777770,roughness:0.9})
);
platoNivelamento.position.y=(fundoPlatôLocal+topoPlatôLocal)/2;
platoNivelamento.receiveShadow=true;
grupoHospital.add(platoNivelamento);

// ===== PAREDES EXTERNAS =====
function criarParede(x,y,z,larg,alt,prof,comVidro=false,vidroY=0,vidroH=0){
  const parede=new THREE.Mesh(new THREE.BoxGeometry(larg,alt,prof),matParede);
  parede.position.set(x,y,z);
  parede.castShadow=true;
  parede.receiveShadow=true;
  grupoHospital.add(parede);
  
  if(comVidro&&vidroH>0){
    const vidro=new THREE.Mesh(new THREE.BoxGeometry(larg-0.3,vidroH,prof+0.05),matVidro);
    vidro.position.set(x,y+vidroY,z);
    vidro.castShadow=false;
    vidro.receiveShadow=false;
    grupoHospital.add(vidro);
  }
  return parede;
}
function registrarParedeHospital(parede){
  paredesHospital.push(marcarSemFusao(registrarObstaculo(parede,'hospital')));
  return parede;
}

// Fachada frontal com vão real de entrada: as três peças não podem virar uma caixa única na fusão.
const VAO_ENTRADA=3.8,ALTURA_ENTRADA=2.55,ABA_FACHADA=(LARGURA-VAO_ENTRADA)/2;
registrarParedeHospital(criarParede(-(LARGURA+VAO_ENTRADA)/4,ALTURA_PAVIMENTO/2,-PROFUNDIDADE/2,ABA_FACHADA,ALTURA_PAVIMENTO,0.25,true,0.3,1.6));
registrarParedeHospital(criarParede( (LARGURA+VAO_ENTRADA)/4,ALTURA_PAVIMENTO/2,-PROFUNDIDADE/2,ABA_FACHADA,ALTURA_PAVIMENTO,0.25,true,0.3,1.6));
registrarParedeHospital(criarParede(0,ALTURA_ENTRADA+(ALTURA_PAVIMENTO-ALTURA_ENTRADA)/2,-PROFUNDIDADE/2,VAO_ENTRADA,ALTURA_PAVIMENTO-ALTURA_ENTRADA,0.25));
// Parede traseira
registrarParedeHospital(criarParede(0,ALTURA_PAVIMENTO/2,PROFUNDIDADE/2,LARGURA,ALTURA_PAVIMENTO,0.25));
// Parede esquerda
registrarParedeHospital(criarParede(-LARGURA/2,ALTURA_PAVIMENTO/2,0,0.25,ALTURA_PAVIMENTO,PROFUNDIDADE));
// Parede direita
registrarParedeHospital(criarParede(LARGURA/2,ALTURA_PAVIMENTO/2,0,0.25,ALTURA_PAVIMENTO,PROFUNDIDADE));

// ===== SEGUNDO PAVIMENTO =====
const pisoSuperior=new THREE.Mesh(new THREE.BoxGeometry(LARGURA-0.5,0.25,PROFUNDIDADE-0.5),matPiso);
pisoSuperior.position.y=ALTURA_PAVIMENTO;
pisoSuperior.castShadow=true;
pisoSuperior.receiveShadow=true;
grupoHospital.add(pisoSuperior);

// Paredes do segundo andar (mais baixas, estilo sótão)
const altSegundo=2.4;
criarParede(0,ALTURA_PAVIMENTO+altSegundo/2,-PROFUNDIDADE/2+0.12,LARGURA-0.5,altSegundo,0.2,true,0.2,1.2);
criarParede(0,ALTURA_PAVIMENTO+altSegundo/2,PROFUNDIDADE/2-0.12,LARGURA-0.5,altSegundo,0.2);
criarParede(-LARGURA/2+0.12,ALTURA_PAVIMENTO+altSegundo/2,0,0.2,altSegundo,PROFUNDIDADE-0.5);
criarParede(LARGURA/2-0.12,ALTURA_PAVIMENTO+altSegundo/2,0,0.2,altSegundo,PROFUNDIDADE-0.5);

// ===== TETO PLANO COM AR CONDICIONADO =====
const teto=new THREE.Mesh(new THREE.BoxGeometry(LARGURA+0.3,0.3,PROFUNDIDADE+0.3),matTeto);
teto.position.y=ALTURA_PAVIMENTO+altSegundo;
teto.castShadow=true;
grupoHospital.add(teto);

// Unidades de ar condicionado no telhado
for(let i=0;i<3;i++){
  const ar=new THREE.Mesh(
    new THREE.BoxGeometry(1.8,0.9,1.2),
    new THREE.MeshStandardMaterial({color:0xd8d8d0,roughness:0.6,metalness:0.4})
  );
  ar.position.set(-4+i*4,ALTURA_PAVIMENTO+altSegundo+0.45,8);
  ar.castShadow=true;
  grupoHospital.add(ar);
}

// ===== PORTA AUTOMÁTICA DE ENTRADA =====
const portaGrupo=new THREE.Group();
portaGrupo.position.set(0,0.08,-PROFUNDIDADE/2-0.16);
grupoHospital.add(portaGrupo);

const portaEsq=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.4,0.12),matVidro);
portaEsq.position.set(-0.88,1.2,0);
portaEsq.castShadow=true;
portaGrupo.add(portaEsq);

const portaDir=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.4,0.12),matVidro);
portaDir.position.set(0.88,1.2,0);
portaDir.castShadow=true;
portaGrupo.add(portaDir);

const molduraEntrada=new THREE.Mesh(new THREE.BoxGeometry(VAO_ENTRADA+0.25,0.16,0.22),matPorta);
molduraEntrada.position.set(0,ALTURA_ENTRADA+0.08,0);
portaGrupo.add(molduraEntrada);
for(const x of[-(VAO_ENTRADA/2+0.08),VAO_ENTRADA/2+0.08]){
  const coluna=new THREE.Mesh(new THREE.BoxGeometry(0.16,ALTURA_ENTRADA,0.22),matPorta);
  coluna.position.set(x,ALTURA_ENTRADA/2,0);portaGrupo.add(coluna);
}

// Sensor de movimento (luz verde acima da porta)
const sensor=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.15,0.2),new THREE.MeshStandardMaterial({color:0x222220,emissive:0x00ff00,emissiveIntensity:0.3}));
sensor.position.set(0,2.5,0.2);
portaGrupo.add(sensor);

const caixaPortaEsq=new THREE.Box3(),caixaPortaDir=new THREE.Box3();
function atualizarColliderPorta(){
  portaEsq.updateWorldMatrix(true,false);portaDir.updateWorldMatrix(true,false);
  caixaPortaEsq.setFromObject(portaEsq);caixaPortaDir.setFromObject(portaDir);
}
atualizarColliderPorta();
marcarObstaculoMovel(registrarCaixa(caixaPortaEsq,'porta-hospital-esquerda'));
marcarObstaculoMovel(registrarCaixa(caixaPortaDir,'porta-hospital-direita'));

// Estado das portas
let portaAberta=false,portaAnimando=false,tempoPorta=0;
export function atualizarPortasHospital(dt){
  const distJogador=Math.hypot(playerPos.x-HOSPITAL_POS.x,playerPos.z-HOSPITAL_POS.z);
  const deveAbrir=distJogador<6&&!portaAberta;
  const deveFechar=distJogador>8&&portaAberta;
  
  if(deveAbrir&&!portaAnimando){portaAnimando=true;tempoPorta=0}
  if(deveFechar&&!portaAnimando){portaAnimando=true;tempoPorta=0}
  
  if(portaAnimando){
    tempoPorta+=dt;
    const t=Math.min(1,tempoPorta/1.2);// 1.2s para abrir/fechar completo
    const easing=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;// easeInOutQuad
    
    if(deveAbrir){
      portaEsq.position.x=THREE.MathUtils.lerp(-0.88,-1.9,easing);
      portaDir.position.x=THREE.MathUtils.lerp(0.88,1.9,easing);
      if(t>=1){portaAberta=true;portaAnimando=false}
    }else{
      portaEsq.position.x=THREE.MathUtils.lerp(-1.9,-0.88,easing);
      portaDir.position.x=THREE.MathUtils.lerp(1.9,0.88,easing);
      if(t>=1){portaAberta=false;portaAnimando=false}
    }
    atualizarColliderPorta();
  }
}

// Faixa amarela de "emergência" na entrada
const faixaEmergencia=new THREE.Mesh(
  new THREE.PlaneGeometry(6,0.6),
  new THREE.MeshStandardMaterial({color:0xffcc00,roughness:0.8,side:THREE.DoubleSide})
);
faixaEmergencia.rotation.x=-Math.PI/2;
faixaEmergencia.position.set(0,0.02,-PROFUNDIDADE/2+1.2);
grupoHospital.add(faixaEmergencia);

// Letreiro "EMERGÊNCIA 24H"
const letreiroGeo=new THREE.BoxGeometry(5,0.8,0.3);
const letreiroMat=new THREE.MeshStandardMaterial({color:0xcc0000,emissive:0x440000,emissiveIntensity:0.4});
const letreiro=new THREE.Mesh(letreiroGeo,letreiroMat);
letreiro.position.set(0,3.2,-PROFUNDIDADE/2-0.2);
grupoHospital.add(letreiro);

// Luzes de emergência piscando
const luzEmergencia1=new THREE.PointLight(0xff0000,0.8,8);
luzEmergencia1.position.set(-2,3.5,-PROFUNDIDADE/2);
grupoHospital.add(luzEmergencia1);
const luzEmergencia2=new THREE.PointLight(0xff0000,0.8,8);
luzEmergencia2.position.set(2,3.5,-PROFUNDIDADE/2);
grupoHospital.add(luzEmergencia2);

let faseLuz=0;
export function atualizarLuzesEmergencia(dt){
  faseLuz+=dt*3;
  const intensidade=0.5+0.5*Math.sin(faseLuz);
  luzEmergencia1.intensity=intensidade*0.8;
  luzEmergencia2.intensity=(1-intensidade)*0.8;
}

// ===== COLUNAS ESTRUTURAIS =====
for(let x of [-LARGURA/2+1,LARGURA/2-1]){
  for(let z of [-PROFUNDIDADE/2+1,0,PROFUNDIDADE/2-1]){
    const coluna=new THREE.Mesh(
      new THREE.BoxGeometry(0.5,ALTURA_PAVIMENTO*2,0.5),
      new THREE.MeshStandardMaterial({color:0xe0e0d8,roughness:0.6})
    );
    coluna.position.set(x,ALTURA_PAVIMENTO,z);
    coluna.castShadow=true;
    coluna.receiveShadow=true;
    grupoHospital.add(coluna);
  }
}

// ===== RAMPAS DE ACESSO (cadeirante/macas) =====
// A rampa liga o terreno natural dianteiro ao topo do piso plano. Assim o Hospital pode estar
// nivelado sem deixar um degrau na porta.
const COMP_RAMPA=6,meiaRampa=COMP_RAMPA/2;
const terrenoFrente=obterElevacao(HOSPITAL_POS.x,HOSPITAL_POS.z-PROFUNDIDADE*ESCALA_HOSPITAL/2-meiaRampa*ESCALA_HOSPITAL);
const rampaLocalExterna=(terrenoFrente-grupoHospital.position.y)/ESCALA_HOSPITAL;
const rampaLocalInterna=ALTURA_TOPO_PISO_LOCAL;
const rampaInclinacao=-Math.atan((rampaLocalInterna-rampaLocalExterna)/COMP_RAMPA);
const rampaGeo=new THREE.BoxGeometry(4,0.15,COMP_RAMPA);
const rampaMat=new THREE.MeshStandardMaterial({color:0x888880,roughness:0.7});
const rampa=new THREE.Mesh(rampaGeo,rampaMat);
rampa.position.set(0,(rampaLocalExterna+rampaLocalInterna)*ESCALA_HOSPITAL/2,-PROFUNDIDADE/2-meiaRampa);
rampa.rotation.x=rampaInclinacao;
rampa.receiveShadow=true;
grupoHospital.add(rampa);
superficiesAndaveis.push(rampa);

// Corrimão da rampa
for(let lado of[-1,1]){
  const corrimao=new THREE.Mesh(
    new THREE.CylinderGeometry(0.04,0.04,6,8),
    new THREE.MeshStandardMaterial({color:0x888880,metalness:0.6,roughness:0.3})
  );
  corrimao.position.set(lado*2.2,0.9,-PROFUNDIDADE/2-2);
  corrimao.rotation.x=Math.atan(0.15/3);
  grupoHospital.add(corrimao);
}

// ===== HELIPONTO NO TELHADO =====
const helipontoRaio=3.5;
const heliponto=new THREE.RingGeometry(helipontoRaio-0.3,helipontoRaio,32);
const helipontoMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9,side:THREE.DoubleSide});
const helipontoMesh=new THREE.Mesh(heliponto,helipontoMat);
helipontoMesh.rotation.x=-Math.PI/2;
helipontoMesh.position.y=ALTURA_PAVIMENTO+altSegundo+0.02;
grupoHospital.add(heliponto);

// "H" gigante no centro do heliponto
const hGeo=new THREE.BoxGeometry(2.5,0.15,0.4);
const hMat=new THREE.MeshStandardMaterial({color:0xffff00,emissive:0x222200});
const hBarraH=new THREE.Mesh(hGeo,hMat);
hBarraH.position.set(0,ALTURA_PAVIMENTO+altSegundo+0.03,0);
grupoHospital.add(hBarraH);
const hBarraV1=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.15,1.2),hMat);
hBarraV1.position.set(-0.85,ALTURA_PAVIMENTO+altSegundo+0.03,0);
grupoHospital.add(hBarraV1);
const hBarraV2=hBarraV1.clone();
hBarraV2.position.set(0.85,ALTURA_PAVIMENTO+altSegundo+0.03,0);
grupoHospital.add(hBarraV2);

// Luzes vermelhas nos cantos do heliponto
for(let ang of[0,Math.PI/2,Math.PI,3*Math.PI/2]){
  const luzHeliponto=new THREE.PointLight(0xff0000,0.6,6);
  luzHeliponto.position.set(
    Math.cos(ang)*helipontoRaio,
    ALTURA_PAVIMENTO+altSegundo+0.3,
    Math.sin(ang)*helipontoRaio
  );
  grupoHospital.add(luzHeliponto);
}

// ===== INTERIORES (visíveis através do vidro) =====
// Balcão de recepção
const balcao=new THREE.Mesh(
  new THREE.BoxGeometry(4,1.1,1.2),
  new THREE.MeshStandardMaterial({color:0x6a90b8,roughness:0.5})
);
balcao.position.set(0,0.55,2);
balcao.castShadow=true;
grupoHospital.add(balcao);

// Computador no balcão
const monitor=new THREE.Mesh(
  new THREE.BoxGeometry(0.6,0.4,0.08),
  new THREE.MeshStandardMaterial({color:0x181818,roughness:0.3,metalness:0.7})
);
monitor.position.set(-0.8,1.2,2.3);
grupoHospital.add(monitor);

// Cadeiras de espera (fileira)
for(let i=0;i<4;i++){
  const cadeira=new THREE.Mesh(
    new THREE.BoxGeometry(0.6,0.8,0.6),
    new THREE.MeshStandardMaterial({color:0x3a5a78,roughness:0.7})
  );
  cadeira.position.set(-3+i*1.1,0.4,4);
  cadeira.castShadow=true;
  grupoHospital.add(cadeira);
}

// Maca de emergência (visível pelo vidro)
const maca=new THREE.Mesh(
  new THREE.BoxGeometry(2.2,0.7,0.9),
  new THREE.MeshStandardMaterial({color:0x2d5a3f,roughness:0.6})
);
maca.position.set(3,0.35,-3);
maca.castShadow=true;
grupoHospital.add(maca);

// Suporte de soro
const soroSuporte=new THREE.Mesh(
  new THREE.CylinderGeometry(0.03,0.03,2.2,8),
  new THREE.MeshStandardMaterial({color:0x888880,metalness:0.5})
);
soroSuporte.position.set(3.3,1.4,-3);
grupoHospital.add(soroSuporte);

const soroBolsa=new THREE.Mesh(
  new THREE.BoxGeometry(0.15,0.25,0.08),
  new THREE.MeshStandardMaterial({color:0xaad8ff,transparent:true,opacity:0.7})
);
soroBolsa.position.set(3.3,2.4,-3);
grupoHospital.add(soroBolsa);

// ===== SINALIZAÇÃO =====
function criarPlaca(texto,x,y,z,rotY=0){
  const placa=new THREE.Mesh(
    new THREE.BoxGeometry(1.2,0.4,0.08),
    new THREE.MeshStandardMaterial({color:0x2a5a78,roughness:0.6})
  );
  placa.position.set(x,y,z);
  placa.rotation.y=rotY;
  grupoHospital.add(placa);
  
  // Texto simplificado como faixa branca
  const textoFaixa=new THREE.Mesh(
    new THREE.PlaneGeometry(1,0.25),
    new THREE.MeshStandardMaterial({color:0xffffff,side:THREE.DoubleSide})
  );
  textoFaixa.position.set(x,y+0.05,z);
  textoFaixa.rotation.y=rotY;
  grupoHospital.add(textoFaixa);
}

criarPlaca('RECEPÇÃO',-2,2.2,3.5);
criarPlaca('EMERGÊNCIA',2,2.2,-2,Math.PI);
criarPlaca('ELEVADOR',-4,2.2,0,Math.PI/2);

// ===== PONTO DE NASCIMENTO (dentro do hospital, na área de emergência) =====
export const PONTO_NASCIMENTO={
  x:HOSPITAL_POS.x+2*ESCALA_HOSPITAL,
  y:grupoHospital.position.y+ALTURA_TOPO_PISO_LOCAL*ESCALA_HOSPITAL+0.02,
  z:HOSPITAL_POS.z-3*ESCALA_HOSPITAL
};

// Exportar posição do jogador para o Police.js usar
import{player}from'./Player.js';
let playerPos={x:0,z:0};
export function atualizarPosicaoJogador(x,z){playerPos={x,z}};

export function obterPontoNascimento(){return{...PONTO_NASCIMENTO}};
