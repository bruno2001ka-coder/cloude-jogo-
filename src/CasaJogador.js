// ===== CASA DO JOGADOR — CASA BRASILEIRA REALISTA =====
import*as THREE from'three';
import{scene}from'./core.js';
import{player,PLAYER_HEIGHT}from'./Player.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,registrarCaixa,marcarSemFusao,marcarObstaculoMovel,superficiesAndaveis}from'./Physics.js';
import{matReboco,matTelha,matMadeira,matConcreto,bmat,uvPorMetro,criarSombraContato}from'./Materials.js';
import{casasOcas,sumirCaixa,ESP_PAREDE,PORTA_ALTURA,VAO_PORTA,PORTA_ABERTA_RAD}from'./Favela.js';

const AREA={x:31.3,z:71.7,larg:10,prof:8};
const amostras=[];
for(let ix=0;ix<=20;ix++)for(let iz=0;iz<=16;iz++){
  const x=AREA.x-AREA.larg/2+ix*AREA.larg/20;
  const z=AREA.z-AREA.prof/2+iz*AREA.prof/16;
  amostras.push({x,z,h:obterElevacao(x,z)});
}
const COTA=Math.max(...amostras.map(a=>a.h))+.10;
const MENOR_COTA=Math.min(...amostras.map(a=>a.h));

function mediaBorda(tipo){
  const margem=.001;
  const borda=amostras.filter(a=>tipo==='norte'?a.z<AREA.z-AREA.prof/2+margem:
    tipo==='sul'?a.z>AREA.z+AREA.prof/2-margem:
    tipo==='oeste'?a.x<AREA.x-AREA.larg/2+margem:
    a.x>AREA.x+AREA.larg/2-margem);
  return borda.reduce((s,a)=>s+a.h,0)/Math.max(1,borda.length);
}
const bordas=['norte','sul','oeste','leste'];
const bordaFrente=bordas.reduce((m,t)=>mediaBorda(t)<mediaBorda(m)?t:m,'norte');
const GIRO=bordaFrente==='norte'?Math.PI:bordaFrente==='sul'?0:bordaFrente==='oeste'?-Math.PI/2:Math.PI/2;
const fx=Math.sin(GIRO),fz=Math.cos(GIRO);

const LARG=7.2,PROF=5.25,ALT=2.85;
const CX=AREA.x-fx*.48,CZ=AREA.z-fz*.48;
const PISO=COTA+.18;
const grupo=new THREE.Group();grupo.name='casa-jogador';scene.add(grupo);

const paredeMat=matReboco(0xe4ded0);
const paredeAcento=matReboco(0xa66d4f);
const concreto=matConcreto();
const madeira=matMadeira(0x6b4127);
const madeiraEscura=matMadeira(0x3e2b20);
const telhadoMat=matTelha(0xa14f37).clone();
telhadoMat.metalness=.06;telhadoMat.roughness=1;
const metal=new THREE.MeshStandardMaterial({color:0x34383a,roughness:.42,metalness:.72});
const alum=new THREE.MeshStandardMaterial({color:0x9da4a4,roughness:.35,metalness:.68});
const vidro=new THREE.MeshStandardMaterial({color:0x6c9ead,roughness:.12,metalness:.08,transparent:true,opacity:.48,depthWrite:false});
const pisoMat=new THREE.MeshStandardMaterial({color:0xb9b1a2,roughness:.82,metalness:0});
const forroMat=new THREE.MeshStandardMaterial({color:0xf0ece2,roughness:.96});
const tecido=new THREE.MeshStandardMaterial({color:0x556b78,roughness:1});
const tecidoClaro=new THREE.MeshStandardMaterial({color:0xd6d0c4,roughness:1});
const tapeteMat=new THREE.MeshStandardMaterial({color:0x73594a,roughness:1});
const verde=new THREE.MeshStandardMaterial({color:0x46623e,roughness:.9});
const terraVaso=new THREE.MeshStandardMaterial({color:0x5c412f,roughness:1});
const ceramica=new THREE.MeshStandardMaterial({color:0x965f45,roughness:.9});
const emissivo=new THREE.MeshStandardMaterial({color:0xffe2a8,emissive:0xffbb66,emissiveIntensity:1.1,roughness:.45});

