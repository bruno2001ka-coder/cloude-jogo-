// ===== MUNDO RURAL =====
// Expansao focada no loop principal do jogo: cultivar -> colher -> vender -> expandir.
// As areas rurais sao irregulares, ligadas por estradas curvas e carregadas por distancia.
// Nada aqui usa grade de quarteirao: cada roca nasce de um poligono organico proprio.
import*as THREE from'three';
import{scene}from'./core.js';
import{alturaDoChaoDesenhado}from'./Terrain.js';
import{matTerraArada,matTerraBatida,matMadeira,matReboco,matTelha,bmat}from'./Materials.js';
import{registrarObstaculo}from'./Physics.js';

export const RURAL_ZONES=[
  {id:'boa-vista',nome:'Sítio Boa Vista',sigla:'BV',x:-145,z:76,raio:28},
  {id:'vale-cedro',nome:'Vale do Cedro',sigla:'VC',x:118,z:104,raio:32},
  {id:'ribeirao',nome:'Roça do Ribeirão',sigla:'RR',x:154,z:-86,raio:30},
];

const mundo=new THREE.Group();mundo.name='mundo-rural';scene.add(mundo);
const grupos=[];

function terrenoY(x,z,extra=.025){return alturaDoChaoDesenhado(x,z)+extra}

function faixaCurva(pontos,largura,material){
  const curva=new THREE.CatmullRomCurve3(pontos.map(p=>new THREE.Vector3(p[0],0,p[1])),false,'centripetal',.35);
  const comp=curva.getLength(),n=Math.max(12,Math.ceil(comp/2));
  const pos=[],uv=[],idx=[];
  for(let i=0;i<=n;i++){
    const u=i/n,p=curva.getPointAt(u),t=curva.getTangentAt(Math.min(.999,u)).normalize();
    const nx=-t.z,nz=t.x;
    for(const lado of[-1,1]){
      const x=p.x+nx*largura*.5*lado,z=p.z+nz*largura*.5*lado;
      pos.push(x,terrenoY(x,z,.018),z);uv.push((i/n)*comp/4,lado<0?0:1);
    }
    if(i<n){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,c,b,b,c,d)}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv.slice(),2));
  g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.receiveShadow=true;m.castShadow=false;return{malha:m,curva};
}

function poligonoRoca(cx,cz,r,seed,material){
  const pts=[];const n=11;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2;
    const wobble=.78+(((seed*17+i*31)%23)/23)*.34;
    pts.push({x:cx+Math.cos(a)*r*wobble,z:cz+Math.sin(a)*r*(.70+.12*Math.sin(seed+i*1.7))});
  }
  const centroY=pts.reduce((s,p)=>s+terrenoY(p.x,p.z,.03),0)/pts.length;
  const pos=[cx,centroY,cz],uv=[.5,.5],idx=[];
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const p of pts){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)}
  for(const p of pts){pos.push(p.x,terrenoY(p.x,p.z,.03),p.z);uv.push((p.x-minX)/(maxX-minX),(p.z-minZ)/(maxZ-minZ))}
  for(let i=0;i<n;i++)idx.push(0,1+i,1+((i+1)%n));
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv.slice(),2));
  g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.receiveShadow=true;m.castShadow=false;
  return{malha:m,pts};
}

function prismaTelhado(larg,comp,altura,mat){
  const w=larg/2,d=comp/2,h=altura;
  const v=[-w,0,-d,w,0,-d,0,h,-d,-w,0,d,w,0,d,0,h,d];
  const idx=[0,1,2,3,5,4,0,3,4,0,4,1,2,1,4,2,4,5,0,2,5,0,5,3];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m;
}

function criarGalpao(parent,x,z,giro,corParede,corTelha){
  const g=new THREE.Group();g.position.set(x,terrenoY(x,z),z);g.rotation.y=giro;parent.add(g);
  const parede=matReboco(corParede),madeira=matMadeira(0x65442f),telhado=matTelha(corTelha);
  const corpo=new THREE.Mesh(new THREE.BoxGeometry(5.4,2.5,4.2),parede);corpo.position.y=1.25;corpo.castShadow=true;corpo.receiveShadow=true;g.add(corpo);g.updateWorldMatrix(true,true);registrarObstaculo(corpo,'galpao-rural');
  const porta=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.15,.10),madeira);porta.position.set(0,1.08,-2.15);porta.castShadow=true;g.add(porta);
  const roof=prismaTelhado(6.2,4.9,1.15,telhado);roof.position.y=2.5;g.add(roof);
  const janela=new THREE.Mesh(new THREE.BoxGeometry(1.1,.8,.08),bmat(0x24343a));janela.position.set(1.8,1.45,-2.17);g.add(janela);
}

