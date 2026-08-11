import { z } from "zod";
import { NONE_VALUE, optionalText, optionalUuid } from "@/lib/form";
import { addDays, fromDateTimeInput } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS, type ProjectColor } from "@/features/projects/schema";
import { RECURRENCE_FREQS, type Recurrence } from "@/features/calendar/recurrence";

export const CALENDAR_VIEWS = ["month", "week", "day"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = {
  month: "月",
  week: "週",
  day: "日",
};

/** 既定は週。日々の業務でいちばん見る単位のため。 */
export function toCalendarView(value: string | null | undefined): CalendarView {
  return CALENDAR_VIEWS.includes(value as CalendarView)
    ? (value as CalendarView)
    : "week";
}

/**
 * 帯を何で塗り分けるか。
 *  - project : 所属プロジェクトの識別色（従来どおり）
 *  - user    : 担当者の色。誰の予定かをひと目で見るため。予定に担当者が
 *              複数いるときは先頭の 1 人、1 人もいなければ作成者を使う。
 *
 * 表示範囲（view / date）と同じく URL（?color=）だけで決まる。色は
 * サーバー側で解決してから CalendarEntry.color に入れるので、描画側は
 * どちらのモードかを知らなくてよい。
 */
export const CALENDAR_COLOR_MODES = ["project", "user"] as const;
export type CalendarColorMode = (typeof CALENDAR_COLOR_MODES)[number];

export const CALENDAR_COLOR_MODE_LABELS: Record<CalendarColorMode, string> = {
  project: "プロジェクト",
  user: "担当者",
};

/** 既定は担当者。まず「誰の予定か」を見たいため。 */
export function toCalendarColorMode(value: string | null | undefined): CalendarColorMode {
  return CALENDAR_COLOR_MODES.includes(value as CalendarColorMode)
    ? (value as CalendarColorMode)
    : "user";
}

/**
 * カンマ区切りのメールアドレス列を配列にする。
 * 空文字は「担当者なし」。重複は畳み、不正なものが 1 つでもあれば弾く。
 */
const assigneeList = z
  .string()
  .trim()
  .transform((value) =>
    value === "" ? [] : [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
  )
  .pipe(z.array(z.email("担当者の指定が不正です")).max(50));

const requiredDateTime = z
  .string()
  .trim()
  .min(1, "日時は必須です")
  .refine((value) => fromDateTimeInput(value) !== null, { message: "日時の形式が不正です" })
  .transform((value) => fromDateTimeInput(value) as Date);

/**
 * タイトルの頭に付ける種別。予定シートのボタンから差し込む。
 *
 * 増減はここだけを直せばよい。付け外しの判定は「先頭の【…】を種別とみなす」
 * という規則で行うので（components/calendar/event-sheet.tsx）、
 * 全角の隅付き括弧で囲む形は崩さないこと。
 */
export const EVENT_TITLE_PRESETS = [
  "【※暫定※】",
  "【MTG】",
  "【定例】",
  "【個人】",
  "【対面】",
] as const;

/** タイトル先頭の種別を取り除く。付いていなければそのまま返す。 */
export function stripTitlePreset(title: string): string {
  return title.replace(/^【[^】]*】\s*/, "");
}

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
    // 担当者はチェックボックス群だが、FormData を Object.fromEntries する都合で
    // 同名の複数値は最後の 1 つしか残らない。そのため画面側で hidden input に
    // カンマ区切りで詰めて送る（DateTimeField と同じやり方）。
    assignees: assigneeList,
    recurrenceFreq: z
      .string()
      .trim()
      .transform((value) => (value === "" || value === NONE_VALUE ? null : value))
      .pipe(z.enum(RECURRENCE_FREQS).nullable()),
    recurrenceInterval: z
      .string()
      .trim()
      .transform((value) => (value === "" ? 1 : Number(value)))
      .pipe(z.number().int().min(1, "1 以上にしてください").max(52, "52 以下にしてください")),
    // <input type="date"> の値。空なら「終わりなし」。
    recurrenceUntil: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: "終了日の形式が不正です",
      }),
  })
  .transform((value) => ({
    ...value,
    // 終日は終了日を含める（利用者は「8/1〜8/3」と入力する）ので、翌 0 時に伸ばす
    endsAt: value.allDay ? addDays(value.endsAt, 1) : value.endsAt,
    // 繰り返さないなら、間隔と終了日は持ち越さない
    recurrenceInterval: value.recurrenceFreq ? value.recurrenceInterval : 1,
    recurrenceUntil: value.recurrenceFreq ? value.recurrenceUntil : null,
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
  /** 担当者のメールアドレスと表示名。並びは対応する。 */
  assignees: string[];
  assigneeNames: string[];
  /** null なら繰り返さない。startsAt / endsAt は 1 回目を表す。 */
  recurrence: Recurrence | null;
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
  /** 表示に使う色。色分けモードに応じてサーバー側で解決済み。 */
  color: ProjectColor;
  projectName: string | null;
  /** 「担当者」で色分けしたときの色の由来。 */
  ownerName: string | null;
  /**
   * 繰り返しの何回目かを指す日付（"YYYY-MM-DD"）。予定のみ。
   * 「この回だけ削除」でどの回かを伝えるために持つ。
   */
  occurrenceDate?: string;
  /** 繰り返しの予定か。帯にアイコンを出す判断に使う。 */
  repeating?: boolean;
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