function mundo(dx,dz){const c=Math.cos(GIRO),s=Math.sin(GIRO);return{x:CX+dx*c+dz*s,z:CZ-dx*s+dz*c}}
function peca(geo,mat,x,y,z,giro=0,pai=grupo,sombra=true){
  uvPorMetro(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=giro;
  m.castShadow=sombra;m.receiveShadow=true;pai.add(m);return m;
}
function caixaLocal(lw,h,ld,dx,dy,dz,mat=paredeMat,colisor=true,categoria='casa-jogador-parede'){
  const p=mundo(dx,dz),m=peca(new THREE.BoxGeometry(lw,h,ld),mat,p.x,PISO+dy+h/2,p.z,GIRO);
  if(colisor)marcarSemFusao(registrarObstaculo(m,categoria));
  return m;
}
function cilindroLocal(rt,rb,h,seg,dx,y,dz,mat=metal,rotZ=0,colisor=false){
  const p=mundo(dx,dz),m=peca(new THREE.CylinderGeometry(rt,rb,h,seg),mat,p.x,y,p.z,GIRO);
  m.rotation.z=rotZ;
  if(colisor)marcarSemFusao(registrarObstaculo(m,'casa-jogador-detalhe'));
  return m;
}

// ===== TERRENO / FUNDAÇÃO =====
const BASE_L=8.45,BASE_P=6.75;
const ALT_BASE=Math.max(.34,COTA-MENOR_COTA+.12);
const base=peca(new THREE.BoxGeometry(BASE_L,ALT_BASE,BASE_P),concreto,
  AREA.x,COTA-ALT_BASE/2,AREA.z,0,grupo,false);
superficiesAndaveis.push(base);

const frenteBase=mundo(0,PROF/2+1.02);
peca(new THREE.BoxGeometry(BASE_L-.35,.48,.16),matReboco(0x716b61),frenteBase.x,COTA-.24,frenteBase.z,GIRO,grupo,false);
for(const sx of[-1,1]){
  const p=mundo(sx*(BASE_L/2-.16),.05);
  peca(new THREE.BoxGeometry(.16,.42,BASE_P-.4),matReboco(0x7c766b),p.x,COTA-.21,p.z,GIRO,grupo,false);
}

const cotaBaixa=mediaBorda(bordaFrente),desnivel=Math.max(0,COTA-cotaBaixa);
if(desnivel>.12){
  const n=Math.max(3,Math.ceil(desnivel/.17)),espelho=desnivel/n,passo=.40,largEscada=2.15;
  for(let i=0;i<n;i++){
    const recuo=(n-i-.5)*passo;
    let x=AREA.x,z=AREA.z;
    if(bordaFrente==='norte')z=AREA.z-AREA.prof/2-recuo;
    if(bordaFrente==='sul')z=AREA.z+AREA.prof/2+recuo;
    if(bordaFrente==='oeste')x=AREA.x-AREA.larg/2-recuo;
    if(bordaFrente==='leste')x=AREA.x+AREA.larg/2+recuo;
    const solo=obterElevacao(x,z),topo=Math.max(solo+.07,cotaBaixa+espelho*(i+1));
    const h=Math.max(.14,topo-solo);
    const geo=(bordaFrente==='norte'||bordaFrente==='sul')
      ?new THREE.BoxGeometry(largEscada,h,passo):new THREE.BoxGeometry(passo,h,largEscada);
    const degrau=peca(geo,concreto,x,solo+h/2,z,0,grupo,false);superficiesAndaveis.push(degrau);
  }
}

for(let i=0;i<4;i++){
  const p=mundo(0,PROF/2+.82+i*.38);
  peca(new THREE.BoxGeometry(1.65,.07,.31),pisoMat,p.x,COTA+.035,p.z,GIRO,grupo,false);
}

// ===== PISO E PAREDES =====
const centro=mundo(0,0);
const piso=peca(new THREE.BoxGeometry(LARG-ESP_PAREDE*2,.16,PROF-ESP_PAREDE*2),pisoMat,
  centro.x,PISO-.08,centro.z,GIRO);
superficiesAndaveis.push(piso);
caixaLocal(LARG,ALT,ESP_PAREDE,0,0,-PROF/2);

function paredeLateralComJanela(lado){
  const x=lado*LARG/2,janZ=-.55,janW=1.55,janH=1.15,peitoril=.92;
  const parteFrente=(PROF/2+janZ-janW/2),parteTras=(PROF/2-janZ-janW/2);
  caixaLocal(ESP_PAREDE,ALT,parteFrente,x,0,(PROF/2+janZ+janW/2)/2);
  caixaLocal(ESP_PAREDE,ALT,parteTras,x,0,(-PROF/2+janZ-janW/2)/2);
  caixaLocal(ESP_PAREDE,peitoril,janW,x,0,janZ);
  caixaLocal(ESP_PAREDE,ALT-peitoril-janH,janW,x,peitoril+janH,janZ);
  const px=lado*(LARG/2+.015),p=mundo(px,janZ);
  const painel=peca(new THREE.BoxGeometry(.035,janH-.06,janW-.08),vidro,p.x,PISO+peitoril+janH/2,p.z,GIRO);painel.renderOrder=2;
  for(const dz of[-janW/2,janW/2]){
    const q=mundo(lado*(LARG/2+.035),janZ+dz);
    peca(new THREE.BoxGeometry(.055,janH+.12,.055),alum,q.x,PISO+peitoril+janH/2,p.z,GIRO,grupo,false);
  }
  for(const yy of[peitoril,peitoril+janH]){
    const q=mundo(lado*(LARG/2+.035),janZ);
    peca(new THREE.BoxGeometry(.055,.055,janW+.12),alum,q.x,PISO+yy,p.z,GIRO,grupo,false);
  }
  const q=mundo(lado*(LARG/2+.045),janZ);
  peca(new THREE.BoxGeometry(.06,.04,janW+.18),concreto,q.x,PISO+peitoril-.05,q.z,GIRO,grupo,false);
}
paredeLateralComJanela(-1);paredeLateralComJanela(1);

const aba=(LARG-VAO_PORTA)/2;
caixaLocal(aba,ALT,ESP_PAREDE,-(LARG+VAO_PORTA)/4,0,PROF/2);
caixaLocal(aba,ALT,ESP_PAREDE, (LARG+VAO_PORTA)/4,0,PROF/2);
caixaLocal(VAO_PORTA,ALT-PORTA_ALTURA,ESP_PAREDE,0,PORTA_ALTURA,PROF/2,paredeAcento);
for(const sx of[-1,1])caixaLocal(.16,PORTA_ALTURA+.18,.13,sx*(VAO_PORTA/2+.08),0,PROF/2+.07,paredeAcento,false);
caixaLocal(VAO_PORTA+.32,.16,.13,0,PORTA_ALTURA+.02,PROF/2+.07,paredeAcento,false);

const rodape=matReboco(0x625e57);
caixaLocal(LARG+.08,.22,.08,0,0,-PROF/2-.055,rodape,false);
caixaLocal(LARG+.08,.22,.08,0,0, PROF/2+.055,rodape,false);
caixaLocal(.08,.22,PROF+.08,-LARG/2-.055,0,0,rodape,false);
caixaLocal(.08,.22,PROF+.08, LARG/2+.055,0,0,rodape,false);

// ===== TELHADO CERÂMICO =====
const EAVE=.38,ANG=.36;
const halfRun=PROF/2+EAVE,slopeLen=halfRun/Math.cos(ANG),rise=halfRun*Math.tan(ANG);
const roof=new THREE.Group();roof.position.set(CX,PISO+ALT,CZ);roof.rotation.y=GIRO;grupo.add(roof);
for(const lado of[-1,1]){
  const agua=new THREE.Mesh(new THREE.BoxGeometry(LARG+EAVE*2,.11,slopeLen),telhadoMat);
  uvPorMetro(agua.geometry,1.35);agua.position.set(0,rise/2+.055,lado*halfRun/2);
  agua.rotation.x=lado>0?ANG:-ANG;agua.castShadow=true;agua.receiveShadow=true;roof.add(agua);
}
const cumeeira=new THREE.Mesh(new THREE.BoxGeometry(LARG+EAVE*2+.05,.16,.18),telhadoMat);
cumeeira.position.set(0,rise+.10,0);cumeeira.castShadow=true;roof.add(cumeeira);
for(const z of[-(PROF/2+EAVE),(PROF/2+EAVE)]){
  const fas=new THREE.Mesh(new THREE.BoxGeometry(LARG+EAVE*2,.14,.07),madeiraEscura);fas.position.set(0,.03,z);fas.castShadow=true;roof.add(fas);
}
for(const z of[-PROF/2,PROF/2]){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([-LARG/2,0,z,LARG/2,0,z,0,rise,z],3));
  geo.setIndex([0,1,2]);geo.computeVertexNormals();
  const emp=new THREE.Mesh(geo,paredeMat);emp.material.side=THREE.DoubleSide;emp.castShadow=true;emp.receiveShadow=true;roof.add(emp);
}
for(const z of[-(PROF/2+EAVE),(PROF/2+EAVE)]){
  const calha=new THREE.Mesh(new THREE.BoxGeometry(LARG+EAVE*2,.07,.09),metal);calha.position.set(0,-.01,z);roof.add(calha);
}
cilindroLocal(.035,.035,ALT,8,LARG/2+.22,PISO+ALT/2,PROF/2+.30,metal,0,false);

