// ===== CIDADE RURAL / FAZENDAS =====
// Protótipo isolado em branch: cidade rural brasileira esparsa, estradas de terra orgânicas,
// propriedades grandes e vegetação de borda. Sem malha de quarteirão e sem árvores em cubos.
import*as THREE from'three';
import{scene}from'./core.js';
import{alturaDoChaoDesenhado}from'./Terrain.js';
import{player}from'./Player.js';
import{matTerraArada,matTerraBatida,matMadeira,matReboco,matTelha,matConcreto,bmat,uvPorMetro}from'./Materials.js';
import{registrarObstaculo,registrarCaixa,marcarObstaculoMovel}from'./Physics.js';
import{criarArquiteturaRuralPadrao}from'./FarmGenerator.js';

export const RURAL_ZONES=[
  {id:'boa-vista',nome:'Sítio Boa Vista',sigla:'BV',x:-145,z:76,raio:30},
  {id:'vale-cedro',nome:'Fazenda Vale do Cedro',sigla:'VC',x:126,z:112,raio:35},
  {id:'ribeirao',nome:'Roça do Ribeirão',sigla:'RR',x:154,z:-86,raio:32},
];
const VILA={x:82,z:98,raio:46};

const mundo=new THREE.Group();mundo.name='cidade-rural-brasileira';scene.add(mundo);
const grupos=[];
const porteiras=[];
const Y_EXTRA=.025;

function chao(x,z,extra=Y_EXTRA){return alturaDoChaoDesenhado(x,z)+extra}
function pseudo(seed){const x=Math.sin(seed*12.9898+78.233)*43758.5453;return x-Math.floor(x)}
function materialCor(c,rough=.86){return new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:0})}

const matBarro=matTerraBatida();
const matRodado=materialCor(0x684632,.96);
const matGramaBorda=materialCor(0x65764d,.98);
const matFolha=materialCor(0x446b3d,.92);
const matFolha2=materialCor(0x587d47,.9);
const matPasto=materialCor(0x6f7f50,.98);
const matPastoSeco=materialCor(0x8a7d54,.99);
const matCapimEscuro=materialCor(0x4f673d,.98);
const matTronco=matMadeira(0x5d432d);
const matArame=materialCor(0x3c3b37,.65);
const matPorteira=matMadeira(0x765437);
const matTelhaCeramica=matTelha(0x8f4e37);

