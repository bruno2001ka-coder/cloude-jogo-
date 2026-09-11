// Service worker do Quintal 3D.
// Navegacao e codigo usam rede primeiro SEM cache HTTP para cada release aparecer imediatamente.
// Assets pesados continuam cache-first para o PWA abrir rapido e funcionar offline.
const VERSAO='quintal3d-v90-rural-farms-046';
const CASCA=[
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icones/icone-192.png',
  './assets/icones/icone-512.png',
];

self.addEventListener('install',ev=>{
  ev.waitUntil((async()=>{
    const cache=await caches.open(VERSAO);
    await Promise.all(CASCA.map(u=>cache.add(new Request(u,{cache:'reload'})).catch(()=>{})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate',ev=>{
  ev.waitUntil((async()=>{
    for(const nome of await caches.keys())if(nome!==VERSAO)await caches.delete(nome);
    await self.clients.claim();
    const clientes=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const cliente of clientes){try{await cliente.navigate(cliente.url)}catch(e){}}
  })());
});

async function guardar(req,resp){
  try{if(resp&&(resp.ok||resp.type==='opaque'))(await caches.open(VERSAO)).put(req,resp.clone())}catch(e){}
  return resp;
}
async function buscarFresco(req){return fetch(req,{cache:'no-store'})}

self.addEventListener('fetch',ev=>{
  const req=ev.request;if(req.method!=='GET')return;
  if(req.mode==='navigate'){
    ev.respondWith((async()=>{try{return await guardar(req,await buscarFresco(req))}catch(e){return(await caches.match(req))||(await caches.match('./index.html'))||Response.error()}})());return;
  }
  const pathname=new URL(req.url).pathname,ehCodigo=/\.(js|css|webmanifest)$/i.test(pathname);
  if(ehCodigo){ev.respondWith((async()=>{try{return await guardar(req,await buscarFresco(req))}catch(e){return(await caches.match(req))||Response.error()}})());return;}
  ev.respondWith((async()=>{const guardado=await caches.match(req);if(guardado){fetch(req).then(r=>guardar(req,r)).catch(()=>{});return guardado}try{return await guardar(req,await fetch(req))}catch(e){return Response.error()}})());
});
