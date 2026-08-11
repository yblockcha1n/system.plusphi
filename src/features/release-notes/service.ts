import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { listUsers } from "@/lib/env";
import { sendPushToUsers } from "@/lib/push";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import {
  releaseNoteDraftSchema,
  releaseNoteFormSchema,
} from "@/features/release-notes/schema";
import type { SessionPayload } from "@/lib/session";

const PATH = "/release-notes";

/**
 * CI から下書きを登録する。
 *
 * 未公開の下書きが既にあれば「作り直す」。公開せずに何度 push しても、
 * 下書きは常に 1 件で「前回の公開以降ぶん」を表す状態に保ちたいため。
 * base_sha だけは最初の下書きのものを引き継ぐ（起点がずれると差分が欠ける）。
 */
export async function saveReleaseNoteDraft(input: unknown): Promise<ActionState> {
  const parsed = releaseNoteDraftSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "下書きの内容が不正です。" };
  }

  const { version, title, body, baseSha, headSha, commitCount, generatedBy } = parsed.data;

  const { data: existing } = await supabase
    .from("release_notes")
    .select("id, base_sha")
    .eq("status", "draft")
    .maybeSingle();

  const values = {
    version,
    title,
    body,
    head_sha: headSha,
    commit_count: commitCount,
    generated_by: generatedBy,
    // 既存の下書きがあれば、その起点を保つ
    base_sha: existing?.base_sha ?? baseSha,
  };

  const { error } = existing
    ? await supabase.from("release_notes").update(values).eq("id", existing.id)
    : await supabase.from("release_notes").insert({ ...values, status: "draft" });

  if (error) {
    return { status: "error", message: `下書きの保存に失敗しました: ${error.message}` };
  }

  revalidatePath(PATH);
  return {
    status: "success",
    message: existing ? "下書きを更新しました。" : "下書きを作成しました。",
  };
}

/** 人が本文を直す。公開済みでも直せる（誤字の修正など）。 */
export async function saveReleaseNote(input: unknown): Promise<ActionState> {
  const parsed = releaseNoteFormSchema.safeParse({
    id: idField(input),
    version: textField(input, "version"),
    title: textField(input, "title"),
    body: textField(input, "body"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, version, title, body } = parsed.data;

  if (!id) {
    return { status: "error", message: "対象が指定されていません。" };
  }

  const { error } = await supabase
    .from("release_notes")
    .update({ version, title, body })
    .eq("id", id);

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidatePath(PATH);
  return { status: "success", message: "パッチノートを更新しました。" };
}

/**
 * 公開する。ここで初めて全員へ通知が飛ぶ。
 *
 * 通知の送信に失敗しても公開そのものは成功として扱う。既に公開状態になった後で
 * エラーを返すと、利用者が「もう一度公開」を押して二重通知になりかねない。
 */
export async function publishReleaseNote(
  session: SessionPayload,
  releaseNoteId: string
): Promise<ActionState> {
  const parsed = z.uuid().safeParse(releaseNoteId);
  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { data, error } = await supabase
    .from("release_notes")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      publisher: session.email,
    })
    // 既に公開済みのものを押しても二重に通知しない
    .eq("id", parsed.data)
    .eq("status", "draft")
    .select("version, title")
    .maybeSingle();

  if (error) {
    return { status: "error", message: `公開に失敗しました: ${error.message}` };
  }

  if (!data) {
    return { status: "error", message: "既に公開済みか、対象が見つかりませんでした。" };
  }

  revalidatePath(PATH);

  // 自分以外にも配る。更新の告知なので、操作した本人にも届いてよい。
  const sent = await sendPushToUsers(
    listUsers().map((user) => user.email),
    {
      kind: "release-note",
      title: `アップデート ${data.version}`,
      body: data.title,
      url: PATH,
      tag: `release-note:${parsed.data}`,
    }
  );

  return {
    status: "success",
    message:
      sent > 0
        ? `公開しました。${sent} 台の端末へ通知しました。`
        : "公開しました。（通知を受け取る端末がまだありません）",
  };
}

export async function deleteReleaseNote(releaseNoteId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(releaseNoteId);
  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase.from("release_notes").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath(PATH);
  return { status: "success", message: "パッチノートを削除しました。" };
}

/**
 * 次の下書きが差分を取る起点を返す。
 *
 * 未公開の下書きがあればその起点、無ければ最後に公開したノートの head。
 * どちらも無ければ null（CI 側は直近数コミットで代替する）。
 */
export async function getDraftBaseSha(): Promise<string | null> {
  const { data: draft } = await supabase
    .from("release_notes")
    .select("base_sha")
    .eq("status", "draft")
    .maybeSingle();

  if (draft?.base_sha) return draft.base_sha;

  const { data: published } = await supabase
    .from("release_notes")
    .select("head_sha")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return published?.head_sha ?? null;
}