// ===== VARANDA =====
const varandaP=mundo(0,PROF/2+.63);
const varanda=peca(new THREE.BoxGeometry(4.15,.12,1.25),pisoMat,varandaP.x,PISO-.02,varandaP.z,GIRO);
superficiesAndaveis.push(varanda);
for(const sx of[-1.78,1.78]){
  const p=mundo(sx,PROF/2+1.06);
  const col=peca(new THREE.BoxGeometry(.14,2.35,.14),madeiraEscura,p.x,PISO+1.175,p.z,GIRO);
  marcarSemFusao(registrarObstaculo(col,'casa-jogador-pilar'));
}
const marqG=new THREE.Group();marqG.position.set(CX,PISO+2.30,CZ);marqG.rotation.y=GIRO;grupo.add(marqG);
const marq=new THREE.Mesh(new THREE.BoxGeometry(4.25,.10,1.55),telhadoMat);marq.position.set(0,.06,PROF/2+.68);marq.rotation.x=.10;marq.castShadow=true;marq.receiveShadow=true;marqG.add(marq);
{const p=mundo(.72,PROF/2+.18);const luz=new THREE.PointLight(0xffc878,.85,7);luz.position.set(p.x,PISO+2.28,p.z);luz.castShadow=false;grupo.add(luz);
 const lamp=peca(new THREE.BoxGeometry(.16,.22,.12),emissivo,p.x,PISO+2.28,p.z,GIRO,grupo,false);lamp.renderOrder=2;}
