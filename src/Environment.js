// Céu, pano de fundo pintado, nuvens, iluminação e HDRI de ambiente — tudo que "segue a câmera" como um skybox.
import*as THREE from'three';
import{RGBELoader}from'three/addons/loaders/RGBELoader.js';
import{scene,camera,renderer}from'./core.js';
import{predioMat}from'./Skyline.js';
import{janela,janelaAcesa}from'./Materials.js';

const HORIZONTE_COLOR=0xcfe3ea;
scene.fog=new THREE.FogExp2(HORIZONTE_COLOR,.013);

// Mapa de ambiente real (HDRI, CC0/Poly Haven) só pra reflexo/iluminação indireta dos materiais — o céu visível
// continua sendo o domo pintado do jogo (scene.background), não a HDRI (scene.environment fica separado).
const pmremGen=new THREE.PMREMGenerator(renderer);pmremGen.compileEquirectangularShader();
new RGBELoader().load('assets/ceu.hdr',hdri=>{const envMap=pmremGen.fromEquirectangular(hdri).texture;scene.environment=envMap;hdri.dispose();pmremGen.dispose()});

// Céu em gradiente (topo→horizonte→base), sempre centrado na câmera: substitui o fundo sólido por uma atmosfera real sem precisar de HDRI externo.
const ceuUniforms={corTopo:{value:new THREE.Color(0x3f7fc9)},corHorizonte:{value:new THREE.Color(HORIZONTE_COLOR)},corBase:{value:new THREE.Color(0xe4d3ab)}};
const ceuMat=new THREE.ShaderMaterial({uniforms:ceuUniforms,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 corTopo;uniform vec3 corHorizonte;uniform vec3 corBase;varying vec3 vPos;void main(){float h=normalize(vPos).y;float t=smoothstep(-0.05,0.55,h);vec3 cor=mix(corHorizonte,corTopo,t);float b=smoothstep(0.0,-0.3,h);cor=mix(cor,corBase,b);gl_FragColor=vec4(cor,1.0);}'});
const ceu=new THREE.Mesh(new THREE.SphereGeometry(230,24,16),ceuMat);ceu.renderOrder=-1;scene.add(ceu);

// Pano de fundo pintado (montanhas + baía + skyline distante), tipo cenário de morro carioca — segue a câmera
// como o céu (mesmo truque de skybox), pra parecer sempre "no horizonte" não importa onde o jogador ande.
function criarTexturaHorizonte(){
  const w=2048,h=512,cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,w,h);
  const grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'rgba(207,227,234,0)');grad.addColorStop(.32,'rgba(207,227,234,.85)');grad.addColorStop(1,'rgba(176,202,213,1)');
  ctx.fillStyle=grad;ctx.fillRect(0,h*.14,w,h*.86);
  function montanhas(baseY,amp,cor,seg){ctx.fillStyle=cor;ctx.beginPath();ctx.moveTo(0,h);let y=baseY;for(let i=0;i<=seg;i++){const x=(w/seg)*i;y=baseY-Math.abs(Math.sin(i*.6+i*.13))*amp-Math.random()*amp*.4;ctx.lineTo(x,y)}ctx.lineTo(w,h);ctx.closePath();ctx.fill()}
  montanhas(h*.4,h*.24,'#93aeb4',22);
  montanhas(h*.5,h*.17,'#71917d',18);
  ctx.fillStyle='#82abc4';ctx.fillRect(0,h*.57,w,h*.09);
  ctx.fillStyle='rgba(150,160,165,.5)';for(let x=0;x<w;x+=16){if(Math.random()<.55){const alt=8+Math.random()*30;ctx.fillRect(x,h*.62-alt,11,alt)}}
  const tex=new THREE.CanvasTexture(cv);tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.ClampToEdgeWrapping;tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
const horizonteMat=new THREE.MeshBasicMaterial({map:criarTexturaHorizonte(),transparent:true,side:THREE.BackSide,depthWrite:false,fog:false});
const horizonte=new THREE.Mesh(new THREE.CylinderGeometry(215,215,320,32,1,true),horizonteMat);horizonte.renderOrder=-1;scene.add(horizonte);

// Nuvens estilizadas (sprites com gradiente radial pintado), espalhadas ao redor do mapa.
function criarTexturaNuvem(){
  const s=256,cv=document.createElement('canvas');cv.width=cv.height=s;const ctx=cv.getContext('2d');
  for(let i=0;i<7;i++){const cx=s*.5+(Math.random()*.5-.25)*s,cy=s*.55+(Math.random()*.3-.15)*s,r=s*(.18+Math.random()*.14);const g2=ctx.createRadialGradient(cx,cy,0,cx,cy,r);g2.addColorStop(0,'rgba(255,255,255,.95)');g2.addColorStop(.7,'rgba(255,255,255,.5)');g2.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g2;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill()}
  return new THREE.CanvasTexture(cv);
}
const nuvemMat=new THREE.SpriteMaterial({map:criarTexturaNuvem(),transparent:true,depthWrite:false,fog:false,opacity:.85});
const nuvens=[];
for(let i=0;i<8;i++){const s=new THREE.Sprite(nuvemMat);const ang=Math.random()*Math.PI*2,raio=75+Math.random()*95;s.position.set(Math.cos(ang)*raio,55+Math.random()*30,Math.sin(ang)*raio);const esc=16+Math.random()*13;s.scale.set(esc,esc*.5,1);scene.add(s);nuvens.push(s)}

// Ambiente um pouco MAIS BAIXO que antes (0,75 -> 0,62): com a HDRI já preenchendo a sombra, o
// hemisférico alto lavava o contraste e as paredes texturadas ficavam chapadas. Menos ambiente é o
// que deixa o relevo do reboco e do tijolo aparecer.
const hemi=new THREE.HemisphereLight(0x9ec9e8,0x6b4a34,0.62);scene.add(hemi);
// SOL. A sombra SEGUE O JOGADOR (ver atualizarAmbiente): antes o mapa de 2048 cobria 164x192 m do
// bairro inteiro, uns 12 texels por metro — sombra de poste virava borrão. Acompanhando o jogador
// num raio de 34 m, o mesmo mapa rende 30 texels por metro, 2,5x mais definição, sem custar um pixel
// a mais de memória. O que sai do raio simplesmente não projeta sombra, e a essa distância ninguém vê.
const SOMBRA_RAIO=34;
// Deslocamento fixo do sol em relação ao alvo: mantém a MESMA direção de luz do bairro todo (é o que
// faz as sombras ficarem paralelas), só reposiciona a caixa de projeção.
const SOL_OFFSET=new THREE.Vector3(-35,60,25);
const sun=new THREE.DirectionalLight(0xffe6bd,2.5);sun.position.copy(SOL_OFFSET);sun.castShadow=true;
sun.shadow.mapSize.width=2048;sun.shadow.mapSize.height=2048;
sun.shadow.camera.left=-SOMBRA_RAIO;sun.shadow.camera.right=SOMBRA_RAIO;
sun.shadow.camera.top=SOMBRA_RAIO;sun.shadow.camera.bottom=-SOMBRA_RAIO;
sun.shadow.camera.near=1;sun.shadow.camera.far=200;sun.shadow.camera.updateProjectionMatrix();
// bias contra acne + normalBias, que é o que resolve o serrilhado agora que as paredes têm normal map:
// o normal perturbado desloca a amostra da sombra, e sem esta folga aparece listra na parede lisa.
sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;sun.shadow.radius=3;
scene.add(sun);scene.add(sun.target);
const fillLight=new THREE.DirectionalLight(0x8fb4e0,0.4);fillLight.position.set(40,25,-30);scene.add(fillLight);
// Lua: segunda luz direcional fixa, sem sombra (evita dobrar o custo de shadow map). Faz cross-fade
// com o sol — mais simples e mais barato que arquear o sol pra "debaixo do chão" à noite.
const lua=new THREE.DirectionalLight(0xaac4ff,0);lua.position.set(38,45,-50);scene.add(lua);

// ===== CICLO DE DIA E NOITE =====
// ?ciclo=N na URL acelera o ciclo pra N segundos, útil pra testar sem esperar os 8 minutos padrão.
const CICLO_DURACAO_S=+new URLSearchParams(location.search).get('ciclo')||480;
let fase=.32;// 0=meia-noite · .25=nascer · .5=meio-dia · .75=pôr — começa de manhã, ninguém abre o jogo no escuro

// Paletas em 4 pontos-chave (meia-noite/nascer/meio-dia/pôr). O meio-dia reaproveita as cores
// originais do jogo, então a aparência em fase=.5 é idêntica à versão sem ciclo.
const CT=[new THREE.Color(0x0a1330),new THREE.Color(0x6f8fc4),new THREE.Color(0x3f7fc9),new THREE.Color(0x5a5f9c)];// corTopo
const CH=[new THREE.Color(0x121c33),new THREE.Color(0xe8b98a),new THREE.Color(HORIZONTE_COLOR),new THREE.Color(0xe89a6b)];// corHorizonte
const CB=[new THREE.Color(0x08101f),new THREE.Color(0xf0c98e),new THREE.Color(0xe4d3ab),new THREE.Color(0xc97a4e)];// corBase
const HEMI_CEU_DIA=new THREE.Color(0x9ec9e8),HEMI_CEU_NOITE=new THREE.Color(0x22314f);
const HEMI_CHAO_DIA=new THREE.Color(0x6b4a34),HEMI_CHAO_NOITE=new THREE.Color(0x141824);
const HORIZ_TINTA_DIA=new THREE.Color(0xffffff),HORIZ_TINTA_NOITE=new THREE.Color(0x1e2f52);
const NUVEM_COR_DIA=new THREE.Color(0xffffff),NUVEM_COR_NOITE=new THREE.Color(0x8fa0c0);
const PREDIO_TINTA_DIA=new THREE.Color(0xffffff),PREDIO_TINTA_NOITE=new THREE.Color(0x2a3550);
const _corTmp=new THREE.Color();
// Blend cíclico entre as 4 cores-chave conforme a fase do dia (0..1).
function corFase(f,cores){const p=f*4,i=Math.floor(p)%4,t=p-Math.floor(p);return _corTmp.copy(cores[i]).lerp(cores[(i+1)%4],t)}

// Estrelas: nasce como filho do domo do céu, então acompanha a câmera de graça (mesmo truque do
// domo/horizonte/nuvens) sem precisar de posição própria por frame.
function criarEstrelas(n,raio){
  const pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){const u=Math.random(),v=Math.random(),th=u*Math.PI*2,ph=Math.acos(v)*.85;// hemisfério de cima, só acima do horizonte pintado
    pos[i*3]=raio*Math.sin(ph)*Math.cos(th);pos[i*3+1]=raio*Math.cos(ph);pos[i*3+2]=raio*Math.sin(ph)*Math.sin(th)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));return geo;
}
const estrelasMat=new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,transparent:true,depthWrite:false,depthTest:false,fog:false,opacity:0});
const estrelas=new THREE.Points(criarEstrelas(260,222),estrelasMat);ceu.add(estrelas);

