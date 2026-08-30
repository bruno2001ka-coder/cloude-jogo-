// Céu, pano de fundo pintado, nuvens, iluminação e HDRI de ambiente — tudo que "segue a câmera" como um skybox.
import*as THREE from'three';
import{RGBELoader}from'three/addons/loaders/RGBELoader.js';
import{scene,camera,renderer}from'./core.js';

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

scene.add(new THREE.HemisphereLight(0x9ec9e8,0x6b4a34,0.75));
const sun=new THREE.DirectionalLight(0xffe6bd,2.35);sun.position.set(-35,60,25);sun.castShadow=true;sun.shadow.mapSize.width=2048;sun.shadow.mapSize.height=2048;sun.shadow.camera.left=-82;sun.shadow.camera.right=82;sun.shadow.camera.top=96;sun.shadow.camera.bottom=-96;sun.shadow.camera.near=1;sun.shadow.camera.far=180;sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0004;sun.shadow.radius=3;scene.add(sun);
const fillLight=new THREE.DirectionalLight(0x8fb4e0,0.4);fillLight.position.set(40,25,-30);scene.add(fillLight);

// Chamado a cada frame: mantém céu/pano de fundo centrados na câmera e as nuvens derivando devagar.
export function atualizarAmbiente(dt){
  ceu.position.copy(camera.position);
  horizonte.position.set(camera.position.x,22,camera.position.z);
  for(const nv of nuvens){nv.position.x+=dt*.6;nv.position.z+=dt*.25;if(nv.position.x>200)nv.position.x-=400;if(nv.position.z>200)nv.position.z-=400}
}
