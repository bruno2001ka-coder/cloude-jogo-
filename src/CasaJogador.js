// ===== CASA DO JOGADOR =====
// Casa própria no platô nivelado do lado leste. Ela usa o MESMO contrato das casas ocas da favela:
// entra em `casasOcas`, então Economy reconhece o interior, a tecla/botão de ação abre e fecha a porta
// e `atualizarPortas` anima a folha sem criar um segundo sistema de interação.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{registrarObstaculo,registrarCaixa,marcarSemFusao,marcarObstaculoMovel,superficiesAndaveis}from'./Physics.js';
import{matReboco,matTelha,matMadeira,matConcreto,bmat,uvPorMetro,criarSombraContato}from'./Materials.js';
import{casasOcas,sumirCaixa,ESP_PAREDE,PORTA_ALTURA,VAO_PORTA,PORTA_ABERTA_RAD}from'./Favela.js';

// É exatamente a área já nivelada pelo WorldGenerator. Repetimos os quatro números aqui porque este
// módulo não deve depender dos detalhes de construção do mundo; a cota é recalculada pela mesma regra.
const AREA={x:65.7,z:-1.8,larg:10,prof:8};
const amostras=[];
for(let ix=0;ix<=20;ix++)for(let iz=0;iz<=16;iz++){
  const x=AREA.x-AREA.larg/2+ix*AREA.larg/20;
  const z=AREA.z-AREA.prof/2+iz*AREA.prof/16;
  amostras.push({x,z,h:obterElevacao(x,z)});
}
const COTA=Math.max(...amostras.map(a=>a.h))+.12;

// A frente olha para a borda mais baixa do platô — é o mesmo lado em que o WorldGenerator coloca a
// escada. Assim a porta nunca nasce apontando para o barranco oposto ao acesso.
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

// Deixa um pequeno quintal/varanda na frente, em direção à escada.
const LARG=6.4,PROF=4.8,ALT=2.9;
const CX=AREA.x-fx*.55,CZ=AREA.z-fz*.55;
const PISO=COTA+.14;
const grupo=new THREE.Group();grupo.name='casa-jogador';scene.add(grupo);

