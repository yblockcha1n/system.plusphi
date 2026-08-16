import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { companyFormSchema } from "@/features/companies/schema";
import type { SessionPayload } from "@/lib/session";

const LIST_PATH = "/companies";

function revalidateAll(): void {
  revalidatePath(LIST_PATH);
  revalidatePath("/companies/[id]", "page");
}

export async function saveCompany(
  session: SessionPayload,
  input: unknown
): Promise<ActionState> {
  const parsed = companyFormSchema.safeParse({
    id: idField(input),
    name: textField(input, "name"),
    nameKana: textField(input, "nameKana"),
    statusId: textField(input, "statusId"),
    website: textField(input, "website"),
    address: textField(input, "address"),
    phone: textField(input, "phone"),
    note: textField(input, "note"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, name, nameKana, statusId, website, address, phone, note } = parsed.data;

  const values = {
    name,
    name_kana: nameKana,
    status_id: statusId,
    website,
    address,
    phone,
    note,
  };

  const { error } = id
    ? await supabase.from("companies").update(values).eq("id", id)
    : // 登録者はセッションから取る。リクエストの値を信用すると詐称できてしまう。
      await supabase.from("companies").insert({ ...values, created_by: session.email });

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return { status: "success", message: id ? "取引先を更新しました。" : "取引先を登録しました。" };
}

/**
 * ステータスだけを切り替える。
 * 一覧から編集シートを開かずに進み具合を動かせるようにするため。
 */
export async function updateCompanyStatus(
  companyId: string,
  input: unknown
): Promise<ActionState> {
  const raw = textField(input, "statusId");

  const parsed = z
    .object({
      id: z.uuid(),
      // 空文字は「ステータスなし」に戻す
      statusId: z.union([z.uuid(), z.literal("")]),
    })
    .safeParse({ id: companyId, statusId: raw });

  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase
    .from("companies")
    .update({ status_id: parsed.data.statusId === "" ? null : parsed.data.statusId })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return { status: "success", message: "ステータスを更新しました。" };
}

/**
 * 取引先を削除する。business_cards.company_id は on delete set null なので、
 * ぶら下がっていた名刺は消えず「会社未設定」になる。
 */
export async function deleteCompany(companyId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(companyId);
  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase.from("companies").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return {
    status: "success",
    message: "取引先を削除しました。名刺は残り、会社未設定になりました。",
  };
}
