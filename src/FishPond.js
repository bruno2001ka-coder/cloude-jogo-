import*as THREE from'three';
import{bairro}from'./WorldGenerator.js';
import{obterElevacao}from'./Terrain.js';
import{superficiesAndaveis}from'./Physics.js';
import{LAGO_PEIXES}from'./LakeConfig.js';

// O buraco NAO e criado aqui. Terrain.js deforma o proprio chao usando LakeConfig.
// Este modulo apenas preenche aquela cavidade com agua, peixes, pedras e um pequeno deque.
const{x:cx,z:cz,raioX:rx,raioZ:rz,nivelAgua:nivel,profundidade}=LAGO_PEIXES;
const SEG=72;
const lago=new THREE.Group();lago.name='lago-peixes-fisico';bairro.add(lago);

const aguaSuperficie=new THREE.MeshStandardMaterial({
  color:0x2b8798,roughness:.16,metalness:.04,transparent:true,opacity:.68,
  depthWrite:false,side:THREE.DoubleSide
});
const aguaVolume=new THREE.MeshStandardMaterial({
  color:0x155767,roughness:.28,metalness:0,transparent:true,opacity:.30,
  depthWrite:false,side:THREE.DoubleSide
});
const lodo=new THREE.MeshStandardMaterial({color:0x33433a,roughness:1,metalness:0});
const pedraMats=[0x67665f,0x817a6d,0x555954].map(color=>new THREE.MeshStandardMaterial({color,roughness:.97,metalness:0}));
const madeira=new THREE.MeshStandardMaterial({color:0x765435,roughness:.94,metalness:0});
const madeiraEscura=new THREE.MeshStandardMaterial({color:0x493426,roughness:.98,metalness:0});
const juncoMat=new THREE.MeshStandardMaterial({color:0x557747,roughness:1,metalness:0});
function add(geo,mat,x,y,z,parent=lago){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// ===== AGUA PREENCHENDO A ESCAVACAO =====
// A borda molhada do terreno cruza o nivel da agua perto de 94% do raio. Por isso o volume termina
// ali: a agua encontra o TALUDE real do chao, em vez de desenhar uma margem falsa por cima dele.
const fatorAgua=.945;
const fundoY=nivel-profundidade;
const fundo=add(new THREE.CircleGeometry(rx*.76,SEG),lodo,cx,fundoY+.018,cz);
fundo.rotation.x=-Math.PI/2;fundo.scale.y=rz/rx;

const volume=add(new THREE.CylinderGeometry(rx*fatorAgua,rx*fatorAgua,profundidade-.03,SEG,1,false),aguaVolume,cx,nivel-profundidade/2,cz);
volume.scale.z=rz/rx;volume.castShadow=false;volume.renderOrder=1;
const superficie=add(new THREE.CircleGeometry(rx*fatorAgua,SEG),aguaSuperficie,cx,nivel+.006,cz);
superficie.rotation.x=-Math.PI/2;superficie.scale.y=rz/rx;superficie.castShadow=false;superficie.renderOrder=2;

// Pedras assentam no TERRENO JA ESCAVADO; nenhuma delas sustenta a agua.
const pedras=[[-5.85,-.7,.37],[-5.1,2.2,.31],[-3.3,3.65,.35],[-.65,4.05,.27],[2.35,3.75,.34],[4.85,2.35,.38],[5.95,.25,.31],[5.25,-2.35,.36],[2.65,-3.75,.31],[-.45,-4.0,.29],[-3.9,-3.15,.35]];
for(let i=0;i<pedras.length;i++){
  const[dx,dz,s]=pedras[i],x=cx+dx,z=cz+dz,y=obterElevacao(x,z);
  const p=add(new THREE.DodecahedronGeometry(s,0),pedraMats[i%3],x,y+s*.38,z);p.scale.set(1.15,.72,.9);p.rotation.y=i*.73;
}

// Juncos na linha externa da margem.
const juncoGeo=new THREE.CylinderGeometry(.018,.025,.7,5);
for(const[dx,dz]of[[-4.65,-2.25],[-4.5,2.35],[4.55,-2.25],[4.6,2.2]])for(let j=0;j<5;j++){
  const x=cx+dx+(j-2)*.075,z=cz+dz+Math.sin(j*1.6)*.075,y=obterElevacao(x,z);
  const r=add(juncoGeo,juncoMat,x,y+.35,z);r.rotation.z=(j-2)*.026;
}

// Deque curto do lado leste, voltado para a fazenda.
const deck=new THREE.Group();lago.add(deck);
const inicioX=cx+rx*1.23,inicioZ=cz+.12,comprimento=3.25,tabuas=10;
const yInicio=obterElevacao(inicioX,inicioZ)+.11;
for(let i=0;i<tabuas;i++){
  const t=i/(tabuas-1),wx=inicioX-comprimento*t,wy=THREE.MathUtils.lerp(yInicio,nivel+.17,t);
  const m=add(new THREE.BoxGeometry(.62,.09,.38),madeira,wx,wy,inicioZ);m.rotation.y=.01*(i%2?1:-1);superficiesAndaveis.push(m);
}
for(const t of[0,1])for(const dz of[-.25,.25]){
  const wx=inicioX-comprimento*t,top=THREE.MathUtils.lerp(yInicio,nivel+.17,t),solo=obterElevacao(wx,inicioZ+dz),h=Math.max(.48,top-solo+.28);
  add(new THREE.CylinderGeometry(.045,.06,h,7),madeiraEscura,wx,solo+h/2,inicioZ+dz);
}

// ===== PEIXES: ANATOMIA LEVE + NADO CORPO-CAUDA =====
// Em vez de esfera esticada + cone, o corpo e uma malha fusiforme feita por aneis.
// Tem mais volume no tronco, afina no pedunculo e fecha num focinho arredondado.
const paletas=[
  {dorso:0x3c5744,flanco:0x71816a,ventre:0xc4bfa5,nadadeira:0x4e654d}, // tilapia/oliva
  {dorso:0x83532d,flanco:0xb77a3c,ventre:0xd9bd83,nadadeira:0x914e31}, // carpa/bronze
  {dorso:0x465e68,flanco:0x8fa4a6,ventre:0xd0d7cf,nadadeira:0x637b82}, // prateado
  {dorso:0x80611f,flanco:0xc49d3e,ventre:0xe2cb8c,nadadeira:0x976c27}, // dourado
];
const corpoMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.36,metalness:.035});
const olhoMat=new THREE.MeshStandardMaterial({color:0x111411,roughness:.18,metalness:.08});
const guelraMat=new THREE.MeshStandardMaterial({color:0x2a2722,roughness:.72,metalness:0,side:THREE.DoubleSide});
const bocaMat=new THREE.MeshStandardMaterial({color:0x2b211d,roughness:.82,metalness:0});
const olhoGeo=new THREE.SphereGeometry(.017,8,6);
const bocaGeo=new THREE.BoxGeometry(.012,.008,.055);
const perfil=[
  [-.33,.050,.036],[-.27,.092,.058],[-.17,.142,.087],[-.04,.166,.100],
  [.10,.158,.096],[.23,.118,.071],[.32,.058,.038],[.355,.018,.015]
];
function corpoFusiforme(paleta){
  const radial=12,pos=[],cor=[],idx=[];
  const dorso=new THREE.Color(paleta.dorso),flanco=new THREE.Color(paleta.flanco),ventre=new THREE.Color(paleta.ventre);
  for(let r=0;r<perfil.length;r++){
    const[x,ry,rz]=perfil[r],u=r/(perfil.length-1);
    for(let j=0;j<radial;j++){
      const a=j/radial*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      pos.push(x,c*ry,s*rz);
      const cc=new THREE.Color();
      if(c>=0)cc.copy(flanco).lerp(dorso,Math.pow(c,.72)*(.82+.08*(1-u)));
      else cc.copy(flanco).lerp(ventre,Math.pow(-c,.78)*.88);
      cor.push(cc.r,cc.g,cc.b);
    }
  }
  for(let r=0;r<perfil.length-1;r++)for(let j=0;j<radial;j++){
    const n=(j+1)%radial,a=r*radial+j,b=r*radial+n,c=(r+1)*radial+n,d=(r+1)*radial+j;
    idx.push(a,b,d,b,c,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cor,3));
  geo.setIndex(idx);geo.computeVertexNormals();
  return geo;
}
const corposGeo=paletas.map(corpoFusiforme);
const nadadeiraMats=paletas.map(p=>new THREE.MeshStandardMaterial({
  color:p.nadadeira,roughness:.5,metalness:.015,transparent:true,opacity:.88,side:THREE.DoubleSide
}));
const pedunculoMats=paletas.map(p=>new THREE.MeshStandardMaterial({color:p.flanco,roughness:.4,metalness:.025}));
const pedunculoGeo=new THREE.CylinderGeometry(.034,.054,.17,9,1,false);pedunculoGeo.rotateZ(Math.PI/2);

