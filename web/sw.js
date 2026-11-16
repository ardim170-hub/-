/* 앱 화면을 휴대폰에 저장해 두고 빠르게 연다.
 * 화면(index.html)은 저장해 둔 것으로 바로 열고, 뒤에서 새 버전을 받아 둔다(다음에 열 때 적용, 새 버전이면 화면에 알림).
 * 저장해 둔 것이 없으면 인터넷에서 받는다. 라이브러리·아이콘도 저장해 둔 것을 먼저 쓴다.
 * 구글 로그인·데이터(시트) 요청은 건드리지 않는다.
 * 어떤 경우든 여기서 문제가 생기면 그냥 인터넷에서 받아 연다 (앱이 안 열리는 일이 없게).
 * 아이폰 사파리는 응답을 준 뒤에 waitUntil을 부르면 오류가 나므로, waitUntil은 이벤트 안에서 바로 부른다. */
const CACHE = 'ardim-app-v3'; // 이름을 바꾸면 예전 저장본(v2)이 지워진다
const SHELL = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).catch(() => {}).then(() => self.clients.claim()));
});
const LIB = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;

/** 새 화면 받기: 받은 것이 저장해 둔 것과 다르면 저장하고 열린 화면에 알린다 */
async function updateIndex() {
  const res = await fetch('index.html', { cache: 'no-store' });
  if (!res.ok) return res;
  try {
    // 화면에 내준 응답과 따로 저장본을 다시 꺼내 비교한다 (같은 응답을 두 번 읽으면 오류가 나서 갱신이 안 됐었다)
    const old = await caches.match('index.html');
    const fresh = await res.clone().text();
    const same = old && (await old.text()) === fresh;
    if (!same) {
      const cache = await caches.open(CACHE);
      await cache.put('index.html', res.clone());
      if (old) (await self.clients.matchAll()).forEach(c => c.postMessage({ type: 'app-updated' }));
    }
  } catch (err) { /* 저장 못 해도 화면은 연다 */ }
  return res;
}

// 화면이 '새 버전 받아' 하면 저장본을 지우고 다시 받는다
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'refresh') e.waitUntil(caches.delete(CACHE).then(() => caches.open(CACHE)).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (/version\.json$/.test(url.pathname)) return; // 버전 확인은 늘 인터넷에서
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));
  if (isPage) {
    const hitP = caches.match('index.html').catch(() => null);
    const netP = hitP.then(() => updateIndex());
    e.waitUntil(netP.catch(() => {}));
    e.respondWith(hitP.then(hit => hit || netP).catch(() => fetch(req)));
    return;
  }
  if (url.origin === location.origin || LIB.test(req.url)) {
    const hitP = caches.match(req).catch(() => null);
    const netP = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    });
    e.waitUntil(netP.catch(() => {}));
    e.respondWith(hitP.then(hit => hit || netP).catch(() => fetch(req)));
  }
});
