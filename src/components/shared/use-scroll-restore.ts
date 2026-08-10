"use client";

import { useEffect, useRef } from "react";

/**
 * スクロール位置をリロードをまたいで覚えておくための ref。
 *
 * 保存先は sessionStorage（タブ単位）。Cookie に置くと毎回のリクエストに載って
 * しまうし、localStorage だと何日も前に見ていた位置が復元されてしまう。
 * 「リロードや別ページからの戻りでは位置が残り、タブを開き直せば既定に戻る」
 * のがこの手の状態には合っている。
 *
 * 使い方:
 *   const scroller = useScrollRestore("calendar:time", 7 * 48);
 *   <div ref={scroller} className="overflow-y-auto">…</div>
 *
 * @param storageKey 画面ごとに一意なキー。
 * @param fallbackTop 保存された位置が無いときの初期スクロール位置(px)。
 */
export function useScrollRestore<T extends HTMLElement>(
  storageKey: string,
  fallbackTop = 0
) {
  const ref = useRef<T>(null);
  // 復元に使うのは初回の値だけ。以後 fallbackTop が変わっても、
  // 利用者が動かしたスクロール位置を勝手に戻さない。
  const fallbackRef = useRef(fallbackTop);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    node.scrollTop = readTop(storageKey) ?? fallbackRef.current;

    // スクロールは毎フレーム飛んでくるので、書き込みは 1 フレームに 1 回へ間引く
    let frame = 0;

    const handleScroll = () => {
      if (frame !== 0) return;

      frame = requestAnimationFrame(() => {
        frame = 0;
        writeTop(storageKey, node.scrollTop);
      });
    };

    node.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      node.removeEventListener("scroll", handleScroll);
    };
  }, [storageKey]);

  return ref;
}

/**
 * sessionStorage は Safari のプライベートモードなどで例外を投げることがある。
 * スクロール位置を覚えられないだけで画面が壊れる理由は無いので、黙って諦める。
 */
function readTop(storageKey: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw === null) return null;

    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function writeTop(storageKey: string, top: number): void {
  try {
    window.sessionStorage.setItem(storageKey, String(Math.round(top)));
  } catch {
    // 保存できなくても操作は続けられる
  }
}
