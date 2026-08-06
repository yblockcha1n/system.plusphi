"use client";

import { useEffect } from "react";

/**
 * Service Worker を登録する。ホーム画面へのインストールに必要。
 * 登録できない環境（非対応ブラウザ、http の LAN アクセスなど）では
 * 何もせずに素通りする＝アプリの動作には影響しない。
 *
 * 開発中は登録しない。next dev のチャンクは内容が変わっても URL が
 * 変わらないため、SW を挟むと古い JS / CSS を掴んだまま直せなくなる
 * （詳細は public/sw.js のコメント）。すでに登録済みの端末を救うため、
 * 開発時は登録解除とキャッシュ削除まで行う。
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void unregisterAll();
      return;
    }

    navigator.serviceWorker
      // updateViaCache: "none" にしないと sw.js 自体がブラウザキャッシュに居座る
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // 登録失敗は致命的ではないので握りつぶす（PWA として入らないだけ）
      });
  }, []);

  return null;
}

async function unregisterAll(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // 掃除に失敗しても開発は続けられる
  }
}