function curvaXZ(pontos){
  return new THREE.CatmullRomCurve3(
    pontos.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal',.35
  );
}
function faixa(curva,largura,offset,material,yExtra=.02,passo=1.7){
  const comp=curva.getLength(),n=Math.max(12,Math.ceil(comp/passo));
  const pos=[],uv=[],idx=[];
  for(let i=0;i<=n;i++){
    const u=i/n,p=curva.getPointAt(u),t=curva.getTangentAt(Math.min(.999,u)).normalize();
    const nx=-t.z,nz=t.x,cx=p.x+nx*offset,cz=p.z+nz*offset;
    for(const lado of[-1,1]){
      const x=cx+nx*largura*.5*lado,z=cz+nz*largura*.5*lado;
      pos.push(x,chao(x,z,yExtra),z);
      uv.push(i*passo/4,lado<0?0:1);
    }
    // Winding +Y: a superfície é chão. Na versão anterior os triângulos apontavam para BAIXO;\n    // se a câmera raspasse sob a manta, ela enxergava uma placa escura gigante.\n    if(i<n){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,b,d,c)}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv.slice(),2));
  g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.receiveShadow=true;m.castShadow=false;m.frustumCulled=true;
  return m;
}
function estradaDeTerra(parent,nome,pontos,largura=4.8,centroVerde=true){
  const c=curvaXZ(pontos);
  const base=faixa(c,largura,0,matBarro,.018);base.name=nome;parent.add(base);
  // Rodados de pneu: duas faixas mais escuras quebram a aparência de "tapete marrom".
  parent.add(faixa(c,.34,-1.12,matRodado,.034,1.5));
  parent.add(faixa(c,.34, 1.12,matRodado,.034,1.5));
  // Acostamento irregular e estreito de capim acompanhando a estrada.
  parent.add(faixa(c,.52,-largura*.58,matGramaBorda,.027,1.9));
  parent.add(faixa(c,.52, largura*.58,matGramaBorda,.027,1.9));
  if(centroVerde)parent.add(faixa(c,.24,0,matGramaBorda,.035,1.7));
  return c;
}

function poligonoTerreno(cx,cz,rx,rz,seed){
  const pts=[],n=10;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2;
    const r=.83+pseudo(seed*31+i*7)*.22;
    pts.push({x:cx+Math.cos(a)*rx*r,z:cz+Math.sin(a)*rz*(.9+pseudo(seed+i)*.16)});
  }
  return pts;
}
function preencherPoligono(parent,pts,material,yExtra=.025){
  let cx=0,cz=0;for(const p of pts){cx+=p.x;cz+=p.z}cx/=pts.length;cz/=pts.length;
  const pos=[cx,chao(cx,cz,yExtra),cz],uv=[.5,.5],idx=[];
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const p of pts){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)}
  for(const p of pts){pos.push(p.x,chao(p.x,p.z,yExtra),p.z);uv.push((p.x-minX)/(maxX-minX),(p.z-minZ)/(maxZ-minZ))}
  // O polígono é visto de cima: ordem invertida para normal +Y e nunca como teto preto por baixo.\n  for(let i=0;i<pts.length;i++)idx.push(0,1+(i+1)%pts.length,i+1);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv.slice(),2));
  g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.receiveShadow=true;parent.add(m);return m;
}
function caixaColisorSegmento(ax,az,bx,bz,altura=1.25,esp=.11){
  // Physics trabalha com AABB. Uma AABB única em uma cerca DIAGONAL vira um retângulo enorme
  // preenchendo todo o espaço entre as pontas — exatamente a "parede invisível" vista no sítio.
  // Quebrar em trechos curtos aproxima a linha real da cerca sem inventar área sólida no meio.
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),PASSO=.55;
  const n=Math.max(1,Math.ceil(len/PASSO));
  for(let i=0;i<n;i++){
    const t0=i/n,t1=(i+1)/n;
    const x0=ax+dx*t0,z0=az+dz*t0,x1=ax+dx*t1,z1=az+dz*t1;
    const y0=chao(x0,z0,0),y1=chao(x1,z1,0);
    const yMin=Math.min(y0,y1)-.28,yMax=Math.max(y0,y1)+altura;
    registrarCaixa(new THREE.Box3(
      new THREE.Vector3(Math.min(x0,x1)-esp,yMin,Math.min(z0,z1)-esp),
      new THREE.Vector3(Math.max(x0,x1)+esp,yMax,Math.max(z0,z1)+esp)
    ),'cerca-rural');
  }
}
function barraEntre(parent,a,b,material,esp=.035){
  const de=new THREE.Vector3(a.x,a.y,a.z),para=new THREE.Vector3(b.x,b.y,b.z),dir=new THREE.Vector3().subVectors(para,de);
  const comp=dir.length();if(comp<.02)return;
  const m=new THREE.Mesh(new THREE.BoxGeometry(comp,esp,esp),material);
  m.position.addVectors(de,para).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),dir.normalize());
  m.castShadow=false;m.receiveShadow=true;parent.add(m);
}
const GEO_POSTE_CERCA=new THREE.CylinderGeometry(.075,.095,1.32,7);
function trechoCercaArame(parent,a,b){
  const len=Math.hypot(b.x-a.x,b.z-a.z);if(len<.18)return;
  const n=Math.max(1,Math.ceil(len/3.2));
  let prev=null;
  for(let s=0;s<=n;s++){
    const t=s/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=chao(x,z,0);
    const poste=new THREE.Mesh(GEO_POSTE_CERCA,matTronco);
    poste.position.set(x,y+.62,z);poste.castShadow=true;poste.receiveShadow=true;parent.add(poste);
    if(prev)for(const h of[.38,.72,1.02])
      barraEntre(parent,{x:prev.x,y:prev.y+h,z:prev.z},{x,y:y+h,z},matArame,.022);
    prev={x,y,z};
  }
  caixaColisorSegmento(a.x,a.z,b.x,b.z);
}
function cercaArame(parent,pts,gapIndex=-1,larguraPorteira=3.9){
  let vao=null;
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length,a=pts[i],b=pts[j];
    if(i!==gapIndex){trechoCercaArame(parent,a,b);continue}
    // O erro antigo era pular o LADO INTEIRO do polígono e colocar uma porteira de 3,9 m no meio:
    // sobravam vários metros abertos dos dois lados. Agora o único buraco no perímetro mede exatamente
    // a largura da porteira; o restante desse mesmo lado continua cercado e com colisão.
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
    const ux=dx/len,uz=dz/len;
    const largura=Math.min(larguraPorteira,Math.max(2.8,len-.8));
    const cx=(a.x+b.x)/2,cz=(a.z+b.z)/2,meia=largura/2;
    const esquerda={x:cx-ux*meia,z:cz-uz*meia};
    const direita ={x:cx+ux*meia,z:cz+uz*meia};
    trechoCercaArame(parent,a,esquerda);
    trechoCercaArame(parent,direita,b);
    // Rotação Y do Three.js: o eixo X local vira (cos(a), -sin(a)) em X/Z.
    // Por isso o sinal de Z é negativo aqui; o atan2 anterior inclinava algumas porteiras ao contrário.
    vao={x:cx,z:cz,ang:Math.atan2(-uz,ux),largura,esquerda,direita,len};
  }
  return vao;
}

