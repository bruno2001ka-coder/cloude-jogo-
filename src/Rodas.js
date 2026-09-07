// ===== SEPARAR AS RODAS DE UM MODELO QUE VEIO FUNDIDO =====
//
// "a onde eu consigo criar as rodas do carro rodando?"
//
// A primeira resposta que eu dei foi ERRADA. Olhei os NÓS do .glb (um só, `mesh_node`) e os
// MATERIAIS (um só, sem grupos) e concluí que as rodas teriam que vir separadas do modelador. Só que
// existe uma terceira costura, e é a que vale: as rodas são ILHAS DE GEOMETRIA DESCONECTADAS. Não
// compartilham um vértice sequer com a lataria.
//
// Medido no carro do jogo: 31 ilhas, sendo 4 pneus e 4 calotas nas quinas, simétricas. No SUV novo:
// 68 ilhas, com os 4 pneus em (±0,6, 0,18, ±0,38) e as 4 calotas logo ao lado. É recorte limpo.
//
// SOLDAR POR POSIÇÃO ANTES DE ANDAR PELA MALHA é obrigatório, e é o passo que quase me fez desistir:
// o exportador duplica vértice na costura de UV, então dois triângulos colados aparecem como ilhas
// diferentes se a comparação for por ÍNDICE. Comparando por POSIÇÃO, a peça volta a ser uma só.
import*as THREE from'three';

// Uma ilha pequena demais é parafuso, antena, retrovisor — não roda.
const MIN_VERTICES=40;

