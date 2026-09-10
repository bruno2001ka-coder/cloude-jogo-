// ===== BAIRRO NOBRE — JARDINS DO MORRO =====
// Expansao planejada em volta da Casa do Jogador. A ordem e proposital: primeiro a rede viaria,
// depois calcadas/infraestrutura e so entao os lotes. Assim nenhuma casa nasce bloqueando uma rua.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao,alturaDoChaoDesenhado}from'./Terrain.js';
import{levanteContraQuina,PASSO_DA_FITA}from'./Favela.js';
import{registrarCaixa,superficiesAndaveis}from'./Physics.js';
import{matAsfalto,matMeioFio,matReboco,matConcreto,matMadeira,matTelha,uvPorMetro}from'./Materials.js';

export const BAIRRO_NOBRE={nome:'Jardins do Morro',casa:{x:31.3,z:71.7},conexaoFavela:{x:31,z:1.2}};
const bairro=new THREE.Group();bairro.name='bairro-nobre-jardins-do-morro';scene.add(bairro);

// A avenida faz curvas de nivel e termina exatamente onde a via baixa da favela acaba.
// Os pontos extras no trecho inferior funcionam como uma serpentina: o vale entre os dois morros
// exige ganhar altura de novo antes da favela, e subir reto deixaria a rua absurda para carro/moto.
export const avenidaNobre=new THREE.CatmullRomCurve3([
  new THREE.Vector3(31.1,0,65.0),new THREE.Vector3(32.5,0,58.0),
  new THREE.Vector3(29.2,0,49.5),new THREE.Vector3(30.0,0,40.5),
  new THREE.Vector3(27.0,0,32.0),new THREE.Vector3(20.0,0,25.0),
  new THREE.Vector3(16.5,0,20.0),new THREE.Vector3(20.0,0,15.0),
  new THREE.Vector3(25.5,0,8.0),new THREE.Vector3(31.0,0,1.2)
],false,'centripetal');

const topoCJ=new THREE.CatmullRomCurve3([
  avenidaNobre.getPointAt(0),new THREE.Vector3(31.0,0,67.3),new THREE.Vector3(31.3,0,70.2)
],false,'centripetal');
const pO=avenidaNobre.getPointAt(.34);
const alamedaOeste=new THREE.CatmullRomCurve3([
  pO,new THREE.Vector3(pO.x-6,0,pO.z+1.8),new THREE.Vector3(pO.x-12,0,pO.z+3.2),new THREE.Vector3(pO.x-18,0,pO.z+.4)
],false,'centripetal');
const pL=avenidaNobre.getPointAt(.59);
const alamedaLeste=new THREE.CatmullRomCurve3([
  pL,new THREE.Vector3(pL.x+7,0,pL.z+1.8),new THREE.Vector3(pL.x+14,0,pL.z+4.0),new THREE.Vector3(pL.x+20,0,pL.z+2.0)
],false,'centripetal');

const asfalto=matAsfalto(),meiofio=matMeioFio(),concreto=matConcreto();
const calcadaMat=new THREE.MeshStandardMaterial({color:0xb8b5ad,roughness:.96,metalness:0});
const faixaMat=new THREE.MeshStandardMaterial({color:0xe9dfb6,roughness:.75,metalness:0});
const brancoMat=new THREE.MeshStandardMaterial({color:0xf1f0e8,roughness:.78,metalness:0});
const metalEscuro=new THREE.MeshStandardMaterial({color:0x292d2f,roughness:.42,metalness:.68});
const vidro=new THREE.MeshStandardMaterial({color:0x73a9b4,roughness:.10,metalness:.08,transparent:true,opacity:.48,depthWrite:false});
const pedra=new THREE.MeshStandardMaterial({color:0x77736a,roughness:.92,metalness:0});
const aguaDecor=new THREE.MeshStandardMaterial({color:0x4c9eb4,roughness:.18,metalness:.05,transparent:true,opacity:.72,depthWrite:false});
const grama=new THREE.MeshStandardMaterial({color:0x537343,roughness:1,metalness:0});
const folha=new THREE.MeshStandardMaterial({color:0x42643d,roughness:1,metalness:0,flatShading:true});
const folha2=new THREE.MeshStandardMaterial({color:0x66804e,roughness:1,metalness:0,flatShading:true});
const emissivo=new THREE.MeshStandardMaterial({color:0xffe4a3,emissive:0xffc15a,emissiveIntensity:1.35,roughness:.42});

