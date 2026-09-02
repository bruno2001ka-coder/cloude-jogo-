// ===== ECONOMIA PARALELA (ficção de jogo): contrabando urbano + cultivo escondido + mercado negro =====
// Itens e cenário fictícios; toda a arte é gerada aqui mesmo com geometria low-poly, no mesmo estilo das árvores do jogo.
import*as THREE from'three';
import{scene,camera}from'./core.js';
import{ground}from'./Terrain.js';
import{obstaculos,superficiesAndaveis}from'./Physics.js';
import{criarSombraContato,folhaMat,folhaClara}from'./Materials.js';
import{criarEsconderijo,refugioEmQueEsta,alternarPortaRefugio,porteiraFazenda,alternarPorteira,pertoDaPorteira,BAR,BIQUEIRA,clienteLaje,pertoDoCliente,entregouAoCliente}from'./WorldGenerator.js';
import{player}from'./Player.js';
import{POLOS,PRECOS}from'./Poles.js';
import{ARMAS,ORDEM_ARMAS,equiparArma}from'./Weapons.js';
// ===== GANCHOS DA POLÍCIA (saúde e procurado) =====
// NÃO dá pra importar Police aqui. Police já importa `inventario` deste módulo, e importar de volta
// fecha o ciclo com a Economy avaliando DEPOIS: `inventario` é uma const, e const acessada antes da
// inicialização lança — foi exatamente isto que aconteceu na primeira tentativa
// ("Cannot access 'inventario' before initialization"), e é o mesmo TDZ que já travou o jogo uma vez.
// Então a dependência anda no sentido que já existe: Police REGISTRA os ganchos ao ser avaliado.
// Os no-op de partida deixam o bar e a biqueira funcionarem (sem curar/denunciar) mesmo se a polícia
// não tiver carregado — degradação silenciosa é melhor que botão que lança.
let ganchosPolicia={curar:()=>false,precisaCurar:()=>false,denunciar:()=>{}};
export function registrarGanchosPolicia(g){ganchosPolicia={...ganchosPolicia,...g}}
const jogadorPrecisaCurar=()=>ganchosPolicia.precisaCurar();

export let dinheiro=1000;
// `municao` e `colete` são consumidos pelo sistema de combate (Police.js). Ficam no inventário, e não
// dentro do Police, porque Economy → Police seria dependência circular: o Police já importa a Economy.
// `armas` (o que o jogador POSSUI) e `municao` (estoque POR ARMA) seguem a mesma regra: o Weapons.js
// só sabe qual está equipada; quem tem e quanto tem é economia.
export const inventario={vaso:0,terra:0,semente:0,pacote:0,colete:0,
  armas:{pistola:true,rifle:false,escopeta:false,metralhadora:false},
  municao:{pistola:24,rifle:0,escopeta:0,metralhadora:0}};
