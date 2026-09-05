// ===== GAME JUICE DE COMBATE =====
import*as THREE from'three';
import{scene}from'./core.js';
import{tocarSomImpacto}from'./Audio.js';
const efeitos=[],partGeo=new THREE.SphereGeometry(.035,5,4),partMat=new THREE.MeshBasicMaterial({color:0xffb347});
export function efeitoDisparo(origem,destino){
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.11,6,4),new THREE.MeshBasicMaterial({color:0xffc34d,transparent:true,opacity:.95}));flash.position.copy(origem);scene.add(flash);
  const luz=new THREE.PointLight(0xffb347,2.2,4,.8);luz.position.copy(origem);scene.add(luz);
  const tracer=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origem.clone(),destino.clone()]),new THREE.LineBasicMaterial({color:0xffe27a,transparent:true,opacity:.95}));scene.add(tracer);
  efeitos.push({tipo:'disparo',flash,luz,tracer,vida:0});
}
export function efeitoImpacto(ponto,tipo='parede'){
  tocarSomImpacto(tipo==='inimigo'?'inimigo':'parede');
  const grupo=new THREE.Group();grupo.position.copy(ponto);scene.add(grupo);
  const lista=[];const cor=tipo==='inimigo'?0xff4b4b:0xc7b6a0;
  for(let i=0;i<7;i++){const m=new THREE.Mesh(partGeo,new THREE.MeshBasicMaterial({color:cor,transparent:true,opacity:.95}));m.position.set(0,0,0);grupo.add(m);const a=Math.random()*Math.PI*2,s=.7+Math.random()*1.3;lista.push({m,v:new THREE.Vector3(Math.cos(a)*s,.5+Math.random()*1.2,Math.sin(a)*s)})}
  efeitos.push({tipo:'impacto',grupo,lista,vida:0});
}
export function atualizarEfeitos(dt){
  for(let i=efeitos.length-1;i>=0;i--){const e=efeitos[i];e.vida+=dt;
    if(e.tipo==='disparo'){const a=Math.max(0,1-e.vida/.09);e.flash.scale.setScalar(1+e.vida*12);e.flash.material.opacity=a;e.luz.intensity=2.2*a;e.tracer.material.opacity=Math.max(0,1-e.vida/.14);if(e.vida>.15){scene.remove(e.flash);scene.remove(e.luz);scene.remove(e.tracer);e.flash.material.dispose();e.tracer.material.dispose();e.tracer.geometry.dispose();efeitos.splice(i,1)}}
    else{for(const p of e.lista){p.v.y-=8*dt;p.m.position.addScaledVector(p.v,dt);p.m.material.opacity=Math.max(0,1-e.vida/.3)}if(e.vida>.32){scene.remove(e.grupo);for(const p of e.lista)p.m.material.dispose();efeitos.splice(i,1)}}
  }
}