function hRua(x,z){return levanteContraQuina(x,z,PASSO_DA_FITA)+.003}
function mundoLocal(cx,cz,giro,x,z){const c=Math.cos(giro),s=Math.sin(giro);return{x:cx+x*c+z*s,z:cz-x*s+z*c}}
function mesh(geo,mat,x,y,z,parent=bairro,sombra=true){
  if(mat?.map)uvPorMetro(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);
  m.castShadow=sombra;m.receiveShadow=true;parent.add(m);return m;
}

// Fita que acompanha a malha real do terreno em duas direcoes. Asfalto e calcada usam a mesma
// amostragem; por isso nao existe placa flutuando quando a rua cruza uma dobra do morro.
function criarFita(curva,largura,material,{offset=0,altura=.003,passo=.72,passoLarg=.55,andavel=false,nome='fita'}={}){
  const total=curva.getLength(),linhas=Math.max(2,Math.ceil(total/passo)),colunas=Math.max(2,Math.ceil(largura/passoLarg));
  const pos=[],uv=[],cor=[],idx=[];
  for(let i=0;i<=linhas;i++){
    const u=i/linhas,p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),nx=-t.z,nz=t.x;
    for(let j=0;j<=colunas;j++){
      const k=j/colunas,l=offset-largura/2+largura*k,x=p.x+nx*l,z=p.z+nz*l;
      const y=(material===asfalto?hRua(x,z):alturaDoChaoDesenhado(x,z)+altura);
      pos.push(x,y,z);uv.push(k*largura/2,u*total/2);cor.push(1,1,1);
    }
  }
  const row=colunas+1;
  for(let i=0;i<linhas;i++)for(let j=0;j<colunas;j++){
    const a=i*row+j,b=a+1,c=a+row+1,d=a+row;idx.push(a,b,d,b,c,d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',g.attributes.uv.clone());
  g.setAttribute('color',new THREE.Float32BufferAttribute(cor,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.name=nome;m.receiveShadow=true;m.castShadow=false;bairro.add(m);
  if(andavel)superficiesAndaveis.push(m);return m;
}

function infraestruturaVia(curva,largura,principal=false){
  criarFita(curva,largura,asfalto,{nome:'asfalto-bairro-nobre',andavel:true});
  const cal=1.08,off=largura/2+.66;
  for(const lado of[-1,1]){
    criarFita(curva,cal,calcadaMat,{offset:lado*off,altura:.062,passo:.78,andavel:true,nome:'calcada-bairro-nobre'});
    criarFita(curva,.18,meiofio,{offset:lado*(largura/2+.10),altura:.07,passo:.72,nome:'meiofio-bairro-nobre'});
  }
  if(principal)criarMarcacoes(curva,largura);
}

function criarMarcacoes(curva,largura){
  const total=curva.getLength(),n=Math.floor(total/4.5),geo=new THREE.BoxGeometry(.105,.012,1.8);
  const inst=new THREE.InstancedMesh(geo,faixaMat,n);inst.receiveShadow=false;inst.castShadow=false;
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),p3=new THREE.Vector3(),sc=new THREE.Vector3(1,1,1),eixoY=new THREE.Vector3(0,1,0);
  for(let i=0;i<n;i++){
    const u=(i+.5)/n,p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),yaw=Math.atan2(t.x,t.z);
    p3.set(p.x,hRua(p.x,p.z)+.014,p.z);q.setFromAxisAngle(eixoY,yaw);m4.compose(p3,q,sc);inst.setMatrixAt(i,m4);
  }
  inst.instanceMatrix.needsUpdate=true;bairro.add(inst);
  // Duas faixas de pedestre: perto do centro do bairro e na transicao com a favela.
  for(const u of[.48,.91]){
    const p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),nx=-t.z,nz=t.x,yaw=Math.atan2(t.x,t.z);
    for(let s=-2;s<=2;s++){
      const x=p.x+nx*s*.9,z=p.z+nz*s*.9,r=mesh(new THREE.BoxGeometry(.62,.014,.32),brancoMat,x,hRua(x,z)+.016,z,bairro,false);r.rotation.y=yaw;
    }
  }
  // Tampas e bocas de lobo ajudam a rua a ter escala e leitura de infraestrutura real.
  const tampaGeo=new THREE.CylinderGeometry(.27,.27,.018,16),tampas=new THREE.InstancedMesh(tampaGeo,metalEscuro,6);
  for(let i=0;i<6;i++){
    const u=.12+i*.145,p=curva.getPointAt(u),t=curva.getTangentAt(u),nx=-t.z,nz=t.x,x=p.x+nx*.92,z=p.z+nz*.92;
    const mm=new THREE.Matrix4().makeTranslation(x,hRua(x,z)+.014,z);tampas.setMatrixAt(i,mm);
  }
  tampas.instanceMatrix.needsUpdate=true;bairro.add(tampas);
  const grelhaGeo=new THREE.BoxGeometry(.54,.025,.22),grelhas=new THREE.InstancedMesh(grelhaGeo,metalEscuro,12);
  let k=0;const m42=new THREE.Matrix4(),q2=new THREE.Quaternion(),sc2=new THREE.Vector3(1,1,1),pos2=new THREE.Vector3(),ey2=new THREE.Vector3(0,1,0);
  for(let i=0;i<6;i++)for(const lado of[-1,1]){
    const u=.10+i*.15,p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),nx=-t.z,nz=t.x;
    const x=p.x+nx*lado*(largura/2-.28),z=p.z+nz*lado*(largura/2-.28);q2.setFromAxisAngle(ey2,Math.atan2(t.x,t.z));
    pos2.set(x,hRua(x,z)+.018,z);m42.compose(pos2,q2,sc2);grelhas.setMatrixAt(k++,m42);
  }
  grelhas.instanceMatrix.needsUpdate=true;bairro.add(grelhas);
}

