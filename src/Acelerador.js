// ===== A ALAVANCA DE ACELERADOR =====
//
// "vamos colocar um acelerador no lado direito, para mim controlar a velocidade, do carro e moto,
//  tipo eu escolho a velocidade arrastando o acelerador" — e, na mesma mensagem: "não quero que o
//  análogo freia não enquanto tô virando".
//
// As duas coisas são a mesma coisa. O acelerador vinha do EIXO Y DO ANALÓGICO, e o analógico é um só:
// empurrar na diagonal pra virar encolhe a componente pra frente. Medido no jogo: dedo cheio reto dava
// 14 m/s, dedo cheio na diagonal dava 9,9 m/s. Virar CUSTAVA velocidade, e não tinha como não custar
// enquanto as duas funções dividissem um dedo.
//
// Com alavanca própria, o analógico esquerdo passa a ser SÓ DIREÇÃO e o problema deixa de existir por
// construção — não é um ajuste, é a causa removida.
//
// ===== ELA SEGURA A POSIÇÃO, E ISSO FOI ESCOLHA DELE =====
// "arrastar e por tipo 10k 15k 20k 40k 50k": a alavanca fica onde ele deixou, e o carro cruza naquela
// velocidade sem dedo nenhum encostado. É o que libera os dois polegares pra dirigir e olhar em volta.
// O risco de uma alavanca que segura é esquecer engatado, e ele é tratado em dois lugares: o número
// em km/h fica escrito nela o tempo todo, e `configurar(null)` zera tudo ao descer do veículo.
//
// A RÉ NÃO ESTÁ AQUI. Ele pediu "alavanca só pra frente + botão de ré": o curso inteiro serve pra
// velocidade de frente, que é onde a precisão importa, e a ré é um botão de segurar à parte.

// A escada que ele pediu, em km/h. Cada degrau vira uma marca desenhada e um ÍMÃ: chegando perto, a
// alavanca gruda no valor exato — é o que faz "põe 20k" ser um gesto e não uma pontaria.
const ESCADA=[10,15,20,30,40,50];
const IMA=.045;// distância (em fração do curso) pra grudar numa marca

const el=document.getElementById('acelerador');
const trilho=document.getElementById('acelTrilho');
const preenche=document.getElementById('acelPreenche');
const puxador=document.getElementById('acelPuxador');
const valorEl=document.getElementById('acelValor');
const marcasEl=document.getElementById('acelMarcas');
const reBtn=document.getElementById('reBtn');

let fracao=0;      // 0..1 do curso
let maxKmh=0;      // 0 = sem veículo; define a escala e quais marcas cabem
let arrastando=null;
let re=false;

export const valorAcelerador=()=>fracao;
export const reSegurada=()=>re;

function desenhar(){
  const pct=(fracao*100).toFixed(1);
  if(preenche)preenche.style.height=`${pct}%`;
  if(puxador)puxador.style.bottom=`calc(${pct}% - 13px)`;
  if(valorEl)valorEl.textContent=maxKmh?`${Math.round(fracao*maxKmh)}`:'0';
}

// As marcas mudam com o veículo: o carro vai a 50 km/h e a moto a 40, então a escada é filtrada pelo
// teto de quem está sendo dirigido. Marca acima do teto seria uma marca que não dá pra alcançar.
function montarMarcas(){
  if(!marcasEl)return;
  marcasEl.textContent='';
  if(!maxKmh)return;
  for(const kmh of ESCADA){
    if(kmh>maxKmh+.5)continue;
    const m=document.createElement('div');
    m.className='acelMarca';
    m.style.bottom=`${(kmh/maxKmh)*100}%`;
    m.dataset.rotulo=String(kmh);
    marcasEl.appendChild(m);
  }
}

function daPosicao(e){
  const r=trilho.getBoundingClientRect();
  // De baixo (0) pra cima (1): a leitura natural de acelerador é "mais alto, mais rápido".
  let f=(r.bottom-e.clientY)/r.height;
  f=Math.max(0,Math.min(1,f));
  // Ímã nas marcas. Sem isto, escolher exatamente 20 km/h num polegar de celular é sorte.
  if(maxKmh)for(const kmh of ESCADA){
    if(kmh>maxKmh+.5)continue;
    const alvo=kmh/maxKmh;
    if(Math.abs(f-alvo)<IMA){f=alvo;break}
  }
  // O zero também é ímã: parar tem que ser fácil de acertar.
  if(f<IMA)f=0;
  fracao=f;desenhar();
}

if(trilho){
  trilho.addEventListener('pointerdown',e=>{
    e.preventDefault();arrastando=e.pointerId;
    trilho.setPointerCapture?.(e.pointerId);daPosicao(e);
  });
  trilho.addEventListener('pointermove',e=>{if(arrastando===e.pointerId)daPosicao(e)});
  const soltar=e=>{if(arrastando===e.pointerId)arrastando=null};
  for(const ev of['pointerup','pointercancel','lostpointercapture'])trilho.addEventListener(ev,soltar);
}

// RÉ: botão de SEGURAR, não de alternar. Alternar deixaria o carro em ré sem nada na tela dizendo
// isso — e a ré é justamente a marcha em que ninguém está olhando pra trás.
if(reBtn){
  const liga=e=>{e.preventDefault();re=true;reBtn.classList.add('ativo')};
  const desliga=()=>{re=false;reBtn.classList.remove('ativo')};
  reBtn.addEventListener('pointerdown',liga);
  for(const ev of['pointerup','pointercancel','lostpointercapture','pointerleave'])reBtn.addEventListener(ev,desliga);
}

// Chamado pelo main quando monta ou desce. `maximoKmh` nulo = sem veículo: some da tela e ZERA, que é
// a rede contra a alavanca ficar engatada de uma pilotagem pra outra.
export function configurar(maximoKmh){
  const tinha=maxKmh;
  maxKmh=maximoKmh||0;
  if(!maxKmh){fracao=0;re=false;arrastando=null;reBtn?.classList.remove('ativo')}
  if(el)el.hidden=!maxKmh;
  if(reBtn)reBtn.hidden=!maxKmh;
  if(maxKmh!==tinha)montarMarcas();
  desenhar();
}

// Enquanto dirige, o resto dos botões some da tela ("quero um Hub limpo sem aparecer coisas
// desnecessária na hora de dirigir"). Quem esconde é o CSS, por uma classe no body: escrever
// `display` na mão aqui brigaria com o Police.js, que reescreve o estilo do botão de tiro todo quadro.
export function modoDirigindo(ligado){
  document.body.classList.toggle('dirigindo',!!ligado);
}

configurar(null);
