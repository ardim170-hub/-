/* 앱 화면을 휴대폰에 저장해 두고 빠르게 연다.
 * 화면(index.html)은 저장해 둔 것으로 바로 열고, 뒤에서 새 버전을 받아 둔다(다음에 열 때 적용, 새 버전이면 화면에 알림).
 * 저장해 둔 것이 없으면 인터넷에서 받는다. 지도·엑셀 같은 라이브러리와 아이콘도 저장해 둔 것을 먼저 쓴다.
 * 구글 로그인·데이터(시트) 요청은 저장하지 않는다. */
const CACHE = 'ardim-app-v1';
const SHELL = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const LIB = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;
/** 새 화면 받기: 받은 것이 저장해 둔 것과 다르면 저장하고 열린 화면에 알린다 */
async function updateIndex() {
  const cache = await caches.open(CACHE);
  const res = await fetch('index.html', { cache: 'no-store' });
  if (!res.ok) return res;
  const fresh = await res.clone().text();
  const old = await cache.match('index.html');
  const same = old && (await old.text()) === fresh;
  if (!same) {
    await cache.put('index.html', res.clone());
    if (old) (await self.clients.matchAll()).forEach(c => c.postMessage({ type: 'app-updated' }));
  }
  return res;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(caches.match('index.html').then(hit => {
      const net = updateIndex();
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => caches.match('index.html'));
    }));
    return;
  }
  if (url.origin === location.origin || LIB.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    }));
  }
});
