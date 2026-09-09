// ===== EDITOR VISUAL DA HUD =====
import'./GameplayPolish.js';
// v2 separa retrato e paisagem. O v1 aplicava a mesma porcentagem nas duas orientacoes e fazia HUD,
// radar e botoes se empilharem quando o celular girava.
const CHAVE='quintal3d.hud.layout.v2';
// Alertas agora vivem numa pilha automatica e DESTRAVAR mora no menu; nenhum deles deve ser arrastado.
const IDS=['hud','radar','invBtn','acaoPanel','hint','miraCombate','touch','aimBase','jumpBtn','fireBtn','fireSecondary','armaBtn','miraBtn','acelerador','reBtn'];
const editBtn=document.getElementById('hudEditBtn'),panel=document.getElementById('hudEditPanel'),saveBtn=document.getElementById('hudEditSave'),cancelBtn=document.getElementById('hudEditCancel'),resetBtn=document.getElementById('hudEditReset'),closeBtn=document.getElementById('hudEditClose'),statusEl=document.getElementById('hudEditStatus');
const nomes={hud:'Status e vida',radar:'Radar',invBtn:'Inventário',acaoPanel:'Ações',hint:'Dicas',miraCombate:'Mira de combate',touch:'Joystick esquerdo',aimBase:'Área de mira',jumpBtn:'Pular',fireBtn:'Tiro',fireSecondary:'Gatilho esquerdo',armaBtn:'Trocar arma',miraBtn:'Mira',acelerador:'Acelerador',reBtn:'Ré'};
let editando=false,layoutAtual=null,layoutInicial=null,arrasto=null,modoAtual=modoTela();
const elementos=()=>IDS.map(id=>document.getElementById(id)).filter(Boolean);
function modoTela(){return innerWidth>=innerHeight?'landscape':'portrait'}
function padrao(){const out={};for(const el of elementos()){const r=el.getBoundingClientRect();out[el.id]={x:Math.max(0,Math.min(1,r.left/innerWidth)),y:Math.max(0,Math.min(1,r.top/innerHeight))}}return out}
function lerTodos(){try{const v=JSON.parse(localStorage.getItem(CHAVE)||'null');return v&&typeof v==='object'?v:{}}catch(e){return{}}}
function validar(layout){if(!layout||typeof layout!=='object')return null;const out={};for(const el of elementos()){const p=layout[el.id];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))out[el.id]={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))}}return Object.keys(out).length?out:null}
function ler(){return validar(lerTodos()[modoTela()])}
function aplicar(layout){for(const el of elementos()){const p=layout?.[el.id];if(!p)continue;el.style.left=`${p.x*100}%`;el.style.top=`${p.y*100}%`;el.style.right='auto';el.style.bottom='auto';el.style.transform='translate(0,0)'}}
function limparAplicacao(){for(const el of elementos()){el.style.removeProperty('left');el.style.removeProperty('top');el.style.removeProperty('right');el.style.removeProperty('bottom');el.style.removeProperty('transform')}}
function aplicarModoAtual(){limparAplicacao();const salvo=ler();if(salvo)aplicar(salvo);modoAtual=modoTela()}
function mensagem(t){if(statusEl)statusEl.textContent=t;clearTimeout(mensagem._t);mensagem._t=setTimeout(()=>{if(statusEl)statusEl.textContent='Arraste qualquer elemento para reorganizar a HUD'},2200)}
function clonar(l){return JSON.parse(JSON.stringify(l))}
function iniciarArrasto(e,el){if(!editando)return;e.preventDefault();e.stopPropagation();el.setPointerCapture?.(e.pointerId);const r=el.getBoundingClientRect();arrasto={el,id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};el.classList.add('hud-edit-active');mensagem(`Editando: ${nomes[el.id]||el.id}`)}
function moverArrasto(e){if(!arrasto||e.pointerId!==arrasto.id)return;e.preventDefault();const el=arrasto.el;const r=el.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);const x=Math.max(0,Math.min(innerWidth-w,e.clientX-arrasto.dx));const y=Math.max(0,Math.min(innerHeight-h,e.clientY-arrasto.dy));layoutAtual[el.id]={x:x/innerWidth,y:y/innerHeight};aplicar({[el.id]:layoutAtual[el.id]})}
function terminarArrasto(e){if(!arrasto||e.pointerId!==arrasto.id)return;arrasto.el.classList.remove('hud-edit-active');arrasto=null}
function marcarElementos(on){for(const el of elementos()){el.classList.toggle('hud-editable',on);if(on){el.addEventListener('pointerdown',el._hudDown=e=>iniciarArrasto(e,el),true);el.addEventListener('pointermove',el._hudMove=moverArrasto,true);el.addEventListener('pointerup',el._hudUp=terminarArrasto,true);el.addEventListener('pointercancel',el._hudUp,true)}else{el.removeEventListener('pointerdown',el._hudDown,true);el.removeEventListener('pointermove',el._hudMove,true);el.removeEventListener('pointerup',el._hudUp,true);el.removeEventListener('pointercancel',el._hudUp,true);el.classList.remove('hud-edit-active')}}}
function fechar(){editando=false;document.body.classList.remove('hud-editing');panel?.classList.remove('open');marcarElementos(false);arrasto=null;dispatchEvent(new Event('hudeditingchange'))}
function abrir(){if(editando)return;layoutInicial=clonar(ler()||padrao());layoutAtual=clonar(layoutInicial);aplicar(layoutAtual);editando=true;document.body.classList.add('hud-editing');panel?.classList.add('open');marcarElementos(true);dispatchEvent(new Event('hudeditingchange'));mensagem(`Layout ${modoTela()==='portrait'?'retrato':'paisagem'}: arraste para reorganizar`)}
function salvar(){try{const todos=lerTodos();todos[modoTela()]=layoutAtual;localStorage.setItem(CHAVE,JSON.stringify(todos));layoutInicial=clonar(layoutAtual);mensagem('Layout desta orientação salvo');setTimeout(fechar,450)}catch(e){mensagem('Não foi possível salvar o layout')}}
function cancelar(){limparAplicacao();aplicar(layoutInicial||padrao());fechar()}
function restaurar(){limparAplicacao();layoutAtual=padrao();aplicar(layoutAtual);mensagem('Padrão desta orientação aplicado; clique em Salvar')}
editBtn?.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();abrir()});saveBtn?.addEventListener('click',salvar);cancelBtn?.addEventListener('click',cancelar);closeBtn?.addEventListener('click',cancelar);resetBtn?.addEventListener('click',restaurar);
addEventListener('keydown',e=>{if(e.code==='Escape'&&editando){e.preventDefault();cancelar()}});
let resizeT=0;addEventListener('resize',()=>{clearTimeout(resizeT);resizeT=setTimeout(()=>{if(editando&&layoutAtual){aplicar(layoutAtual);return}if(modoTela()!==modoAtual)aplicarModoAtual()},120)});
aplicarModoAtual();
export function isHUDEditando(){return editando}
export function iniciarEditorHUD(){if(!editando)abrir()}