function cercar(parent,pts,aberturaIndex=0){
  const mat=matMadeira(0x6d5237),postGeo=new THREE.CylinderGeometry(.07,.09,1.15,6),railGeo=new THREE.BoxGeometry(1,0.07,.07);
  const postes=[],rails=[];
  for(let i=0;i<pts.length;i++){
    if(i===aberturaIndex||i===(aberturaIndex+1)%pts.length)continue;
    const a=pts[i],b=pts[(i+1)%pts.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),steps=Math.max(1,Math.floor(len/3));
    for(let s=0;s<=steps;s++){const t=s/steps,x=a.x+dx*t,z=a.z+dz*t;postes.push({x,z,y:terrenoY(x,z)+.57})}
    for(let s=0;s<steps;s++){
      const t0=s/steps,t1=(s+1)/steps,x0=a.x+dx*t0,z0=a.z+dz*t0,x1=a.x+dx*t1,z1=a.z+dz*t1;
      rails.push({x:(x0+x1)/2,z:(z0+z1)/2,y:terrenoY((x0+x1)/2,(z0+z1)/2)+.72,len:Math.hypot(x1-x0,z1-z0),ang:Math.atan2(x1-x0,z1-z0)});
    }
  }
  const pmesh=new THREE.InstancedMesh(postGeo,mat,postes.length);const dummy=new THREE.Object3D();
  postes.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();pmesh.setMatrixAt(i,dummy.matrix)});
  pmesh.castShadow=true;pmesh.receiveShadow=true;parent.add(pmesh);
  const rmesh=new THREE.InstancedMesh(railGeo,mat,rails.length*2);let k=0;
  for(const r of rails)for(const yoff of[0,.42]){
    dummy.position.set(r.x,r.y+yoff,r.z);dummy.rotation.set(0,r.ang,0);dummy.scale.set(r.len,1,1);dummy.updateMatrix();rmesh.setMatrixAt(k++,dummy.matrix);
  }
  rmesh.castShadow=true;rmesh.receiveShadow=true;parent.add(rmesh);
}

function arvore(parent,x,z,escala=1){
  const g=new THREE.Group();g.position.set(x,terrenoY(x,z),z);parent.add(g);
  const tronco=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1.8*escala,7),matMadeira(0x5c432d));tronco.position.y=.9*escala;tronco.castShadow=true;g.add(tronco);
  const copa=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05*escala,1),bmat(0x4e7441));copa.position.y=2.1*escala;copa.scale.set(1,.82,1);copa.castShadow=true;copa.receiveShadow=true;g.add(copa);
}

function montarZona(zona,i){
  const grupo=new THREE.Group();grupo.name='rural-'+zona.id;mundo.add(grupo);
  const arada=poligonoRoca(zona.x,zona.z,zona.raio,i+3,matTerraArada());grupo.add(arada.malha);
  cercar(grupo,arada.pts,(i*3+2)%arada.pts.length);
  const entrada={x:arada.pts[(i*3+2)%arada.pts.length].x,z:arada.pts[(i*3+2)%arada.pts.length].z};
  const caminho=faixaCurva([
    [entrada.x,entrada.z],
    [entrada.x+(i%2?12:-10),entrada.z+10],
    [zona.x+(i-1)*8,zona.z+zona.raio+18],
    [zona.x+(i-1)*18,zona.z+zona.raio+34]
  ],3.2,matTerraBatida());
  grupo.add(caminho.malha);
  criarGalpao(grupo,zona.x-zona.raio*.45,zona.z-zona.raio*.28,.35+i*.55,[0xd7cfb8,0xc9d0bf,0xd5c2aa][i],[0x775d4e,0x6f6a5d,0x8a5c45][i]);
  // Vegetacao fica nas bordas, nunca no meio do terreno de plantio.
  for(let a=0;a<10;a++){
    const ang=a/10*Math.PI*2+.3*i,rr=zona.raio*(1.08+(a%3)*.07);
    arvore(grupo,zona.x+Math.cos(ang)*rr,zona.z+Math.sin(ang)*rr*(.76+.06*i),.78+(a%4)*.09);
  }
  grupos.push({grupo,zona});
}
RURAL_ZONES.forEach(montarZona);

// 175 m fica alem do que a neblina permite ver com clareza. Fora disso a area inteira deixa de
// renderizar; logica de cultivo continua independente, porque plantas sao entidades do Economy.js.
export function atualizarMundoRural(x,z){
  for(const r of grupos){
    const dx=x-r.zona.x,dz=z-r.zona.z;
    r.grupo.visible=dx*dx+dz*dz<175*175;
  }
}
