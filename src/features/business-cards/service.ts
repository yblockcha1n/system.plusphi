import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { businessCardFormSchema } from "@/features/business-cards/schema";
import { deleteCardImage } from "@/features/business-cards/storage";
import { looksLikeSameCompany } from "@/features/business-cards/company-match";
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
    statusId: textField(input, "statusId"),
    companyName: textField(input, "companyName"),
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
    imagePath: textField(input, "imagePath"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, imagePath, companyName, ...fields } = parsed.data;

  /*
   * 取引先が選ばれていないが会社名だけ読めている場合は、ここで用意する。
   *
   * 「先に取引先を作ってから名刺を登録する」を強いると、名刺を溜める動作が
   * 途切れてしまう。表記ゆれで会社が乱立しないよう、作る前に必ず既存と照合する。
   *
   * 会社名が無い相手（個人事業主・知人など）はそのまま。会社に属さない名刺も
   * 単独で成立し、名刺自身のステータスで進み具合を追える。
   */
  const companyId = fields.companyId ?? (await resolveCompany(session, companyName));

  const values = {
    company_id: companyId,
    status_id: fields.statusId,
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
    // 画像は読み取りの時点で保存済み。空なら既存のものを残す。
    ...(imagePath ? { image_path: imagePath } : {}),
  };

  const { error } = id
    ? await supabase.from("business_cards").update(values).eq("id", id)
    : // 登録者はセッションから取る。リクエストの値を信用すると詐称できてしまう。
      await supabase
        .from("business_cards")
        .insert({ ...values, created_by: session.email });

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return { status: "success", message: id ? "名刺を更新しました。" : "名刺を登録しました。" };
}

/**
 * 会社名から取引先を用意する。既にあればその id、無ければ作って返す。
 *
 * @returns 会社名が空なら null（会社に属さない名刺として扱う）。
 */
async function resolveCompany(
  session: SessionPayload,
  companyName: string | null
): Promise<string | null> {
  if (!companyName) return null;

  const { data, error } = await supabase.from("companies").select("id, name");

  if (error) {
    console.error("[business-cards] 取引先の照合に失敗しました", { message: error.message });
    return null;
  }

  const existing = data.find((row) => looksLikeSameCompany(row.name, companyName));
  if (existing) return existing.id;

  const created = await supabase
    .from("companies")
    .insert({ name: companyName, created_by: session.email })
    .select("id")
    .single();

  if (created.error) {
    console.error("[business-cards] 取引先の作成に失敗しました", {
      companyName,
      message: created.error.message,
    });
    return null;
  }

  return created.data.id;
}

/**
 * 名刺のステータスだけを切り替える。
 * 会社に属さない相手も単独で追えるようにするための入口。
 */
export async function updateBusinessCardStatus(
  cardId: string,
  input: unknown
): Promise<ActionState> {
  const parsed = z
    .object({
      id: z.uuid(),
      // 空文字は「ステータスなし」に戻す
      statusId: z.union([z.uuid(), z.literal("")]),
    })
    .safeParse({ id: cardId, statusId: textField(input, "statusId") });

  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase
    .from("business_cards")
    .update({ status_id: parsed.data.statusId === "" ? null : parsed.data.statusId })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return { status: "success", message: "ステータスを更新しました。" };
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
