import { z } from "zod";
import { optionalText, optionalUuid } from "@/lib/form";
import { addDays, fromDateTimeInput } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS, type ProjectColor } from "@/features/projects/schema";

export const CALENDAR_VIEWS = ["month", "week", "day"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = {
  month: "月",
  week: "週",
  day: "日",
};

export function toCalendarView(value: string | null | undefined): CalendarView {
  return CALENDAR_VIEWS.includes(value as CalendarView)
    ? (value as CalendarView)
    : "month";
}

const requiredDateTime = z
  .string()
  .trim()
  .min(1, "日時は必須です")
  .refine((value) => fromDateTimeInput(value) !== null, { message: "日時の形式が不正です" })
  .transform((value) => fromDateTimeInput(value) as Date);

/**
 * 予定の入力。終日かどうかで送られてくる値の形が変わる。
 *  - 通常: startsAt / endsAt は "YYYY-MM-DDTHH:mm"
 *  - 終日: "YYYY-MM-DD"（fromDateTimeInput が JST 0時として解釈する）
 *
 * 終日予定は DB 上「開始日の 0時 〜 終了日の翌 0時」で持つ。半開区間に揃えると
 * 通常の予定と同じ範囲判定コードで扱えるため。
 */
export const eventFormSchema = z
  .object({
    id: z.uuid().optional(),
    projectId: optionalUuid,
    title: z.string().trim().min(1, "タイトルは必須です").max(200),
    description: optionalText(4000),
    location: optionalText(300),
    // チェックボックスは checked のとき "on" を送り、未チェックでは何も送らない。
    // ブラウザ差で別の値が来ても落ちないよう、真とみなす値だけを列挙する。
    allDay: z
      .unknown()
      .transform((value) => value === "on" || value === "true" || value === true),
    startsAt: requiredDateTime,
    endsAt: requiredDateTime,
  })
  .transform((value) => ({
    ...value,
    // 終日は終了日を含める（利用者は「8/1〜8/3」と入力する）ので、翌 0 時に伸ばす
    endsAt: value.allDay ? addDays(value.endsAt, 1) : value.endsAt,
  }))
  .refine((value) => value.endsAt.getTime() >= value.startsAt.getTime(), {
    message: "終了は開始より後にしてください",
    path: ["endsAt"],
  });

export type EventFormInput = z.input<typeof eventFormSchema>;

export type EventItem = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: ProjectColor;
  title: string;
  description: string | null;
  location: string | null;
  /** ISO 文字列。 */
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  createdBy: string | null;
  createdByName: string | null;
};

/**
 * カレンダーに置く「1本の帯」。予定とタスクを同じ形に正規化して重ねて描くための型。
 * kind でどちら由来かを見分け、クリック時の遷移先を変える。
 */
export type CalendarEntry = {
  key: string;
  kind: "event" | "task" | "deadline";
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: ProjectColor;
  projectName: string | null;
};

/**
 * 帯の見た目。由来で描き分ける。
 *  - event    : 塗りつぶし
 *  - task     : 左に太い縦線（作業期間）
 *  - deadline : 破線の枠（締切そのもの）
 *
 * ホームの「今日の予定」でも同じ見た目を使うため、クライアント側の
 * コンポーネントではなくここに置く（Server Component からも呼べるように）。
 * tasks/schema.ts の TASK_STATUS_BADGE と同じ位置づけ。
 */
export function entryClassName(entry: CalendarEntry): string {
  const color = PROJECT_COLORS[entry.color];

  if (entry.kind === "deadline") {
    return cn("border border-dashed font-medium", color.chip);
  }
  if (entry.kind === "task") {
    return cn("border border-l-4", color.chip);
  }
  return cn("border", color.chip);
}
