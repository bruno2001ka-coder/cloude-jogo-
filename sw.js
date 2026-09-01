const CACHE_NAME = 'quintal3d-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/main.js',
  './src/core.js',
  './src/Bullets.js',
  './src/Camera.js',
  './src/Economy.js',
  './src/Environment.js',
  './src/HealthBar.js',
  './src/Input.js',
  './src/Materials.js',
  './src/NPCs.js',
  './src/NavMesh.js',
  './src/Personagem.js',
  './src/Physics.js',
  './src/Player.js',
  './src/Poles.js',
  './src/Police.js',
  './src/Save.js',
  './src/Skyline.js',
  './src/Terrain.js',
  './src/UI.js',
  './src/Weapons.js',
  './src/WorldGenerator.js',
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando arquivos estáticos...');
      return cache.addAll(ASSETS_TO_CACHE).then(() => {
        console.log('[SW] Arquivos cacheados com sucesso!');
      });
    }).catch((error) => {
      console.error('[SW] Erro ao cachear arquivos:', error);
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Removendo cache antigo:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      console.log('[SW] Service Worker ativado!');
      return self.clients.claim();
    })
  );
});

// Interceptação de requisições (estratégia: cache primeiro, depois rede)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((networkResponse) => {
        // Se for uma requisição válida, salva no cache
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback para offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
