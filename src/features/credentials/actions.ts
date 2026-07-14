"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/dal";
import { supabase } from "@/lib/supabase";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  credentialFormSchema,
  sectionFormSchema,
  type ActionState,
} from "@/features/credentials/schema";

const CREDENTIALS_PATH = "/credentials";

function toErrorState(error: z.ZodError): ActionState {
  return {
    status: "error",
    message: "入力内容を確認してください。",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

/* ------------------------------- セクション ------------------------------- */

export async function saveSection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const parsed = sectionFormSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
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
  await requireSession();

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

/* ----------------------------- クレデンシャル ----------------------------- */

export async function saveCredential(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();

  const parsed = credentialFormSchema.safeParse({
    id: formData.get("id") || undefined,
    sectionId: formData.get("sectionId") ?? "",
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
    url: formData.get("url"),
    notes: formData.get("notes"),
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

  // 登録者はセッションから取る。フォームの値を信用すると詐称できてしまう。
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
  await requireSession();

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
 * Server Action は UI を経由せず直接 POST できるため、必ず認証を確認する。
 */
export async function revealSecret(
  credentialId: string,
  field: "password" | "notes"
): Promise<{ value: string } | { error: string }> {
  await requireSession();

  const parsed = revealSchema.safeParse({ credentialId, field });
  if (!parsed.success) {
    return { error: "不正なリクエストです。" };
  }

  const column = parsed.data.field === "password" ? "password_ciphertext" : "notes_ciphertext";

  const { data, error } = await supabase
    .from("credentials")
    .select(column)
    .eq("id", parsed.data.credentialId)
    .single();

  if (error || !data) {
    return { error: "取得に失敗しました。" };
  }

  const ciphertext = (data as Record<string, string | null>)[column];

  if (!ciphertext) {
    return { error: "値が登録されていません。" };
  }

  try {
    return { value: decryptSecret(ciphertext) };
  } catch {
    // 鍵が変わった / データが壊れている
    return { error: "復号に失敗しました。ENCRYPTION_KEY が登録時と異なる可能性があります。" };
  }
}
