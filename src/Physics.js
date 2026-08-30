// Colisão: obstáculos estáticos (paredes/muretas/postes) e superfícies andáveis (lajes/degraus),
// mais os testes de sobreposição AABB usados por jogador, câmera e NPCs/animais.
import*as THREE from'three';

export const COLLISION_EPSILON=.0001;
export const obstaculos=[];
export const superficiesAndaveis=[];

export function registrarObstaculo(meshParede){
  // Atualiza a hierarquia antes de converter o espaço local para world space.
  meshParede.updateWorldMatrix(true,false);
  // A AABB é calculada somente da parede recebida, nunca do grupo/telhado.
  const box=new THREE.Box3().setFromObject(meshParede);
  obstaculos.push(box);
  return box;
}

export function caixaColideComObstaculos(box){
  return obstaculos.some(o=>{
    const overlapX=Math.min(o.max.x,box.max.x)-Math.max(o.min.x,box.min.x);
    const overlapY=Math.min(o.max.y,box.max.y)-Math.max(o.min.y,box.min.y);
    const overlapZ=Math.min(o.max.z,box.max.z)-Math.max(o.min.z,box.min.z);
    return overlapX>COLLISION_EPSILON&&overlapY>COLLISION_EPSILON&&overlapZ>COLLISION_EPSILON;
  });
}

export function colideObstaculoXZ(x,z,y,meiaLarg,meiaProf,altura){
  return obstaculos.some(box=>{
    const overlapX=Math.min(box.max.x,x+meiaLarg)-Math.max(box.min.x,x-meiaLarg);
    const overlapY=Math.min(box.max.y,y+altura)-Math.max(box.min.y,y);
    const overlapZ=Math.min(box.max.z,z+meiaProf)-Math.max(box.min.z,z-meiaProf);
    return overlapX>COLLISION_EPSILON&&overlapY>COLLISION_EPSILON&&overlapZ>COLLISION_EPSILON;
  });
}
