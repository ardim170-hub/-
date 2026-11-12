/* 앱 화면을 휴대폰에 저장해 두고 빠르게 연다.
 * 화면(index.html)은 늘 새 버전을 먼저 받아 보고, 인터넷이 안 되면 저장해 둔 것으로 연다.
 * 지도·엑셀 같은 라이브러리와 아이콘은 저장해 둔 것을 먼저 쓴다. 구글 로그인·데이터(시트) 요청은 저장하지 않는다. */
const CACHE = "ardim-app-202611121106";
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const LIB = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  if (url.origin === location.origin || LIB.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; });
      return hit || net;
    }));
  }
});
