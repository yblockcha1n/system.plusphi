"use client";

import { useState } from "react";

/**
 * Sheet を開くたびに変わる key。`<form key={...}>` に渡してフォームを作り直させる。
 *
 * defaultValue を使う入力は、マウント後に defaultValue が変わっても値が追随しない
 * （React の非制御コンポーネントの仕様）。1 つの Sheet を使い回して別のレコードを
 * 編集する作りなので、これが無いと前に開いたレコードの値が残ってしまう。
 * Base UI もこれを "changing the default value state of an uncontrolled
 * FieldControl after being initialized" として警告する。
 *
 * onOpen には Select など form の外にある state のリセットを渡す。
 * （effect ではなくレンダー中に追随させる: https://react.dev/learn/you-might-not-need-an-effect）
 */
export function useFormResetKey(open: boolean, onOpen?: () => void): number {
  const [resetKey, setResetKey] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setResetKey((current) => current + 1);
      onOpen?.();
    }
  }

  return resetKey;
}
