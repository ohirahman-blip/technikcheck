// Only a neutral offline contact page is cached. No admin pages, credentials,
// customer responses or Supabase requests enter the service-worker cache.
const CACHE='technikcheck-offline-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/customer-offline.html'])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('technikcheck-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.mode!=='navigate'||url.origin!==location.origin||url.pathname.startsWith('/admin'))return;event.respondWith(fetch(event.request).catch(()=>caches.match('/customer-offline.html')));});