infraestruturaVia(avenidaNobre,6.4,true);
infraestruturaVia(topoCJ,5.4,false);

// ===== POSTES DE REDE, FIOS E ILUMINACAO =====
const postes=[];
function montarRede(curva){
  const total=curva.getLength(),n=Math.max(8,Math.floor(total/10));
  const geoPoste=new THREE.CylinderGeometry(.105,.145,6.5,8),posteInst=new THREE.InstancedMesh(geoPoste,concreto,n);
  const geoBraco=new THREE.BoxGeometry(1.15,.10,.10),bracoInst=new THREE.InstancedMesh(geoBraco,metalEscuro,n);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),sc=new THREE.Vector3(1,1,1),ey=new THREE.Vector3(0,1,0);
  for(let i=0;i<n;i++){
    const u=.04+i*.92/(n-1),p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),nx=-t.z,nz=t.x;
    const x=p.x+nx*(6.4/2+1.62),z=p.z+nz*(6.4/2+1.62),y=obterElevacao(x,z),yaw=Math.atan2(t.x,t.z);
    pos.set(x,y+3.25,z);q.identity();m4.compose(pos,q,sc);posteInst.setMatrixAt(i,m4);
    pos.set(x,y+6.16,z);q.setFromAxisAngle(ey,yaw);m4.compose(pos,q,sc);bracoInst.setMatrixAt(i,m4);
    postes.push({x,z,y:y+6.22,nx,nz});
  }
  posteInst.instanceMatrix.needsUpdate=true;bracoInst.instanceMatrix.needsUpdate=true;posteInst.castShadow=true;posteInst.receiveShadow=true;bairro.add(posteInst);bairro.add(bracoInst);
}
montarRede(avenidaNobre);

// Quatro cabos por vao; cada cabo recebe cinco segmentos e uma barriga pequena de gravidade.
const fios=[];
function seg(a,b){fios.push(a.x,a.y,a.z,b.x,b.y,b.z)}
for(let i=0;i<postes.length-1;i++){
  const a=postes[i],b=postes[i+1];
  for(const desloc of[-.34,0,.34]){
    let prev=null;
    for(let s=0;s<=5;s++){
      const t=s/5,x=THREE.MathUtils.lerp(a.x+a.nx*desloc,b.x+b.nx*desloc,t),z=THREE.MathUtils.lerp(a.z+a.nz*desloc,b.z+b.nz*desloc,t);
      const y=THREE.MathUtils.lerp(a.y,b.y,t)-Math.sin(Math.PI*t)*.23,cur={x,y,z};if(prev)seg(prev,cur);prev=cur;
    }
  }
  let prev=null;
  for(let s=0;s<=5;s++){
    const t=s/5,x=THREE.MathUtils.lerp(a.x+a.nx*.12,b.x+b.nx*.12,t),z=THREE.MathUtils.lerp(a.z+a.nz*.12,b.z+b.nz*.12,t);
    const y=THREE.MathUtils.lerp(a.y-.85,b.y-.85,t)-Math.sin(Math.PI*t)*.34,cur={x,y,z};if(prev)seg(prev,cur);prev=cur;
  }
}
const geoFio=new THREE.BufferGeometry();geoFio.setAttribute('position',new THREE.Float32BufferAttribute(fios,3));
const linhaFio=new THREE.LineSegments(geoFio,new THREE.LineBasicMaterial({color:0x171a1a,transparent:true,opacity:.88}));linhaFio.frustumCulled=false;bairro.add(linhaFio);

