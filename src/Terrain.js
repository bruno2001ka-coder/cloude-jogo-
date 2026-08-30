// Relevo procedural do terreno + a malha de chão (única superfície de chão; vielas ficam expostas entre as casas).
import*as THREE from'three';
import{scene}from'./core.js';

// Relevo procedural: frequências baixas produzem morros longos e vales suaves.
export function obterElevacao(x,z){const morroNorte=Math.sin(z*.045)*3.6;const morroLeste=Math.cos(x*.035)*2.8;const valeDiagonal=Math.sin((x+z)*.028)*1.9;return THREE.MathUtils.clamp(morroNorte+morroLeste+valeDiagonal,-2.5,9.5)}

// Textura procedural de terra/grama (sem arquivos externos): mancha de tons sobre o marrom base, repetida pelo terreno.
function criarTexturaChao(){const s=256,cv=document.createElement('canvas');cv.width=cv.height=s;const ctx=cv.getContext('2d');ctx.fillStyle='#8b6f4e';ctx.fillRect(0,0,s,s);for(let i=0;i<950;i++){const x=Math.random()*s,y=Math.random()*s,r=1+Math.random()*2.6,terra=Math.random()<.55;ctx.fillStyle=terra?`rgba(${100+Math.random()*30|0},${75+Math.random()*25|0},${45+Math.random()*20|0},.5)`:`rgba(${60+Math.random()*35|0},${92+Math.random()*30|0},${42+Math.random()*20|0},.32)`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(52,52);tex.colorSpace=THREE.SRGBColorSpace;return tex}

const groundMat=new THREE.MeshStandardMaterial({map:criarTexturaChao(),color:0xffffff,roughness:.95,flatShading:false});
const groundGeometry=new THREE.PlaneGeometry(260,260,84,84);
const groundPositions=groundGeometry.attributes.position;
for(let i=0;i<groundPositions.count;i++){const x=groundPositions.getX(i),localY=groundPositions.getY(i),worldZ=-localY;groundPositions.setZ(i,obterElevacao(x,worldZ))}
groundGeometry.computeVertexNormals();
export const ground=new THREE.Mesh(groundGeometry,groundMat);
ground.rotation.x=-Math.PI/2;ground.castShadow=true;ground.receiveShadow=true;scene.add(ground);
