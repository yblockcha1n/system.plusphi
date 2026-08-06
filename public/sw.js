/**
 * plusphi 基幹システムの Service Worker。
 *
 * このアプリはクレデンシャルを扱うため、キャッシュ対象を
 * 「内容が変われば URL も変わる」本番ビルドの成果物だけに限定している。
 * 画面（HTML / RSC ペイロード）や API の応答には
 * 復号したパスワードやタスク内容が乗りうるので、絶対にキャッシュしない。
 *
 * 目的はオフライン動作ではなく「ホーム画面にインストールできること」と
 * 静的アセットの読み込みを速くすることの 2 点。
 */

// キャッシュ方針を変えたら必ず上げること。activate で古い世代を捨てる。
const STATIC_CACHE = "plusphi-static-v2";

self.addEventListener("install", () => {
  // 新しい SW をすぐ有効にする（古いアセットを掴み続けないため）
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/**
 * 応答が「不変」を宣言しているか。
 *
 * ここが要点。next dev（Turbopack）のチャンクも /_next/static/ 配下に来るが、
 * 中身が変わっても URL は変わらない（例: src_app_globals_css_1igg3k2._.single.css）。
 * これを cache-first で保存すると、コードを直しても端末には永久に古い JS / CSS が
 * 返り続け、ハイドレーションが壊れて「ボタンを押しても反応しない」「並べ替えが
 * 効かない」状態になる。ホーム画面に入れた PWA では自力で復旧できない。
 *
 * 本番ビルドの成果物だけが Cache-Control に immutable を付けて配信されるので、
 * それを唯一の判定材料にする（開発サーバーは no-store を返すため保存されない）。
 */
function isImmutable(response) {
  return (response.headers.get("cache-control") ?? "").includes("immutable");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 同一オリジンのビルド成果物だけを扱う。それ以外は素通しでネットワークへ。
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);

      if (response.ok && isImmutable(response)) {
        cache.put(request, response.clone());
      }

      return response;
    })()
  );
});
