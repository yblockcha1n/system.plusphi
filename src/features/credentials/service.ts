import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { reorderRecords } from "@/lib/reorder";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { credentialFormSchema, sectionFormSchema } from "@/features/credentials/schema";
import type { SessionPayload } from "@/lib/session";

const CREDENTIALS_PATH = "/credentials";

/* ------------------------------- セクション ------------------------------- */

export async function saveSection(input: unknown): Promise<ActionState> {
  const parsed = sectionFormSchema.safeParse({
    id: idField(input),
    name: textField(input, "name"),
    description: textField(input, "description"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, name, description } = parsed.data;

  const { error } = id
    ? await supabase.from("sections").update({ name, description }).eq("id", id)
    : await supabase.from("sections").insert({ name, description });

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidatePath(CREDENTIALS_PATH);
  return { status: "success", message: id ? "セクションを更新しました。" : "セクションを作成しました。" };
}

export async function deleteSection(sectionId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(sectionId);
  if (!parsed.success) {
    return { status: "error", message: "不正なセクションです。" };
  }

  // credentials.section_id は ON DELETE SET NULL。中身は消えず「未分類」に移る。
  const { error } = await supabase.from("sections").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath(CREDENTIALS_PATH);
  return { status: "success", message: "セクションを削除しました。中のクレデンシャルは未分類に移動しました。" };
}

/**
 * ドラッグ&ドロップ後の並び順を保存する。
 * 「未分類」は DB 上の行ではないので、呼び出し側で除外してから渡すこと。
 */
export async function reorderSections(input: unknown): Promise<ActionState> {
  const result = await reorderRecords("sections", input);

  if (result.status === "success") {
    revalidatePath(CREDENTIALS_PATH);
  }

  return result;
}

/* ----------------------------- クレデンシャル ----------------------------- */

export async function saveCredential(
  session: SessionPayload,
  input: unknown
): Promise<ActionState> {
  const parsed = credentialFormSchema.safeParse({
    id: idField(input),
    sectionId: textField(input, "sectionId"),
    name: textField(input, "name"),
    username: textField(input, "username"),
    password: textField(input, "password"),
    url: textField(input, "url"),
    notes: textField(input, "notes"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, sectionId, name, username, password, url, notes } = parsed.data;

  const base = {
    section_id: sectionId,
    name,
    username,
    url,
  };

  if (id) {
    // 編集時、パスワード/メモが空欄なら「変更しない」。既存の暗号文をそのまま残す。
    const { error } = await supabase
      .from("credentials")
      .update({
        ...base,
        ...(password !== null ? { password_ciphertext: encryptSecret(password) } : {}),
        ...(notes !== null ? { notes_ciphertext: encryptSecret(notes) } : {}),
      })
      .eq("id", id);

    if (error) {
      return { status: "error", message: `保存に失敗しました: ${error.message}` };
    }

    revalidatePath(CREDENTIALS_PATH);
    return { status: "success", message: "クレデンシャルを更新しました。" };
  }

  // 登録者はセッションから取る。リクエストの値を信用すると詐称できてしまう。
  const { error } = await supabase.from("credentials").insert({
    ...base,
    password_ciphertext: password !== null ? encryptSecret(password) : null,
    notes_ciphertext: notes !== null ? encryptSecret(notes) : null,
    created_by: session.email,
  });

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidatePath(CREDENTIALS_PATH);
  return { status: "success", message: "クレデンシャルを登録しました。" };
}

export async function deleteCredential(credentialId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(credentialId);
  if (!parsed.success) {
    return { status: "error", message: "不正なクレデンシャルです。" };
  }

  const { error } = await supabase.from("credentials").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath(CREDENTIALS_PATH);
  return { status: "success", message: "クレデンシャルを削除しました。" };
}

/* -------------------------------- 復号 -------------------------------- */

const revealSchema = z.object({
  credentialId: z.uuid(),
  field: z.enum(["password", "notes"]),
});

/**
 * 一覧には暗号文すら送らず、「表示」を押されたときだけここで復号する。
 * 認証は Route Handler 側の withSession が担保する。
 *
 * クレデンシャルは全員が全件を見られる共有金庫として運用しているため、
 * 行ごとの権限は持たせない代わりに、復号できたときだけ監査ログを 1 行残す。
 */
export async function revealSecret(
  session: SessionPayload,
  credentialId: string,
  input: unknown
): Promise<ActionState & { data?: { value: string } }> {
  const parsed = revealSchema.safeParse({
    credentialId,
    field: textField(input, "field"),
  });

  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { field } = parsed.data;
  const column = field === "password" ? "password_ciphertext" : "notes_ciphertext";

  const { data, error } = await supabase
    .from("credentials")
    .select(`name, ${column}`)
    .eq("id", parsed.data.credentialId)
    .single();

  if (error || !data) {
    return { status: "error", message: "取得に失敗しました。" };
  }

  const row = data as unknown as Record<string, string | null>;
  const ciphertext = row[column];

  if (!ciphertext) {
    return { status: "error", message: "値が登録されていません。" };
  }

  let value: string;

  try {
    value = decryptSecret(ciphertext);
  } catch {
    // 鍵が変わった / データが壊れている
    return {
      status: "error",
      message: "復号に失敗しました。ENCRYPTION_KEY が登録時と異なる可能性があります。",
    };
  }

  await recordAccess(session, parsed.data.credentialId, row.name ?? "(名称不明)", field);

  return { status: "success", data: { value } };
}

/**
 * 復号を監査ログに残す。
 *
 * 記録に失敗しても復号結果は返す（fail open）。0004 のマイグレーションを流す前の
 * 環境や DB の一時的な不調で、クレデンシャル閲覧そのものが使えなくなるほうが
 * 業務影響が大きいため。取りこぼしはサーバーログから追えるようにしておく。
 */
async function recordAccess(
  session: SessionPayload,
  credentialId: string,
  credentialName: string,
  field: "password" | "notes"
): Promise<void> {
  const { error } = await supabase.from("credential_access_log").insert({
    credential_id: credentialId,
    credential_name: credentialName,
    // 閲覧者はセッションから取る。リクエストの値を信用すると詐称できてしまう。
    actor: session.email,
    field,
  });

  if (error) {
    console.error("[audit] クレデンシャル閲覧の記録に失敗しました", {
      credentialId,
      actor: session.email,
      field,
      message: error.message,
    });
  }
}
