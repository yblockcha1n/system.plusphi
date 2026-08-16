import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { businessCardFormSchema } from "@/features/business-cards/schema";
import { deleteCardImage, storeCardImage } from "@/features/business-cards/storage";
import type { SessionPayload } from "@/lib/session";

const LIST_PATH = "/companies";

function revalidateAll(): void {
  revalidatePath(LIST_PATH);
  revalidatePath("/companies/[id]", "page");
  revalidatePath("/business-cards");
}

export async function saveBusinessCard(
  session: SessionPayload,
  input: unknown
): Promise<ActionState> {
  const parsed = businessCardFormSchema.safeParse({
    id: idField(input),
    companyId: textField(input, "companyId"),
    fullName: textField(input, "fullName"),
    fullNameKana: textField(input, "fullNameKana"),
    department: textField(input, "department"),
    title: textField(input, "title"),
    email: textField(input, "email"),
    phone: textField(input, "phone"),
    mobile: textField(input, "mobile"),
    digitalCardUrl: textField(input, "digitalCardUrl"),
    source: textField(input, "source"),
    receivedAt: textField(input, "receivedAt"),
    note: textField(input, "note"),
    imageDataUrl: textField(input, "imageDataUrl"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, imageDataUrl, ...fields } = parsed.data;

  const values = {
    company_id: fields.companyId,
    full_name: fields.fullName,
    full_name_kana: fields.fullNameKana,
    department: fields.department,
    title: fields.title,
    email: fields.email,
    phone: fields.phone,
    mobile: fields.mobile,
    digital_card_url: fields.digitalCardUrl,
    source: fields.source,
    received_at: fields.receivedAt,
    note: fields.note,
  };

  const { data, error } = id
    ? await supabase.from("business_cards").update(values).eq("id", id).select("id").single()
    : // 登録者はセッションから取る。リクエストの値を信用すると詐称できてしまう。
      await supabase
        .from("business_cards")
        .insert({ ...values, created_by: session.email })
        .select("id")
        .single();

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  // 画像は送られてきたときだけ差し替える。空なら既存のものをそのまま残す。
  if (imageDataUrl) {
    const path = await storeCardImage(data.id, imageDataUrl);

    if (path) {
      await supabase.from("business_cards").update({ image_path: path }).eq("id", data.id);
    }
  }

  revalidateAll();
  return { status: "success", message: id ? "名刺を更新しました。" : "名刺を登録しました。" };
}

export async function deleteBusinessCard(cardId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(cardId);
  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { data: row } = await supabase
    .from("business_cards")
    .select("image_path")
    .eq("id", parsed.data)
    .maybeSingle();

  const { error } = await supabase.from("business_cards").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  // ストレージは外部キーで消えないので自分で片付ける
  await deleteCardImage(row?.image_path ?? null);

  revalidateAll();
  return { status: "success", message: "名刺を削除しました。" };
}
