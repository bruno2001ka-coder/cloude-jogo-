// Materiais compartilhados do bairro (cache por cor + materiais dedicados) e a sombra de contato falsa.
import*as THREE from'three';
import{renderer}from'./core.js';

// ===== TEXTURAS PBR =====
// Cada conjunto tem cor (albedo), normal e ORM. ORM é um RGB só: Oclusão no R, Roughness no G,
// Metalness no B — o formato do glTF, que o three lê direto. A MESMA imagem serve de aoMap,
// roughnessMap e metalnessMap, então são 3 texturas por material na memória de vídeo e não 5.
//
// Os mapas são gerados proceduralmente (scripts/texturas.py, que está no repositório e reproduz
// assets/tex/ byte a byte): saem tileáveis por construção — o ruído é sorteado no domínio da
// frequência, então a borda fecha sozinha — e cabem em 844 KB no total, que é o que decide se roda
// no celular.
const carregador=new THREE.TextureLoader();
const anisotropia=Math.min(8,renderer.capabilities.getMaxAnisotropy());
function tex(caminho,ehCor){
  const t=carregador.load(caminho);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  // Só o albedo é sRGB. Normal e ORM carregam NÚMEROS (direção e rugosidade), não cor: passar eles
  // pela conversão de gama distorceria o valor e o relevo sairia errado.
  if(ehCor)t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=anisotropia;// nitidez em superfície vista de raspão — o chão é quase todo assim
  return t;
}
const conjuntos={};
function conjunto(nome){
  if(!conjuntos[nome])conjuntos[nome]={
    cor:tex(`assets/tex/${nome}_cor.jpg`,true),
    normal:tex(`assets/tex/${nome}_normal.jpg`,false),
    orm:tex(`assets/tex/${nome}_orm.jpg`,false)};
  return conjuntos[nome];
}
// Monta um MeshStandardMaterial completo em cima de um conjunto. `cor` é TINTA: os mapas de reboco e
// telha são quase neutros de propósito, pra cada casa manter a cor dela e ganhar a textura por cima.
function pbr(nome,cor=0xffffff,extra={}){
  const c=conjunto(nome);
  return new THREE.MeshStandardMaterial({
    color:cor,map:c.cor,normalMap:c.normal,
    roughnessMap:c.orm,metalnessMap:c.orm,aoMap:c.orm,
    roughness:1,metalness:1,// os mapas mandam; estes ficam em 1 pra não atenuar o que vem deles
    aoMapIntensity:.85,
    ...extra});
}

const matCache=new Map();
export const bmat=c=>{if(!matCache.has(c))matCache.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.8,flatShading:true}));return matCache.get(c)};

// ===== FACHADA, TELHADO E CONCRETO =====
// Cacheados por cor: o bairro tem 7 cores de parede e 6 de telhado, então são 13 materiais no total
// pra 96 casas — e material compartilhado é o que mantém o número de draw calls baixo.
const cacheReboco=new Map(),cacheTelha=new Map();
export const matReboco=c=>{if(!cacheReboco.has(c))cacheReboco.set(c,pbr('reboco',c));return cacheReboco.get(c)};
export const matTelha=c=>{if(!cacheTelha.has(c))cacheTelha.set(c,pbr('telha',c));return cacheTelha.get(c)};
export const matConcreto=()=>pbrConcreto;
const pbrConcreto=pbr('reboco',0x9d9a92,{aoMapIntensity:1});
export const matChao=()=>pbrChao;
const pbrChao=pbr('chao',0xffffff);
export const tijolo=pbr('tijolo',0xffffff),telha=matTelha(0x77736b);
// Madeira tingida: a mesma tábua serve de porta, de cerca e de parede de celeiro — o que muda é a
// tinta. Cacheado por cor pela mesma razão das fachadas: a cerca da fazenda são ~120 peças e material
// compartilhado é o que deixa elas caberem em InstancedMesh.
const cacheMadeira=new Map();
export const matMadeira=c=>{if(!cacheMadeira.has(c))cacheMadeira.set(c,pbr('madeira',c));return cacheMadeira.get(c)};
// Terra arada dos canteiros: mesmo mapa do chão, tinta bem mais escura e úmida. Reaproveitar o
// conjunto custa zero textura nova na memória de vídeo.
export const matTerraArada=()=>pbrTerraArada;
const pbrTerraArada=pbr('chao',0x6d5334,{roughness:1});
// Terra batida do pátio do sítio: o chão do mapa é areia clara, e a fazenda em cima dela parecia
// montada num deserto. Mesmo conjunto de textura, tinta de terra pisada.
export const matTerraBatida=()=>pbrTerraBatida;
const pbrTerraBatida=pbr('chao',0xc0a074);