// Avança o relógio e modula tudo que reage à hora do dia: sol/lua, céu, névoa, nuvens, prédios, janelas.
function atualizarCicloDia(dt){
  fase=(fase+dt/CICLO_DURACAO_S)%1;
  const theta=(fase-.25)*Math.PI*2,altura=Math.sin(theta),arco=Math.cos(theta);
  const quanNoite=1-THREE.MathUtils.smoothstep(altura,-.2,.15);

  sun.position.set(-35*arco,Math.max(altura,0)*62+8,25*arco);
  sun.intensity=Math.pow(Math.max(altura,0),.6)*2.35;
  sun.castShadow=altura>0;
  lua.intensity=quanNoite*.4;

  ceuUniforms.corTopo.value.copy(corFase(fase,CT));
  ceuUniforms.corHorizonte.value.copy(corFase(fase,CH));
  ceuUniforms.corBase.value.copy(corFase(fase,CB));
  scene.fog.color.copy(ceuUniforms.corHorizonte.value);

  hemi.color.copy(HEMI_CEU_DIA).lerp(HEMI_CEU_NOITE,quanNoite);
  hemi.groundColor.copy(HEMI_CHAO_DIA).lerp(HEMI_CHAO_NOITE,quanNoite);
  hemi.intensity=THREE.MathUtils.lerp(.62,.26,quanNoite);

  horizonteMat.color.copy(HORIZ_TINTA_DIA).lerp(HORIZ_TINTA_NOITE,quanNoite);
  nuvemMat.color.copy(NUVEM_COR_DIA).lerp(NUVEM_COR_NOITE,quanNoite);
  nuvemMat.opacity=THREE.MathUtils.lerp(.85,.22,quanNoite);
  estrelasMat.opacity=quanNoite*.9;

  renderer.toneMappingExposure=THREE.MathUtils.lerp(1.05,.85,quanNoite);
  janelaAcesa.emissiveIntensity=THREE.MathUtils.lerp(.25,.95,quanNoite);
  janela.emissiveIntensity=THREE.MathUtils.lerp(.06,.16,quanNoite);
  predioMat.color.copy(PREDIO_TINTA_DIA).lerp(PREDIO_TINTA_NOITE,quanNoite*.75);
}
export function obterBandaFase(){return fase<.22||fase>.78?'noite':fase<.30?'nascer':fase<.68?'dia':'por'}

// Chamado a cada frame: avança o ciclo dia/noite, mantém céu/pano de fundo centrados na câmera e as nuvens derivando devagar.
// `alvo` é a posição do jogador: a caixa de sombra viaja com ele (ver SOMBRA_RAIO).
const _alvoSol=new THREE.Vector3();
export function atualizarAmbiente(dt,alvo){
  if(alvo){
    // Trava o alvo na grade de um texel. Sem isso a caixa de sombra desliza continuamente com o
    // jogador e a borda de toda sombra ferve (shadow swimming) enquanto ele anda.
    const passo=SOMBRA_RAIO*2/2048;
    _alvoSol.set(Math.round(alvo.x/passo)*passo,0,Math.round(alvo.z/passo)*passo);
    sun.target.position.copy(_alvoSol);
    sun.position.copy(_alvoSol).add(SOL_OFFSET);
    sun.target.updateMatrixWorld();
  }
  atualizarCicloDia(dt);
  ceu.position.copy(camera.position);
  horizonte.position.set(camera.position.x,22,camera.position.z);
  for(const nv of nuvens){nv.position.x+=dt*.6;nv.position.z+=dt*.25;if(nv.position.x>200)nv.position.x-=400;if(nv.position.z>200)nv.position.z-=400}
}
