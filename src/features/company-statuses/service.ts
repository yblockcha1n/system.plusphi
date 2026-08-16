import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { reorderRecords } from "@/lib/reorder";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { companyStatusFormSchema } from "@/features/company-statuses/schema";
import type { SessionPayload } from "@/lib/session";

const SETTINGS_PATH = "/settings/company-statuses";
const COMPANIES_PATH = "/companies";

/** マスタ画面と、ステータスを選ぶ画面（取引先一覧など）の両方を作り直す。 */
/** ステータスを触るとマスタ画面と取引先一覧の両方の表示が変わる。 */
function revalidateAll(): void {
  revalidatePath(SETTINGS_PATH);
  revalidatePath(COMPANIES_PATH);
  revalidatePath("/companies/[id]", "page");
}

export async function saveCompanyStatus(
  session: SessionPayload,
  input: unknown
): Promise<ActionState> {
  const parsed = companyStatusFormSchema.safeParse({
    id: idField(input),
    name: textField(input, "name"),
    description: textField(input, "description"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, name, description } = parsed.data;

  const { error } = id
    ? await supabase.from("company_statuses").update({ name, description }).eq("id", id)
    : await supabase
        .from("company_statuses")
        .insert({ name, description, created_by: session.email });

  if (error) {
    // 23505 = unique_violation。名前の重複は利用者の入力ミスなので、専用の文言にする。
    if (error.code === "23505") {
      return {
        status: "error",
        message: "同じ名前のステータスが既にあります。",
        fieldErrors: { name: ["この名前は使われています"] },
      };
    }

    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return { status: "success", message: id ? "ステータスを更新しました。" : "ステータスを追加しました。" };
}

/**
 * ステータスを削除する。companies.status_id は on delete set null なので、
 * 付いていた取引先は消えず「ステータスなし」になる。
 */
export async function deleteCompanyStatus(statusId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(statusId);
  if (!parsed.success) {
    return { status: "error", message: "不正なステータスです。" };
  }

  const { error } = await supabase.from("company_statuses").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return {
    status: "success",
    message: "ステータスを削除しました。付いていた取引先はステータスなしになりました。",
  };
}

/**
 * 使わなくなったステータスを選択肢から外す / 戻す。
 *
 * 削除と違い、既に付いている取引先のステータス表示はそのまま残る。過去の記録を
 * 保ったまま新規登録では選ばせたくない、という場合はこちらを使う。
 */
export async function setCompanyStatusArchived(
  statusId: string,
  input: unknown
): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({
    id: statusId,
    archived: (input as { archived?: unknown })?.archived,
  });

  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase
    .from("company_statuses")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return {
    status: "success",
    message: parsed.data.archived
      ? "ステータスを選択肢から外しました。"
      : "ステータスを選べるように戻しました。",
  };
}

/** ドラッグ&ドロップ後の並び順を保存する。 */
export async function reorderCompanyStatuses(input: unknown): Promise<ActionState> {
  const result = await reorderRecords("company_statuses", input);

  if (result.status === "success") {
    revalidateAll();
  }

  return result;
}
