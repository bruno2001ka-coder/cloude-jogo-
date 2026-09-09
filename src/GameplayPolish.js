// ===== PASSE DE QUALIDADE DE GAMEPLAY / HUD =====
// Correcoes aditivas e de baixo risco: nao toca em fisica, economia, IA ou mapa.
const style=document.createElement('style');
style.textContent=`
/* Empilha mensagens importantes em vez de deixar quatro avisos brigando pelo mesmo espaco. */
#gameAlertStack{position:fixed;z-index:18;top:12px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;width:min(46vw,520px);pointer-events:none}
#gameAlertStack>#alertaPolicia,#gameAlertStack>#atencaoPolicia,#gameAlertStack>#refugioIndicador,#gameAlertStack>#avisoPolicia{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;max-width:100%;width:max-content;white-space:normal;text-align:center;margin:0}
#gameAlertStack>#avisoPolicia{width:min(100%,520px)}

/* DESTRAVAR e ferramenta de recuperacao, nao botao de jogo. */
#destravarBtn{display:none!important}
#menuPanel>#destravarBtn{display:flex!important;position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;width:100%;min-width:150px;min-height:44px}

/* O menu nao deve ficar em cima do radar. */
#menuBtn{right:154px;top:14px}
#menuPanel{right:154px;top:66px}

/* Mantem a HUD legivel sem cobrir metade do cenario. */
#hud{max-width:min(48vw,520px);overflow:hidden}
#hint{transition:opacity .25s ease}
body.dicas-minimas #hint{opacity:0;pointer-events:none}

@media(pointer:coarse){
  #hint{font-size:9px;line-height:1.25;max-width:48vw;padding:7px 10px}
}

@media(orientation:portrait){
  #hud{max-width:calc(100vw - 142px);padding:9px 10px;font-size:11px;line-height:1.45;border-radius:10px}
  #barraVidaTrilho{width:min(150px,100%)}
  #radar{width:116px;height:116px;top:10px;right:10px}
  #menuBtn{top:134px;right:10px;width:44px;height:44px}
  #menuPanel{top:184px;right:10px}
  #gameAlertStack{top:186px;width:calc(100vw - 24px)}

  /* Controles menores, mas ainda acima do alvo de toque minimo. */
  #touch{width:152px;height:152px;left:14px;bottom:22px}
  #stick{width:58px;height:58px;margin:-29px}
  #jumpBtn{width:82px;height:82px;right:14px;bottom:24px;font-size:12px}
  #fireBtn{width:68px;height:68px;right:20px;bottom:118px;font-size:19px}
  #miraBtn{width:54px;height:54px;right:94px;bottom:125px;font-size:19px}
  #armaBtn{width:56px;height:56px;right:20px;bottom:196px}
  #invBtn{width:54px;height:54px;left:16px;bottom:188px}
  #fireSecondary{width:50px;height:50px;left:14px;top:auto;bottom:254px}
  #hint{left:auto;right:10px;bottom:112px;transform:none;max-width:42vw}
}

@media(orientation:landscape) and (max-height:520px){
  #hud{max-width:36vw;padding:8px 10px;font-size:11px}
  #radar{width:116px;height:116px}
  #gameAlertStack{top:10px;width:min(40vw,460px)}
  #menuBtn{right:140px;top:10px}
  #menuPanel{right:140px;top:60px}
}
`;
document.head.appendChild(style);

// Alertas compartilham um unico corredor visual. O jogo continua controlando display/texto de cada um.
const stack=document.createElement('div');
stack.id='gameAlertStack';
for(const id of['alertaPolicia','atencaoPolicia','refugioIndicador','avisoPolicia']){
  const el=document.getElementById(id);if(el)stack.appendChild(el);
}
document.body.appendChild(stack);

// Destravar fica disponivel, mas sai da tela principal.
const menu=document.getElementById('menuPanel'),destravar=document.getElementById('destravarBtn');
if(menu&&destravar){destravar.textContent='🛠 Destravar';menu.appendChild(destravar)}

// No celular as instrucoes grandes somem depois de alguns segundos de jogo; qualquer toque acelera isso.
if(matchMedia('(pointer:coarse)').matches){
  const minimizar=()=>document.body.classList.add('dicas-minimas');
  setTimeout(minimizar,12000);
  addEventListener('pointerdown',()=>setTimeout(minimizar,3500),{once:true,passive:true});
}