const paredeMat=matReboco(0xc8b58e),telhadoMat=matTelha(0x67635e),madeira=matMadeira(0x69482f),concreto=matConcreto();
function mundo(dx,dz){const c=Math.cos(GIRO),s=Math.sin(GIRO);return{x:CX+dx*c+dz*s,z:CZ-dx*s+dz*c}}
function peca(geo,mat,x,y,z,giro=0,pai=grupo,sombra=true){
  uvPorMetro(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=giro;
  m.castShadow=sombra;m.receiveShadow=true;pai.add(m);return m;
}
function caixaLocal(lw,h,ld,dx,dy,dz,mat=paredeMat,colisor=true){
  const p=mundo(dx,dz),m=peca(new THREE.BoxGeometry(lw,h,ld),mat,p.x,PISO+dy+h/2,p.z,GIRO);
  if(colisor)marcarSemFusao(registrarObstaculo(m,'casa-jogador-parede'));
  return m;
}

// Piso elevado só 14 cm sobre o platô: é degrau normal, não obstáculo.
const centro=mundo(0,0);
const piso=peca(new THREE.BoxGeometry(LARG-ESP_PAREDE*2,.14,PROF-ESP_PAREDE*2),concreto,
  centro.x,PISO-.07,centro.z,GIRO);
superficiesAndaveis.push(piso);

// Casca oca: três paredes inteiras e fachada dividida pelo vão.
caixaLocal(LARG,ALT,ESP_PAREDE,0,0,-PROF/2);
caixaLocal(ESP_PAREDE,ALT,PROF,-LARG/2,0,0);
caixaLocal(ESP_PAREDE,ALT,PROF, LARG/2,0,0);
const aba=(LARG-VAO_PORTA)/2;
caixaLocal(aba,ALT,ESP_PAREDE,-(LARG+VAO_PORTA)/4,0,PROF/2);
caixaLocal(aba,ALT,ESP_PAREDE, (LARG+VAO_PORTA)/4,0,PROF/2);
caixaLocal(VAO_PORTA,ALT-PORTA_ALTURA,ESP_PAREDE,0,PORTA_ALTURA,PROF/2);

// Laje utilizável e mureta baixa. A casa fica pronta para receber outras funções depois (guardar itens,
// bancada de corte, upgrades), sem precisar refazer a construção.
const laje=peca(new THREE.BoxGeometry(LARG+.16,.14,PROF+.16),telhadoMat,centro.x,PISO+ALT+.07,centro.z,GIRO);
superficiesAndaveis.push(laje);
for(const[dx,dz,w,d]of[[0,PROF/2,LARG+.16,.14],[0,-PROF/2,LARG+.16,.14],[LARG/2,0,.14,PROF+.16],[-LARG/2,0,.14,PROF+.16]]){
  const p=mundo(dx,dz);peca(new THREE.BoxGeometry(w,.38,d),telhadoMat,p.x,PISO+ALT+.26,p.z,GIRO);
}

// Janela lateral simples para a casa não parecer um galpão fechado.
const vidro=new THREE.MeshPhysicalMaterial({color:0x8fc0cf,roughness:.18,metalness:.05,transparent:true,opacity:.72});
{const p=mundo(-LARG/2-.015,-.65);peca(new THREE.BoxGeometry(.04,1.0,1.45),vidro,p.x,PISO+1.55,p.z,GIRO,false,false)}

// Placa CASA acima da porta. Um CanvasTexture pequeno custa um único material e deixa a casa reconhecível
// de longe sem criar outra UI permanente na tela.
if(typeof document!=='undefined'){
  const cv=document.createElement('canvas');cv.width=512;cv.height=128;const ctx=cv.getContext('2d');
  ctx.fillStyle='#1d3551';ctx.fillRect(0,0,cv.width,cv.height);ctx.strokeStyle='#d7e6f4';ctx.lineWidth=10;ctx.strokeRect(5,5,502,118);
  ctx.fillStyle='#ffffff';ctx.font='bold 70px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('CASA',256,67);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshBasicMaterial({map:tex});const p=mundo(0,PROF/2+.105);
  const placa=peca(new THREE.PlaneGeometry(1.9,.48),mat,p.x,PISO+2.57,p.z,GIRO,grupo,false);placa.renderOrder=1;
}

// Porta com dobradiça real. Nasce aberta para o primeiro spawn nunca prender o jogador.
const dobra=mundo(-VAO_PORTA/2,PROF/2);
const pivo=new THREE.Group();pivo.position.set(dobra.x,PISO,dobra.z);pivo.rotation.y=GIRO;grupo.add(pivo);
const folha=peca(new THREE.BoxGeometry(VAO_PORTA-.06,PORTA_ALTURA-.05,.07),madeira,
  (VAO_PORTA-.06)/2,(PORTA_ALTURA-.05)/2,0,0,pivo);
pivo.rotation.y=GIRO;folha.updateWorldMatrix(true,false);
const caixaFechada=new THREE.Box3().setFromObject(folha);
pivo.rotation.y=GIRO+PORTA_ABERTA_RAD;
const caixaPorta=new THREE.Box3();sumirCaixa(caixaPorta);registrarCaixa(caixaPorta,'casa-jogador-porta');marcarObstaculoMovel(caixaPorta);

// Interior básico, sem entulhar a sala que será usada pela progressão depois.
// Colchão no fundo esquerdo.
{const p=mundo(-1.55,-1.35);peca(new THREE.BoxGeometry(1.8,.18,.78),bmat(0x496c86),p.x,PISO+.12,p.z,GIRO,grupo,false);
 const q=mundo(-1.55,-1.62);peca(new THREE.BoxGeometry(.62,.12,.42),bmat(0xd9d2bd),q.x,PISO+.25,q.z,GIRO,grupo,false)}
// Mesa de trabalho simples no fundo direito: já marca visualmente onde depois entram cortes/upgrades.
{const p=mundo(1.45,-1.42);peca(new THREE.BoxGeometry(1.65,.12,.72),madeira,p.x,PISO+.92,p.z,GIRO,grupo,false);
 for(const sx of[-.68,.68])for(const sz of[-.24,.24]){const q=mundo(1.45+sx,-1.42+sz);peca(new THREE.BoxGeometry(.09,.86,.09),madeira,q.x,PISO+.43,q.z,GIRO,grupo,false)}}
// Luz interna barata: sem sombra, para não multiplicar passes de render.
{const p=mundo(0,-.2);const luz=new THREE.PointLight(0xffd79c,1.35,7);luz.position.set(p.x,PISO+2.35,p.z);luz.castShadow=false;grupo.add(luz);
 const lamp=peca(new THREE.SphereGeometry(.08,8,6),bmat(0xffd79c),p.x,PISO+2.38,p.z,0,grupo,false);lamp.material.emissive?.set?.(0xffd79c)}
criarSombraContato(2.6,grupo,0,.02);

const RECUO=ESP_PAREDE+.25;
export const casaJogador={x:CX,z:CZ,y:PISO,giro:GIRO,pivo,folha,caixa:caixaPorta,caixaFechada,aberta:true,
  papel:'jogador',comercio:null,fechadaRad:GIRO,abertaRad:GIRO+PORTA_ABERTA_RAD,
  meiaLarg:LARG/2-RECUO,meiaProf:PROF/2-RECUO,larg:LARG,prof:PROF,alt:ALT,piso:PISO};
casasOcas.push(casaJogador);

export function pontoInicialCasaJogador(){const p=mundo(0,-.55);return{x:p.x,y:PISO+.02,z:p.z}}
export function posicionarJogadorNaCasa(jogador){
  if(!jogador)return false;const p=pontoInicialCasaJogador();jogador.position.set(p.x,p.y,p.z);jogador.rotation.y=GIRO;return true;
}
