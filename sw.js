// 改动 index.html 后，把版本号 +1；v10 起会自动发现并切换新版
const V = 'beishu-v10';
const FILES = ['./', './index.html', './manifest.json',
               './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  const freshFiles = FILES.map(f=>new Request(f,{cache:'reload'}));
  e.waitUntil(caches.open(V).then(c => c.addAll(freshFiles)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('beishu-') && k !== V)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({type:'window'}))
      .then(cs => Promise.all(cs.map(c=>typeof c.navigate==='function'
        ? c.navigate(c.url).catch(()=>{}) : Promise.resolve())))
  );
});

self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// 页面联网时优先取最新版；断网时退回本地缓存。图标等静态文件仍缓存优先。
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if(url.origin !== self.location.origin) return;

  if(e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(res=>{
        if(res && res.ok){
          const copy = res.clone();
          caches.open(V).then(c=>c.put('./index.html',copy));
        }
        return res;
      }).catch(()=>caches.match('./index.html').then(hit=>hit || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(V).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
