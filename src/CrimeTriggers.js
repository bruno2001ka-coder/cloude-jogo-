// ===== GATILHOS DE CRIME =====
// Percepção visual não é, por si só, motivo de perseguição. Este módulo concentra os eventos
// temporários que transformam uma patrulha passiva em uma resposta policial.
const DURACAO_ALERTA_TIRO=6;
const DURACAO_COLISAO=2.5;
const DURACAO_ENTREGA=4;

const estado={armaVisivel:false,tiro:null,colisaoAte:0,entregaAte:0};
const agora=()=>performance.now()/1000;

export function definirArmaVisivel(visivel){estado.armaVisivel=!!visivel}
export function alertarDisparoProximo(x=0,z=0,duracao=DURACAO_ALERTA_TIRO){estado.tiro={x,z,ate:Math.max(estado.tiro?.ate||0,agora()+duracao),raio:24}}
export function alertarColisaoPolicial(duracao=DURACAO_COLISAO){estado.colisaoAte=Math.max(estado.colisaoAte,agora()+duracao)}
export function alertarEntregaIlegal(duracao=DURACAO_ENTREGA){estado.entregaAte=Math.max(estado.entregaAte,agora()+duracao)}
export function crimeAtivo(t=agora(),pos=null){
  const tiroAtivo=estado.tiro&&estado.tiro.ate>t&&(!pos||Math.hypot(pos.x-estado.tiro.x,pos.z-estado.tiro.z)<=estado.tiro.raio);
  return estado.armaVisivel||tiroAtivo||estado.colisaoAte>t||estado.entregaAte>t;
}
export function estadoDosGatilhos(t=agora()){
  return{hasWeaponEquipped:estado.armaVisivel,tiroProximo:!!(estado.tiro&&estado.tiro.ate>t),
    colisao:estado.colisaoAte>t,entregaIlegal:estado.entregaAte>t};
}
export function limparGatilhos(){estado.armaVisivel=false;estado.tiro=null;estado.colisaoAte=0;estado.entregaAte=0}
