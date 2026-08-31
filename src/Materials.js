// Materiais compartilhados do bairro (cache por cor + materiais dedicados) e a sombra de contato falsa.
import*as THREE from'three';

const matCache=new Map();
export const bmat=c=>{if(!matCache.has(c))matCache.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.8,flatShading:true}));return matCache.get(c)};
export const tijolo=bmat(0xb55d3e),telha=bmat(0x77736b);
// Materiais dedicados (fora do cache genérico) pra cada objeto reagir à luz do seu jeito: vidro brilha, metal reflete, concreto é fosco.
export const concreto=new THREE.MeshStandardMaterial({color:0xb9b3a1,roughness:.95});
export const janela=new THREE.MeshPhysicalMaterial({color:0x0c2430,roughness:.08,metalness:.1,clearcoat:.55,clearcoatRoughness:.12,emissive:0x1c3d4d,emissiveIntensity:.12});
export const janelaAcesa=new THREE.MeshPhysicalMaterial({color:0x2c3d20,roughness:.1,metalness:.05,clearcoat:.4,clearcoatRoughness:.15,emissive:0xffcf7a,emissiveIntensity:.85});
export const molduraJanela=new THREE.MeshStandardMaterial({color:0x4a4038,roughness:.85});
export const porta=new THREE.MeshStandardMaterial({color:0x5a382e,roughness:.55,metalness:.06});
export const agua=new THREE.MeshStandardMaterial({color:0x2f7fae,roughness:.3,metalness:.45});
export const posteMat=new THREE.MeshStandardMaterial({color:0x3a302a,roughness:.5,metalness:.55});
export const folhaMat=new THREE.MeshStandardMaterial({color:0x4f8e4c,roughness:.9});
export const folhaClara=new THREE.MeshStandardMaterial({color:0x75ad58,roughness:.9});
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