function telhadoDuasAguas(parent,x,y,z,w,d,h,cor=0x9a5437){
  const mat=matTelha(cor),incl=Math.atan2(h,w/2),comp=Math.hypot(w/2,h)+.32;
  for(const lado of[-1,1]){
    const m=new THREE.Mesh(uvPorMetro(new THREE.BoxGeometry(comp,.14,d+.55)),mat);
    m.position.set(x+lado*Math.cos(incl)*comp/2,y+h-Math.sin(incl)*comp/2,z);
    m.rotation.z=-lado*incl;m.castShadow=true;m.receiveShadow=true;parent.add(m);
  }
}
function casaRural(parent,x,z,giro=0,seed=1){
  const g=new THREE.Group();g.position.set(x,chao(x,z,0),z);g.rotation.y=giro;parent.add(g);
  const cores=[0xd8c8a7,0xc8d1bd,0xe3d6be,0xd0c3b4],parede=matReboco(cores[seed%cores.length]);
  const w=5.4+(seed%3)*.45,d=4.1+((seed+1)%3)*.38,h=2.55;
  const corpo=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),parede);corpo.position.y=h/2;corpo.castShadow=true;corpo.receiveShadow=true;g.add(corpo);
  telhadoDuasAguas(g,0,h,0,w,d,1.05,[0x8c4f39,0x975c42,0x7f4938][seed%3]);
  // Varanda com pilares e beiral baixo, muito mais "casa de sítio" que bloco puro.
  const varanda=new THREE.Mesh(new THREE.BoxGeometry(w*.78,.12,1.45),matConcreto());varanda.position.set(0,.08,d/2+.62);varanda.receiveShadow=true;g.add(varanda);
  for(const px of[-w*.31,w*.31]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,2.15,8),matMadeira(0x6f533a));p.position.set(px,1.08,d/2+1.18);p.castShadow=true;g.add(p)}
  const beiral=new THREE.Mesh(new THREE.BoxGeometry(w*.78,.13,1.7),matTelha(0x8f533d));beiral.position.set(0,2.2,d/2+.75);beiral.rotation.x=-.08;beiral.castShadow=true;g.add(beiral);
  const porta=new THREE.Mesh(new THREE.BoxGeometry(.9,1.95,.08),matMadeira(0x70482e));porta.position.set(-.65,1.0,d/2+.045);g.add(porta);
  for(const px of[1.15,-1.75]){const j=new THREE.Mesh(new THREE.BoxGeometry(.9,.82,.07),materialCor(0x78949a,.28));j.position.set(px,1.35,d/2+.05);g.add(j)}
  g.updateWorldMatrix(true,true);registrarObstaculo(corpo,'casa-rural');
  return g;
}
function galpao(parent,x,z,giro=0,seed=1){
  const g=new THREE.Group();g.position.set(x,chao(x,z,0),z);g.rotation.y=giro;parent.add(g);
  const w=6.6,d=4.8,h=2.8,parede=matReboco(seed%2?0xbcae8f:0xc3b497);
  const corpo=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),parede);corpo.position.y=h/2;corpo.castShadow=true;corpo.receiveShadow=true;g.add(corpo);
  telhadoDuasAguas(g,0,h,0,w,d,1.25,seed%2?0x725044:0x71655a);
  const vao=new THREE.Mesh(new THREE.BoxGeometry(2.45,2.35,.10),matMadeira(0x5f4934));vao.position.set(0,1.18,d/2+.055);g.add(vao);
  g.updateWorldMatrix(true,true);registrarObstaculo(corpo,'galpao-rural');
}
function arvore(parent,x,z,s=1,seed=1){
  const g=new THREE.Group();g.position.set(x,chao(x,z,0),z);g.rotation.y=pseudo(seed)*Math.PI*2;parent.add(g);
  const tronco=new THREE.Mesh(new THREE.CylinderGeometry(.11*s,.19*s,2.35*s,8),matTronco);
  tronco.position.y=1.16*s;tronco.rotation.z=(pseudo(seed+44)-.5)*.08;tronco.castShadow=true;g.add(tronco);
  // Copa formada por volumes irregulares, não por uma esfera única. Isso tira o visual de 'pirulito'.
  const lobos=[
    [-.48,2.30,.10,.92,.72,1.05],[.40,2.42,-.05,.84,.68,.92],[.02,2.78,-.12,.90,.74,.96],
    [-.10,2.52,.48,.78,.64,.88],[.25,2.64,.34,.66,.58,.80],[-.34,2.67,-.34,.62,.56,.76]
  ];
  for(let i=0;i<lobos.length;i++){
    const [lx,ly,lz,sc,sy,sz]=lobos[i];
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry(sc*s,1),i%2?matFolha:matFolha2);
    m.position.set(lx*s,ly*s,lz*s);
    m.scale.set(.95+pseudo(seed+i)*.18,sy,sz);
    m.rotation.set(pseudo(seed+i*3)*.35,pseudo(seed+i*5)*Math.PI,pseudo(seed+i*7)*.22);
    m.castShadow=i<3;m.receiveShadow=true;g.add(m);
  }
}
function arbusto(parent,x,z,s=.7,seed=1){
  const g=new THREE.Group();g.position.set(x,chao(x,z,0),z);parent.add(g);
  for(let i=0;i<3;i++){
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry((.34+.10*pseudo(seed+i))*s,1),i%2?matFolha2:matCapimEscuro);
    m.position.set((pseudo(seed+i*4)-.5)*.55*s,.28*s+(i%2)*.08,(pseudo(seed+i*6)-.5)*.5*s);
    m.scale.set(1.15,.65,1);m.rotation.y=pseudo(seed+i*9)*Math.PI;m.receiveShadow=true;g.add(m);
  }
}
function eucalipto(parent,x,z,s=1,seed=1){
  const g=new THREE.Group();g.position.set(x,chao(x,z,0),z);parent.add(g);
  const h=(4.3+pseudo(seed)*1.8)*s;
  const tronco=new THREE.Mesh(new THREE.CylinderGeometry(.07*s,.12*s,h,7),matTronco);
  tronco.position.y=h/2;tronco.castShadow=true;g.add(tronco);
  for(let i=0;i<4;i++){
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry((.62+.1*pseudo(seed+i))*s,1),i%2?matFolha:matFolha2);
    m.position.set((pseudo(seed+i*3)-.5)*.65*s,h*.78+i*.18*s,(pseudo(seed+i*5)-.5)*.5*s);
    m.scale.set(.72,.55,1.08);m.rotation.y=pseudo(seed+i*8)*Math.PI;g.add(m);
  }
}
function bananeiras(parent,x,z,seed=1){
  const g=new THREE.Group();g.position.set(x,chao(x,z,0),z);parent.add(g);
  const folha=new THREE.MeshStandardMaterial({color:0x527e43,roughness:.9,side:THREE.DoubleSide});
  for(let c=0;c<3;c++){
    const ox=(pseudo(seed+c)-.5)*1.1,oz=(pseudo(seed*3+c)-.5)*1.1,h=1.5+.35*pseudo(seed+c*7);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,h,7),materialCor(0x7b8d57,.9));t.position.set(ox,h/2,oz);g.add(t);
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2+pseudo(seed+i)*.25,leaf=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.34,1,1),folha);
      leaf.position.set(ox+Math.cos(a)*.48,h+.08,oz+Math.sin(a)*.48);
      leaf.rotation.set(-.28, -a, .15*Math.sin(a));g.add(leaf);
    }
  }
}
function reservatorioAzul(parent,x,z){
  const y=chao(x,z,0),g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  for(const dx of[-.45,.45])for(const dz of[-.45,.45]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,2.2,6),matMadeira(0x6b5842));p.position.set(dx,1.1,dz);g.add(p)}
  const cx=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.88,16),materialCor(0x376f8d,.48));cx.position.y=2.15;cx.castShadow=true;g.add(cx);
}
function porteiraAutomatica(parent,x,z,ang=0,larg=3.8){
  const y=chao(x,z,0),g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ang;parent.add(g);
  const folha=larg/2+.035;
  const pL=new THREE.Group(),pR=new THREE.Group();pL.position.x=-larg/2;pR.position.x=larg/2;g.add(pL,pR);
  const criarFolha=(pivo,lado)=>{
    for(const h of[.38,.82,1.18]){
      const m=new THREE.Mesh(new THREE.BoxGeometry(folha,.10,.08),matPorteira);
      m.position.set(lado*folha/2,h,0);m.castShadow=true;pivo.add(m);
    }
    for(const px of[.10,Math.max(.14,folha-.10)]){const m=new THREE.Mesh(new THREE.BoxGeometry(.10,1.15,.10),matPorteira);m.position.set(lado*px,.72,0);pivo.add(m)}
  };
  criarFolha(pL,1);criarFolha(pR,-1);
  for(const lx of[-larg/2-.12,larg/2+.12]){const m=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,1.55,8),matTronco);m.position.set(lx,.72,0);m.castShadow=true;g.add(m)}
  const esp=.16,hx=Math.abs(Math.cos(ang))*larg/2+Math.abs(Math.sin(ang))*esp,hz=Math.abs(Math.sin(ang))*larg/2+Math.abs(Math.cos(ang))*esp;
  const fechada=new THREE.Box3(new THREE.Vector3(x-hx,y-.25,z-hz),new THREE.Vector3(x+hx,y+1.5,z+hz));
  const caixa=marcarObstaculoMovel(registrarCaixa(fechada.clone(),'porteira-rural'));
  const p={x,z,pL,pR,angulo:0,alvo:0,caixa,fechada,colisorAtivo:true,aberta:false};
  porteiras.push(p);return p;
}
function atualizarPorteiras(dt){
  for(const p of porteiras){
    const d=Math.hypot(player.position.x-p.x,player.position.z-p.z);
    p.aberta=d<4.6?true:d>7.2?false:p.aberta;
    const alvo=p.aberta?Math.PI*.46:0,delta=alvo-p.angulo,passo=Math.min(Math.abs(delta),.72*dt);
    if(Math.abs(delta)>.0005)p.angulo+=Math.sign(delta)*passo;
    p.pL.rotation.y=-p.angulo;p.pR.rotation.y=p.angulo;
    const livre=p.angulo>Math.PI*.34;
    if(livre&&p.colisorAtivo){p.caixa.makeEmpty();p.colisorAtivo=false}
    else if(!livre&&!p.colisorAtivo){p.caixa.copy(p.fechada);p.colisorAtivo=true}
  }
}