// ===== UV EM METROS =====
// BoxGeometry nasce com UV de 0 a 1 por face: uma parede de 6 m e uma mureta de 12 cm receberiam a
// MESMA textura esticada, e o tijolo da parede sairia gigante ao lado do da mureta. Aqui a UV de cada
// face é reescalada pelo tamanho real dela, então a textura tem densidade constante no bairro inteiro.
// A ordem das faces do BoxGeometry é fixa (+X,-X,+Y,-Y,+Z,-Z), 4 vértices cada com 1 segmento.
export function uvPorMetro(geo,metrosPorLado=2){
  const p=geo.parameters;if(!p)return geo;
  const{width:w,height:h,depth:d}=p;
  const uv=geo.attributes.uv;if(!uv)return geo;
  const tam=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++){
    const su=tam[f][0]/metrosPorLado,sv=tam[f][1]/metrosPorLado;
    for(let v=0;v<4;v++){
      const i=f*4+v;
      uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);
    }
  }
  uv.needsUpdate=true;
  // aoMap lê o segundo canal de UV. Aponta pro mesmo buffer: custo zero de memória, e sem isto a
  // oclusão simplesmente não aparece.
  geo.setAttribute('uv1',uv);
  return geo;
}
// Materiais dedicados (fora do cache genérico) pra cada objeto reagir à luz do seu jeito: vidro brilha, metal reflete, concreto é fosco.
export const concreto=pbr('reboco',0xb9b3a1,{aoMapIntensity:1});
export const janela=new THREE.MeshPhysicalMaterial({color:0x0c2430,roughness:.08,metalness:.1,clearcoat:.55,clearcoatRoughness:.12,emissive:0x1c3d4d,emissiveIntensity:.12});
export const janelaAcesa=new THREE.MeshPhysicalMaterial({color:0x2c3d20,roughness:.1,metalness:.05,clearcoat:.4,clearcoatRoughness:.15,emissive:0xffcf7a,emissiveIntensity:.85});
export const molduraJanela=new THREE.MeshStandardMaterial({color:0x4a4038,roughness:.85});
export const porta=pbr('madeira',0xffffff);
export const agua=new THREE.MeshStandardMaterial({color:0x2f7fae,roughness:.3,metalness:.45});
export const posteMat=new THREE.MeshStandardMaterial({color:0x3a302a,roughness:.5,metalness:.55});
// Folhagem escurecida (era 0x4f8e4c / 0x75ad58): com o sol a 2,5 e tone mapping ACES, verde claro
// satura e vira menta lavado — a copa das árvores parecia de plástico. Verde escuro é o que sobrevive
// à exposição e volta a ler como folha.
export const folhaMat=new THREE.MeshStandardMaterial({color:0x33652f,roughness:.95});
export const folhaClara=new THREE.MeshStandardMaterial({color:0x4a7d38,roughness:.95});
// Colete balístico: mesma cor/aspereza do colete dos policiais (Police.js) de propósito — o jogador e a
// polícia usam o mesmo equipamento, e repetir a cor solta em dois arquivos garantia divergência na
// primeira vez que alguém ajustasse o tom. Fica aqui (e não em Player.js) por ser material compartilhável.
export const coleteMat=new THREE.MeshStandardMaterial({color:0x14181f,roughness:.75});
// Faixa/ombreira um tico mais clara: sem ela o colete vira um bloco preto chapado contra a camisa escura.
export const coleteFaixaMat=new THREE.MeshStandardMaterial({color:0x2b323d,roughness:.7});

// Sombra de contato falsa (blob radial suave): ajuda a "grudar" objetos no chão sem custo de mais uma luz/sombra real.
function criarTexturaSombra(){const s=128,cv=document.createElement('canvas');cv.width=cv.height=s;const ctx=cv.getContext('2d');const grad=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);grad.addColorStop(0,'rgba(0,0,0,.45)');grad.addColorStop(.7,'rgba(0,0,0,.16)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,s,s);return new THREE.CanvasTexture(cv)}
const sombraTex=criarTexturaSombra();
export function criarSombraContato(raio,parent,x=0,z=0){const mat=new THREE.MeshBasicMaterial({map:sombraTex,transparent:true,depthWrite:false});const m=new THREE.Mesh(new THREE.PlaneGeometry(raio*2,raio*2),mat);m.rotation.x=-Math.PI/2;m.position.set(x,.02,z);m.renderOrder=1;parent.add(m);return m}
