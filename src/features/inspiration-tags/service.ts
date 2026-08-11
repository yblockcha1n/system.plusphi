import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { reorderRecords } from "@/lib/reorder";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { inspirationTagFormSchema } from "@/features/inspiration-tags/schema";
import type { SessionPayload } from "@/lib/session";

const SETTINGS_PATH = "/settings/inspiration-tags";
const KNOWLEDGE_PATH = "/inspirations";

/** タグを触ると、マスタ画面とナレッジ一覧の両方の表示が変わる。 */
function revalidateAll(): void {
  revalidatePath(SETTINGS_PATH);
  revalidatePath(KNOWLEDGE_PATH);
}

export async function saveInspirationTag(
  session: SessionPayload,
  input: unknown
): Promise<ActionState> {
  const parsed = inspirationTagFormSchema.safeParse({
    id: idField(input),
    name: textField(input, "name"),
    description: textField(input, "description"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, name, description } = parsed.data;

  const { error } = id
    ? await supabase.from("inspiration_tags").update({ name, description }).eq("id", id)
    : await supabase
        .from("inspiration_tags")
        .insert({ name, description, created_by: session.email });

  if (error) {
    // 23505 = unique_violation。名前の重複は入力ミスなので専用の文言にする。
    if (error.code === "23505") {
      return {
        status: "error",
        message: "同じ名前のタグが既にあります。",
        fieldErrors: { name: ["この名前は使われています"] },
      };
    }

    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return { status: "success", message: id ? "タグを更新しました。" : "タグを追加しました。" };
}

/**
 * タグを削除する。inspiration_tag_links は on delete cascade なので、
 * 紐づけだけが消えて投稿そのものは残る。
 */
export async function deleteInspirationTag(tagId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(tagId);
  if (!parsed.success) {
    return { status: "error", message: "不正なタグです。" };
  }

  const { error } = await supabase.from("inspiration_tags").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return {
    status: "success",
    message: "タグを削除しました。付いていた投稿からは外れましたが、投稿自体は残っています。",
  };
}

/** 使わなくなったタグを選択肢から外す / 戻す。既存の紐づけはそのまま残る。 */
export async function setInspirationTagArchived(
  tagId: string,
  input: unknown
): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({
    id: tagId,
    archived: (input as { archived?: unknown })?.archived,
  });

  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase
    .from("inspiration_tags")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return {
    status: "success",
    message: parsed.data.archived
      ? "タグを選択肢から外しました。"
      : "タグを選べるように戻しました。",
  };
}

/** ドラッグ&ドロップ後の並び順を保存する。 */
export async function reorderInspirationTags(input: unknown): Promise<ActionState> {
  const result = await reorderRecords("inspiration_tags", input);

  if (result.status === "success") {
    revalidateAll();
  }

  return result;
}