function montarFazenda(zona,i){
  const grupo=new THREE.Group();grupo.name='fazenda-'+zona.id;mundo.add(grupo);
  const pts=poligonoTerreno(zona.x,zona.z,zona.raio,zona.raio*.72,11+i*7);
  // Propriedade rural brasileira: predominância de pasto, com roça menor e irregular dentro.
  // Antes a fazenda inteira era terra marrom e parecia um terreno vazio.
  preencherPoligono(grupo,pts,i%2?matPasto:matPastoSeco,.026);
  const rocas=[
    poligonoTerreno(zona.x-zona.raio*.08,zona.z-zona.raio*.10,zona.raio*.36,zona.raio*.22,101+i*9),
    poligonoTerreno(zona.x+zona.raio*.28,zona.z+zona.raio*.16,zona.raio*.18,zona.raio*.12,171+i*13)
  ];
  preencherPoligono(grupo,rocas[0],matTerraArada(),.04);
  preencherPoligono(grupo,rocas[1],matPastoSeco,.042);
  // Perímetro 100% fechado: a cerca só deixa o vão exato ocupado pela porteira.
  const gap=(i*3+2)%pts.length;
  const vao=cercaArame(grupo,pts,gap,3.9);
  if(vao)porteiraAutomatica(grupo,vao.x,vao.z,vao.ang,vao.largura);
  // TODAS as fazendas usam agora a mesma linguagem arquitetônica das referências:
  // sede colonial contemporânea transitável + galpão/curral de madeira em escala métrica.
  // A fazenda antiga (-86,-50) não é tocada por este gerador.
  criarArquiteturaRuralPadrao({
    parent:grupo,cx:zona.x,cz:zona.z,seed:i+1,nome:zona.nome,
    porte:i===1?'grande':i===2?'compacta':'media'
  });
  reservatorioAzul(grupo,zona.x-zona.raio*.43,zona.z+zona.raio*.12);
  bananeiras(grupo,zona.x+zona.raio*.37,zona.z+zona.raio*.2,30+i);
  // Vegetação de borda irregular: árvore grande + arbusto + alguns eucaliptos.
  for(let k=0;k<18;k++){
    const ang2=k/18*Math.PI*2+.21*i,rr=zona.raio*(.96+pseudo(i*40+k)*.28);
    const x=zona.x+Math.cos(ang2)*rr,z=zona.z+Math.sin(ang2)*rr*.77;
    if(k%4===0)eucalipto(grupo,x,z,.72+pseudo(k+i)*.22,80+i*20+k);
    else arvore(grupo,x,z,.68+pseudo(k+i)*.34,80+i*20+k);
    if(k%3===0)arbusto(grupo,x+1.2,z-.7,.8,500+i*30+k);
  }
  // Pequenos capões no interior quebram o vazio sem bloquear a circulação.
  for(let k=0;k<10;k++){
    const a2=pseudo(300+i*50+k)*Math.PI*2,rr=zona.raio*(.32+.46*pseudo(340+i*20+k));
    arbusto(grupo,zona.x+Math.cos(a2)*rr,zona.z+Math.sin(a2)*rr*.7,.65+pseudo(k)*.35,700+i*20+k);
  }
  grupos.push({grupo,x:zona.x,z:zona.z,raio:185});
}