// Anda pela malha juntando triângulos que compartilham vértice (soldado por posição) e devolve as
// ilhas, cada uma como uma lista de índices de triângulo.
function ilhas(geo){
  const pos=geo.getAttribute('position');
  const idx=geo.getIndex();
  const n=idx?idx.count:pos.count;
  const chave=new Map(),solda=new Int32Array(pos.count);
  for(let i=0;i<pos.count;i++){
    const k=`${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    let v=chave.get(k);
    if(v===undefined){v=chave.size;chave.set(k,v)}
    solda[i]=v;
  }
  const pai=new Int32Array(chave.size);
  for(let i=0;i<pai.length;i++)pai[i]=i;
  const acha=a=>{while(pai[a]!==a){pai[a]=pai[pai[a]];a=pai[a]}return a};
  const une=(a,b)=>{const ra=acha(a),rb=acha(b);if(ra!==rb)pai[ra]=rb};
  const vert=t=>idx?idx.getX(t):t;
  for(let t=0;t<n;t+=3){
    const a=solda[vert(t)],b=solda[vert(t+1)],c=solda[vert(t+2)];
    une(a,b);une(b,c);
  }
  const porRaiz=new Map();
  for(let t=0;t<n;t+=3){
    const r=acha(solda[vert(t)]);
    let lista=porRaiz.get(r);
    if(!lista){lista=[];porRaiz.set(r,lista)}
    lista.push(t);
  }
  return[...porRaiz.values()];
}

// Monta uma geometria nova só com os triângulos pedidos, com os vértices recentrados no `centro`.
// Recentrar é o que faz a roda GIRAR EM VOLTA DO PRÓPRIO EIXO: sem isso ela orbita o carro, que é o
// erro clássico de quem separa peça sem mexer no pivô.
function recortar(geo,triangulos,centro){
  const pos=geo.getAttribute('position'),nor=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
  const idx=geo.getIndex();
  const vert=t=>idx?idx.getX(t):t;
  const p=[],nn=[],uu=[];
  for(const t of triangulos)for(let k=0;k<3;k++){
    const i=vert(t+k);
    p.push(pos.getX(i)-centro.x,pos.getY(i)-centro.y,pos.getZ(i)-centro.z);
    if(nor)nn.push(nor.getX(i),nor.getY(i),nor.getZ(i));
    if(uv)uu.push(uv.getX(i),uv.getY(i));
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  if(nor)g.setAttribute('normal',new THREE.Float32BufferAttribute(nn,3));
  if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uu,2));
  if(!nor)g.computeVertexNormals();
  return g;
}

function caixaDe(geo,triangulos){
  const pos=geo.getAttribute('position'),idx=geo.getIndex();
  const vert=t=>idx?idx.getX(t):t;
  const c=new THREE.Box3(),v=new THREE.Vector3();
  c.makeEmpty();
  for(const t of triangulos)for(let k=0;k<3;k++)c.expandByPoint(v.fromBufferAttribute(pos,vert(t+k)));
  return c;
}

/**
 * Acha as quatro rodas na malha fundida e as troca por peças articuladas.
 * Devolve `null` quando o modelo não tem o recorte (aí o veículo segue com a malha inteira, como era).
 *
 * Cada roda vira DOIS objetos aninhados, e não um só: um GRUPO que esterça (gira em Y) e, dentro
 * dele, a MALHA que roda (gira no eixo do pneu). Aninhar em vez de usar dois ângulos no mesmo objeto
 * evita a armadilha da ordem de Euler — a mesma que já me custou duas medidas erradas no assentamento
 * do carro. Com pai e filho, a ordem é a hierarquia, e não há convenção pra errar.
 */
export function separarRodas(raiz){
  let malha=null;
  raiz.traverse(o=>{if(o.isMesh&&!malha)malha=o});
  if(!malha)return null;
  const geo=malha.geometry;
  const grupos=ilhas(geo);
  if(grupos.length<5)return null;// sem ilhas suficientes não há o que separar

  const caixaToda=new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position'));
  const tam=new THREE.Vector3();caixaToda.getSize(tam);
  const meio=new THREE.Vector3();caixaToda.getCenter(meio);
  // O eixo COMPRIDO é o do carro; o CURTO na horizontal é a largura. Descobrir em vez de assumir:
  // o mesmo código serve pra qualquer modelo que o Bruno traga do Meshy, e eles saem em eixos
  // diferentes conforme o prompt.
  const eixoLongo=tam.x>=tam.z?'x':'z';
  const eixoLargo=eixoLongo==='x'?'z':'x';

  // Candidatas a roda: ilhas na METADE DE BAIXO e afastadas do eixo central nos dois sentidos.
  // Retrovisor e antena ficam em cima e caem fora sozinhos.
  const quinas=new Map();
  const sobra=[];
  const maior=grupos.reduce((a,b)=>a.length>=b.length?a:b);
  for(const g of grupos){
    if(g===maior||g.length<MIN_VERTICES){sobra.push(g);continue}
    const c=caixaDe(geo,g),cen=new THREE.Vector3();c.getCenter(cen);
    const baixo=cen.y<meio.y;
    const foraDoEixoLongo=Math.abs(cen[eixoLongo]-meio[eixoLongo])>tam[eixoLongo]*.18;
    const foraDoEixoLargo=Math.abs(cen[eixoLargo]-meio[eixoLargo])>tam[eixoLargo]*.18;
    if(!(baixo&&foraDoEixoLongo&&foraDoEixoLargo)){sobra.push(g);continue}
    const chave=`${Math.sign(cen[eixoLongo]-meio[eixoLongo])}|${Math.sign(cen[eixoLargo]-meio[eixoLargo])}`;
    if(!quinas.has(chave))quinas.set(chave,[]);
    quinas.get(chave).push(...g);// pneu e calota da mesma quina viram UMA roda
  }
  if(quinas.size!==4)return null;

  // A FRENTE do modelo é o lado NEGATIVO do eixo longo: o `giroDoModelo` do veículo leva -X pra -Z,
  // que é a frente do jogo (medido em foto: a câmera em -Z vê a grade e os faróis).
  const rodas=[];
  for(const[chave,tris]of quinas){
    const c=caixaDe(geo,tris),cen=new THREE.Vector3(),t=new THREE.Vector3();
    c.getCenter(cen);c.getSize(t);
    const pivo=new THREE.Group();
    pivo.position.copy(cen);
    const m=new THREE.Mesh(recortar(geo,tris,cen),malha.material);
    m.castShadow=true;m.receiveShadow=true;
    pivo.add(m);
    malha.add(pivo);// entra no MESMO referencial da malha original, então herda escala e giro dela
    // O EIXO DO PNEU É A DIMENSÃO MAIS FINA. Um pneu é um disco: redondo em dois eixos e chato no
    // terceiro, e o chato é o eixo. Descobrir assim, em vez de fixar 'z', é o que faz isto funcionar
    // com qualquer modelo — o Meshy exporta em orientações diferentes conforme o prompt.
    const lados=[['x',t.x],['y',t.y],['z',t.z]].sort((a,b)=>a[1]-b[1]);
    const eixoGiro=lados[0][0];          // o mais fino
    // ===== O RAIO SAI EM METROS, NÃO EM UNIDADES DO ARQUIVO =====
    // A geometria continua na escala CRUA do .glb; quem encolhe pro tamanho do jogo é a escala da
    // raiz, posta pelo `ajustarModelo`. O giro da roda é `distância / raio`, e a distância vem em
    // metros de mundo — misturar as duas dava uma roda girando na proporção errada (medido: o pneu
    // parecia ter 48 cm de raio num carro de 1,97 m, quando tem 18).
    const escala=new THREE.Vector3();m.getWorldScale(escala);
    const raio=lados[2][1]/2*escala.x;
    rodas.push({
      pivo,malha:m,eixoGiro,raio,
      dianteira:Number(chave.split('|')[0])<0,
    });
  }
  // O corpo perde os triângulos das rodas: sem isso ficariam duas rodas no mesmo lugar, uma girando e
  // a outra colada na lataria.
  const doCorpo=[];
  for(const g of sobra)doCorpo.push(...g);
  doCorpo.push(...maior);
  malha.geometry=recortar(geo,doCorpo,new THREE.Vector3(0,0,0));
  geo.dispose();
  return rodas;
}
