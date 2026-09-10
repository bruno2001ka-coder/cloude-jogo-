// ===== INFRAESTRUTURA — JARDINS DO MORRO =====
// Postes/fios seguem a rede viaria. Arvores publicas consultam os lotes e nunca atravessam casas.
import*as THREE from'three';
import{scene}from'./core.js';
import{obterElevacao}from'./Terrain.js';
import{vias,CALCADA_LARGURA}from'./NobleDistrictPlan.js';
import{lotesNobres}from'./NobleDistrictHouses.js';

const grupo=new THREE.Group();grupo.name='bairro-nobre-infraestrutura';scene.add(grupo);
const posteMat=new THREE.MeshStandardMaterial({color:0x777873,roughness:.96});
const metalMat=new THREE.MeshStandardMaterial({color:0x303436,roughness:.72,metalness:.48});
const luzMat=new THREE.MeshStandardMaterial({color:0xffe5a6,emissive:0xffc45a,emissiveIntensity:.65,roughness:.45});
const troncoMat=new THREE.MeshStandardMaterial({color:0x6b4b32,roughness:1});
const folhaMat=new THREE.MeshStandardMaterial({color:0x486d43,roughness:1,flatShading:true});
const placaMat=new THREE.MeshStandardMaterial({color:0x244c41,roughness:.7,metalness:.12});

const geoPoste=new THREE.CylinderGeometry(.09,.12,5.8,7),geoBraco=new THREE.BoxGeometry(.055,.055,1.05),geoLuz=new THREE.BoxGeometry(.34,.09,.18),geoTronco=new THREE.CylinderGeometry(.08,.12,1.45,7),geoCopa=new THREE.DodecahedronGeometry(.58,1),geoPlaca=new THREE.BoxGeometry(.85,.34,.045);
const postes=[],arvores=[],bracos=[],lampadas=[],placas=[];
const topoPorVia=[];
const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),P=new THREE.Vector3(),EY=new THREE.Vector3(0,1,0);
function matriz(x,y,z,giro,sx=1,sy=1,sz=1){Q.setFromAxisAngle(EY,giro);S.set(sx,sy,sz);P.set(x,y,z);return M.clone().compose(P,Q,S)}
function pertoDeLote(x,z,margem=1.15){
 for(const l of lotesNobres){
  const dx=x-l.cx,dz=z-l.cz,c=Math.cos(l.giro),s=Math.sin(l.giro);
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  if(Math.abs(lx)<l.w/2+margem&&Math.abs(lz)<l.d/2+margem)return true;
 }
 return false;
}

for(let vi=0;vi<vias.length;vi++){
 const v=vias[vi],total=v.curva.getLength(),n=Math.max(2,Math.floor(total/(vi===0?12:10))),tops=[];
 for(let i=0;i<=n;i++){
  const u=i/n,p=v.curva.getPointAt(u),t=v.curva.getTangentAt(u).normalize(),lado=(i%2?1:-1),off=v.largura/2+.78;
  const x=p.x-t.z*lado*off,z=p.z+t.x*lado*off,y=obterElevacao(x,z),giro=Math.atan2(t.x,t.z);
  postes.push(matriz(x,y+2.9,z,0));tops.push({x,y:y+5.55,z});
  const bx=x+t.z*lado*.48,bz=z-t.x*lado*.48;
  bracos.push(matriz(bx,y+5.22,bz,giro+Math.PI/2));
  lampadas.push(matriz(x+t.z*lado*.94,y+5.18,z-t.x*lado*.94,giro));
  // Arborizacao fica na faixa de calcada/servico e so nasce se houver folga real dos lotes.
  if(i<n){
   const u2=(i+.5)/n,a=v.curva.getPointAt(u2),ta=v.curva.getTangentAt(u2).normalize(),al=-lado;
   const ao=v.largura/2+Math.max(.55,CALCADA_LARGURA*.72),ax=a.x-ta.z*al*ao,az=a.z+ta.x*al*ao;
   if(!pertoDeLote(ax,az,1.25)){const ay=obterElevacao(ax,az);arvores.push({tronco:matriz(ax,ay+.72,az,0),copa:matriz(ax,ay+1.65,az,0,.85,1,.85)})}
  }
 }
 topoPorVia.push(tops);
 if(vi>0){const p=v.curva.getPointAt(.08),t=v.curva.getTangentAt(.08).normalize(),x=p.x-t.z*(v.largura/2+.75),z=p.z+t.x*(v.largura/2+.75),y=obterElevacao(x,z),g=Math.atan2(t.x,t.z);placas.push(matriz(x,y+1.55,z,g))}
}
function inst(nome,geo,mat,lista,sombra=false){if(!lista.length)return;const im=new THREE.InstancedMesh(geo,mat,lista.length);im.name=nome;for(let i=0;i<lista.length;i++)im.setMatrixAt(i,lista[i]);im.instanceMatrix.needsUpdate=true;im.castShadow=sombra;im.receiveShadow=true;im.frustumCulled=false;grupo.add(im)}
inst('postes-nobre',geoPoste,posteMat,postes,true);inst('bracos-luz-nobre',geoBraco,metalMat,bracos);inst('lampadas-nobre',geoLuz,luzMat,lampadas);inst('placas-rua-nobre',geoPlaca,placaMat,placas);
inst('troncos-nobre',geoTronco,troncoMat,arvores.map(a=>a.tronco));inst('copas-nobre',geoCopa,folhaMat,arvores.map(a=>a.copa),true);

const verts=[];
function cabo(a,b,deslocY=0,deslocX=0){let prev={x:a.x+deslocX,y:a.y+deslocY,z:a.z};for(let k=1;k<=4;k++){const f=k/4,q={x:a.x+(b.x-a.x)*f+deslocX,z:a.z+(b.z-a.z)*f,y:a.y+(b.y-a.y)*f+deslocY-Math.sin(Math.PI*f)*.38};verts.push(prev.x,prev.y,prev.z,q.x,q.y,q.z);prev=q}}
for(const tops of topoPorVia)for(let i=1;i<tops.length;i++){cabo(tops[i-1],tops[i],0,0);cabo(tops[i-1],tops[i],-.20,.07);cabo(tops[i-1],tops[i],-.39,-.06)}
const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));const fios=new THREE.LineSegments(wg,new THREE.LineBasicMaterial({color:0x17191a}));fios.name='rede-eletrica-nobre';grupo.add(fios);

console.info('[bairro-nobre-infra] postes=%d arvores=%d lotes-protegidos=%d cabos=%d',postes.length,arvores.length,lotesNobres.length,verts.length/6);