// Cauda bilobada com entalhe central, dorsal triangular e peitorais finas.
const formaCauda=new THREE.Shape();
formaCauda.moveTo(0,0);formaCauda.lineTo(-.10,.045);formaCauda.lineTo(-.27,.185);
formaCauda.lineTo(-.255,.045);formaCauda.lineTo(-.34,0);formaCauda.lineTo(-.255,-.045);
formaCauda.lineTo(-.27,-.185);formaCauda.lineTo(-.10,-.045);formaCauda.closePath();
const caudaGeo=new THREE.ShapeGeometry(formaCauda);

const formaDorsal=new THREE.Shape();
formaDorsal.moveTo(-.15,0);formaDorsal.lineTo(-.055,.13);formaDorsal.lineTo(.085,.072);formaDorsal.lineTo(.16,0);formaDorsal.closePath();
const dorsalGeo=new THREE.ShapeGeometry(formaDorsal);

const pectoralGeo=new THREE.BufferGeometry();
pectoralGeo.setAttribute('position',new THREE.Float32BufferAttribute([.035,0,0,-.13,0,.12,-.09,0,.025],3));
pectoralGeo.setIndex([0,1,2]);pectoralGeo.computeVertexNormals();

const guelraGeo=new THREE.RingGeometry(.047,.052,12,1,-1.05,2.1);
const peixes=[];
function addPeixeMesh(geo,mat,parent){
  const m=new THREE.Mesh(geo,mat);m.castShadow=false;m.receiveShadow=false;parent.add(m);return m;
}
function criarPeixe(i){
  const especie=i%paletas.length,g=new THREE.Group(),tronco=new THREE.Group();g.add(tronco);lago.add(g);
  addPeixeMesh(corposGeo[especie],corpoMat,tronco);

  const dorsal=addPeixeMesh(dorsalGeo,nadadeiraMats[especie],tronco);dorsal.position.set(-.02,.145,0);
  const finL=addPeixeMesh(pectoralGeo,nadadeiraMats[especie],tronco);finL.position.set(.075,-.015,.085);
  const finR=addPeixeMesh(pectoralGeo,nadadeiraMats[especie],tronco);finR.position.set(.075,-.015,-.085);finR.scale.z=-1;

  for(const lado of[-1,1]){
    const olho=addPeixeMesh(olhoGeo,olhoMat,tronco);olho.position.set(.255,.038,lado*.071);olho.scale.z=.72;
    const guelra=addPeixeMesh(guelraGeo,guelraMat,tronco);guelra.position.set(.195,-.002,lado*.078);guelra.scale.set(.72,1,1);
  }
  const boca=addPeixeMesh(bocaGeo,bocaMat,tronco);boca.position.set(.357,-.017,0);

  const pedunculo=new THREE.Group();pedunculo.position.x=-.30;tronco.add(pedunculo);
  const haste=addPeixeMesh(pedunculoGeo,pedunculoMats[especie],pedunculo);haste.position.x=-.075;
  const caudaPivot=new THREE.Group();caudaPivot.position.x=-.155;pedunculo.add(caudaPivot);
  const cauda=addPeixeMesh(caudaGeo,nadadeiraMats[especie],caudaPivot);cauda.position.x=-.008;

  const escala=.72+(i%4)*.075;g.scale.setScalar(escala);
  const fase=i*.83,orbitX=1.45+(i%5)*.46,orbitZ=.78+(i%4)*.34,vel=.20+(i%3)*.035;
  const a=fase,x=cx+Math.cos(a)*orbitX,z=cz+Math.sin(a*.96)*orbitZ,y=nivel-(.27+(i%5)*.105);
  g.position.set(x,y,z);
  peixes.push({g,tronco,pedunculo,caudaPivot,finL,finR,fase,orbitX,orbitZ,vel,prof:.27+(i%5)*.105,
    ultimoX:x,ultimoY:y,ultimoZ:z,yaw:0});
}
for(let i=0;i<12;i++)criarPeixe(i);