const potMat=new THREE.MeshStandardMaterial({color:0x8a5a3a,roughness:.85});
const floraMat=new THREE.MeshStandardMaterial({color:0x9fc75c,roughness:.8});
const floraAcentoMat=new THREE.MeshStandardMaterial({color:0xf3e9b8,roughness:.6,emissive:0xc9b878,emissiveIntensity:.15});
const caulePlantaMat=new THREE.MeshStandardMaterial({color:0x5a7a3c,roughness:.85});
const TEMPO_ESTAGIO=22;// segundos por estágio (broto→vegetativa→flora): ritmo de jogo casual, não é guia real de cultivo
export const plantas=[];
function distXZ(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function bloco(geo,material,x,y,z,parent){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// ===== OS 4 POLOS ECONÔMICOS =====
// As coordenadas vêm de Poles.js (fonte única, compartilhada com o WorldGenerator e o radar). O mapa
// forma um quadrilátero em torno do bairro, com nenhum trecho menor que 60 m: o jogador é obrigado a
// atravessar a área patrulhada pelo helicóptero pra fechar um ciclo econômico.
export const lojaPos=new THREE.Vector3(POLOS.sementes.x,0,POLOS.sementes.z);// mercadinho já existente no bairro
export const receptadorPos=new THREE.Vector3(POLOS.receptador.x,0,POLOS.receptador.z);
export const fazendaPos=new THREE.Vector3(POLOS.fazenda.x,0,POLOS.fazenda.z);
export const armasPos=new THREE.Vector3(POLOS.armas.x,0,POLOS.armas.z);
criarEsconderijo(receptadorPos.x,receptadorPos.z);

// Planta em vaso com três estágios visuais: muda, vegetativa e floração.
// As formas são deliberadamente de jogo, mas respeitam a leitura natural de caule, nós, folhas e flores.
const GEO_FOLHA=new THREE.IcosahedronGeometry(.115,1);
const GEO_BROTO=new THREE.SphereGeometry(.08,7,5);
function folhaCannabis(parent,x,y,z,escala,rotacao,material,estagio){
  const m=bloco(GEO_FOLHA,material,x,y,z,parent);
  m.scale.set(.58*escala,.13*escala,1.45*escala);
  m.rotation.set(.25+escala*.18,rotacao,.18);
  m.userData.estagio=estagio;
  return m;
}
function ramoCannabis(parent,x,y,z,escala,estagio,folhas){
  const haste=bloco(new THREE.CylinderGeometry(.012*escala,.018*escala,.24*escala,5),caulePlantaMat,x,y,z,parent);
  haste.rotation.z=.2;
  for(let i=0;i<folhas;i++){
    const ang=i*Math.PI*2/folhas+(estagio%2)*.22;
    const raio=.10*escala,altura=y+.08*escala;
    folhaCannabis(parent,x+Math.cos(ang)*raio,altura,z+Math.sin(ang)*raio,.72*escala,ang,estagio===2?floraMat:folhaMat,estagio);
  }
  return haste;
}
function criarPlanta(x,y,z){
  const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
  bloco(new THREE.CylinderGeometry(.2,.16,.26,8),potMat,0,.13,0,g);
  const revelaEm=[];
  const registrar=(m,estagio)=>{m.visible=estagio===0;revelaEm.push([m,estagio]);return m};
  registrar(bloco(new THREE.CylinderGeometry(.022,.032,.38,6),caulePlantaMat,0,.45,0,g),0);
  // Estágio 1: muda vegetativa, mais alta, com nós e folhas em pares alternados.
  for(const [yy,esc] of [[.58,.72],[.72,.62],[.86,.5]]){
    const antes=g.children.length;
    const ramo=ramoCannabis(g,0,yy,0,esc,1,5);registrar(ramo,1);
    for(const m of g.children.slice(antes+1))registrar(m,1);
  }
  // Estágio 2: copa mais cheia, folhas estreitas e flores claras concentradas nos ápices.
  for(const [yy,esc] of [[.62,.9],[.82,.8],[1.02,.68],[1.20,.5]]){
    const antes=g.children.length;
    const ramo=ramoCannabis(g,0,yy,0,esc,2,7);registrar(ramo,2);
    for(const m of g.children.slice(antes+1))registrar(m,2);
    registrar(bloco(GEO_BROTO,floraAcentoMat,0,yy+.13*esc,.02,g),2);
  }
  registrar(bloco(new THREE.ConeGeometry(.07,.22,7),floraAcentoMat,0,1.39,.02,g),2);
  for(const [m] of revelaEm)if(m.userData.estagio===undefined&&m.position.y>.45)m.visible=false;
  criarSombraContato(.45,g,0,0);
  return{grupo:g,x,y,z,plantadoEm:performance.now()/1000,estagio:0,revelaEm,colhida:false};
}
// Crescimento cumulativo: cada parte some visível a partir do seu próprio estágio e continua visível depois (a planta não "encolhe").
function atualizarEstagioPlanta(planta){planta.revelaEm.forEach(([m,estagioMin])=>m.visible=planta.estagio>=estagioMin)}
export function atualizarPlantas(){
  const agora=performance.now()/1000;
  for(const p of plantas){
    if(p.colhida)continue;
    const estagioAlvo=Math.min(2,Math.floor((agora-p.plantadoEm)/TEMPO_ESTAGIO));
    if(estagioAlvo!==p.estagio){p.estagio=estagioAlvo;atualizarEstagioPlanta(p)}
  }
}
// ===== MIRA DE PLANTIO: raycaster a partir da câmera (combina com a mira fixa no centro da tela) contra o
// terreno E as superfícies elevadas (lajes/degraus) — dá pra plantar em qualquer lugar, rua ou telhado.
const raycasterMira=new THREE.Raycaster(),ALCANCE_MIRA=14;
const potGhostMat=new THREE.MeshBasicMaterial({color:0x33ff55,transparent:true,opacity:.5,depthTest:false});
const potGhost=new THREE.Mesh(new THREE.CylinderGeometry(.2,.16,.26,8),potGhostMat);potGhost.visible=false;potGhost.renderOrder=2;scene.add(potGhost);
const miraEl=document.getElementById('mira');
function calcularAlvoPlantio(){
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  raycasterMira.set(camera.position,dir);raycasterMira.far=ALCANCE_MIRA*2;
  const hits=raycasterMira.intersectObjects([ground,...superficiesAndaveis],true);
  if(!hits.length)return null;
  const ponto=hits[0].point;
  if(ponto.distanceTo(player.position)>ALCANCE_MIRA)return null;
  const meia=.22;
  const caixaVaso=new THREE.Box3(new THREE.Vector3(ponto.x-meia,ponto.y,ponto.z-meia),new THREE.Vector3(ponto.x+meia,ponto.y+.3,ponto.z+meia));
  const bloqueado=obstaculos.some(o=>o.intersectsBox(caixaVaso));
  const pertoDemais=plantas.some(p=>!p.colhida&&Math.hypot(p.x-ponto.x,p.z-ponto.z)<1.6);
  return{ponto,valido:!bloqueado&&!pertoDemais};
}
export function atualizarMiraPlantio(){
  const temIngredientes=inventarioAberto&&inventario.vaso>0&&inventario.terra>0&&inventario.semente>0;
  miraEl.style.display=temIngredientes?'block':'none';
  if(!temIngredientes){potGhost.visible=false;return}
  const alvo=calcularAlvoPlantio();
  if(!alvo){potGhost.visible=false;miraEl.style.borderColor='rgba(255,255,255,.85)';return}
  potGhost.visible=true;potGhost.position.set(alvo.ponto.x,alvo.ponto.y+.13,alvo.ponto.z);
  potGhostMat.color.set(alvo.valido?0x33ff55:0xff3333);
  miraEl.style.borderColor=alvo.valido?'#33ff55':'#ff3333';
}
// Ação primária do contexto — o que a tecla E faz. Existe como função (e não como um `click()` no
// botão do painel) porque o painel é reconstruído por mudança de contexto: disparar pelo DOM
// dependeria de o botão certo estar montado naquele frame.
export function acaoPrimaria(){
  const ctx=contextoAtual();
  if(!ctx)return null;
  if(ctx.tipo==='refugio'){const aberta=alternarPortaRefugio(ctx.refugio);renderizarAcoes();return aberta?'porta-aberta':'porta-fechada'}
  if(ctx.tipo==='porteira'){const aberta=alternarPorteira();renderizarAcoes();return aberta?'porteira-aberta':'porteira-fechada'}
  if(ctx.tipo==='planta'&&ctx.planta.estagio===2){colher(ctx.planta);return 'colheu'}
  return null;
}
export function contextoAtual(){
  const p=player.position;
  // O refúgio vem PRIMEIRO: dentro da casa, a única ação que importa é a porta. `chave` inclui o
  // estado dela porque o painel só se redesenha quando a chave muda — sem isso o botão continuaria
  // escrito "Fechar" depois de fechar.
  const refugio=refugioEmQueEsta(p);
  if(refugio)return{tipo:'refugio',refugio,chave:'refugio'+(refugio.aberta?'A':'F')};
  // A porteira vem antes dos polos: ela fica a 21 m do Depósito Rural, então não disputam contexto —
  // a ordem aqui é só pra deixar as duas ações de abrir/fechar juntas no topo.
  if(pertoDaPorteira(p))return{tipo:'porteira',chave:'porteira'+(porteiraFazenda.aberta?'A':'F')};
  // A chave carrega se precisa curar: o painel só se redesenha quando ela muda, e sem isso o botão
  // continuaria escrito "Você está inteiro" depois de levar tiro parado no balcão.
  if(distXZ(p,lojaPos)<POLOS.sementes.raio)return{tipo:'loja',chave:'loja'+(jogadorPrecisaCurar()?'F':'C')};
  if(distXZ(p,receptadorPos)<POLOS.receptador.raio)return{tipo:'receptador'};
  // A chave inclui a espera da diária: o painel só se redesenha quando a chave muda, e sem isso o
  // "volte em 45s" ficava congelado no número do momento do clique. Redesenha uma vez por segundo,
  // e só enquanto o jogador está parado no balcão.
  if(distXZ(p,fazendaPos)<POLOS.fazenda.raio)return{tipo:'fazenda',chave:'fazenda'+esperaDaDiaria()};
  if(distXZ(p,armasPos)<POLOS.armas.raio)return{tipo:'armas'};
  // Bar e biqueira ficam DEPOIS dos polos: os dois moram no morro, longe dos quatro, então não
  // disputam contexto — a ordem aqui é só pra manter os pontos de compra e venda juntos no painel.
  // A chave do bar carrega a vida porque o botão muda de "cheio" pra vendável quando o jogador apanha.
  if(distXZ(p,{x:BAR.x,z:BAR.z})<BAR.raio)return{tipo:'bar',chave:'bar'+(jogadorPrecisaCurar()?'F':'C')};
  if(distXZ(p,{x:BIQUEIRA.x,z:BIQUEIRA.z})<BIQUEIRA.raio)return{tipo:'biqueira',chave:'biqueira'+inventario.pacote};
  if(pertoDoCliente(p))return{tipo:'entrega',chave:'entrega'+inventario.pacote+'x'+clienteLaje.pacotesPedidos};
  const plantaProxima=plantas.find(pl=>!pl.colhida&&Math.hypot(pl.x-p.x,pl.z-p.z)<1.6);
  if(plantaProxima)return{tipo:'planta',planta:plantaProxima};
  return null;
}
const acaoPanel=document.getElementById('acaoPanel'),statusEconomia=document.getElementById('statusEconomia');
// A munição saiu daqui: ela agora é por arma e já aparece no botão de troca e no contador do HUD —
// repetir na mesma linha só gastava espaço de tela no celular.
export function atualizarStatusEconomia(){statusEconomia.textContent=`R$${dinheiro} · 🪴${inventario.vaso} 🌱${inventario.terra} 🌾${inventario.semente} 📦${inventario.pacote} 🛡${inventario.colete}`}
// Serve os itens SIMPLES (vaso/terra/semente/colete). Não serve munição: com `municao` sendo um objeto
// por arma, `inventario['municao']+=12` viraria a string "[object Object]12" — silenciosamente, sem erro.
export function comprar(item,preco,quantidade=1){if(dinheiro>=preco){dinheiro-=preco;inventario[item]+=quantidade;atualizarStatusEconomia();renderizarAcoes();renderizarInventario()}}
// Arma sem bala é compra morta: o jogador sai da loja, aperta o gatilho, não sai tiro e acha que
// quebrou. Por isso a compra já vem com um pacote de munição e equipa a arma na hora.
export function comprarArma(id){
  const p=PRECOS.armas[id];
  if(!p||inventario.armas[id]||dinheiro<p.arma)return;
  dinheiro-=p.arma;inventario.armas[id]=true;inventario.municao[id]+=p.qtd;equiparArma(id);
  atualizarStatusEconomia();renderizarAcoes();renderizarInventario();
}
export function comprarMunicao(id){
  const p=PRECOS.armas[id];
  if(!p||!inventario.armas[id]||dinheiro<p.municao)return;
  dinheiro-=p.municao;inventario.municao[id]+=p.qtd;
  atualizarStatusEconomia();renderizarAcoes();renderizarInventario();
}
// ===== DIÁRIA DA ROÇA: a saída pra quem quebrou =====
// Sem isto dava pra travar o jogo de vez: um ciclo custa R$48 (vaso 8 + terra 6 + semente 34) e ser
// rendido tira R$60. Chegando abaixo de R$48 sem vaso, terra, semente nem pacote, NÃO EXISTIA
// nenhuma forma de ganhar dinheiro — e sem botão de recomeçar, o save ficava morto.
// A espera é o que impede virar estratégia: dá pra ficar batendo enxada, mas rende um terço de plantar.
let proximaDiaria=0;
export function esperaDaDiaria(){return Math.max(0,Math.ceil((proximaDiaria-performance.now()/1000)))}
export function trabalharNaRoca(){
  if(esperaDaDiaria()>0)return false;
  proximaDiaria=performance.now()/1000+PRECOS.fazendaDiariaEspera;
  dinheiro+=PRECOS.fazendaDiaria;
  atualizarStatusEconomia();renderizarAcoes();
  return true;
}
export function venderPacotes(){if(inventario.pacote>0){dinheiro+=inventario.pacote*PRECOS.receptadorPacote;inventario.pacote=0;atualizarStatusEconomia();renderizarAcoes();renderizarInventario()}}
// ===== BIQUEIRA: vender no morro =====
// Paga menos que o Receptador E sobe o procurado. É venda na rua, à vista: a polícia fica sabendo.
// A conta está em PRECOS — a R$26 dois pacotes cobrem o ciclo de R$48 com R$4 de sobra, que é o
// mínimo que ainda é lucro. O Receptador continua sendo o pagamento de verdade, e é o que mantém a
// travessia do mapa (que é o miolo do risco do jogo) valendo a pena.
export function venderNaBiqueira(){
  if(inventario.pacote<=0)return;
  dinheiro+=inventario.pacote*PRECOS.biqueiraPacote;inventario.pacote=0;
  ganchosPolicia.denunciar();
  atualizarStatusEconomia();renderizarAcoes();renderizarInventario();
}
// ===== BAR: a única cura instantânea =====
// A regeneração normal só corre em patrulha (Police.js), então quem apanha no meio de uma
// perseguição não tem como sarar. R$30 é acima da diária da roça de propósito: apanhar precisa
// custar mais que um turno de trabalho, senão levar tiro vira pedágio.
// Comida e água do Mercado: cura parcial, pelo mesmo caminho de cura que o bar usa.
// Entrega na laje: paga mais que o Receptador, e o cliente só leva o que pediu.
export function entregarNaLaje(){
  const quantos=Math.min(inventario.pacote,clienteLaje.pacotesPedidos);
  if(quantos<=0)return;
  inventario.pacote-=quantos;dinheiro+=quantos*PRECOS.entregaLaje;
  entregouAoCliente(quantos);
  atualizarStatusEconomia();renderizarAcoes();renderizarInventario();
}
export function comer(preco,cura){
  if(dinheiro<preco||!jogadorPrecisaCurar())return;
  if(!ganchosPolicia.curar(cura))return;
  dinheiro-=preco;
  atualizarStatusEconomia();renderizarAcoes();
}
export function beberNoBar(){
  if(dinheiro<PRECOS.barDose||!jogadorPrecisaCurar())return;
  if(!ganchosPolicia.curar())return;
  dinheiro-=PRECOS.barDose;
  atualizarStatusEconomia();renderizarAcoes();
}
export function plantarAqui(){
  const alvo=calcularAlvoPlantio();
  if(inventario.vaso>0&&inventario.terra>0&&inventario.semente>0&&alvo&&alvo.valido){
    inventario.vaso--;inventario.terra--;inventario.semente--;
    plantas.push(criarPlanta(alvo.ponto.x,alvo.ponto.y,alvo.ponto.z));
    potGhost.visible=false;
    atualizarStatusEconomia();renderizarAcoes();renderizarInventario();
  }
}
// ===== INVENTÁRIO: o jogador decide onde plantar — abre o inventário parado no local escolhido e planta ali, na hora que quiser.
const invBtn=document.getElementById('invBtn'),invPanel=document.getElementById('invPanel');
let inventarioAberto=false,invEstrutura=null;
export function alternarInventario(){inventarioAberto=!inventarioAberto;renderizarInventario()}
export function isInventarioAberto(){return inventarioAberto}
// Monta o DOM do painel só UMA VEZ enquanto ele fica aberto: reconstruir o innerHTML a cada frame (60x/s)
// destruía e recriava o botão embaixo do dedo do jogador — o toque começava num elemento que sumia antes
// do "click" disparar, e o clique era simplesmente perdido. Agora só o texto/estado dos elementos existentes muda.
function garantirEstruturaInventario(){
  if(invEstrutura)return invEstrutura;
  invPanel.innerHTML='';
  const linVaso=document.createElement('div');linVaso.className='invLinha';invPanel.appendChild(linVaso);
  const linTerra=document.createElement('div');linTerra.className='invLinha';invPanel.appendChild(linTerra);
  const linSemente=document.createElement('div');linSemente.className='invLinha';invPanel.appendChild(linSemente);
  const linPacote=document.createElement('div');linPacote.className='invLinha';invPanel.appendChild(linPacote);
  const linDica=document.createElement('div');linDica.className='invLinha';linDica.style.opacity='.75';linDica.style.fontSize='11px';linDica.textContent='Mire onde quer plantar — o vaso fantasma verde mostra o lugar';invPanel.appendChild(linDica);
  const btnPlantar=document.createElement('button');btnPlantar.onclick=plantarAqui;invPanel.appendChild(btnPlantar);
  const btnFechar=document.createElement('button');btnFechar.className='fechar';btnFechar.textContent='Fechar';btnFechar.onclick=alternarInventario;invPanel.appendChild(btnFechar);
  invEstrutura={linVaso,linTerra,linSemente,linPacote,btnPlantar,btnFechar};
  return invEstrutura;
}
export function renderizarInventario(){
  // A mira de plantio precisa sumir JUNTO com o painel: antes só o potGhost era escondido aqui, e
  // fechar o inventário com ela visível deixava o círculo preso no centro da tela pra sempre.
  if(!inventarioAberto){invPanel.style.display='none';potGhost.visible=false;miraEl.style.display='none';invEstrutura=null;return}
  const el=garantirEstruturaInventario();
  const temIngredientes=inventario.vaso>0&&inventario.terra>0&&inventario.semente>0;
  const alvo=temIngredientes?calcularAlvoPlantio():null;
  const podePlantar=!!(alvo&&alvo.valido);
  let motivo='';
  if(!temIngredientes)motivo='Falta vaso, terra ou semente rara';
  else if(!alvo)motivo='Mire pro chão ou telhado, por perto';
  else if(!alvo.valido)motivo='Muito perto de parede ou de outra muda';
  el.linVaso.textContent=`🪴 Vaso: ${inventario.vaso}`;
  el.linTerra.textContent=`🌱 Terra: ${inventario.terra}`;
  el.linSemente.textContent=`🌾 Semente Rara: ${inventario.semente}`;
  el.linPacote.textContent=`📦 Pacotes: ${inventario.pacote}`;
  el.btnPlantar.textContent=podePlantar?'Plantar Muda onde estou mirando':motivo;
  el.btnPlantar.disabled=!podePlantar;
  invPanel.style.display='flex';
}
invBtn.addEventListener('click',alternarInventario);
export function colher(planta){
  if(planta.estagio===2&&!planta.colhida){
    planta.colhida=true;
    inventario.pacote+=2+Math.floor(Math.random()*2);
    scene.remove(planta.grupo);
    const idx=plantas.indexOf(planta);if(idx>=0)plantas.splice(idx,1);
    atualizarStatusEconomia();renderizarAcoes();
  }
}
// Usado pela polícia (Police.js) quando encontra uma plantação sem o jogador por perto pra defender:
// a muda é perdida, sem pacotes — ao contrário de colher(), que é o jogador colhendo de propósito.
export function confiscarPlanta(planta){
  if(planta.colhida)return;
  planta.colhida=true;
  scene.remove(planta.grupo);
  const idx=plantas.indexOf(planta);if(idx>=0)plantas.splice(idx,1);
  atualizarStatusEconomia();renderizarAcoes();
}
// Multa aplicada pela polícia quando o jogador é rendido num confronto (ver Police.js).
export function aplicarMulta(valor){dinheiro=Math.max(0,dinheiro-valor);atualizarStatusEconomia()}

// ===== ACESSOS PRO SAVE (ver Save.js) =====
// `dinheiro` é `export let`: quem importa enxerga o valor, mas não consegue escrever nele de fora.
// O setter existe por isso, e sanitiza — um save corrompido com "abc" viraria NaN e contaminaria a
// economia inteira de forma silenciosa (NaN sobrevive a toda aritmética seguinte).
export function obterDinheiro(){return dinheiro}
export function definirDinheiro(v){dinheiro=Math.max(0,Math.floor(Number(v)||0));atualizarStatusEconomia()}
// Recria uma muda com a IDADE que ela tinha quando foi salva, e não recém-plantada: o estágio é
// função do tempo desde o plantio, então plantar "do zero" no load faria a plantação inteira voltar
// pra broto e o jogador perderia os 44 s de crescimento a cada vez que abrisse o jogo.
export function restaurarPlanta(x,y,z,idade){
  const p=criarPlanta(x,y,z);
  const anos=Math.max(0,Number(idade)||0);
  p.plantadoEm=performance.now()/1000-anos;
  p.estagio=Math.min(2,Math.floor(anos/TEMPO_ESTAGIO));
  atualizarEstagioPlanta(p);
  plantas.push(p);
  return p;
}
export function idadeDaPlanta(p){return performance.now()/1000-p.plantadoEm}
export function limparPlantas(){for(const p of plantas)scene.remove(p.grupo);plantas.length=0}
let ultimoContextoTipo=null;
// Identidade do painel de ações: o loop só redesenha quando ela muda. Mora aqui, e não inline no
// main, porque cada contexto sabe o que o faz mudar (o estágio da muda, o estado da porta).
export function chaveContexto(ctx){return ctx?(ctx.chave??ctx.tipo+(ctx.planta?ctx.planta.estagio:'')):null}
// Botão de compra: mesmo formato nos 4 polos, desabilitado quando falta dinheiro.
function botaoLoja(rotulo,preco,aoClicar){
  const b=document.createElement('button');b.textContent=rotulo;b.disabled=dinheiro<preco;b.onclick=aoClicar;
  acaoPanel.appendChild(b);return b;
}
export function renderizarAcoes(){
  const ctx=contextoAtual(),tipo=ctx?ctx.tipo:null;
  acaoPanel.innerHTML='';
  if(tipo==='refugio'){
    const r=ctx.refugio;
    const b=document.createElement('button');
    b.textContent=r.aberta?'🚪 Fechar a porta e se esconder':'🚪 Abrir a porta e sair';
    b.onclick=()=>{alternarPortaRefugio(r);renderizarAcoes()};
    acaoPanel.appendChild(b);
    acaoPanel.style.display='flex';
  }else if(tipo==='porteira'){
    const b=document.createElement('button');
    b.textContent=porteiraFazenda.aberta?'🚧 Fechar a porteira':'🚧 Abrir a porteira';
    b.onclick=()=>{alternarPorteira();renderizarAcoes()};
    acaoPanel.appendChild(b);
    acaoPanel.style.display='flex';
  }else if(tipo==='loja'){
    // O Mercado virou o que mercadinho é: COMIDA E ÁGUA. A semente foi pra biqueira — semente se
    // compra na boca. Aqui a cura é barata e PARCIAL, e é o contraponto da dose do bar (cura tudo,
    // R$30): quem está quase cheio come, quem está quase morto bebe no bar.
    const b1=botaoLoja(`🍱 Marmita (R$${PRECOS.mercadoMarmita}) +${PRECOS.mercadoMarmitaCura} de vida`,
      PRECOS.mercadoMarmita,()=>comer(PRECOS.mercadoMarmita,PRECOS.mercadoMarmitaCura));
    const b2=botaoLoja(`💧 Água (R$${PRECOS.mercadoAgua}) +${PRECOS.mercadoAguaCura} de vida`,
      PRECOS.mercadoAgua,()=>comer(PRECOS.mercadoAgua,PRECOS.mercadoAguaCura));
    if(!jogadorPrecisaCurar()){b1.disabled=b2.disabled=true;b1.textContent='🍱 Você está inteiro'}
    acaoPanel.style.display='flex';
  }else if(tipo==='fazenda'){
    // Depósito Rural (oeste, longe): a ÚNICA fonte de vaso e terra.
    botaoLoja(`Comprar Terra (R$${PRECOS.fazendaTerra})`,PRECOS.fazendaTerra,()=>comprar('terra',PRECOS.fazendaTerra));
    botaoLoja(`Comprar Vaso (R$${PRECOS.fazendaVaso})`,PRECOS.fazendaVaso,()=>comprar('vaso',PRECOS.fazendaVaso));
    // Diária: sempre visível, pra o jogador SABER que existe antes de precisar. Um socorro que só
    // aparece quando você já quebrou é um socorro que ninguém encontra.
    {
      const espera=esperaDaDiaria();
      const b=document.createElement('button');
      b.textContent=espera>0?`🌾 Trabalhar na roça (volte em ${espera}s)`:`🌾 Trabalhar na roça (+R$${PRECOS.fazendaDiaria})`;
      b.disabled=espera>0;
      b.onclick=()=>{trabalharNaRoca()};
      acaoPanel.appendChild(b);
    }
    acaoPanel.style.display='flex';
  }else if(tipo==='armas'){
    // Loja de Armas (nordeste): é o polo que sustenta o combate — sem munição não há defesa.
    // Uma linha por arma: compra a arma se ainda não tem, munição DELA se já tem. Rótulo curto porque
    // o acaoPanel é flex-wrap de 94vw — 5 botões de texto longo viram parede de texto no celular.
    for(const id of ORDEM_ARMAS){
      const a=ARMAS[id],p=PRECOS.armas[id];
      if(!inventario.armas[id])botaoLoja(`${a.icone} ${a.nome} (R$${p.arma})`,p.arma,()=>comprarArma(id));
      else botaoLoja(`${a.icone} ${p.qtd} balas (R$${p.municao})`,p.municao,()=>comprarMunicao(id));
    }
    botaoLoja(`🛡 Colete (R$${PRECOS.armasColete})`,PRECOS.armasColete,()=>comprar('colete',PRECOS.armasColete));
    acaoPanel.style.display='flex';
  }else if(tipo==='receptador'){
    // Só ESCOAMENTO. A venda de semente saiu daqui pra semente ter um ponto único (o Mercado): com
    // dois pontos vendendo, o receptador virava atalho e o trajeto até o centro deixava de existir.
    const b2=document.createElement('button');b2.textContent=`Vender ${inventario.pacote} pacote(s) (+R$${inventario.pacote*PRECOS.receptadorPacote})`;b2.disabled=inventario.pacote<=0;b2.onclick=venderPacotes;acaoPanel.appendChild(b2);
    acaoPanel.style.display='flex';
  }else if(tipo==='bar'){
    const b=document.createElement('button');
    const precisa=jogadorPrecisaCurar();
    b.textContent=precisa?`🍺 Dose (R$${PRECOS.barDose}) — cura tudo`:'🍺 Você está inteiro';
    b.disabled=!precisa||dinheiro<PRECOS.barDose;
    b.onclick=beberNoBar;acaoPanel.appendChild(b);
    acaoPanel.style.display='flex';
  }else if(tipo==='biqueira'){
    // A boca é COMPRA e venda: semente na mão e escoamento na hora. É o ponto do morro.
    botaoLoja(`🌱 Comprar Semente (R$${PRECOS.biqueiraSemente})`,PRECOS.biqueiraSemente,
      ()=>comprar('semente',PRECOS.biqueiraSemente));
    const b=document.createElement('button');
    b.textContent=`📦 Vender ${inventario.pacote} na boca (+R$${inventario.pacote*PRECOS.biqueiraPacote}) ⚠`;
    b.disabled=inventario.pacote<=0;
    b.onclick=venderNaBiqueira;acaoPanel.appendChild(b);
    const aviso=document.createElement('span');
    aviso.textContent=`Paga menos que o receptador (R$${PRECOS.receptadorPacote}) e a polícia fica sabendo.`;
    aviso.style.cssText='font-size:11px;opacity:.75;align-self:center';
    acaoPanel.appendChild(aviso);
    acaoPanel.style.display='flex';
  }else if(tipo==='entrega'){
    const quantos=Math.min(inventario.pacote,clienteLaje.pacotesPedidos);
    const b=document.createElement('button');
    b.textContent=quantos>0
      ?`📦 Entregar ${quantos} (+R$${quantos*PRECOS.entregaLaje})`
      :`Ele quer ${clienteLaje.pacotesPedidos} pacote(s) — você tem ${inventario.pacote}`;
    b.disabled=quantos<=0;b.onclick=entregarNaLaje;acaoPanel.appendChild(b);
    acaoPanel.style.display='flex';
  }else if(tipo==='planta'){
    const nomes=['Broto','Vegetativa','Flora (pronta)'],pronta=ctx.planta.estagio===2;
    const b1=document.createElement('button');b1.textContent=pronta?'Colher':`Crescendo: ${nomes[ctx.planta.estagio]}`;b1.disabled=!pronta;b1.onclick=()=>colher(ctx.planta);acaoPanel.appendChild(b1);
    acaoPanel.style.display='flex';
  }else{
    acaoPanel.style.display='none';
  }
  ultimoContextoTipo=chaveContexto(ctx);
}
export function getUltimoContextoTipo(){return ultimoContextoTipo}
atualizarStatusEconomia();
