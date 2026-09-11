// Currais separados da fazenda: vacas, porcos e galinhas, cada especie com cerca e porteira funcional.
// O movimento original dos animais continua em WorldGenerator.js; aqui so restringimos os alvos ao
// retangulo do curral e cuidamos da geometria/colisao das porteiras.
import*as THREE from'three';
import{bairro,animais,sumirCaixa}from'./WorldGenerator.js';
import{obterElevacao}from'./Terrain.js';
import{registrarCaixa,marcarObstaculoMovel}from'./Physics.js';
import{criarSombraContato}from'./Materials.js';
import{player}from'./Player.js';
import{FAZENDA_CONFIG}from'./FarmConfig.js';

const madeira=new THREE.MeshStandardMaterial({color:0x7a5738,roughness:.94,metalness:0});
const madeiraEscura=new THREE.MeshStandardMaterial({color:0x4e3928,roughness:.96,metalness:0});
const metal=new THREE.MeshStandardMaterial({color:0x5d6060,roughness:.55,metalness:.55});
const telha=new THREE.MeshStandardMaterial({color:0x76564b,roughness:.94,metalness:0});
const concreto=new THREE.MeshStandardMaterial({color:0x8d8980,roughness:.96,metalness:0});
const agua=new THREE.MeshStandardMaterial({color:0x4d86a6,roughness:.28,metalness:.08});
const capim=new THREE.MeshStandardMaterial({color:0x72844f,roughness:1,metalness:0});

const ALT_POSTE=1.12,RAIO_INTERACAO=2.6,VAO=1.75;
const porteirasAnimais=[];

// Layout único compartilhado com o gerador da fazenda. Antes os currais moravam só neste arquivo
// e a roça era calculada em outro módulo sem saber onde eles estavam — exatamente por isso os
// canteiros nasceram DENTRO do curral dos porcos.
const CURRAIS=Object.values(FAZENDA_CONFIG.currais).map(c=>({
  ...c,
  spawn:c.spawn.map(p=>[p[0],p[1]]),
}));

