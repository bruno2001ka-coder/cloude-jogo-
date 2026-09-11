// Corpo 3D do policial: carrega uma vez e clona o esqueleto para cada agente.
import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{clone as clonarComEsqueleto}from'three/addons/utils/SkeletonUtils.js';
import{camera,noCelular}from'./core.js';
import{PLAYER_HEIGHT,maoDireita}from'./Player.js';
import{AJUSTE}from'./Personagem.js';

const ANIM_POL={andar:'Walking',correr:'Running',atirandoParado:'01a05f36-abe2-72cf-b71b-cd8f5821a04d'};
const TRANSICAO=.18,VEL_CORRIDA_POL=2.6;
// Animacao e apenas visual. Longe da camera ela pode atualizar em passos maiores sem mexer em IA,
// tiro, colisao ou rota. Isso tira trabalho justamente quando ha varios policiais em campo.
const ANIM_DIST_MEDIA=25,ANIM_DIST_LONGE=45,ANIM_PASSO_MEDIA=.05,ANIM_PASSO_LONGE=.10;
let modelo=null,carregando=false,falhou=false;
const pendentes=[],vestidos=[];
const _v=new THREE.Vector3();

function extremos(raiz){
  let min=Infinity,max=-Infinity,zmin=Infinity,zmax=-Infinity;
  raiz.traverse(o=>{
    if(!o.isSkinnedMesh)return;
    o.updateWorldMatrix(true,false);o.skeleton?.update?.();
    const pos=o.geometry.getAttribute('position');
    if(!pos)return;
    for(let i=0;i<pos.count;i++){
      o.getVertexPosition(i,_v);o.localToWorld(_v);
      if(_v.y<min)min=_v.y;if(_v.y>max)max=_v.y;
      if(_v.z<zmin)zmin=_v.z;if(_v.z>zmax)zmax=_v.z;
    }
  });
  return{min,max,altura:max-min,profundidade:zmax-zmin};
}
function levantarSeDeitado(raiz){
  let e=extremos(raiz);
  if(!(e.profundidade>e.altura*1.5))return;
  let cabeca=null;
  raiz.traverse(o=>{if(o.isBone&&!cabeca&&/^head$/i.test(o.name||''))cabeca=o});
  for(const rx of[-Math.PI/2,Math.PI/2]){
    raiz.rotation.x=rx;raiz.updateMatrixWorld(true);e=extremos(raiz);
    if(!cabeca)break;
    cabeca.getWorldPosition(_v);
    if(_v.y>(e.min+e.max)/2)break;
  }
}
function pedirModelo(){
  if(modelo||carregando||falhou)return;
  carregando=true;
  new GLTFLoader().load('assets/policial.glb',gltf=>{
    modelo=gltf;carregando=false;
    while(pendentes.length)vestir(pendentes.shift());
  },undefined,err=>{
    falhou=true;carregando=false;pendentes.length=0;
    console.warn('Quintal 3D: policial 3D nao carregou; usando corpo simplificado.',err);
  });
}
function vestir(pedido){
  const{grupo,caixas}=pedido;
  const raiz=clonarComEsqueleto(modelo.scene);
  raiz.traverse(o=>{if(o.isMesh){
    // No celular, cada SkinnedMesh projetando sombra custa outra passada de pele no shadow map.
    // O corpo continua recebendo sombra; so deixa de projeta-la. No PC mantem a qualidade completa.
    o.castShadow=!noCelular;o.receiveShadow=true;
    // Antes estava false, obrigando render ate fora da camera. O policial inteiro se move pelo grupo,
    // entao o bounding volume acompanha a posicao e o culling volta a ser seguro.
    o.frustumCulled=true;
  }});
  const mixer=new THREE.AnimationMixer(raiz),acoes={};
  for(const clipe of modelo.animations){
    if(clipe.name!==ANIM_POL.andar&&clipe.name!==ANIM_POL.correr&&clipe.name!==ANIM_POL.atirandoParado)continue;
    const a=mixer.clipAction(clipe);a.enabled=true;a.setEffectiveWeight(0);a.play();acoes[clipe.name]=a;
  }
  grupo.add(raiz);grupo.updateWorldMatrix(true,true);mixer.update(0);raiz.updateMatrixWorld(true);
  levantarSeDeitado(raiz);
  for(let volta=0;volta<6;volta++){
    raiz.updateMatrixWorld(true);const e=extremos(raiz);
    if(!(e.altura>0))break;
    const razao=PLAYER_HEIGHT/e.altura;
    if(Math.abs(razao-1)<.003)break;
    raiz.scale.multiplyScalar(razao);
  }
  raiz.updateMatrixWorld(true);
  const escalaMundo=new THREE.Vector3(),posMundo=new THREE.Vector3();
  grupo.getWorldScale(escalaMundo);grupo.getWorldPosition(posMundo);
  const depois=extremos(raiz);
  if(escalaMundo.y>0)raiz.position.y-=(depois.min-posMundo.y)/escalaMundo.y;
  for(const m of caixas)if(m)m.visible=false;

  if(pedido.arma){
    let mao=null;
    raiz.traverse(o=>{if(o.isBone&&!mao&&/^RightHand$/i.test(o.name||''))mao=o});
    if(mao){
      const eOsso=new THREE.Vector3(),eGrupo=new THREE.Vector3();
      mao.getWorldScale(eOsso);grupo.getWorldScale(eGrupo);
      mao.add(pedido.arma);pedido.arma.visible=true;
      if(eOsso.x>0)pedido.arma.scale.setScalar(eGrupo.x/eOsso.x);
      if(maoDireita.parent&&maoDireita.parent.isBone){
        pedido.arma.quaternion.copy(maoDireita.quaternion);
        pedido.arma.position.copy(maoDireita.position);
      }else{
        const qOsso=new THREE.Quaternion(),qCorpo=new THREE.Quaternion();
        mao.getWorldQuaternion(qOsso);grupo.getWorldQuaternion(qCorpo);
        pedido.arma.quaternion.copy(qOsso.invert().multiply(qCorpo));
        pedido.arma.rotateX(AJUSTE.arma.giroX);pedido.arma.rotateY(AJUSTE.arma.giroY);pedido.arma.rotateZ(AJUSTE.arma.giroZ);
        pedido.arma.position.set(0,0,0);
      }
    }
  }
  const estado={mixer,acoes,atual:null,raiz,grupo,animAcum:0};
  vestidos.push(estado);pedido.aoVestir?.(estado);return estado;
}

