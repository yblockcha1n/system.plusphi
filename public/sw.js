/**
 * plusphi 基幹システムの Service Worker。
 *
 * このアプリはクレデンシャルを扱うため、キャッシュ対象を
 * 「内容が変われば URL も変わる」本番ビルドの成果物だけに限定している。
 * 画面（HTML / RSC ペイロード）や API の応答には
 * 復号したパスワードやタスク内容が乗りうるので、絶対にキャッシュしない。
 *
 * 目的はオフライン動作ではなく「ホーム画面にインストールできること」と
 * 静的アセットの読み込みを速くすること、そして Web Push を受け取ることの 3 点。
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

/* ------------------------------ Web Push ------------------------------ */

/**
 * 通知の中身はサーバー（src/lib/push.ts）が JSON で送ってくる。
 * 形は src/features/push/schema.ts の PushPayload と揃えること。
 */
function parsePayload(event) {
  const fallback = {
    title: "plusphi",
    body: "新しい通知があります。",
    url: "/home",
    tag: "plusphi",
  };

  if (!event.data) return fallback;

  try {
    return { ...fallback, ...event.data.json() };
  } catch {
    // JSON でない（他所から送られた等）ときは本文としてそのまま出す
    return { ...fallback, body: event.data.text() || fallback.body };
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePayload(event);

  // waitUntil を付けないと、表示前に SW が停止させられることがある
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // アイコンは manifest と同じものを使う（PWA の見た目と揃える）
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // 同じ tag の通知は置き換わる。同一タスクの通知が積み上がらないようにする。
      tag: payload.tag,
      // 置き換えのたびに鳴らすとうるさいので、再通知はしない
      renotify: false,
      // クリック先を notificationclick 側へ引き渡す
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url || "/home", self.location.origin);

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        // 未読み込みのタブも拾えるようにする
        includeUncontrolled: true,
      });

      // 既に開いているタブがあればそれを使う。通知のたびに新しい窓が増えると
      // ホーム画面から起動した PWA では特に鬱陶しい。
      for (const client of clients) {
        if (new URL(client.url).origin !== target.origin) continue;

        await client.focus();

        if ("navigate" in client) {
          await client.navigate(target.href);
        }

        return;
      }

      await self.clients.openWindow(target.href);
    })()
  );
});

/**
 * 購読が push サービス側の都合で作り直されたとき（鍵の失効など）に発火する。
 * 黙って失うと通知が届かなくなるだけで気付けないので、登録し直して
 * サーバーへ送り直す。
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription || (await self.registration.pushManager.getSubscription());

      // applicationServerKey は古い購読から引き継ぐ（VAPID 公開鍵は同じ）
      const key = event.newSubscription?.options?.applicationServerKey
        || old?.options?.applicationServerKey;

      if (!key) return;

      const subscription =
        event.newSubscription
        || (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
    })()
  );
});
