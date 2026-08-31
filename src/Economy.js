// ===== ECONOMIA PARALELA (ficção de jogo): contrabando urbano + cultivo escondido + mercado negro =====
// Itens e cenário fictícios; toda a arte é gerada aqui mesmo com geometria low-poly, no mesmo estilo das árvores do jogo.
import*as THREE from'three';
import{scene,camera}from'./core.js';
import{ground}from'./Terrain.js';
import{obstaculos,superficiesAndaveis}from'./Physics.js';
import{criarSombraContato,folhaMat,folhaClara}from'./Materials.js';
import{criarEsconderijo}from'./WorldGenerator.js';
import{player}from'./Player.js';

export let dinheiro=300;export const inventario={vaso:0,terra:0,semente:0,pacote:0};
const potMat=new THREE.MeshStandardMaterial({color:0x8a5a3a,roughness:.85});
const floraMat=new THREE.MeshStandardMaterial({color:0x9fc75c,roughness:.8});
const floraAcentoMat=new THREE.MeshStandardMaterial({color:0xf3e9b8,roughness:.6,emissive:0xc9b878,emissiveIntensity:.15});
const caulePlantaMat=new THREE.MeshStandardMaterial({color:0x5a7a3c,roughness:.85});
const TEMPO_ESTAGIO=22;// segundos por estágio (broto→vegetativa→flora): ritmo de jogo casual, não é guia real de cultivo
export const plantas=[];
function distXZSq(a,b){const dx=a.x-b.x,dz=a.z-b.z;return dx*dx+dz*dz}
function bloco(geo,material,x,y,z,parent){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

export const lojaPos=new THREE.Vector3(0,0,-18);
const LOJA_RAIO_QT=4.5*4.5;
export const receptadorPos=new THREE.Vector3(50,0,30);
const RECEPTADOR_RAIO_QT=4.5*4.5;
criarEsconderijo(receptadorPos.x,receptadorPos.z);

// Planta em vaso, estilizada em 3 estágios (broto/vegetativa/flora), com a mesma técnica de aglomerados das árvores.
function criarPlanta(x,y,z){
  const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
  bloco(new THREE.CylinderGeometry(.2,.16,.26,8),potMat,0,.13,0,g);
  const caule=bloco(new THREE.CylinderGeometry(.022,.032,.32,6),caulePlantaMat,0,.42,0,g);
  const broto=bloco(new THREE.DodecahedronGeometry(.12,0),folhaClara,0,.42,0,g);
  const vegFolhas=[[-.11,.5,.06,.15],[.11,.52,-.05,.14],[0,.58,.09,.13]].map(p=>{const m=bloco(new THREE.DodecahedronGeometry(p[3]+Math.random()*.02,0),Math.random()<.5?folhaMat:folhaClara,p[0],p[1],p[2],g);m.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);return m});
  const florFolhas=[[0,.76,.1,.13],[-.15,.7,-.06,.12],[.15,.7,-.06,.12],[-.08,.83,.03,.1],[.08,.83,-.03,.1]].map(p=>{const m=bloco(new THREE.DodecahedronGeometry(p[3]+Math.random()*.02,0),floraMat,p[0],p[1],p[2],g);m.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);return m});
  const florAcentos=[[0,.87,.12],[-.15,.79,-.04],[.15,.79,-.04]].map(p=>bloco(new THREE.SphereGeometry(.035,6,6),floraAcentoMat,p[0],p[1],p[2],g));
  const revelaEm=[[caule,0],[broto,0],...vegFolhas.map(m=>[m,1]),...florFolhas.map(m=>[m,2]),...florAcentos.map(m=>[m,2])];
  [...vegFolhas,...florFolhas,...florAcentos].forEach(m=>m.visible=false);
  criarSombraContato(.45,g,0,0);
  const planta={grupo:g,x,y,z,plantadoEm:performance.now()/1000,estagio:0,revelaEm,colhida:false};
  return planta;
}
// Crescimento cumulativo: cada parte some visível a partir do seu próprio estágio e continua visível depois (a planta não "encolhe").
function atualizarEstagioPlanta(planta){planta.revelaEm.forEach(([m,estagioMin])=>m.visible=planta.estagio>=estagioMin)}
export function atualizarPlantas(){
  const agora=performance.now()/1000;
  for(const p of plantas){
    if(p.colhida)continue;
    const estagioAlvo=Math.min(2,Math.floor((agora-p.plantadoEm)/TEMPO_ESTAGIO));
    if(estagioAlvo!==p.estagio){p.estagio=estagioAlvo;atualizarEstagioPlanta(p)}
  }
}
// ===== MIRA DE PLANTIO: raycaster a partir da câmera (combina com a mira fixa no centro da tela) contra o
// terreno E as superfícies elevadas (lajes/degraus) — dá pra plantar em qualquer lugar, rua ou telhado.
const raycasterMira=new THREE.Raycaster(),ALCANCE_MIRA=14;
const potGhostMat=new THREE.MeshBasicMaterial({color:0x33ff55,transparent:true,opacity:.5,depthTest:false});
const potGhost=new THREE.Mesh(new THREE.CylinderGeometry(.2,.16,.26,8),potGhostMat);potGhost.visible=false;potGhost.renderOrder=2;scene.add(potGhost);
const miraEl=document.getElementById('mira');
function calcularAlvoPlantio(){
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  raycasterMira.set(camera.position,dir);raycasterMira.far=ALCANCE_MIRA*2;
  const hits=raycasterMira.intersectObjects([ground,...superficiesAndaveis],true);
  if(!hits.length)return null;
  const ponto=hits[0].point;
  if(ponto.distanceTo(player.position)>ALCANCE_MIRA)return null;
  const meia=.22;
  const caixaVaso=new THREE.Box3(new THREE.Vector3(ponto.x-meia,ponto.y,ponto.z-meia),new THREE.Vector3(ponto.x+meia,ponto.y+.3,ponto.z+meia));
  const bloqueado=obstaculos.some(o=>o.intersectsBox(caixaVaso));
  const pertoDemais=plantas.some(p=>!p.colhida&&distXZSq(p,ponto)<2.56);
  return{ponto,valido:!bloqueado&&!pertoDemais};
}
export function atualizarMiraPlantio(){
  const temIngredientes=inventarioAberto&&inventario.vaso>0&&inventario.terra>0&&inventario.semente>0;
  miraEl.style.display=temIngredientes?'block':'none';
  if(!temIngredientes){potGhost.visible=false;return}
  const alvo=calcularAlvoPlantio();
  if(!alvo){potGhost.visible=false;miraEl.style.borderColor='rgba(255,255,255,.85)';return}
  potGhost.visible=true;potGhost.position.set(alvo.ponto.x,alvo.ponto.y+.13,alvo.ponto.z);
  potGhostMat.color.set(alvo.valido?0x33ff55:0xff3333);
  miraEl.style.borderColor=alvo.valido?'#33ff55':'#ff3333';
}
export function contextoAtual(){
  const p=player.position;
  if(distXZSq(p,lojaPos)<LOJA_RAIO_QT)return{tipo:'loja'};
  if(distXZSq(p,receptadorPos)<RECEPTADOR_RAIO_QT)return{tipo:'receptador'};
  const plantaProxima=plantas.find(pl=>!pl.colhida&&distXZSq(pl,p)<2.56);
  if(plantaProxima)return{tipo:'planta',planta:plantaProxima};
  return null;
}
const acaoPanel=document.getElementById('acaoPanel'),statusEconomia=document.getElementById('statusEconomia');
export function atualizarStatusEconomia(){statusEconomia.textContent=`R$${dinheiro} · 🪴${inventario.vaso} 🌱${inventario.terra} 🌾${inventario.semente} 📦${inventario.pacote}`}
export function comprar(item,preco){if(dinheiro>=preco){dinheiro-=preco;inventario[item]++;atualizarStatusEconomia();renderizarAcoes();renderizarInventario()}}
export function venderPacotes(){if(inventario.pacote>0){dinheiro+=inventario.pacote*40;inventario.pacote=0;atualizarStatusEconomia();renderizarAcoes();renderizarInventario()}}
export function plantarAqui(){
  const alvo=calcularAlvoPlantio();
  if(inventario.vaso>0&&inventario.terra>0&&inventario.semente>0&&alvo&&alvo.valido){
    inventario.vaso--;inventario.terra--;inventario.semente--;
    plantas.push(criarPlanta(alvo.ponto.x,alvo.ponto.y,alvo.ponto.z));
    potGhost.visible=false;
    atualizarStatusEconomia();renderizarAcoes();renderizarInventario();
  }
}
// ===== INVENTÁRIO: o jogador decide onde plantar — abre o inventário parado no local escolhido e planta ali, na hora que quiser.
const invBtn=document.getElementById('invBtn'),invPanel=document.getElementById('invPanel');
let inventarioAberto=false,invEstrutura=null;
export function alternarInventario(){inventarioAberto=!inventarioAberto;renderizarInventario()}
export function isInventarioAberto(){return inventarioAberto}
// Monta o DOM do painel só UMA VEZ enquanto ele fica aberto: reconstruir o innerHTML a cada frame (60x/s)
// destruía e recriava o botão embaixo do dedo do jogador — o toque começava num elemento que sumia antes
// do "click" disparar, e o clique era simplesmente perdido. Agora só o texto/estado dos elementos existentes muda.
function garantirEstruturaInventario(){
  if(invEstrutura)return invEstrutura;
  invPanel.innerHTML='';
  const linVaso=document.createElement('div');linVaso.className='invLinha';invPanel.appendChild(linVaso);
  const linTerra=document.createElement('div');linTerra.className='invLinha';invPanel.appendChild(linTerra);
  const linSemente=document.createElement('div');linSemente.className='invLinha';invPanel.appendChild(linSemente);
  const linPacote=document.createElement('div');linPacote.className='invLinha';invPanel.appendChild(linPacote);
  const linDica=document.createElement('div');linDica.className='invLinha';linDica.style.opacity='.75';linDica.style.fontSize='11px';linDica.textContent='Mire onde quer plantar — o vaso fantasma verde mostra o lugar';invPanel.appendChild(linDica);
  const btnPlantar=document.createElement('button');btnPlantar.onclick=plantarAqui;invPanel.appendChild(btnPlantar);
  const btnFechar=document.createElement('button');btnFechar.className='fechar';btnFechar.textContent='Fechar';btnFechar.onclick=alternarInventario;invPanel.appendChild(btnFechar);
  invEstrutura={linVaso,linTerra,linSemente,linPacote,btnPlantar,btnFechar};
  return invEstrutura;
}
export function renderizarInventario(){
  if(!inventarioAberto){invPanel.style.display='none';potGhost.visible=false;invEstrutura=null;return}
  const el=garantirEstruturaInventario();
  const temIngredientes=inventario.vaso>0&&inventario.terra>0&&inventario.semente>0;
  const alvo=temIngredientes?calcularAlvoPlantio():null;
  const podePlantar=!!(alvo&&alvo.valido);
  let motivo='';
  if(!temIngredientes)motivo='Falta vaso, terra ou semente rara';
  else if(!alvo)motivo='Mire pro chão ou telhado, por perto';
  else if(!alvo.valido)motivo='Muito perto de parede ou de outra muda';
  el.linVaso.textContent=`🪴 Vaso: ${inventario.vaso}`;
  el.linTerra.textContent=`🌱 Terra: ${inventario.terra}`;
  el.linSemente.textContent=`🌾 Semente Rara: ${inventario.semente}`;
  el.linPacote.textContent=`📦 Pacotes: ${inventario.pacote}`;
  el.btnPlantar.textContent=podePlantar?'Plantar Muda onde estou mirando':motivo;
  el.btnPlantar.disabled=!podePlantar;
  invPanel.style.display='flex';
}
invBtn.addEventListener('click',alternarInventario);
export function colher(planta){
  if(planta.estagio===2&&!planta.colhida){
    planta.colhida=true;
    inventario.pacote+=2+Math.floor(Math.random()*2);
    scene.remove(planta.grupo);
    const idx=plantas.indexOf(planta);if(idx>=0)plantas.splice(idx,1);
    atualizarStatusEconomia();renderizarAcoes();
  }
}
// Usado pela polícia (Police.js) quando encontra uma plantação sem o jogador por perto pra defender:
// a muda é perdida, sem pacotes — ao contrário de colher(), que é o jogador colhendo de propósito.
export function confiscarPlanta(planta){
  if(planta.colhida)return;
  planta.colhida=true;
  scene.remove(planta.grupo);
  const idx=plantas.indexOf(planta);if(idx>=0)plantas.splice(idx,1);
  atualizarStatusEconomia();renderizarAcoes();
}
// Multa aplicada pela polícia quando o jogador é rendido num confronto (ver Police.js).
export function aplicarMulta(valor){dinheiro=Math.max(0,dinheiro-valor);atualizarStatusEconomia()}
let ultimoContextoTipo=null;
export function renderizarAcoes(){
  const ctx=contextoAtual(),tipo=ctx?ctx.tipo:null;
  acaoPanel.innerHTML='';
  if(tipo==='loja'){
    const b1=document.createElement('button');b1.textContent='Comprar Vaso (R$10)';b1.disabled=dinheiro<10;b1.onclick=()=>comprar('vaso',10);acaoPanel.appendChild(b1);
    const b2=document.createElement('button');b2.textContent='Comprar Terra (R$8)';b2.disabled=dinheiro<8;b2.onclick=()=>comprar('terra',8);acaoPanel.appendChild(b2);
    acaoPanel.style.display='flex';
  }else if(tipo==='receptador'){
    const b1=document.createElement('button');b1.textContent='Comprar Semente Rara (R$25)';b1.disabled=dinheiro<25;b1.onclick=()=>comprar('semente',25);acaoPanel.appendChild(b1);
    const b2=document.createElement('button');b2.textContent=`Vender ${inventario.pacote} pacote(s) (+R$${inventario.pacote*40})`;b2.disabled=inventario.pacote<=0;b2.onclick=venderPacotes;acaoPanel.appendChild(b2);
    acaoPanel.style.display='flex';
  }else if(tipo==='planta'){
    const nomes=['Broto','Vegetativa','Flora (pronta)'],pronta=ctx.planta.estagio===2;
    const b1=document.createElement('button');b1.textContent=pronta?'Colher':`Crescendo: ${nomes[ctx.planta.estagio]}`;b1.disabled=!pronta;b1.onclick=()=>colher(ctx.planta);acaoPanel.appendChild(b1);
    acaoPanel.style.display='flex';
  }else{
    acaoPanel.style.display='none';
  }
  ultimoContextoTipo=tipo?tipo+(ctx.planta?ctx.planta.estagio:''):null;
}
export function getUltimoContextoTipo(){return ultimoContextoTipo}
atualizarStatusEconomia();