function mesh(geo,mat,x,y,z,parent=bairro){
  const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function terrenoMedio(x1,z1,x2,z2){
  return (obterElevacao(x1,z1)+obterElevacao(x2,z2))/2;
}
function registrarTrecho(x1,z1,x2,z2,altura=ALT_POSTE){
  const y1=obterElevacao(x1,z1),y2=obterElevacao(x2,z2),esp=.12;
  registrarCaixa(new THREE.Box3(
    new THREE.Vector3(Math.min(x1,x2)-esp,y1<y2?y1-.3:y2-.3,Math.min(z1,z2)-esp),
    new THREE.Vector3(Math.max(x1,x2)+esp,Math.max(y1,y2)+altura,Math.max(z1,z2)+esp)
  ),'curral-animal');
}
function travessaEntre(x1,z1,x2,z2,altura){
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),ang=Math.atan2(dx,dz),y=terrenoMedio(x1,z1,x2,z2)+altura;
  const r=mesh(new THREE.BoxGeometry(.075,.10,len),madeira,(x1+x2)/2,y,(z1+z2)/2);
  r.rotation.y=ang;return r;
}
function poste(x,z,extra=0){
  const y=obterElevacao(x,z);
  return mesh(new THREE.CylinderGeometry(.075,.095,ALT_POSTE+extra,8),madeiraEscura,x,y+(ALT_POSTE+extra)/2,z);
}
function cercaTrecho(x1,z1,x2,z2){
  const len=Math.hypot(x2-x1,z2-z1),passos=Math.max(1,Math.ceil(len/1.9));
  for(let i=0;i<=passos;i++){
    const t=i/passos;poste(x1+(x2-x1)*t,z1+(z2-z1)*t);
  }
  for(const h of[.38,.78])travessaEntre(x1,z1,x2,z2,h);
  registrarTrecho(x1,z1,x2,z2);
}
function criarPlaca(curral,zFrente){
  const x=curral.cx,y=obterElevacao(x,zFrente)+1.55;
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#5b402a';ctx.fillRect(0,0,384,128);
  ctx.strokeStyle='#b58a58';ctx.lineWidth=10;ctx.strokeRect(7,7,370,114);
  ctx.fillStyle='#f4e7c7';ctx.font='700 48px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(`${curral.icone} ${curral.nome.toUpperCase()}`,192,65);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const placa=new THREE.Mesh(new THREE.PlaneGeometry(2.15,.72),new THREE.MeshStandardMaterial({map:tex,roughness:.9,side:THREE.DoubleSide}));
  placa.position.set(x,y,zFrente+.055);placa.castShadow=true;bairro.add(placa);
}
function criarCocho(curral){
  const x=curral.cx-curral.w*.22,z=curral.cz-curral.d*.22,y=obterElevacao(x,z);
  const g=new THREE.Group();g.position.set(x,y,z);bairro.add(g);
  // Cocho de madeira em V simplificado e bebedouro baixo.
  const c1=mesh(new THREE.BoxGeometry(1.35,.18,.45),madeiraEscura,0,.22,0,g);c1.rotation.x=.18;
  const c2=mesh(new THREE.BoxGeometry(1.35,.18,.45),madeiraEscura,0,.22,.24,g);c2.rotation.x=-.18;
  for(const sx of[-.55,.55])mesh(new THREE.CylinderGeometry(.04,.05,.35,7),madeiraEscura,sx,.14,.1,g);
  const bx=.95,bz=.55;
  mesh(new THREE.CylinderGeometry(.36,.4,.25,12),concreto,bx,.13,bz,g);
  mesh(new THREE.CylinderGeometry(.31,.31,.025,12),agua,bx,.265,bz,g);
  criarSombraContato(.95,g);
}
function criarAbrigo(curral){
  const x=curral.cx+curral.w*.25,z=curral.cz-curral.d*.28,y=obterElevacao(x,z);
  const g=new THREE.Group();g.position.set(x,y,z);bairro.add(g);
  for(const sx of[-.75,.75])for(const sz of[-.52,.52])mesh(new THREE.CylinderGeometry(.045,.055,1.2,7),madeiraEscura,sx,.6,sz,g);
  const t=mesh(new THREE.BoxGeometry(1.8,.10,1.35),telha,0,1.24,0,g);t.rotation.z=-.08;
  // Uma pequena manta de capim sob o abrigo deixa o curral menos vazio sem adicionar colisao.
  const cama=mesh(new THREE.CylinderGeometry(.62,.68,.035,14),capim,0,.025,0,g);cama.scale.z=.75;
}
function criarPorteira(curral,x,z,z0,z1){
  const y=obterElevacao(x,z),larg=z1-z0;
  poste(x,z0,.25);poste(x,z1,.25);
  const pivo=new THREE.Group();pivo.position.set(x,y,z0);bairro.add(pivo);
  const folha=new THREE.Group();folha.position.z=larg/2;pivo.add(folha);
  for(const h of[.30,.62,.94])mesh(new THREE.BoxGeometry(.07,.11,larg-.08),madeiraEscura,0,h,0,folha);
  for(const zz of[-larg/2+.05,larg/2-.05])mesh(new THREE.BoxGeometry(.08,1.02,.09),madeiraEscura,0,.51,zz,folha);
  const diag=mesh(new THREE.BoxGeometry(.065,.09,Math.hypot(larg-.15,.72)),madeira,0,.60,0,folha);diag.rotation.x=-Math.atan2(.72,larg-.15);
  const dobradica1=mesh(new THREE.CylinderGeometry(.04,.04,.12,8),metal,.06,.27,-larg/2+.04,folha);dobradica1.rotation.z=Math.PI/2;
  const dobradica2=mesh(new THREE.CylinderGeometry(.04,.04,.12,8),metal,.06,.82,-larg/2+.04,folha);dobradica2.rotation.z=Math.PI/2;

  const fechada=new THREE.Box3(new THREE.Vector3(x-.18,y-.35,z0),new THREE.Vector3(x+.18,y+1.08,z1));
  const caixa=new THREE.Box3();caixa.copy(fechada);registrarCaixa(caixa,'porteira-animal');marcarObstaculoMovel(caixa);
  const gate={id:`curral-${curral.tipo}`,tipo:curral.tipo,nome:curral.nome,icone:curral.icone,x,z,y,raio:RAIO_INTERACAO,pivo,folha,
    aberta:false,alvoAng:0,caixa,caixaFechada:fechada};
  porteirasAnimais.push(gate);return gate;
}
function criarCurral(curral){
  const x0=curral.cx-curral.w/2,x1=curral.cx+curral.w/2,z0=curral.cz-curral.d/2,z1=curral.cz+curral.d/2;
  // Porteira no lado leste, voltada para o corredor central da fazenda.
  const gz=curral.cz,g0=gz-VAO/2,g1=gz+VAO/2;
  cercaTrecho(x0,z0,x1,z0);cercaTrecho(x0,z1,x1,z1);cercaTrecho(x0,z0,x0,z1);
  cercaTrecho(x1,z0,x1,g0);cercaTrecho(x1,g1,x1,z1);
  criarPorteira(curral,x1,gz,g0,g1);
  criarPlaca(curral,z1);
  criarCocho(curral);criarAbrigo(curral);
  curral.bounds={minX:x0+.55,maxX:x1-.55,minZ:z0+.55,maxZ:z1-.55};
}
for(const c of CURRAIS)criarCurral(c);

