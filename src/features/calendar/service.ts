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
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, projectId, title, description, location, allDay, startsAt, endsAt } = parsed.data;

  const values = {
    project_id: projectId,
    title,
    description,
    location,
    all_day: allDay,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
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
