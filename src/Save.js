// ===== SAVE / LOAD AUTOMÁTICO =====
// Salva dinheiro, inventário, armas e munição, plantações (com a IDADE de cada muda), nível de
// procurado e a posição do jogador. Grava sozinho e carrega sozinho ao abrir; sem save, o jogo
// começa do zero.
//
// A exigência difícil é "não pode corromper". localStorage é síncrono e por-chave, mas isso NÃO
// basta: o navegador do celular mata a aba a qualquer momento (o jogador troca de app, chega uma
// ligação), a cota pode estourar no meio, e o próprio objeto pode ser montado pela metade. Então:
//
//   1. DOIS SLOTS alternados (A/B) com número de sequência. Toda gravação vai pro slot MAIS VELHO,
//      nunca por cima do mais novo — se a aba morrer no meio da escrita, o save anterior está
//      intacto no outro slot. É double buffering, o mesmo truque de quem grava em cartão de memória.
//   2. CHECKSUM sobre o texto. Escrita truncada ou byte trocado deixa de bater e o slot é descartado
//      em vez de virar um save meio-válido, que é o pior dos mundos: o jogo abre e o dinheiro é NaN.
//   3. VERSÃO do formato, pra um save antigo ser ignorado em vez de aplicado torto.
//   4. Toda leitura é VALIDADA campo a campo, com padrão pra cada um. Nada de `Object.assign` no
//      inventário: um save adulterado com {municao:"abc"} contaminaria a economia com NaN, e NaN
//      sobrevive a toda aritmética seguinte sem nunca lançar erro.
//   5. NADA aqui pode lançar exceção. Em aba anônima, com storage desativado, o simples ACESSO a
//      localStorage já joga — por isso até o teste de disponibilidade é try/catch.
import*as Economia from'./Economy.js';
import*as Jogador from'./Player.js';
import*as Armas from'./Weapons.js';
import*as Policia from'./Police.js';

const CHAVE_A='quintal3d.save.a',CHAVE_B='quintal3d.save.b';
const VERSAO=1;
const INTERVALO_AUTOSAVE=5;// segundos

// Storage pode simplesmente não existir (aba anônima, cookies bloqueados, WebView restrita).
// Descobrimos UMA vez, e o jogo segue normalmente sem save em vez de quebrar.
const armazem=(()=>{
  try{const t='quintal3d.teste';localStorage.setItem(t,'1');localStorage.removeItem(t);return localStorage}
  catch(e){return null}
})();
export function saveDisponivel(){return !!armazem}

// djb2: barato, sem dependência, e suficiente pra pegar escrita truncada ou byte trocado — não é
// segurança, é integridade. Em base 36 pra ocupar pouco espaço.
function somaVerificacao(txt){
  let h=5381;
  for(let i=0;i<txt.length;i++)h=((h<<5)+h+txt.charCodeAt(i))>>>0;
  return h.toString(36);
}

// ===== VALIDADORES =====
// Cada um devolve SEMPRE um valor utilizável. É o que garante que um save adulterado degrade pro
// padrão em vez de contaminar o jogo.
const inteiro=(v,padrao=0,min=0,max=1e9)=>{const n=Math.floor(Number(v));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):padrao};
const numero=(v,padrao=0,min=-1e6,max=1e6)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):padrao};
const booleano=v=>v===true;

function montarEstado(){
  const inv=Economia.inventario;
  const municao={},armas={};
  for(const id of Armas.ORDEM_ARMAS){
    municao[id]=inteiro(inv.municao?.[id],0);
    armas[id]=booleano(inv.armas?.[id]);
  }
  armas.pistola=true;// a pistola é a arma inicial: nunca some, nem com save adulterado
  return{
    v:VERSAO,
    d:inteiro(Economia.obterDinheiro(),0),
    inv:{vaso:inteiro(inv.vaso),terra:inteiro(inv.terra),semente:inteiro(inv.semente),
      pacote:inteiro(inv.pacote),colete:Math.min(1,inteiro(inv.colete))},
    armas,municao,
    arma:Armas.idArmaEquipada?.()||'pistola',
    pol:Policia.estadoPoliciaParaSave?.()??null,
    pos:{x:numero(Jogador.player.position.x),y:numero(Jogador.player.position.y),z:numero(Jogador.player.position.z)},
    // Idade, e não o instante do plantio: `performance.now()` reinicia a cada carregamento da
    // página, então gravar o instante faria a muda "nascer no futuro" na sessão seguinte.
    plantas:Economia.plantas.filter(p=>!p.colhida).map(p=>({
      x:numero(p.x),y:numero(p.y),z:numero(p.z),i:numero(Economia.idadeDaPlanta(p),0,0,1e6)})),
  };
}

