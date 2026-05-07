/* ============================================================
   Service Worker — 英語学習アプリ PWA
   オフライン対応・キャッシュ管理
   ============================================================ */

const CACHE_NAME = 'english-learning-v1';

// キャッシュするファイル一覧
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  // Google Fonts（オプション：CDNリソースは初回のみキャッシュ）
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@300;400;600;700&display=swap',
];

// インストール時：キャッシュを作成
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // CDN以外をキャッシュ（エラーが出ても続行）
      return Promise.allSettled(
        CACHE_URLS.map(url => cache.add(url).catch(e => console.warn('Cache miss:', url, e)))
      );
    })
  );
  self.skipWaiting();
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// フェッチ時：キャッシュファースト（Supabase APIはネットワーク優先）
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Supabase API リクエストはキャッシュしない（常にネットワーク）
  if (url.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => new Response('offline', { status: 503 })));
    return;
  }

  // それ以外はキャッシュファースト
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 成功したレスポンスはキャッシュに追加
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // オフラインでキャッシュもない場合
        return new Response('オフラインです。インターネット接続を確認してください。', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
