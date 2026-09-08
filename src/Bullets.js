// ===== BALAS COM TRAJETÓRIA REAL =====
// Antes o tiro era um raycast instantâneo que só testava as caixas dos policiais — ou seja, atravessava
// casa inteira e acertava alguém do outro lado. Agora cada tiro é um projétil que viaja, e o trecho
// percorrido em cada frame é testado contra as PAREDES e contra os alvos: o que vier primeiro ganha.
import*as THREE from'three';
import{scene}from'./core.js';
import{primeiroImpactoNoSegmento,intersectarSegmentoCaixa}from'./Physics.js';
import{efeitoImpacto}from'./CombatFX.js';

const VELOCIDADE=95,VIDA_MAX=1.6,RAIO_BALA=.045;
// A polícia precisa do número pra ANTECIPAR o tiro (mirar onde o alvo vai estar). Exportado daqui, e
// não copiado lá, porque duas cópias da velocidade da bala divergem na primeira vez que alguém
// ajustar o balanceamento — e a divergência apareceria como pontaria misteriosamente pior.
export const VELOCIDADE_BALA=VELOCIDADE;

// ===== A BALA É UM RISCO, NÃO UMA BOLINHA =====
// "os projéteis dos tiros estão feio."
//
// Era uma ESFERA de 4,5 cm de raio. A bala anda a 95 m/s, ou seja 1,58 m POR QUADRO a 60 fps: o olho
// via uma bolinha se teletransportando em saltos de um metro e meio, com um vão preto entre um
// quadro e o outro. Nenhum tamanho de esfera conserta isso — o problema é a forma.
//
// Agora é um cilindro deitado NA DIREÇÃO do tiro, com 1,8 m de comprimento: ele cobre o vão do
// quadro, então o que se vê é um risco contínuo, que é como tracejante se parece de verdade.
// `AdditiveBlending` porque tracejante é luz: ele SOMA com o fundo em vez de tapar, e é isso que faz
// aparecer à noite sem ficar um adesivo cinza de dia.
const COMPRIMENTO_BALA=1.8;
// Cilindro nasce deitado no Y; girar a geometria uma vez põe o eixo no Z, que é o que o
// `setFromUnitVectors` espera lá embaixo. Feito na geometria (uma vez) e não por bala.
const balaGeo=new THREE.CylinderGeometry(RAIO_BALA*.6,RAIO_BALA*.9,COMPRIMENTO_BALA,5,1,true);
balaGeo.rotateX(Math.PI/2);
const balaMatJogador=new THREE.MeshBasicMaterial({color:0xbdf0ff,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false});
const balaMatPolicia=new THREE.MeshBasicMaterial({color:0xffd98a,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false});
// Rastro atrás do risco: mais longo que ele e mais fraco, pra dar o sentido da trajetória.
const rastroMatJogador=new THREE.LineBasicMaterial({color:0x7fd8ff,transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false});
const rastroMatPolicia=new THREE.LineBasicMaterial({color:0xffbf5e,transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false});

const _eixoZ=new THREE.Vector3(0,0,1),_dirNorm=new THREE.Vector3();
const balas=[];
const impactos=[];
const impactoGeo=new THREE.SphereGeometry(.07,6,5);
const impactoMat=new THREE.MeshBasicMaterial({color:0xffe9b0,transparent:true,opacity:.9});

// deDoJogador: define quem pode ser atingido (o tiro do jogador não acerta o próprio jogador e vice-versa).
// ===== A BALA VOA PELA MIRA; O CANO É SÓ DE ONDE ELA APARECE =====
// `origemVisual` é opcional e não tem efeito nenhum na física: o projétil é desenhado saindo dali e
// converge pra trajetória de verdade em `CONVERGE` segundos.
//
// Isto conserta uma imprecisão MEDIDA. A câmera é de terceira pessoa e o cano fica ~1,3 m abaixo
// dela; fazendo a bala sair do cano em direção ao ponto visado, as duas retas só se encontram NAQUELA
// distância. Medido, com o ponto visado a ~12 m: a bala passava a 48 cm da mira num alvo a 10 m,
// 112 cm a 30 m e 273 cm a 50 m. Não era defeito de conta — é o que acontece quando se atira de um
// lugar e se mira de outro.
//
// Agora a reta da bala É a reta da mira, então ela acerta onde a mira aponta em QUALQUER distância.
// O risco continua saindo do cano, que é o que o olho espera ver.
const CONVERGE=.12;
export function dispararBala(origem,direcao,deDoJogador,origemVisual=null){
  const mesh=new THREE.Mesh(balaGeo,deDoJogador?balaMatJogador:balaMatPolicia);
  mesh.position.copy(origemVisual||origem);
  // Deita o risco na direção do tiro. A direção não muda ao longo do voo, então isto é uma vez só.
  mesh.quaternion.setFromUnitVectors(_eixoZ,_dirNorm.copy(direcao).normalize());
  mesh.frustumCulled=false;// a caixa de corte de um cilindro girado nasce errada e some com o risco
  scene.add(mesh);
  const rastro=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([mesh.position.clone(),mesh.position.clone()]),
    deDoJogador?rastroMatJogador:rastroMatPolicia);
  scene.add(rastro);
  balas.push({mesh,rastro,pos:origem.clone(),dir:direcao.clone().normalize(),vida:0,deDoJogador,
    desvio:origemVisual?origemVisual.clone().sub(origem):null});
}

