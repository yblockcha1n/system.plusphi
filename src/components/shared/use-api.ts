"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { idleState, type ActionState } from "@/lib/form";
import type { ApiResult } from "@/lib/api-client";

/**
 * Server Actions と違い、Route Handler の応答には更新後の画面が含まれない。
 * 成功したら router.refresh() を呼んで Server Component を取り直す必要がある。
 * その呼び忘れを防ぐため、成功処理はこのファイルに集約している。
 */
function useMutationRunner() {
  const router = useRouter();

  return (result: ActionState, options?: { silent?: boolean }) => {
    if (result.status === "error") {
      // フィールド単位のエラーはフォーム内に出すので、トーストは全体エラーだけ
      if (!result.fieldErrors) toast.error(result.message);
      return false;
    }

    if (!options?.silent && result.message) toast.success(result.message);
    router.refresh();
    return true;
  };
}

type SubmitValues = Record<string, string>;

/**
 * フォーム送信用。`<form onSubmit={onSubmit}>` に繋ぐ。
 *
 * FormData は await をまたぐ前に読む（currentTarget は非同期処理のあとに
 * null になるため）。
 */
export function useApiForm(
  submit: (values: SubmitValues) => Promise<ApiResult>,
  onSuccess?: () => void
) {
  const [state, setState] = useState<ActionState>(idleState);
  const [pending, setPending] = useState(false);
  const handle = useMutationRunner();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const values = Object.fromEntries(new FormData(event.currentTarget)) as SubmitValues;

    setPending(true);
    const result = await submit(values);
    setPending(false);
    setState(result);

    if (handle(result)) onSuccess?.();
  };

  return { state, pending, onSubmit };
}

/**
 * フォーム以外の更新（削除・状態変更・並べ替えなど）用。
 * silent: true にすると成功トーストを出さない（並べ替えのように頻度が高いもの向け）。
 */
export function useApiMutation() {
  const [pending, startTransition] = useTransition();
  const handle = useMutationRunner();

  const run = (
    request: () => Promise<ApiResult>,
    options?: { silent?: boolean; onSuccess?: () => void; onError?: () => void }
  ) => {
    startTransition(async () => {
      const result = await request();

      if (handle(result, options)) {
        options?.onSuccess?.();
      } else {
        // 楽観的更新を巻き戻したいときに使う
        options?.onError?.();
      }
    });
  };

  return { run, pending };
}
