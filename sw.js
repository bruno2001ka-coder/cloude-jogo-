// Service worker do Quintal 3D — é ele que torna o jogo instalável (PWA) e o faz abrir offline
// depois da primeira visita.
//
// Três políticas, uma por tipo de coisa, e o motivo de cada uma:
//
//  · NAVEGAÇÃO (abrir o jogo) → REDE PRIMEIRO, cache como rede de segurança. Se fosse cache primeiro,
//    quem instalasse o jogo ficaria preso numa versão velha até limpar os dados do site — e este jogo
//    é atualizado a cada push.
//  · CÓDIGO E ASSETS DO PRÓPRIO SITE (src/*.js, assets/*) → CACHE PRIMEIRO, com atualização em segundo
//    plano. São ~2 MB entre modelos, texturas e HDRI: buscar tudo de novo a cada abertura é o que faz
//    um jogo web parecer lento no celular. A cópia nova entra pro próximo carregamento.
//  · CDN DO THREE.JS (outro domínio) → CACHE PRIMEIRO também, mas a resposta vem OPACA (o navegador não
//    deixa ler status nem corpo de outro domínio sem CORS). Opaca serve pra guardar e devolver, então
//    dá pra abrir offline; o que NÃO dá é saber se deu 404 — por isso ela nunca substitui uma cópia
//    boa que já esteja no cache.
//
// A versão no nome do cache é o que expulsa o cache velho: mudou o número, `activate` apaga tudo que
// não é dele. Sem isso, arquivo removido do projeto continuaria vivo no celular de quem já instalou.
const VERSAO='quintal3d-v1';
const CASCA=[
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icones/icone-192.png',
  './assets/icones/icone-512.png',
];

self.addEventListener('install',ev=>{
  // `addAll` falha inteiro se UM arquivo falhar, e aí a instalação toda é abortada. Um por um, com
  // cada falha engolida: o jogo instala mesmo que um ícone tenha sumido do servidor.
  ev.waitUntil((async()=>{
    const cache=await caches.open(VERSAO);
    await Promise.all(CASCA.map(u=>cache.add(u).catch(()=>{})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate',ev=>{
  ev.waitUntil((async()=>{
    for(const nome of await caches.keys())if(nome!==VERSAO)await caches.delete(nome);
    await self.clients.claim();
  })());
});

// Guarda no cache sem deixar a falha derrubar a resposta: cache cheio ou modo privado não podem
// quebrar o jogo, só deixar de acelerar.
async function guardar(req,resp){
  try{
    if(resp&&(resp.ok||resp.type==='opaque'))(await caches.open(VERSAO)).put(req,resp.clone());
  }catch(e){}
  return resp;
}

self.addEventListener('fetch',ev=>{
  const req=ev.request;
  // POST, range de vídeo e afins passam direto: cache de GET é a única coisa que faz sentido aqui.
  if(req.method!=='GET')return;

  if(req.mode==='navigate'){
    ev.respondWith((async()=>{
      try{return await guardar(req,await fetch(req))}
      catch(e){return (await caches.match(req))||(await caches.match('./index.html'))||Response.error()}
    })());
    return;
  }

  ev.respondWith((async()=>{
    const guardado=await caches.match(req);
    if(guardado){
      // Atualiza por trás sem segurar a resposta. `catch` vazio de propósito: estar offline é normal
      // aqui, e uma promessa rejeitada solta virava erro no console a cada arquivo.
      fetch(req).then(r=>guardar(req,r)).catch(()=>{});
      return guardado;
    }
    try{return await guardar(req,await fetch(req))}
    catch(e){return Response.error()}
  })());
});
