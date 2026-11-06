// =============================================================
// Service Worker：オフラインでも遊べるようにする
// ・初回アクセス時に、ゲームに必要なファイルをすべてキャッシュに保存する
// ・2回目以降は、キャッシュからすぐ表示しつつ、裏でネットから最新版を取り直す
//   （更新したファイルは、次に開いたときに反映される）
// ・ファイルを追加・削除したときは、下の FILES を直し、CACHE の番号を上げる
// =============================================================
const CACHE = 'purin-v1';

const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'js/main.js',
  'js/data.js',
  'js/model.js',
  'js/stage.js',
  'js/actions.js',
  'js/texts.js',
  'js/repair.js',
  'js/cooking.js',
  'js/judge.js',
  'js/render.js',
  'js/icons.js',
  'assets/title.webp',
  'assets/logo.webp',
  'assets/icons/favicon-32.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  ...['angry', 'blush', 'bored', 'calm', 'cheerful', 'confused', 'determined', 'frustrated', 'giggle', 'happy',
    'laugh', 'nervous', 'neutral', 'pout', 'serious', 'shout', 'sideglance', 'sigh', 'smug', 'speaking',
    'surprised', 'tasting', 'thinking', 'uneasy', 'wink'].map((n) => `assets/chihiro/${n}.webp`),
];

// Google Fonts は、一度読み込んだものを保存しておく（オフラインでも同じフォントで表示）
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // 古いバージョンのキャッシュを消す
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      // 裏で最新版を取りに行き、取れたらキャッシュを更新する
      const update = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(update);
        return cached;
      }
      const res = await update;
      if (res) return res;
      // オフラインで、キャッシュにもない場合：ページの移動なら index.html を返す
      if (req.mode === 'navigate') return cache.match('index.html');
      return new Response('', { status: 504, statusText: 'offline' });
    }),
  );
});