// Luminarias modernas do lado oposto. Instanciadas: poste, pescoco e luminaria sao tres draw calls.
const lampN=9,lampPost=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.07,4.1,7),metalEscuro,lampN);
const lampArm=new THREE.InstancedMesh(new THREE.BoxGeometry(.62,.055,.055),metalEscuro,lampN);
const lampHead=new THREE.InstancedMesh(new THREE.BoxGeometry(.34,.075,.16),emissivo,lampN);
{
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),sc=new THREE.Vector3(1,1,1),ey=new THREE.Vector3(0,1,0);
  for(let i=0;i<lampN;i++){
    const u=.06+i*.88/(lampN-1),p=avenidaNobre.getPointAt(u),t=avenidaNobre.getTangentAt(u).normalize(),nx=-t.z,nz=t.x;
    const x=p.x-nx*(6.4/2+1.50),z=p.z-nz*(6.4/2+1.50),y=obterElevacao(x,z),yaw=Math.atan2(t.x,t.z);
    pos.set(x,y+2.05,z);q.identity();m4.compose(pos,q,sc);lampPost.setMatrixAt(i,m4);
    q.setFromAxisAngle(ey,yaw);pos.set(x,y+4.02,z);m4.compose(pos,q,sc);lampArm.setMatrixAt(i,m4);
    pos.set(x+t.x*.27,y+3.98,z+t.z*.27);m4.compose(pos,q,sc);lampHead.setMatrixAt(i,m4);
    if(i===1||i===4||i===7){const l=new THREE.PointLight(0xffcf7a,.32,9,2);l.position.set(x,y+3.8,z);l.castShadow=false;bairro.add(l)}
  }
  lampPost.instanceMatrix.needsUpdate=true;lampArm.instanceMatrix.needsUpdate=true;lampHead.instanceMatrix.needsUpdate=true;
}bairro.add(lampPost,lampArm,lampHead);

// ===== ARBORIZACAO URBANA =====
const arvN=18,trunkGeo=new THREE.CylinderGeometry(.09,.13,1.65,7),copaGeo=new THREE.DodecahedronGeometry(.63,1);
const troncos=new THREE.InstancedMesh(trunkGeo,matMadeira(0x5b4631),arvN),copas=new THREE.InstancedMesh(copaGeo,folha,arvN);
const corCopa=new THREE.Color(),m4a=new THREE.Matrix4(),qa=new THREE.Quaternion(),posa=new THREE.Vector3(),sca=new THREE.Vector3();
for(let i=0;i<arvN;i++){
  const u=.08+i*.84/(arvN-1),p=avenidaNobre.getPointAt(u),t=avenidaNobre.getTangentAt(u).normalize(),nx=-t.z,nz=t.x,lado=i%2?1:-1;
  const x=p.x+nx*lado*(6.4/2+2.45),z=p.z+nz*lado*(6.4/2+2.45),y=obterElevacao(x,z),s=.8+(i%4)*.08;
  posa.set(x,y+.825*s,z);sca.set(s,s,s);m4a.compose(posa,qa,sca);troncos.setMatrixAt(i,m4a);
  posa.set(x,y+2.02*s,z);sca.set(s*.92,s*1.05,s*.92);m4a.compose(posa,qa,sca);copas.setMatrixAt(i,m4a);
  corCopa.setHex(i%3===0?0x6f824b:i%3===1?0x46683e:0x597948);copas.setColorAt(i,corCopa);
}
troncos.instanceMatrix.needsUpdate=true;copas.instanceMatrix.needsUpdate=true;if(copas.instanceColor)copas.instanceColor.needsUpdate=true;
troncos.castShadow=true;copas.castShadow=true;bairro.add(troncos,copas);