// Pequenos aneis de superficie. Sao so 3 malhas leves, nao uma simulacao GPU de fluido.
const ondas=[];
for(let i=0;i<3;i++){
  const mat=new THREE.MeshBasicMaterial({color:0xa8dce2,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide});
  const o=add(new THREE.RingGeometry(.24,.28,28),mat,cx,nivel+.016,cz);o.rotation.x=-Math.PI/2;o.renderOrder=3;ondas.push({o,mat});
}

let ultimoTempo=0;
function normalizarAngulo(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
function animar(t){
  requestAnimationFrame(animar);if(document.hidden)return;
  const tempo=t/1000,dt=Math.min(.05,ultimoTempo?tempo-ultimoTempo:.016);ultimoTempo=tempo;
  aguaSuperficie.opacity=.66+Math.sin(tempo*.7)*.018;
  for(let i=0;i<peixes.length;i++){
    const p=peixes[i];
    // Orbitas irregulares e lentas: evita o aspecto de peixe preso num trilho perfeitamente circular.
    const a=tempo*p.vel+p.fase+Math.sin(tempo*.17+p.fase)*.16;
    const x=cx+Math.cos(a)*p.orbitX+Math.sin(a*.57+p.fase)*.24;
    const z=cz+Math.sin(a*.96)*p.orbitZ+Math.cos(a*.43+p.fase)*.16;
    const y=nivel-p.prof+Math.sin(tempo*.47+p.fase*1.7)*.028;

    const vx=(x-p.ultimoX)/Math.max(dt,.001),vz=(z-p.ultimoZ)/Math.max(dt,.001);
    if(Math.hypot(vx,vz)>.002){
      const alvoYaw=Math.atan2(vx,vz)-Math.PI/2,dy=normalizarAngulo(alvoYaw-p.yaw);
      p.yaw+=dy*(1-Math.exp(-5.2*dt));
      p.g.rotation.y=p.yaw;
      // Peixe inclina levemente o corpo para dentro da curva e acompanha mudanca de profundidade.
      p.g.rotation.x=THREE.MathUtils.lerp(p.g.rotation.x,THREE.MathUtils.clamp(-dy*.42,-.16,.16),1-Math.exp(-4*dt));
      const subida=THREE.MathUtils.clamp((y-p.ultimoY)/Math.max(dt,.001)*.18,-.07,.07);
      p.g.rotation.z=THREE.MathUtils.lerp(p.g.rotation.z,-subida,1-Math.exp(-4*dt));
    }
    p.g.position.set(x,y,z);

    // Onda posterior: pouco movimento no tronco, mais no pedunculo e maximo na cauda.
    const freq=5.2+p.vel*4+(i%3)*.18,faseNado=tempo*freq+p.fase*1.9;
    p.tronco.rotation.y=Math.sin(faseNado)*.025;
    p.pedunculo.rotation.y=Math.sin(faseNado-.62)*.145;
    p.caudaPivot.rotation.y=Math.sin(faseNado-1.12)*.34;
    const abre=.20+Math.sin(faseNado*.52+i)*.07;
    p.finL.rotation.x=abre;p.finR.rotation.x=-abre;

    p.ultimoX=x;p.ultimoY=y;p.ultimoZ=z;
  }
  for(let i=0;i<ondas.length;i++){
    const q=ondas[i],f=(tempo*.17+i/3)%1,s=.85+f*3.5;q.o.scale.set(s,s*.72,1);q.mat.opacity=(1-f)*.13;
  }
}
requestAnimationFrame(animar);

export{LAGO_PEIXES};
