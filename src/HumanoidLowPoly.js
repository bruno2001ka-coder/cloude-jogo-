// Humanoide low-poly compartilhado pelos moradores e clientes.
// Mantem a altura crua em ~1,75 unidade para continuar compativel com PLAYER_HEIGHT/1.75.
// As geometrias sao compartilhadas: muitos NPCs usam os mesmos buffers e materiais cacheados.
import*as THREE from'three';

const GEO={
  torso:new THREE.CylinderGeometry(.20,.17,.66,8),
  pescoco:new THREE.CylinderGeometry(.07,.075,.11,8),
  cabeca:new THREE.SphereGeometry(.195,10,8),
  cabelo:new THREE.SphereGeometry(.205,10,6,0,Math.PI*2,0,Math.PI/2),
  braco:new THREE.CylinderGeometry(.061,.052,.50,7),
  mao:new THREE.SphereGeometry(.066,8,6),
  perna:new THREE.CylinderGeometry(.073,.061,.53,7),
  pe:new THREE.SphereGeometry(.09,8,6),
  olho:new THREE.SphereGeometry(.022,7,5),
  nariz:new THREE.ConeGeometry(.026,.055,6),
  boca:new THREE.SphereGeometry(.032,7,5),
  pelvis:new THREE.CylinderGeometry(.18,.16,.16,8),
};
const cacheMat=new Map();
function mat(cor,roughness=.78){
  const k=`${cor}-${roughness}`;
  if(!cacheMat.has(k))cacheMat.set(k,new THREE.MeshStandardMaterial({color:cor,roughness,metalness:0}));
  return cacheMat.get(k);
}
function adicionar(geo,material,parent,x,y,z,sombras=true){
  const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=sombras;m.receiveShadow=true;parent.add(m);return m;
}

export function criarHumanoLowPoly({parent,roupa=0x556677,pele=0xc79067,calca=0x34363b,cabelo=0x171712,sapato=0x242424,sombras=true,largura=1}){
  const g=new THREE.Group();parent?.add(g);
  const roupaMat=mat(roupa,.82),peleMat=mat(pele,.62),calcaMat=mat(calca,.88),cabeloMat=mat(cabelo,.92),sapatoMat=mat(sapato,.9),rostoMat=mat(0x201916,.72);
  const meshes=[];
  const add=(geo,material,p,x,y,z)=>{const m=adicionar(geo,material,p,x,y,z,sombras);meshes.push(m);return m};

  // Quadril e tronco afunilados: acabam com a silhueta de caixa sem aumentar muito os triangulos.
  const pelvis=add(GEO.pelvis,calcaMat,g,0,.69,0);pelvis.scale.x=largura;
  const torso=add(GEO.torso,roupaMat,g,0,1.06,0);torso.scale.x=largura*1.08;torso.scale.z=.92;
  add(GEO.pescoco,peleMat,g,0,1.425,0);

  // Cabeca oval + cabelo em meia esfera, sem cubos.
  const head=add(GEO.cabeca,peleMat,g,0,1.585,0);head.scale.set(.96,1.08,.94);
  const hair=add(GEO.cabelo,cabeloMat,g,0,1.625,0);hair.scale.set(1.02,.92,1.02);
  for(const x of[-.067,.067])add(GEO.olho,rostoMat,g,x,1.615,.181,false);
  const nariz=add(GEO.nariz,peleMat,g,0,1.565,.196,false);nariz.rotation.x=Math.PI/2;
  const mouth=add(GEO.boca,rostoMat,g,0,1.505,.19,false);mouth.scale.set(1.25,.28,.3);

  // Bracos e pernas giram pelo ombro/quadril, em vez de pelo centro da peca.
  const bracos=[];
  for(const lado of[-1,1]){
    const piv=new THREE.Group();piv.position.set(lado*.285*largura,1.315,0);g.add(piv);
    add(GEO.braco,peleMat,piv,0,-.25,0);
    add(GEO.mao,peleMat,piv,0,-.53,.005);
    bracos.push(piv);
  }
  const pernas=[];
  for(const lado of[-1,1]){
    const piv=new THREE.Group();piv.position.set(lado*.105,.64,0);g.add(piv);
    add(GEO.perna,calcaMat,piv,0,-.265,0);
    const pe=add(GEO.pe,sapatoMat,piv,0,-.555,.045);pe.scale.set(.88,.55,1.35);
    pernas.push(piv);
  }

  return{grupo:g,pernas,bracos,meshes,torso,head};
}
