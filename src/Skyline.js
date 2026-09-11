// ===== CIDADE NO FUNDO: skyline de baixa complexidade, sem colisão =====
// Restrição real deste projeto que ditou a solução: `scene.fog = FogExp2(0.013)`. A 180 m o fator de
// névoa é 1 − e^(−(0,013·180)²) = 0,996 — uma cidade em espaço de mundo seria simplesmente ENGOLIDA.
// Por isso a skyline usa a mesma técnica de skybox do céu e do horizonte pintado: acompanha a câmera em
// X/Z (portanto está sempre "no horizonte"), com material sem névoa e cor clareando com a distância,
// simulando perspectiva atmosférica.
//
// Custo: 1 draw call · 96 prédios · 0 sombras · 0 AABB registrada · 0 custo de física.
// As matrizes de instância são calculadas UMA vez; seguir a câmera é só mover o grupo pai (1 atribuição
// por frame), não recompor 96 matrizes.
import*as THREE from'three';
import{scene,camera}from'./core.js';

const NUM_PREDIOS=96,RAIO_MIN=168,RAIO_MAX=196,BASE_Y=1.5;
const HORIZONTE=new THREE.Color(0xcfe3ea);

// Caixa unitária com a base em y=0: assim a matriz de instância só escala e translada.
const predioGeo=new THREE.BoxGeometry(1,1,1);
predioGeo.translate(0,.5,0);
// MeshBasicMaterial: a cidade não recebe luz nem sombra — é silhueta, não cenário jogável.
export const predioMat=new THREE.MeshBasicMaterial({fog:false});
const predios=new THREE.InstancedMesh(predioGeo,predioMat,NUM_PREDIOS);
predios.castShadow=false;predios.receiveShadow=false;
predios.frustumCulled=false;// o grupo pai se move todo frame; o bounding box do culling nasceria errado

export const cidadeFundo=new THREE.Group();
cidadeFundo.add(predios);
scene.add(cidadeFundo);

const matriz=new THREE.Matrix4(),posicao=new THREE.Vector3(),quat=new THREE.Quaternion(),escala=new THREE.Vector3();
const eixoY=new THREE.Vector3(0,1,0),corInstancia=new THREE.Color();
for(let i=0;i<NUM_PREDIOS;i++){
  // Distribuição angular com jitter: num anel perfeitamente regular a silhueta vira pente e denuncia o truque.
  const ang=(i/NUM_PREDIOS)*Math.PI*2+(Math.random()-.5)*.05;
  const raio=RAIO_MIN+Math.random()*(RAIO_MAX-RAIO_MIN);
  // h = 9 + 34·u²: a distribuição quadrática concentra prédios baixos e deixa poucas torres altas — é o
  // perfil real de uma silhueta urbana. Torre mais alta: atan(43/180) ≈ 13,5° acima do horizonte.
  const u=Math.random(),altura=9+34*u*u;
  posicao.set(Math.cos(ang)*raio,BASE_Y,Math.sin(ang)*raio);
  quat.setFromAxisAngle(eixoY,-ang);
  escala.set(7+Math.random()*11,altura,7+Math.random()*11);
  predios.setMatrixAt(i,matriz.compose(posicao,quat,escala));
  // Perspectiva aérea: quanto mais longe, mais o prédio se dissolve na cor do horizonte.
  const distanciaNormalizada=(raio-RAIO_MIN)/(RAIO_MAX-RAIO_MIN);
  predios.setColorAt(i,corInstancia.setHex(0x59687a).lerp(HORIZONTE,.42+distanciaNormalizada*.3));
}
predios.instanceMatrix.needsUpdate=true;
if(predios.instanceColor)predios.instanceColor.needsUpdate=true;

// Chamado a cada frame pelo main: recentra o anel na câmera, igual ao céu e ao horizonte pintado.
const ZONAS_RURAIS_VISUAIS=[
  {x:-145,z:76,r:105},{x:126,z:112,r:110},{x:154,z:-86,r:105},{x:82,z:98,r:90}
];
export function atualizarSkyline(){
  cidadeFundo.position.set(camera.position.x,0,camera.position.z);
  // No campo, um anel de torres brancas em 360° mata a leitura rural. A cidade continua existindo
  // perto da região urbana, mas some quando a câmera entra de fato nas propriedades.
  let rural=false;
  for(const z of ZONAS_RURAIS_VISUAIS){
    const dx=camera.position.x-z.x,dz=camera.position.z-z.z;
    if(dx*dx+dz*dz<z.r*z.r){rural=true;break}
  }
  cidadeFundo.visible=!rural;
}