// ===== CASAS DE ALTO PADRAO =====
const coresCasa=[0xeee9df,0xe4e1d8,0xd9ddd6,0xe8dfd1,0xd8d2c5,0xf0ede5];
const coresAcento=[0x725847,0x59666b,0x846d59,0x4e5e55,0x8a725b];
function cotaPlana(cx,cz,giro,w,d){
  let max=-99,min=99;
  for(const x of[-w/2,0,w/2])for(const z of[-d/2,0,d/2]){const p=mundoLocal(cx,cz,giro,x,z),h=obterElevacao(p.x,p.z);max=Math.max(max,h);min=Math.min(min,h)}
  return{cota:max+.08,min};
}
function caixaRotacionada(cx,cz,giro,w,d,y0,y1,categoria){
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const x of[-w/2,w/2])for(const z of[-d/2,d/2]){const p=mundoLocal(cx,cz,giro,x,z);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)}
  registrarCaixa(new THREE.Box3(new THREE.Vector3(minX,y0,minZ),new THREE.Vector3(maxX,y1,maxZ)),categoria);
}
function pecaLocal(g,geo,mat,x,y,z,sombra=true){if(mat?.map)uvPorMetro(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=sombra;m.receiveShadow=true;g.add(m);return m}
function janelaLocal(g,x,y,z,w,h){
  const j=pecaLocal(g,new THREE.BoxGeometry(w,h,.045),vidro,x,y,z,false);j.renderOrder=2;
  for(const sx of[-w/2,w/2])pecaLocal(g,new THREE.BoxGeometry(.045,h+.08,.06),metalEscuro,x+sx,y,z+.012,false);
  for(const sy of[-h/2,h/2])pecaLocal(g,new THREE.BoxGeometry(w+.08,.045,.06),metalEscuro,x,y+sy,z+.012,false);
}
function endereco(curva,u,lado,dist=9.5){
  const p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),nx=-t.z*lado,nz=t.x*lado,cx=p.x+nx*dist,cz=p.z+nz*dist;
  return{cx,cz,giro:Math.atan2(-nx,-nz),p,t,nx,nz};
}

