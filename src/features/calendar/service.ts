import "server-only";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidateWorkspace } from "@/lib/revalidate";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { eventFormSchema } from "@/features/calendar/schema";
import type { SessionPayload } from "@/lib/session";

export async function saveEvent(session: SessionPayload, input: unknown): Promise<ActionState> {
  const parsed = eventFormSchema.safeParse({
    id: idField(input),
    projectId: textField(input, "projectId"),
    title: textField(input, "title"),
    description: textField(input, "description"),
    location: textField(input, "location"),
    allDay: (input as { allDay?: unknown })?.allDay,
    startsAt: textField(input, "startsAt"),
    endsAt: textField(input, "endsAt"),
    assignees: textField(input, "assignees"),
    recurrenceFreq: textField(input, "recurrenceFreq"),
    recurrenceInterval: textField(input, "recurrenceInterval"),
    recurrenceUntil: textField(input, "recurrenceUntil"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const {
    id,
    projectId,
    title,
    description,
    location,
    allDay,
    startsAt,
    endsAt,
    assignees,
    recurrenceFreq,
    recurrenceInterval,
    recurrenceUntil,
  } = parsed.data;

  const values = {
    project_id: projectId,
    title,
    description,
    location,
    all_day: allDay,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    assignees,
    recurrence_freq: recurrenceFreq,
    recurrence_interval: recurrenceInterval,
    recurrence_until: recurrenceUntil,
    // 繰り返しをやめたら「この回だけ削除」の記録も意味を失うので消す
    ...(recurrenceFreq ? {} : { recurrence_excluded_dates: [] }),
  };

  const { error } = id
    ? await supabase.from("events").update(values).eq("id", id)
    : await supabase.from("events").insert({ ...values, created_by: session.email });

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return { status: "success", message: id ? "予定を更新しました。" : "予定を登録しました。" };
}

const skipSchema = z.object({
  id: z.uuid(),
  // 除外する回の開始日（"YYYY-MM-DD"）
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "対象の日付が不正です"),
});

/**
 * 繰り返しの「この回だけ」を消す。
 *
 * 行を消すのではなく、除外日として記録する。繰り返しは大元の 1 行から展開して
 * いるので、1 回だけ消すには「この日は出さない」と覚えておくしかない。
 */
export async function skipEventOccurrence(
  eventId: string,
  input: unknown
): Promise<ActionState> {
  const parsed = skipSchema.safeParse({
    id: eventId,
    occurrenceDate: textField(input, "occurrenceDate"),
  });

  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { data: event, error: readError } = await supabase
    .from("events")
    .select("recurrence_freq, recurrence_excluded_dates")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (readError || !event) {
    return { status: "error", message: "予定が見つかりませんでした。" };
  }

  if (!event.recurrence_freq) {
    return { status: "error", message: "繰り返しの予定ではありません。" };
  }

  const excluded = new Set(event.recurrence_excluded_dates ?? []);
  excluded.add(parsed.data.occurrenceDate);

  const { error } = await supabase
    .from("events")
    .update({ recurrence_excluded_dates: [...excluded].sort() })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return { status: "success", message: "この回の予定を削除しました。" };
}

/** 予定そのものを消す。繰り返しの場合は全回が消える。 */
export async function deleteEvent(eventId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(eventId);
  if (!parsed.success) {
    return { status: "error", message: "不正な予定です。" };
  }

  const { error } = await supabase.from("events").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return { status: "success", message: "予定を削除しました。" };
}