for(const sx of[-1.38,1.38]){
  const p=mundo(sx,PROF/2+.80);
  peca(new THREE.CylinderGeometry(.24,.18,.34,10),ceramica,p.x,PISO+.17,p.z,GIRO,grupo,false);
  peca(new THREE.CylinderGeometry(.18,.18,.035,10),terraVaso,p.x,PISO+.35,p.z,GIRO,grupo,false);
  for(let i=0;i<5;i++){
    const folha=peca(new THREE.SphereGeometry(.16,7,5),verde,p.x+(i-2)*.07,PISO+.53+(i%2)*.08,p.z+(i%2?-.06:.05),0,grupo,false);
    folha.scale.set(.65,1.65,.52);
  }
}

// ===== PORTA FUNCIONAL =====
const dobra=mundo(-VAO_PORTA/2,PROF/2);
const pivo=new THREE.Group();pivo.position.set(dobra.x,PISO,dobra.z);pivo.rotation.y=GIRO;grupo.add(pivo);
const folha=peca(new THREE.BoxGeometry(VAO_PORTA-.06,PORTA_ALTURA-.05,.075),madeira,
  (VAO_PORTA-.06)/2,(PORTA_ALTURA-.05)/2,0,0,pivo);
for(const yy of[.43,.82,1.21,1.60]){
  const fr=peca(new THREE.BoxGeometry(VAO_PORTA-.20,.045,.018),madeiraEscura,(VAO_PORTA-.06)/2,yy,.048,0,pivo,false);fr.castShadow=false;
}
const maca=peca(new THREE.CylinderGeometry(.035,.035,.12,10),metal,VAO_PORTA-.22,1.02,.08,0,pivo,false);maca.rotation.x=Math.PI/2;
pivo.rotation.y=GIRO;folha.updateWorldMatrix(true,false);
const caixaFechada=new THREE.Box3().setFromObject(folha);
pivo.rotation.y=GIRO+PORTA_ABERTA_RAD;
const caixaPorta=new THREE.Box3();sumirCaixa(caixaPorta);registrarCaixa(caixaPorta,'casa-jogador-porta');marcarObstaculoMovel(caixaPorta);