// ===== PLANEJAMENTO GEOMETRICO: RUA PRIMEIRO, LOTE DEPOIS =====
const VIAS_PLANEJADAS=[
  {nome:'avenida',curva:avenidaNobre,reserva:5.0},
  {nome:'acesso-cj',curva:topoCJ,reserva:4.4},
];
const lotesPlanejados=[{cx:31.3,cz:71.7,giro:0,w:12,d:10,nome:'CJ'}];
function distanciaPontoRetangulo(px,pz,r){
  const dx=px-r.cx,dz=pz-r.cz,c=Math.cos(r.giro),sn=Math.sin(r.giro);
  const lx=dx*c-dz*sn,lz=dx*sn+dz*c,qx=Math.abs(lx)-r.w/2,qz=Math.abs(lz)-r.d/2;
  if(qx<=0&&qz<=0)return Math.max(qx,qz);
  return Math.hypot(Math.max(0,qx),Math.max(0,qz));
}
function projecaoLote(r,ex,ez){
  const c=Math.cos(r.giro),sn=Math.sin(r.giro);
  return Math.abs(c*ex-sn*ez)*r.w/2+Math.abs(sn*ex+c*ez)*r.d/2;
}
function lotesSeTocam(a,b,folga=.8){
  const dx=b.cx-a.cx,dz=b.cz-a.cz;
  for(const r of[a,b]){
    const c=Math.cos(r.giro),sn=Math.sin(r.giro),eixos=[[c,-sn],[sn,c]];
    for(const[ex,ez]of eixos)
      if(Math.abs(dx*ex+dz*ez)>projecaoLote(a,ex,ez)+projecaoLote(b,ex,ez)+folga)return false;
  }
  return true;
}
function corredorLivre(lote){
  for(const via of VIAS_PLANEJADAS){
    const n=Math.max(20,Math.ceil(via.curva.getLength()/.35));
    for(let i=0;i<=n;i++){
      const p=via.curva.getPointAt(i/n);
      if(distanciaPontoRetangulo(p.x,p.z,lote)<via.reserva)return false;
    }
  }
  return true;
}
function reservarLote(lote){
  if(!corredorLivre(lote)){console.warn('[bairro-nobre] lote rejeitado por invadir via:',lote.nome);return false}
  for(const outro of lotesPlanejados)if(lotesSeTocam(lote,outro,.8)){
    console.warn('[bairro-nobre] lote rejeitado por sobreposicao:',lote.nome,'x',outro.nome);return false;
  }
  lotesPlanejados.push(lote);return true;
}
function criarCasaLuxo(curva,u,lado,idx,dist){
  const e=endereco(curva,u,lado,dist),w=5.7+(idx%3)*.3,d=4.7+(idx%2)*.35,dois=idx%4!==1;
  const loteW=w+1.5,loteD=d+1.9;
  if(!reservarLote({cx:e.cx,cz:e.cz,giro:e.giro,w:loteW,d:loteD,nome:`casa-${idx}`}))return false;
  const{cota,min}=cotaPlana(e.cx,e.cz,e.giro,loteW,loteD),g=new THREE.Group();
  g.position.set(e.cx,cota,e.cz);g.rotation.y=e.giro;g.name=`casa-nobre-${idx}`;bairro.add(g);
  const baseH=Math.max(.24,cota-min+.12),parede=matReboco(coresCasa[idx%coresCasa.length]),acento=matReboco(coresAcento[idx%coresAcento.length]);
  pecaLocal(g,new THREE.BoxGeometry(loteW,baseH,loteD),concreto,0,-baseH/2,0,false);
  pecaLocal(g,new THREE.BoxGeometry(loteW-.45,.055,loteD-.35),grama,0,.03,-.18,false);
  // Entrada e garagem em concreto lavado.
  pecaLocal(g,new THREE.BoxGeometry(3.0,.075,2.75),calcadaMat,-1.35,.07,loteD/2-1.32,false);
  const h1=2.55,h2=dois?2.35:0,altura=h1+h2;
  pecaLocal(g,new THREE.BoxGeometry(w,h1,d),parede,0,h1/2,-.30);
  if(dois)pecaLocal(g,new THREE.BoxGeometry(w*.72,h2,d*.82),parede,.55,h1+h2/2,-.52);
  // Volume vertical em pedra/reboco escuro quebra a fachada branca.
  pecaLocal(g,new THREE.BoxGeometry(1.18,altura+.14,.12),acento,w/2-.86,(altura+.14)/2,d/2+.065);
  // Porta social, portao de garagem e puxador.
  pecaLocal(g,new THREE.BoxGeometry(.82,1.95,.075),matMadeira(0x604632),w/2-1.05,.98,d/2+.065);
  pecaLocal(g,new THREE.BoxGeometry(2.38,1.72,.07),metalEscuro,-1.35,.86,d/2+.068);
  for(let r=-.7;r<=.7;r+=.28)pecaLocal(g,new THREE.BoxGeometry(2.22,.035,.025),new THREE.MeshStandardMaterial({color:0x4f5557,roughness:.58,metalness:.55}),-1.35,.86+r,d/2+.108,false);
  janelaLocal(g,w/2-2.55,1.48,d/2+.07,1.25,.92);
  if(dois){
    janelaLocal(g,.85,h1+1.22,d*.41+.01,1.75,.95);
    const sac=pecaLocal(g,new THREE.BoxGeometry(2.45,.10,.82),concreto,.72,h1+.05,d/2+.34);sac.castShadow=true;
    const guarda=pecaLocal(g,new THREE.BoxGeometry(2.30,.58,.035),vidro,.72,h1+.40,d/2+.76,false);guarda.renderOrder=2;
  }
  // Laje com platibanda, paineis solares em parte das casas.
  const roofY=altura+.08;pecaLocal(g,new THREE.BoxGeometry(w+.24,.16,d+.24),concreto,0,roofY,-.30);
  for(const x of[-w/2,w/2])pecaLocal(g,new THREE.BoxGeometry(.12,.38,d+.30),parede,x,roofY+.20,-.30);
  for(const z of[-d/2-.30,d/2])pecaLocal(g,new THREE.BoxGeometry(w+.20,.38,.12),parede,0,roofY+.20,z);
  if(idx%3===0)for(const sx of[-.72,.72]){
    const painel=pecaLocal(g,new THREE.BoxGeometry(1.15,.045,.68),new THREE.MeshStandardMaterial({color:0x18252a,roughness:.16,metalness:.55}),sx,roofY+.34,-.55,false);painel.rotation.x=-.12;
  }
  // Muro baixo, portao social e caixa de correio.
  const frente=loteD/2;
  pecaLocal(g,new THREE.BoxGeometry((loteW-3.35)/2,.82,.12),parede,-(loteW+3.35)/4,.41,frente);
  pecaLocal(g,new THREE.BoxGeometry((loteW-3.35)/2,.82,.12),parede,(loteW+3.35)/4,.41,frente);
  pecaLocal(g,new THREE.BoxGeometry(3.15,.78,.055),metalEscuro,0,.39,frente+.025,false);
  pecaLocal(g,new THREE.BoxGeometry(.28,.38,.20),metalEscuro,loteW/2-.36,.68,frente+.02,false);
  // Paisagismo frontal em volumes pequenos.
  for(const sx of[-loteW/2+.52,loteW/2-.55])for(let j=0;j<2;j++){
    const arb=pecaLocal(g,new THREE.DodecahedronGeometry(.24+(j*.04),0),j?folha2:folha,sx+j*.18,.28+j*.10,frente-.58-j*.25,false);arb.scale.y=1.45;
  }
  // Piscina no fundo em algumas casas, visivel das lajes e do morro.
  if(idx%5===2){
    pecaLocal(g,new THREE.BoxGeometry(2.65,.09,1.32),concreto,-1.0,.055,-loteD/2+.73,false);
    const a=pecaLocal(g,new THREE.BoxGeometry(2.38,.035,1.08),aguaDecor,-1.0,.11,-loteD/2+.73,false);a.renderOrder=2;
  }
  // Luz de fachada sem criar PointLight em toda residencia.
  pecaLocal(g,new THREE.BoxGeometry(.12,.22,.07),emissivo,w/2-1.64,1.92,d/2+.10,false);
  caixaRotacionada(e.cx,e.cz,e.giro,w,d,cota-.35,cota+altura+.48,'casa-bairro-nobre');
  return true;
}

