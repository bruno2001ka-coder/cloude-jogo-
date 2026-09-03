// Efeitos sonoros curtos do jogo. Não usa arquivos externos: evita peso extra e falhas de CDN.
let contexto=null;

function obterContexto(){
  try{
    const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!AudioContext)return null;
    contexto??=new AudioContext();
    if(contexto.state==='suspended')contexto.resume().catch(()=>{});
    return contexto;
  }catch(e){
    // Áudio é opcional: nenhuma falha sonora pode interromper o gameplay.
    return null;
  }
}

function tom(ctx,quando,duracao,frequencia,volume,tipo='square'){
  const oscilador=ctx.createOscillator();
  const ganho=ctx.createGain();
  oscilador.type=tipo;oscilador.frequency.setValueAtTime(frequencia,quando);
  ganho.gain.setValueAtTime(.0001,quando);
  ganho.gain.exponentialRampToValueAtTime(volume,quando+.006);
  ganho.gain.exponentialRampToValueAtTime(.0001,quando+duracao);
  oscilador.connect(ganho);ganho.connect(ctx.destination);
  oscilador.start(quando);oscilador.stop(quando+duracao+.02);
}

export function tocarSomEquiparColete(){
  const ctx=obterContexto();
  if(!ctx)return;
  const agora=ctx.currentTime;
  // Dois cliques curtos simulam a fivela e o encaixe da placa, sem ser um som agressivo.
  tom(ctx,agora,.075,155,.045,'square');
  tom(ctx,agora+.085,.11,235,.035,'triangle');
}