function montarVila(){
  const g=new THREE.Group();g.name='vila-rural';mundo.add(g);
  // Casas seguem a estrada e têm recuos diferentes; nenhuma grade ortogonal.
  const casas=[
    [56,92,.18,1],[67,104,-.12,2],[79,111,.22,3],[91,106,-.28,4],
    [102,96,.10,5],[93,84,.34,6],[73,82,-.20,7]
  ];
  for(const c of casas)casaRural(g,...c);
  galpao(g,108,111,.18,2);reservatorioAzul(g,105,103);
  bananeiras(g,61,83,61);bananeiras(g,99,113,73);
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2,rr=27+pseudo(i*5)*20;
    const x=VILA.x+Math.cos(a)*rr,z=VILA.z+Math.sin(a)*rr*.72;
    if(i%5===0)eucalipto(g,x,z,.78+pseudo(i)*.22,200+i);else arvore(g,x,z,.68+pseudo(i)*.42,200+i);
    if(i%3===0)arbusto(g,x+1,z+.6,.8,900+i);
  }
  grupos.push({grupo:g,x:VILA.x,z:VILA.z,raio:180});
}

const estradas=new THREE.Group();estradas.name='malha-estradas-rurais';mundo.add(estradas);
// Eixos principais: curvas longas, bifurcações e acessos. Sem ruas paralelas em tabuleiro.
estradaDeTerra(estradas,'Estrada Boa Vista',[[34,72],[13,85],[-18,98],[-58,104],[-101,94],[-145,79]],5.1,true);
estradaDeTerra(estradas,'Estrada do Cedro',[[34,73],[49,84],[67,96],[84,104],[105,110],[126,113]],5.3,true);
estradaDeTerra(estradas,'Estrada do Ribeirão',[[31,68],[50,52],[73,30],[99,2],[126,-37],[154,-72]],4.8,true);
// Acessos de fazenda: mais estreitos, sem capim central.
estradaDeTerra(estradas,'Acesso Boa Vista',[[-118,90],[-130,84],[-145,76]],3.4,false);
estradaDeTerra(estradas,'Acesso Vale do Cedro',[[106,110],[116,115],[126,112]],3.6,false);
estradaDeTerra(estradas,'Acesso Ribeirão',[[132,-47],[143,-65],[154,-86]],3.3,false);

montarVila();
RURAL_ZONES.forEach(montarFazenda);

let ultimo=performance.now()/1000;
export function atualizarMundoRural(x,z){
  const agora=performance.now()/1000,dt=Math.min(.05,Math.max(0,agora-ultimo));ultimo=agora;
  atualizarPorteiras(dt);
  for(const r of grupos){
    const dx=x-r.x,dz=z-r.z;r.grupo.visible=dx*dx+dz*dz<r.raio*r.raio;
  }
}
