// Remove o visual de caixas dos animais da fazenda sem tocar na IA/movimento deles.
import*as THREE from'three';
import{animais}from'./WorldGenerator.js';
import'./AnimalPens.js';
import'./FishPond.js';

const mats=new Map();
function mat(c,rough=.86){const k=`${c}-${rough}`;if(!mats.has(k))mats.set(k,new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:0}));return mats.get(k)}
function add(g,geo,m,x,y,z,sx=1,sy=1,sz=1){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}
const GEO={
  esfera:new THREE.SphereGeometry(1,10,7),
  esfera8:new THREE.SphereGeometry(1,8,6),
  perna:new THREE.CylinderGeometry(.06,.055,1,7),
  pernaFina:new THREE.CylinderGeometry(.035,.03,1,6),
  cone:new THREE.ConeGeometry(1,1,7),
  cauda:new THREE.CylinderGeometry(.025,.018,1,6),
};

function vaca(g){
  const branco=mat(0xe9e4d8),escuro=mat(0x3b3028),casco=mat(0x26221f),chifre=mat(0xd8c99f),nariz=mat(0x7f6b61);
  add(g,GEO.esfera,branco,0,.53,0,.52,.34,.78);
  add(g,GEO.esfera8,escuro,0,.61,.66,.28,.25,.32);
  add(g,GEO.esfera8,nariz,0,.53,.91,.20,.13,.16);
  for(const x of[-.19,.19]){
    const o=add(g,GEO.esfera8,escuro,x,.72,.64,.15,.07,.12);o.rotation.z=x<0?-.35:.35;
    const h=add(g,GEO.cone,chifre,x*.72,.85,.62,.055,.16,.055);h.rotation.z=x<0?.22:-.22;
  }
  for(const x of[-.25,.25])for(const z of[-.34,.34]){
    add(g,GEO.perna,escuro,x,.24,z,1,.45,1);
    add(g,GEO.esfera8,casco,x,.035,z,.08,.045,.11);
  }
  const t=add(g,GEO.cauda,escuro,0,.55,-.79,1,.55,1);t.rotation.x=-.35;
}
function porco(g){
  const pele=mat(0xc9827c),focinho=mat(0xa8635e),casco=mat(0x5e403b);
  add(g,GEO.esfera,pele,0,.38,0,.38,.27,.55);
  add(g,GEO.esfera8,pele,0,.46,.43,.25,.22,.24);
  add(g,GEO.esfera8,focinho,0,.43,.64,.17,.12,.10);
  for(const x of[-.14,.14]){
    const o=add(g,GEO.cone,pele,x,.66,.40,.09,.16,.06);o.rotation.z=x<0?-.25:.25;
  }
  for(const x of[-.20,.20])for(const z of[-.28,.28]){
    add(g,GEO.pernaFina,casco,x,.15,z,1,.26,1);
  }
  const cauda=add(g,new THREE.TorusGeometry(.08,.018,5,8,Math.PI*1.55),pele,.34,.45,-.43,.75,.75,.75);cauda.rotation.y=Math.PI/2;
}
function galinha(g){
  const pena=mat(0xe4dece),bico=mat(0xd98a3f),crista=mat(0xb03c30),perna=mat(0xc38a4b),olho=mat(0x1f1a18);
  add(g,GEO.esfera8,pena,0,.29,0,.18,.23,.27);
  add(g,GEO.esfera8,pena,0,.48,.17,.13,.14,.14);
  const bk=add(g,GEO.cone,bico,0,.46,.34,.05,.10,.05);bk.rotation.x=Math.PI/2;
  for(const x of[-.045,.045])add(g,GEO.esfera8,olho,x,.51,.285,.018,.018,.018);
  for(const x of[-.06,.06])add(g,GEO.pernaFina,perna,x,.105,-.02,.65,.19,.65);
  for(const x of[-.055,0,.055]){const c=add(g,GEO.esfera8,crista,x,.62,.14,.045,.075,.035);c.rotation.z=x*4;}
  const cauda=add(g,GEO.cone,pena,0,.37,-.27,.12,.28,.08);cauda.rotation.x=-.75;
}

for(const a of animais){
  const g=a.grupo;
  const p=g.children[0]?.geometry?.parameters||{};
  const tipo=g.userData.tipoAnimal||((p.width??0)>.75?'vaca':(p.width??0)>.4?'porco':'galinha');
  g.clear();g.userData.tipoAnimal=tipo;
  if(tipo==='vaca')vaca(g);else if(tipo==='porco')porco(g);else galinha(g);
}