export function vestirPolicial(grupo,caixas,arma,aoVestir){
  if(falhou)return;
  const pedido={grupo,caixas,arma,aoVestir};
  if(modelo)vestir(pedido);else{pendentes.push(pedido);pedirModelo()}
}
export function despirPolicial(estado){
  const i=vestidos.indexOf(estado);if(i>=0)vestidos.splice(i,1);
  estado?.mixer?.stopAllAction?.();
}
function trocar(estado,nome){
  const proxima=estado.acoes[nome];
  if(!proxima||estado.atual===proxima)return;
  if(estado.atual)estado.atual.fadeOut(TRANSICAO);
  proxima.reset().fadeIn(TRANSICAO).play();estado.atual=proxima;
}
export function atualizarCorpoPolicial(estado,dt,velocidade,atirandoParado=false){
  if(!estado)return;
  const parado=velocidade<.25;
  trocar(estado,atirandoParado&&parado?ANIM_POL.atirandoParado:(velocidade>=VEL_CORRIDA_POL?ANIM_POL.correr:ANIM_POL.andar));
  if(estado.atual){
    estado.atual.paused=parado&&!atirandoParado;
    if(parado&&!atirandoParado)estado.atual.time=0;
    estado.atual.setEffectiveWeight(1);
  }

  // Perto do jogador/camera: 60 Hz visual. Medio: ate 20 Hz. Longe: ate 10 Hz.
  // Em combate parado nao reduz, para a animacao de tiro continuar responsiva.
  let passo=0;
  if(!atirandoParado&&estado.grupo){
    const dx=estado.grupo.position.x-camera.position.x,dz=estado.grupo.position.z-camera.position.z,d2=dx*dx+dz*dz;
    if(d2>ANIM_DIST_LONGE*ANIM_DIST_LONGE)passo=ANIM_PASSO_LONGE;
    else if(d2>ANIM_DIST_MEDIA*ANIM_DIST_MEDIA)passo=ANIM_PASSO_MEDIA;
  }
  if(passo){
    estado.animAcum+=dt;
    if(estado.animAcum<passo)return;
    dt=estado.animAcum;estado.animAcum=0;
  }else estado.animAcum=0;
  estado.mixer.update(dt);
}
export function temCorpo3D(){return !!modelo}

// O arquivo publicado hoje tem ~0,5 MB. Carrega em tempo ocioso, antes da primeira ronda,
// para o jogador quase nunca ver o boneco reserva de geometria simples.
if(typeof requestIdleCallback==='function')requestIdleCallback(()=>pedirModelo(),{timeout:1400});
else setTimeout(pedirModelo,500);
