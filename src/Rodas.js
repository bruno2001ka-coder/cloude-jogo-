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
 * Acha as rodas na malha fundida e as troca por peças articuladas.
 * `quantas` é 4 (carro) ou 2 (moto) — ver a nota sobre a linha central logo abaixo.
 * Devolve `null` quando o modelo não tem o recorte (aí o veículo segue com a malha inteira, como era).
 *
 * Cada roda vira DOIS objetos aninhados, e não um só: um GRUPO que esterça (gira em Y) e, dentro
 * dele, a MALHA que roda (gira no eixo do pneu). Aninhar em vez de usar dois ângulos no mesmo objeto
 * evita a armadilha da ordem de Euler — a mesma que já me custou duas medidas erradas no assentamento
 * do carro. Com pai e filho, a ordem é a hierarquia, e não há convenção pra errar.
 */
export function separarRodas(raiz,quantas=4){
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

  // ===== UMA RODA É UM DISCO, E É ISSO QUE PRECISA SER CHECADO =====
  // A primeira versão juntava, em cada quina, TODA ilha que estivesse na metade de baixo e longe dos
  // dois eixos centrais. Regra gulosa: ela engolia para-lama, braço de suspensão, ponteira de
  // escapamento — qualquer peça pequena que morasse por ali.
  //
  // O Bruno viu na hora, e o número confirma. Medindo as quatro rodas montadas assim:
  //     0,594 x 0,363 x 0,228  <- inchada
  //     0,530 x 0,447 x 0,233  <- inchada
  //     0,370 x 0,364 x 0,162  <- a única certa
  //     0,532 x 0,448 x 0,243  <- inchada
  // Girando, as três inchadas arrastam a peça vizinha junto e saem do lugar. "só uma roda que saiu
  // certo girando no eixo."
  //
  // Agora: em cada quina, a MAIOR ilha é o pneu, e só entram com ele as peças CONCÊNTRICAS de raio
  // parecido — o que aceita a calota (que é exatamente isso) e recusa o resto. Braço de suspensão não
  // é concêntrico com o pneu; para-lama é muito maior; parafuso é muito menor.
  const RAZAO_DISCO=1.35;  // um disco tem os dois maiores lados parecidos
  const CONCENTRICO=.30;   // desvio máximo do centro, em fração do raio do pneu
  const RAIO_PARECIDO=1.15;// a calota tem quase o raio do pneu; o resto, não

  const medir=g=>{
    const c=caixaDe(geo,g),cen=new THREE.Vector3(),t=new THREE.Vector3();
    c.getCenter(cen);c.getSize(t);
    const lados=[['x',t.x],['y',t.y],['z',t.z]].sort((a,b)=>a[1]-b[1]);
    return{tris:g,cen,t,eixo:lados[0][0],raio:lados[2][1]/2,razao:lados[2][1]/(lados[1][1]||1e-6)};
  };

  const porQuina=new Map();
  const sobra=[];
  const maior=grupos.reduce((a,b)=>a.length>=b.length?a:b);
  const candidatas=[];
  for(const g of grupos){
    if(g===maior||g.length<MIN_VERTICES){sobra.push(g);continue}
    const m=medir(g);
    const baixo=m.cen.y<meio.y;
    const foraDoEixoLongo=Math.abs(m.cen[eixoLongo]-meio[eixoLongo])>tam[eixoLongo]*.18;
    // ===== MOTO NÃO TEM ESQUERDA E DIREITA =====
    // Esta era a linha que barrava a moto, e não o `porQuina.size!==4` que eu esperava: as duas rodas
    // dela ficam EM CIMA da linha central, então `foraDoEixoLargo` reprovava as duas antes mesmo de
    // chegar na contagem. Num carro a exigência continua valendo — é ela que separa as quinas.
    const foraDoEixoLargo=quantas===2||Math.abs(m.cen[eixoLargo]-meio[eixoLargo])>tam[eixoLargo]*.18;
    if(!(baixo&&foraDoEixoLongo&&foraDoEixoLargo)){sobra.push(g);continue}
    const chave=quantas===2?`${Math.sign(m.cen[eixoLongo]-meio[eixoLongo])}`
      :`${Math.sign(m.cen[eixoLongo]-meio[eixoLongo])}|${Math.sign(m.cen[eixoLargo]-meio[eixoLargo])}`;
    if(!porQuina.has(chave))porQuina.set(chave,[]);
    porQuina.get(chave).push(m);
    candidatas.push(m);
  }
  if(porQuina.size!==quantas)return null;

  const quinas=new Map();
  for(const[chave,pecas]of porQuina){
    // O pneu é a maior peça da quina, e tem que PARECER disco. Se não parecer, o modelo não é o que
    // este código sabe recortar — melhor devolver null e deixar o carro inteiro do que entregar uma
    // roda torta girando.
    const pneu=pecas.reduce((a,b)=>a.tris.length>=b.tris.length?a:b);
    if(pneu.razao>RAZAO_DISCO)return null;
    const eixo=pneu.eixo;
    // Distância entre centros MEDIDA NO PLANO DO DISCO: ao longo do eixo do pneu a calota fica
    // deslocada de propósito (ela mora na face de fora), e isso não desalinha nada — girar em torno
    // de um eixo não depende de onde se está AO LONGO dele.
    const noPlano=(a,b)=>{
      let d=0;
      for(const k of['x','y','z'])if(k!==eixo)d+=(a[k]-b[k])**2;
      return Math.sqrt(d);
    };
    const juntas=[];
    for(const q of pecas){
      if(q===pneu){juntas.push(...q.tris);continue}
      if(q.eixo!==eixo)continue;                                   // peça deitada noutro sentido
      if(q.raio>pneu.raio*RAIO_PARECIDO)continue;                  // grande demais pra ser calota
      if(noPlano(q.cen,pneu.cen)>pneu.raio*CONCENTRICO)continue;   // não é concêntrica
      juntas.push(...q.tris);
    }
    // O que não entrou volta pro corpo: para-lama e suspensão continuam parados, onde devem ficar.
    for(const q of pecas)if(!juntas.includes(q.tris[0]))sobra.push(q.tris);
    quinas.set(chave,{tris:juntas,eixo,pneu});
  }

  // A FRENTE do modelo é o lado NEGATIVO do eixo longo: o `giroDoModelo` do veículo leva -X pra -Z,
  // que é a frente do jogo (medido em foto: a câmera em -Z vê a grade e os faróis).
  const rodas=[];
  for(const[chave,roda]of quinas){
    const{tris,eixo,pneu}=roda;
    // ===== O PIVÔ SAI DO PNEU, NÃO DO CONJUNTO =====
    // No plano do disco o centro tem que ser o do PNEU: é ele que rola. A calota é concêntrica, então
    // não muda nada ali — mas se um dia entrar uma peça levemente descentrada, usar o pneu impede que
    // ela puxe o eixo de rotação pra fora do lugar.
    // AO LONGO do eixo, tanto faz: girar em torno de uma reta não depende de onde se está nela.
    const c=caixaDe(geo,tris),cen=new THREE.Vector3();c.getCenter(cen);
    for(const k of['x','y','z'])if(k!==eixo)cen[k]=pneu.cen[k];
    const pivo=new THREE.Group();
    pivo.position.copy(cen);
    const m=new THREE.Mesh(recortar(geo,tris,cen),malha.material);
    m.castShadow=true;m.receiveShadow=true;
    pivo.add(m);
    malha.add(pivo);// entra no MESMO referencial da malha original, então herda escala e giro dela
    // ===== O RAIO SAI EM METROS, NÃO EM UNIDADES DO ARQUIVO =====
    // A geometria continua na escala CRUA do .glb; quem encolhe pro tamanho do jogo é a escala da
    // raiz, posta pelo `ajustarModelo`. O giro da roda é `distância / raio`, e a distância vem em
    // metros de mundo — misturar as duas dava uma roda girando na proporção errada (medido: o pneu
    // parecia ter 48 cm de raio num carro de 1,97 m, quando tem 18).
    const escala=new THREE.Vector3();m.getWorldScale(escala);
    rodas.push({
      pivo,malha:m,eixoGiro:eixo,raio:pneu.raio*escala.x,
      dianteira:Number(chave.split('|')[0])<0,
    });
  }
  // Todas as rodas giram no MESMO eixo, sejam duas ou quatro. Se a detecção discordar entre elas,
  // alguma peça foi lida errada — devolve null e o veículo fica inteiro, que é melhor que uma roda
  // torta girando.
  if(rodas.length!==quantas||new Set(rodas.map(r=>r.eixoGiro)).size!==1)return null;

  // O corpo perde os triângulos das rodas: sem isso ficariam duas rodas no mesmo lugar, uma girando e
  // a outra colada na lataria.
  const doCorpo=[];
  for(const g of sobra)doCorpo.push(...g);
  doCorpo.push(...maior);
  malha.geometry=recortar(geo,doCorpo,new THREE.Vector3(0,0,0));
  geo.dispose();
  return rodas;
}