// ===== GRAVAÇÃO =====
let seqAtual=0;
function lerSlot(chave){
  if(!armazem)return null;
  try{
    const bruto=armazem.getItem(chave);
    if(!bruto)return null;
    const env=JSON.parse(bruto);
    if(!env||typeof env.p!=='string')return null;
    if(somaVerificacao(env.p)!==env.c)return null;// escrita truncada/adulterada: descarta o slot
    const dados=JSON.parse(env.p);
    if(!dados||dados.v!==VERSAO)return null;// formato de outra versão: ignora em vez de aplicar torto
    return{seq:inteiro(env.s,0),dados};
  }catch(e){return null}// JSON quebrado é save inválido, não é erro do jogo
}
export function salvar(){
  if(!armazem)return false;
  try{
    const p=JSON.stringify(montarEstado());
    // Grava no slot MAIS VELHO: se a aba morrer no meio desta escrita, o mais novo continua inteiro.
    const a=lerSlot(CHAVE_A),b=lerSlot(CHAVE_B);
    const seqA=a?a.seq:-1,seqB=b?b.seq:-1;
    seqAtual=Math.max(seqA,seqB,seqAtual)+1;
    const alvo=seqA<=seqB?CHAVE_A:CHAVE_B;
    armazem.setItem(alvo,JSON.stringify({s:seqAtual,c:somaVerificacao(p),p}));
    return true;
  }catch(e){return false}// cota estourada / storage sumiu no meio: o save anterior segue válido
}

// ===== CARGA =====
export function carregar(){
  const a=lerSlot(CHAVE_A),b=lerSlot(CHAVE_B);
  // O mais NOVO que estiver íntegro. Se o mais novo estiver corrompido, cai automaticamente no
  // anterior — que é justamente o motivo de existirem dois slots.
  const escolhido=(!a&&!b)?null:(!b||(a&&a.seq>=b.seq))?a:b;
  if(!escolhido)return false;
  seqAtual=escolhido.seq;
  const s=escolhido.dados;
  try{
    Economia.definirDinheiro(s.d);
    const inv=Economia.inventario;
    inv.vaso=inteiro(s.inv?.vaso);inv.terra=inteiro(s.inv?.terra);
    inv.semente=inteiro(s.inv?.semente);inv.pacote=inteiro(s.inv?.pacote);inv.colete=Math.min(1,inteiro(s.inv?.colete));
    for(const id of Armas.ORDEM_ARMAS){
      inv.armas[id]=booleano(s.armas?.[id]);
      inv.municao[id]=inteiro(s.municao?.[id],0);
    }
    inv.armas.pistola=true;
    // Só equipa arma que o jogador REALMENTE tem: um save adulterado dizendo "metralhadora" sem a
    // arma comprada deixaria o HUD apontando pra uma arma inexistente.
    Armas.equiparArma?.(inv.armas[s.arma]?s.arma:'pistola');
    Policia.aplicarEstadoPoliciaDoSave?.(s.pol);
    if(s.pos){
      Jogador.player.position.set(numero(s.pos.x,0,-120,120),numero(s.pos.y,0,-50,200),numero(s.pos.z,8,-120,120));
      Jogador.destravarJogador?.(true);// se a posição salva ficou dentro de geometria, sai de lá
    }
    Economia.limparPlantas();
    if(Array.isArray(s.plantas))for(const p of s.plantas.slice(0,40))// teto: save adulterado com 10 mil mudas travaria o jogo
      Economia.restaurarPlanta(numero(p.x,0,-120,120),numero(p.y,0,-50,200),numero(p.z,0,-120,120),numero(p.i,0,0,1e6));
    Economia.atualizarStatusEconomia();
    Economia.renderizarAcoes();
    return true;
  }catch(e){
    // Chegou aqui = save estruturalmente válido mas com algo inesperado. O jogo continua rodando
    // com o que já foi aplicado; melhor um estado parcial do que uma tela preta.
    return false;
  }
}
export function apagarSave(){try{armazem?.removeItem(CHAVE_A);armazem?.removeItem(CHAVE_B);return true}catch(e){return false}}

// ===== AUTOMÁTICO =====
let acumulado=0;
export function atualizarSave(dt){
  acumulado+=dt;
  if(acumulado<INTERVALO_AUTOSAVE)return;
  acumulado=0;salvar();
}
// No celular a aba é morta sem aviso quando o jogador troca de app — `visibilitychange` é o último
// momento garantido de rodar código, e é por isso que ele importa mais que `beforeunload` (que o
// Safari em iOS frequentemente não dispara).
export function instalarSalvamentoAoSair(){
  addEventListener('visibilitychange',()=>{if(document.hidden)salvar()});
  addEventListener('pagehide',salvar);
  addEventListener('beforeunload',salvar);
}
