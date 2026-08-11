"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

/**
 * この端末が通知を受け取れる状態か。
 *  - unsupported : ブラウザが Push / 通知に対応していない（iOS のホーム画面未追加を含む）
 *  - denied      : 利用者がブラウザ側で拒否済み。アプリからは復帰できない
 *  - off         : 対応しているが未登録
 *  - on          : この端末で購読済み
 */
export type PushState = "loading" | "unsupported" | "denied" | "off" | "on";

/**
 * VAPID 公開鍵（base64url）を pushManager が要求する形に変換する。
 *
 * 戻り値を Uint8Array<ArrayBuffer> にしているのは、既定の Uint8Array が
 * SharedArrayBuffer も取りうる型になり、BufferSource として受け取ってもらえないため。
 */
function toApplicationServerKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * 端末単位の Push 購読を扱う。
 *
 * Notification.requestPermission() は「利用者の操作から呼ばれたとき」しか通らない
 * （iOS では特に厳格）。そのため enable() はボタンの onClick から直接呼ぶこと。
 * useEffect の中で自動的に許可を求めてはいけない。
 */
export function usePushSubscription(vapidPublicKey: string | null) {
  const [state, setState] = useState<PushState>("loading");
  const [pending, setPending] = useState(false);

  // 現在の購読状態を読む。許可は求めない（読むだけ）。
  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      if (!vapidPublicKey || !isSupported()) {
        if (!cancelled) setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setState(subscription ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    };

    void read();

    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const enable = useCallback(async () => {
    if (!vapidPublicKey || pending) return;

    setPending(true);

    try {
      // ここは利用者の操作の延長でなければならない（iOS の要件）
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        toast.error("通知が許可されませんでした。");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // 既に購読済みならそれを使い回す。作り直すと endpoint が変わる。
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          // Push を受けたら必ず通知を出す約束。false は各ブラウザが許可していない。
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(vapidPublicKey),
        }));

      const result = await api.subscribePush(subscription.toJSON());

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      setState("on");
      toast.success(result.message);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? `通知を登録できませんでした: ${cause.message}` : "通知を登録できませんでした。"
      );
    } finally {
      setPending(false);
    }
  }, [pending, vapidPublicKey]);

  const disable = useCallback(async () => {
    if (pending) return;

    setPending(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // サーバー側の行を先に消す。ブラウザ側だけ解除して失敗すると、
        // 宛先が残ったまま届かない通知を送り続けることになる。
        const result = await api.unsubscribePush(subscription.endpoint);

        if (result.status === "error") {
          toast.error(result.message);
          return;
        }

        await subscription.unsubscribe();
        toast.success(result.message);
      }

      setState("off");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? `通知を解除できませんでした: ${cause.message}` : "通知を解除できませんでした。"
      );
    } finally {
      setPending(false);
    }
  }, [pending]);

  const sendTest = useCallback(async () => {
    setPending(true);

    const result = await api.sendTestPush();

    setPending(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
  }, []);

  return { state, pending, enable, disable, sendTest };
}
