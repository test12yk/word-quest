// 오프라인 캐시: 앱 파일을 미리 저장해 두고, 네트워크가 안 되면 저장본을 쓴다.
// 파일을 수정했다면 VERSION을 올려야 기존 사용자에게 새 파일이 반영된다.
const VERSION = 'wordquest-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/data.js', 'js/quiz.js', 'js/srs.js', 'js/store.js', 'js/tts.js', 'js/notify.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 네트워크 우선, 실패하면 캐시(개발 중 수정이 바로 보이고, 오프라인에서도 동작)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((wins) => {
    const w = wins.find((c) => 'focus' in c);
    if (w) { w.navigate?.('./#/review'); return w.focus(); }
    return self.clients.openWindow('./#/review');
  }));
});
