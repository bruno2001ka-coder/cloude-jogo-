// ===== JARDINS DO MORRO — RUAS NATIVAS DO MESMO SISTEMA DA FAVELA =====
// Nao desenha perfil proprio, nao sobe 3/8 cm, nao vira superficie fisica paralela.
// A mesma fita PBR, a mesma sanga de terra, o mesmo levante contra quina e o mesmo meio-fio usados
// pela viaPrincipal/viaBaixa da favela sao reutilizados aqui diretamente.
import*as THREE from'three';
import{scene}from'./core.js';
import{matAsfalto,matMeioFio}from'./Materials.js';
import{fitaDaVia,meioFioDaVia}from'./Favela.js';
import{vias,LIGACAO_FAVELA,VIA_PRINCIPAL_LARGURA}from'./NobleDistrictPlan.js';

const grupo=new THREE.Group();grupo.name='bairro-nobre-vias-integradas';scene.add(grupo);
const asfalto=matAsfalto(),meiofio=matMeioFio();

function construir(via){
  const pista=new THREE.Mesh(fitaDaVia(via.curva,via.largura,true),asfalto);
  pista.name=`asfalto-integrado-${via.nome}`;pista.receiveShadow=true;pista.castShadow=false;grupo.add(pista);

  const guia=new THREE.Mesh(meioFioDaVia(via.curva,via.largura),meiofio);
  guia.name=`meiofio-integrado-${via.nome}`;guia.receiveShadow=true;guia.castShadow=false;grupo.add(guia);
}
for(const via of vias)construir(via);

console.info('[bairro-nobre-ruas] sistema=favela | vias=%d | largura-juncao=%.1fm | juncao=(%.2f,%.2f)',vias.length,VIA_PRINCIPAL_LARGURA,LIGACAO_FAVELA.x,LIGACAO_FAVELA.z);