function tipoPorIndice(i){return i<2?'vaca':i<4?'porco':'galinha'}
function sortearAlvo(c){
  const b=c.bounds;
  return{x:b.minX+Math.random()*(b.maxX-b.minX),z:b.minZ+Math.random()*(b.maxZ-b.minZ)};
}
// Reposiciona a fauna uma unica vez e desliga o sorteio global de WorldGenerator. O proprio
// atualizarAnimais continua fazendo a locomocao, rotacao e assentamento no terreno.
for(let i=0;i<animais.length;i++){
  const a=animais[i],tipo=tipoPorIndice(i),c=CURRAIS.find(q=>q.tipo===tipo),sp=c.spawn[i-(tipo==='vaca'?0:tipo==='porco'?2:4)]||[c.cx,c.cz];
  a.grupo.userData.tipoAnimal=tipo;a.curral=c;
  a.x=sp[0];a.z=sp[1];a.grupo.position.set(a.x,obterElevacao(a.x,a.z),a.z);
  a.alvo=sortearAlvo(c);a.proximaDecisao=Infinity;a.proximaTrocaCurral=performance.now()/1000+3+Math.random()*4;
}

// Um timer barato basta: o movimento ocorre no loop principal; aqui so escolhemos o proximo ponto.
setInterval(()=>{
  const agora=performance.now()/1000;
  for(const a of animais){
    if(!a.curral)continue;
    const chegou=Math.hypot(a.alvo.x-a.x,a.alvo.z-a.z)<.55;
    if(chegou||agora>=a.proximaTrocaCurral){a.alvo=sortearAlvo(a.curral);a.proximaTrocaCurral=agora+3.5+Math.random()*4.5;}
    a.proximaDecisao=Infinity;
  }
},700);

export function porteiraAnimalProxima(pos){
  let melhor=null,dist=Infinity;
  for(const p of porteirasAnimais){const d=Math.hypot(pos.x-p.x,pos.z-p.z);if(d<p.raio&&d<dist){melhor=p;dist=d}}
  return melhor;
}
export function alternarPorteiraAnimal(p){
  if(!p)return false;
  p.aberta=!p.aberta;p.alvoAng=p.aberta?-Math.PI*.52:0;
  if(p.aberta)sumirCaixa(p.caixa);else p.caixa.copy(p.caixaFechada);
  return p.aberta;
}
export{porteirasAnimais,CURRAIS};

// Painel de acao das porteiras. Reusa o mesmo #acaoPanel das casas/lojas sem criar HUD nova.
// Como os currais ficam longe dos outros contextos, o botao so aparece quando realmente ha uma
// porteira de animal a menos de 2,6 m. No teclado, E faz a mesma coisa que tocar no botao.
const acaoPanel=document.getElementById('acaoPanel');
let ultimaPorteiraUI=null,ultimoEstadoUI=null;
function desenharAcaoPorteira(p){
  if(!acaoPanel||!p)return;
  acaoPanel.innerHTML='';
  const b=document.createElement('button');b.id='animalGateAction';
  b.textContent=`${p.icone} ${p.aberta?'Fechar':'Abrir'} porteira das ${p.nome.toLowerCase()}`;
  b.onclick=()=>{alternarPorteiraAnimal(p);desenharAcaoPorteira(p)};
  acaoPanel.appendChild(b);acaoPanel.style.display='flex';
  ultimaPorteiraUI=p;ultimoEstadoUI=p.aberta;
}
setInterval(()=>{
  const p=porteiraAnimalProxima(player.position),botao=document.getElementById('animalGateAction');
  if(p){
    if(!botao||ultimaPorteiraUI!==p||ultimoEstadoUI!==p.aberta)desenharAcaoPorteira(p);
    return;
  }
  // Se outro sistema ja substituiu o conteudo do painel, nao mexe nele.
  if(botao){botao.remove();if(!acaoPanel.children.length)acaoPanel.style.display='none'}
  ultimaPorteiraUI=null;ultimoEstadoUI=null;
},120);
addEventListener('keydown',e=>{
  if(e.code!=='KeyE'||e.repeat)return;
  const p=porteiraAnimalProxima(player.position);if(!p)return;
  e.preventDefault();alternarPorteiraAnimal(p);desenharAcaoPorteira(p);
},true);

// Anima so as tres folhas. requestAnimationFrame separado evita tocar no loop central e custa quase zero.
let ultimo=performance.now();
function animar(t){
  const dt=Math.min(.05,(t-ultimo)/1000);ultimo=t;
  const k=1-Math.exp(-10*dt);
  for(const p of porteirasAnimais){
    p.pivo.rotation.y+=(p.alvoAng-p.pivo.rotation.y)*k;
    if(Math.abs(p.alvoAng-p.pivo.rotation.y)<.002)p.pivo.rotation.y=p.alvoAng;
  }
  requestAnimationFrame(animar);
}
requestAnimationFrame(animar);
