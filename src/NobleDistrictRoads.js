// ===== JARDINS DO MORRO — FASE 1: MALHA URBANA =====
// Sem casas. Primeiro validamos ruas, calcadas e corredores livres.
import*as THREE from'three';
import{scene}from'./core.js';
import{superficiesAndaveis}from'./Physics.js';
import{matAsfalto,matMeioFio}from'./Materials.js';
import{
  vias,avenidaNobre,VIA_PRINCIPAL_LARGURA,ALAMEDA_LARGURA,CALCADA_LARGURA,
  FAIXA_TECNICA,alturaPerfil
}from'./NobleDistrictPlan.js';

const grupo=new THREE.Group();grupo.name='bairro-nobre-fase1-vias';scene.add(grupo);
const asfalto=matAsfalto(),meiofio=matMeioFio();
const calcada=new THREE.MeshStandardMaterial({color:0xb8b5ad,roughness:.96,metalness:0});
const faixa=new THREE.MeshStandardMaterial({color:0xe7dfb8,roughness:.78,metalness:0});

function fita(via,largura,material,{offset=0,altura=.012,andavel=false,nome='fita'}={}){
  const curva=via.curva,total=curva.getLength();
  const linhas=Math.max(8,Math.ceil(total/.8)),cols=Math.max(2,Math.ceil(largura/.55));
  const pos=[],uv=[],cor=[],idx=[];
  for(let i=0;i<=linhas;i++){
    const u=i/linhas,p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize(),nx=-t.z,nz=t.x;
    const centroY=alturaPerfil(via,u)+altura;
    for(let j=0;j<=cols;j++){
      const k=j/cols,l=offset-largura/2+largura*k;
      const x=p.x+nx*l,z=p.z+nz*l;
      // A pista segue o PERFIL da via, nao cada caroço lateral do terreno.
      pos.push(x,centroY,z);uv.push(k*largura/2,u*total/2);cor.push(1,1,1);
    }
  }
  const row=cols+1;
  for(let i=0;i<linhas;i++)for(let j=0;j<cols;j++){
    const a=i*row+j,b=a+1,c=a+row+1,d=a+row;
    // Enrolamento corrigido para normal +Y.
    idx.push(a,b,d,b,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('uv1',g.attributes.uv.clone());
  g.setAttribute('color',new THREE.Float32BufferAttribute(cor,3));
  g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.name=nome;m.receiveShadow=true;m.castShadow=false;grupo.add(m);
  if(andavel)superficiesAndaveis.push(m);return m;
}

function construirVia(via){
  const L=via.largura;
  fita(via,L,asfalto,{altura:.035,andavel:true,nome:`asfalto-${via.nome}`});
  const off=L/2+CALCADA_LARGURA/2+.18;
  for(const lado of[-1,1]){
    fita(via,CALCADA_LARGURA,calcada,{offset:lado*off,altura:.085,andavel:true,nome:`calcada-${via.nome}`});
    fita(via,.18,meiofio,{offset:lado*(L/2+.09),altura:.075,nome:`meiofio-${via.nome}`});
  }
}
for(const v of vias)construirVia(v);

// Marcacao central apenas na avenida principal.
{
  const via=vias[0],curva=avenidaNobre,total=curva.getLength(),n=Math.floor(total/5);
  const geo=new THREE.BoxGeometry(.11,.018,1.7),inst=new THREE.InstancedMesh(geo,faixa,n);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),sc=new THREE.Vector3(1,1,1),ey=new THREE.Vector3(0,1,0);
  for(let i=0;i<n;i++){
    const u=(i+.5)/n,p=curva.getPointAt(u),t=curva.getTangentAt(u).normalize();
    pos.set(p.x,alturaPerfil(via,u)+.055,p.z);q.setFromAxisAngle(ey,Math.atan2(t.x,t.z));m4.compose(pos,q,sc);inst.setMatrixAt(i,m4);
  }
  inst.instanceMatrix.needsUpdate=true;grupo.add(inst);
}

console.info('[bairro-nobre-fase1] vias=%d | avenida=%.1fm | alamedas=%.1fm | calcada=%.1fm | faixa tecnica=%.2fm',vias.length,VIA_PRINCIPAL_LARGURA,ALAMEDA_LARGURA,CALCADA_LARGURA,FAIXA_TECNICA);