const SITES_CASA=[
  [.55,-1,9.3],[.40,1,9.3],[.14,1,9.3],[.65,-1,9.3],
  [.33,1,12.9],[.40,1,17.1],[.26,-1,14.7],[.59,-1,17.7],
  [.47,1,18.3],[.66,-1,17.7],[.68,-1,17.7],[.33,1,20.7],
  [.23,-1,22.5],[.40,1,24.9]
];
let casaId=0;
for(let idx=0;idx<SITES_CASA.length;idx++){
  const[u,lado,dist]=SITES_CASA[idx];
  if(criarCasaLuxo(avenidaNobre,u,lado,idx,dist))casaId++;
}

// Dois predios baixos na chegada da favela fazem a transicao de densidade: bairro nobre residencial
// em cima, edificacao mais urbana embaixo, antes de entrar no tecido apertado da favela.
function criarPredio(u,lado,id,dist){
  const e=endereco(avenidaNobre,u,lado,dist),w=7.4,d=6.0;
  if(!reservarLote({cx:e.cx,cz:e.cz,giro:e.giro,w:8.5,d:7.0,nome:`predio-${id}`}))return false;
  const{cota,min}=cotaPlana(e.cx,e.cz,e.giro,8.5,7.0),g=new THREE.Group();
  g.position.set(e.cx,cota,e.cz);g.rotation.y=e.giro;bairro.add(g);
  const fund=Math.max(.3,cota-min+.15),parede=matReboco(id?0xd9d7cf:0xe8e4da),h=7.35;
  pecaLocal(g,new THREE.BoxGeometry(8.5,fund,7),concreto,0,-fund/2,0,false);
  pecaLocal(g,new THREE.BoxGeometry(w,h,d),parede,0,h/2,-.15);
  pecaLocal(g,new THREE.BoxGeometry(w+.25,.18,d+.25),concreto,0,h+.09,-.15);
  pecaLocal(g,new THREE.BoxGeometry(2.55,2.15,.07),metalEscuro,-1.55,1.08,d/2+.035);
  pecaLocal(g,new THREE.BoxGeometry(1.0,2.15,.07),vidro,1.30,1.08,d/2+.04,false);
  for(let andar=0;andar<2;andar++)for(const x of[-2.25,-.7,.85,2.4])janelaLocal(g,x,3.30+andar*2.18,d/2+.045,1.05,.82);
  pecaLocal(g,new THREE.BoxGeometry(w+.9,.08,1.08),concreto,0,3.00,d/2+.46);
  pecaLocal(g,new THREE.BoxGeometry(w+.65,.48,.035),vidro,0,3.28,d/2+.98,false);
  caixaRotacionada(e.cx,e.cz,e.giro,w,d,cota-.4,cota+h+.3,'predio-bairro-nobre');
}
criarPredio(.96,-1,0,18.0);criarPredio(.96,1,1,10.5);