// ===== INTERIOR EM ESCALA DO PERSONAGEM =====
// PLAYER_HEIGHT é a referência única. Hoje o jogador mede 0,90 m no mundo; se esse valor mudar,
// cama, mesa, cadeira, armário e decoração acompanham automaticamente.
const H=PLAYER_HEIGHT;
const MOB=H/.90;
peca(new THREE.BoxGeometry(LARG-.35,.07,PROF-.35),forroMat,centro.x,PISO+ALT-.04,centro.z,GIRO,grupo,false);

// Cama: comprimento 1,28x a altura do corpo, largura 0,68x e colchão baixo o bastante para sentar.
{
  const x=-2.35,z=-1.72;
  const comp=H*1.28,larg=H*.68;
  const p=mundo(x,z);
  peca(new THREE.BoxGeometry(comp,H*.10,larg),madeiraEscura,p.x,PISO+H*.10,p.z,GIRO,grupo,false);
  peca(new THREE.BoxGeometry(comp-H*.05,H*.11,larg-H*.05),tecidoClaro,p.x,PISO+H*.205,p.z,GIRO,grupo,false);
  const trav=mundo(x,z-larg*.27);
  peca(new THREE.BoxGeometry(H*.42,H*.07,H*.24),tecido,trav.x,PISO+H*.305,trav.z,GIRO,grupo,false);
  const cab=mundo(x,z-larg/2-.035);
  peca(new THREE.BoxGeometry(comp+H*.03,H*.50,H*.07),madeiraEscura,cab.x,PISO+H*.25,cab.z,GIRO,grupo,false);
}

// Mesa de trabalho: tampo na metade da altura do jogador e profundidade compatível com o alcance dos braços.
{
  const x=2.15,z=-1.72;
  const mw=H*1.05,md=H*.47,altura=H*.50,tampo=H*.055;
  const p=mundo(x,z);
  peca(new THREE.BoxGeometry(mw,tampo,md),madeira,p.x,PISO+altura,p.z,GIRO,grupo,false);
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const q=mundo(x+sx*(mw/2-H*.055),z+sz*(md/2-H*.055));
    peca(new THREE.BoxGeometry(H*.06,altura-tampo,H*.06),madeiraEscura,q.x,PISO+(altura-tampo)/2,p.z,GIRO,grupo,false);
  }

  // Cadeira: assento a ~27% da altura do corpo; encosto termina abaixo dos ombros.
  const cz=z+H*.68,ass=H*.37,seatY=H*.27;
  const c=mundo(x,cz);
  peca(new THREE.BoxGeometry(ass,H*.045,ass),madeiraEscura,c.x,PISO+seatY,p.z,GIRO,grupo,false);
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const q=mundo(x+sx*ass*.34,cz+sz*ass*.34);
    peca(new THREE.BoxGeometry(H*.045,seatY,H*.045),madeiraEscura,q.x,PISO+seatY/2,p.z,GIRO,grupo,false);
  }
  const enc=mundo(x,cz+ass/2-H*.025);
  peca(new THREE.BoxGeometry(ass,H*.36,H*.045),madeiraEscura,enc.x,PISO+seatY+H*.18,enc.z,GIRO,grupo,false);
}