function criarImpacto(x,y,z){
  const m=new THREE.Mesh(impactoGeo,impactoMat.clone());
  m.position.set(x,y,z);scene.add(m);
  impactos.push({mesh:m,vida:0});
}

function removerBala(i){
  const b=balas[i];
  scene.remove(b.mesh);scene.remove(b.rastro);
  b.rastro.geometry.dispose();
  balas.splice(i,1);
}

// alvos: [{caixa:Box3, aoAtingir:fn}] — montado por quem chama, já filtrado por lado (jogador x polícia).
export function atualizarBalas(dt,obterAlvos){
  for(let i=balas.length-1;i>=0;i--){
    const b=balas[i];
    b.vida+=dt;
    if(b.vida>VIDA_MAX){removerBala(i);continue}

    const ax=b.pos.x,ay=b.pos.y,az=b.pos.z;
    const passo=VELOCIDADE*dt;
    const bx=ax+b.dir.x*passo,by=ay+b.dir.y*passo,bz=az+b.dir.z*passo;

    // 1) onde esse trecho bate numa parede?
    const parede=primeiroImpactoNoSegmento(ax,ay,az,bx,by,bz);
    let melhorT=parede?parede.t:Infinity;
    let alvoAtingido=null;

    // 2) algum alvo é atingido ANTES da parede? (se a parede vier primeiro, o tiro morre nela)
    for(const alvo of obterAlvos(b.deDoJogador)){
      const hit=intersectarSegmentoCaixa(alvo.caixa,ax,ay,az,bx-ax,by-ay,bz-az);
      if(hit!==null&&hit<melhorT){melhorT=hit;alvoAtingido=alvo}
    }

    if(melhorT<=1){
      const hx=ax+(bx-ax)*melhorT,hy=ay+(by-ay)*melhorT,hz=az+(bz-az)*melhorT;
      criarImpacto(hx,hy,hz);efeitoImpacto(new THREE.Vector3(hx,hy,hz),alvoAtingido?'inimigo':'parede');
      if(alvoAtingido)alvoAtingido.aoAtingir();
      removerBala(i);continue;
    }

    b.pos.set(bx,by,bz);
    // O desvio do cano some ao longo de CONVERGE: no primeiro quadro o risco sai da arma, e logo
    // depois ele está em cima da trajetória real. A física NUNCA vê este desvio.
    const f=b.desvio?Math.max(0,1-b.vida/CONVERGE):0;
    if(f>0)b.mesh.position.copy(b.pos).addScaledVector(b.desvio,f);
    else b.mesh.position.copy(b.pos);
    // O rastro começa ATRÁS do risco (não no meio dele) e cobre o resto do vão do quadro.
    const cauda=b.mesh.position.clone().addScaledVector(b.dir,-(COMPRIMENTO_BALA*.5+Math.min(4,passo)));
    b.rastro.geometry.setFromPoints([cauda,b.mesh.position.clone()]);
  }

  for(let i=impactos.length-1;i>=0;i--){
    const im=impactos[i];
    im.vida+=dt;
    im.mesh.material.opacity=Math.max(0,.9-im.vida*4);
    im.mesh.scale.setScalar(1+im.vida*5);
    if(im.vida>.22){scene.remove(im.mesh);im.mesh.material.dispose();impactos.splice(i,1)}
  }
}

export function limparBalas(){
  for(let i=balas.length-1;i>=0;i--)removerBala(i);
}
