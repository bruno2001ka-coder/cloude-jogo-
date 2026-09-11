import * as THREE from 'three';
import {favela,lotes} from './WorldGenerator.js';
import {bmat,ferroMat,pvcMat,janelaAcesa} from './Materials.js';

// Camada visual adicional de fachada.
// A favela foi removida - este arquivo agora é apenas para compatibilidade
const grupo=new THREE.Group();
grupo.name='favela-fachadas-detalhadas';
favela.add(grupo);

// Sem lotes para detalhar (favela removida)
console.info('[favela visual] favela removida - apenas area rural/fazenda');