// ===== PRACA CENTRAL =====
function criarPraca(){
  const e=endereco(avenidaNobre,.48275862068965514,1,10.5),W=8.6,D=6.6;
  if(!reservarLote({cx:e.cx,cz:e.cz,giro:e.giro,w:W,d:D,nome:'praca'}))return;
  const{cota,min}=cotaPlana(e.cx,e.cz,e.giro,W,D),g=new THREE.Group();g.position.set(e.cx,cota,e.cz);g.rotation.y=e.giro;bairro.add(g);
  const fund=Math.max(.18,cota-min+.08);pecaLocal(g,new THREE.BoxGeometry(W,fund,D),calcadaMat,0,-fund/2,0,false);superficiesAndaveis.push(g.children[0]);
  // Fonte baixa central.
  pecaLocal(g,new THREE.CylinderGeometry(1.08,1.18,.28,24),pedra,0,.14,0,false);
  const a=pecaLocal(g,new THREE.CylinderGeometry(.93,.93,.035,24),aguaDecor,0,.30,0,false);a.renderOrder=2;
  pecaLocal(g,new THREE.CylinderGeometry(.12,.15,.72,12),pedra,0,.52,0,false);
  const l=new THREE.PointLight(0xffd08a,.24,7,2);l.position.set(0,2.2,0);l.castShadow=false;g.add(l);
  // Bancos e lixeiras.
  for(const[bx,bz,r]of[[-2.3,-1.6,.2],[2.3,1.6,Math.PI+.2],[-2.3,1.7,-.2],[2.3,-1.7,Math.PI-.2]]){
    const banco=new THREE.Group();banco.position.set(bx,.25,bz);banco.rotation.y=r;g.add(banco);
    pecaLocal(banco,new THREE.BoxGeometry(1.45,.12,.42),matMadeira(0x805c3d),0,.22,0,false);
    for(const sx of[-.55,.55])pecaLocal(banco,new THREE.BoxGeometry(.09,.42,.09),metalEscuro,sx,0,0,false);
  }
  for(const bx of[-3.35,3.35])pecaLocal(g,new THREE.CylinderGeometry(.18,.20,.55,10),metalEscuro,bx,.28,-2.45,false);
  // Uma arvore de copa maior identifica a praca de longe.
  pecaLocal(g,new THREE.CylinderGeometry(.16,.22,2.4,8),matMadeira(0x5d4934),-3.05,1.2,.25);
  const copa=pecaLocal(g,new THREE.DodecahedronGeometry(1.05,1),folha2,-3.05,2.75,.25);copa.scale.set(1,1.12,1);
  caixaRotacionada(e.cx,e.cz,e.giro,2.4,2.4,cota,cota+.75,'fonte-praca-nobre');
}
criarPraca();

// ===== PLACAS, HIDRANTES E MOBILIARIO =====
function placaTexto(txt,x,z,giro,yBase){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#1f4a3b';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#d5c28a';ctx.lineWidth=8;ctx.strokeRect(5,5,502,118);
  ctx.fillStyle='#f5f0df';ctx.font='bold 44px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,256,64);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});
  const g=new THREE.Group();g.position.set(x,yBase,z);g.rotation.y=giro;bairro.add(g);
  const p=pecaLocal(g,new THREE.BoxGeometry(3.4,.86,.055),mat,0,2.12,0,false);p.renderOrder=1;
  for(const sx of[-1.35,1.35])pecaLocal(g,new THREE.CylinderGeometry(.045,.055,1.85,7),metalEscuro,sx,.93,0,false);
}
{
  const p=avenidaNobre.getPointAt(.94),t=avenidaNobre.getTangentAt(.94),yaw=Math.atan2(t.x,t.z);placaTexto('JARDINS DO MORRO',p.x-5.0,p.z+1.1,yaw,obterElevacao(p.x-5,p.z+1.1));
}
const hidranteMat=new THREE.MeshStandardMaterial({color:0xb62f26,roughness:.65,metalness:.25});
for(const u of[.18,.40,.64,.82]){
  const p=avenidaNobre.getPointAt(u),t=avenidaNobre.getTangentAt(u),nx=-t.z,nz=t.x,x=p.x-nx*4.65,z=p.z-nz*4.65,y=obterElevacao(x,z);
  mesh(new THREE.CylinderGeometry(.11,.14,.48,10),hidranteMat,x,y+.24,z,bairro,false);mesh(new THREE.SphereGeometry(.13,8,5),hidranteMat,x,y+.51,z,bairro,false);
}

console.info('[bairro-nobre] %s | casas=%d predios=2 lotes-validados=%d postes=%d arvores=%d | corredor viario protegido',BAIRRO_NOBRE.nome,casaId,lotesPlanejados.length,postes.length,arvN);