// Armário proporcional: ligeiramente mais alto que o jogador, mas alcançável sem parecer um prédio.
{
  const aw=H*.64,ah=H*1.17,ad=H*.38;
  const p=mundo(2.75,.35);
  peca(new THREE.BoxGeometry(aw,ah,ad),matMadeira(0x806044),p.x,PISO+ah/2,p.z,GIRO,grupo,false);
  // Divisão das duas portas e puxadores na altura do peito.
  const meio=mundo(2.75,.35+ad/2+.012);
  peca(new THREE.BoxGeometry(H*.025,ah*.88,.018),madeiraEscura,meio.x,PISO+ah*.50,meio.z,GIRO,grupo,false);
  for(const sx of[-.12,.12]){
    const pux=mundo(2.75+sx*MOB,.35+ad/2+.025);
    peca(new THREE.SphereGeometry(H*.025,7,5),metal,pux.x,PISO+H*.56,pux.z,0,grupo,false);
  }
}

// Tapete e quadro também seguem a mesma escala para não denunciarem objetos gigantes ao lado do personagem.
{
  const r=mundo(0,.18);
  peca(new THREE.BoxGeometry(H*1.35,.018,H*.78),tapeteMat,r.x,PISO+.018,r.z,GIRO,grupo,false);
  const q=mundo(0,-PROF/2+.12),qw=H*.72,qh=H*.44;
  peca(new THREE.BoxGeometry(qw,qh,.025),madeiraEscura,q.x,PISO+H*1.05,q.z,GIRO,grupo,false);
  peca(new THREE.BoxGeometry(qw-H*.08,qh-H*.08,.014),new THREE.MeshStandardMaterial({color:0x6f826b,roughness:.9}),q.x,PISO+H*1.05,q.z+.02,GIRO,grupo,false);
}

{const p=mundo(0,-.10);const luz=new THREE.PointLight(0xffd79c,1.15,8);luz.position.set(p.x,PISO+2.42,p.z);luz.castShadow=false;grupo.add(luz);
 const lamp=peca(new THREE.SphereGeometry(.095,10,7),emissivo,p.x,PISO+2.50,p.z,0,grupo,false);}

criarSombraContato(3.2,grupo,0,.025);

const RECUO=ESP_PAREDE+.28;
export const casaJogador={x:CX,z:CZ,y:PISO,giro:GIRO,pivo,folha,caixa:caixaPorta,caixaFechada,aberta:true,
  papel:'jogador',comercio:null,fechadaRad:GIRO,abertaRad:GIRO+PORTA_ABERTA_RAD,
  meiaLarg:LARG/2-RECUO,meiaProf:PROF/2-RECUO,larg:LARG,prof:PROF,alt:ALT,piso:PISO,lajeY:PISO+ALT};
casasOcas.push(casaJogador);

export function pontoInicialCasaJogador(){const p=mundo(0,-.45);return{x:p.x,y:PISO+.02,z:p.z}}
export function posicionarJogadorNaCasa(jogador){
  if(!jogador)return false;const p=pontoInicialCasaJogador();jogador.position.set(p.x,p.y,p.z);jogador.rotation.y=GIRO;return true;
}
posicionarJogadorNaCasa(player);
