"use client";

import { useCallback, useMemo, useState } from "react";

export type SheetTarget<T> = {
  open: boolean;
  /** 表示中の対象。閉じたあとも直前の対象を保持し続ける。 */
  target: T | undefined;
  /** 対象を差し替えて開く。 */
  show: (target?: T) => void;
  /** Sheet / Dialog の onOpenChange にそのまま渡す。 */
  onOpenChange: (open: boolean) => void;
};

/**
 * Sheet / Dialog の「開閉」と「編集対象」をまとめて持つ。
 *
 * 閉じるときに対象を null に戻さないのが要点。Base UI の入力は初回マウント時の
 * defaultValue を ref で固定して以後の変更を警告するため、閉じる瞬間に対象を
 * 消すと（閉じるアニメーション中もまだマウントされている）defaultValue が空へ
 * 変わって警告になる。削除ダイアログのタイトルが一瞬「「undefined」を削除しますか？」
 * になる見た目の崩れも同じ原因。
 *
 * 対象は次に show() されたときに差し替わり、そのとき open が false→true になるので
 * useFormResetKey がフォームを作り直す。
 */
export function useSheetTarget<T>(): SheetTarget<T> {
  const [state, setState] = useState<{ open: boolean; target?: T }>({ open: false });

  const show = useCallback((target?: T) => setState({ open: true, target }), []);
  const onOpenChange = useCallback(
    (open: boolean) => setState((previous) => ({ ...previous, open })),
    []
  );

  return useMemo(
    () => ({ open: state.open, target: state.target, show, onOpenChange }),
    [state.open, state.target, show, onOpenChange]
  );
}
