/**
 * 日時はすべて JST（Asia/Tokyo）固定で扱う。
 *
 * サーバー（Vercel は UTC）とブラウザ（利用者のローカル）でタイムゾーンが違うと、
 * Server Component が描いた日付とクライアントが再計算した日付がずれてハイドレーション
 * エラーになる。`new Date()` のローカルメソッド（getHours 等）は環境依存なので使わず、
 * 「UTC+9 を足した Date に対して getUTC* を読む」形に統一する。
 *
 * JST はサマータイムが無く常に UTC+9 なので、この単純な足し引きで厳密に正しい。
 */

export const TIME_ZONE = "Asia/Tokyo";

const OFFSET_MS = 9 * 60 * 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MINUTES_PER_DAY = 24 * 60;

/** JST の壁時計をそのまま UTC として読めるようにずらした Date（計算用の内部表現）。 */
function toWall(date: Date): Date {
  return new Date(date.getTime() + OFFSET_MS);
}

export type DateParts = {
  year: number;
  /** 0 始まり（Date と同じ） */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = 日曜 */
  weekday: number;
};

export function partsOf(date: Date): DateParts {
  const wall = toWall(date);
  return {
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth(),
    day: wall.getUTCDate(),
    hour: wall.getUTCHours(),
    minute: wall.getUTCMinutes(),
    weekday: wall.getUTCDay(),
  };
}

/** JST の年月日時分から Date（= 絶対時刻）を作る。 */
export function fromParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MS);
}

/* ------------------------------ 日付キー ------------------------------ */

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** JST における "YYYY-MM-DD"。日付の同一判定とグルーピングのキーに使う。 */
export function dateKey(date: Date): string {
  const { year, month, day } = partsOf(date);
  return `${pad(year, 4)}-${pad(month + 1)}-${pad(day)}`;
}

/** "YYYY-MM-DD" を JST 0時の Date にする。不正な値は null。 */
export function parseDateKey(key: string | null | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;

  const [year, month, day] = key.split("-").map(Number);
  const date = fromParts(year, month - 1, day);

  // "2026-02-31" のような繰り上がる日付を弾く
  return dateKey(date) === key ? date : null;
}

/* --------------------------- input との相互変換 --------------------------- */

/** <input type="datetime-local"> 用の "YYYY-MM-DDTHH:mm"（JST）。 */
export function toDateTimeInput(date: Date | null): string {
  if (!date) return "";
  const { hour, minute } = partsOf(date);
  return `${dateKey(date)}T${pad(hour)}:${pad(minute)}`;
}

/** <input type="date"> 用の "YYYY-MM-DD"（JST）。 */
export function toDateInput(date: Date | null): string {
  return date ? dateKey(date) : "";
}

/**
 * datetime-local / date の値を JST として解釈して Date にする。
 * ブラウザのローカルタイムゾーンでは解釈しない（`new Date(value)` を使わない理由）。
 */
export function fromDateTimeInput(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = fromParts(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0)
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

/* -------------------------------- 加算 -------------------------------- */

export function addDays(date: Date, amount: number): Date {
  const { year, month, day, hour, minute } = partsOf(date);
  return fromParts(year, month + 0, day + amount, hour, minute);
}

export function addMonths(date: Date, amount: number): Date {
  const { year, month, day, hour, minute } = partsOf(date);
  // 1/31 の 1ヶ月後が 3/3 にならないよう、月末にクランプする
  const lastDay = daysInMonth(year, month + amount);
  return fromParts(year, month + amount, Math.min(day, lastDay), hour, minute);
}

export function addMinutes(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 60_000);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/* ------------------------------- 境界 ------------------------------- */

export function startOfDay(date: Date): Date {
  const { year, month, day } = partsOf(date);
  return fromParts(year, month, day);
}

export function endOfDay(date: Date): Date {
  return addDays(startOfDay(date), 1);
}

/** 週の始まりは日曜（Google カレンダーの既定に合わせる）。 */
export function startOfWeek(date: Date): Date {
  const { weekday } = partsOf(date);
  return addDays(startOfDay(date), -weekday);
}

export function startOfMonth(date: Date): Date {
  const { year, month } = partsOf(date);
  return fromParts(year, month, 1);
}

export function endOfMonth(date: Date): Date {
  const { year, month } = partsOf(date);
  return fromParts(year, month + 1, 1);
}

/** 月表示のグリッド。前後の月にはみ出した日を含む 6 週 × 7 日。 */
export function monthGridStart(date: Date): Date {
  return startOfWeek(startOfMonth(date));
}

export function buildDayGrid(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

/** その日の 0 時からの経過分。時間軸グリッドの縦位置に使う。 */
export function minutesFromStartOfDay(date: Date): number {
  const { hour, minute } = partsOf(date);
  return hour * 60 + minute;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

/** [aStart, aEnd) と [bStart, bEnd) が重なるか。 */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/* ------------------------------- 表示 ------------------------------- */

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: TIME_ZONE, ...options });

const dateFormat = formatter({ year: "numeric", month: "2-digit", day: "2-digit" });
const shortDateFormat = formatter({ month: "numeric", day: "numeric" });
const weekdayDateFormat = formatter({ month: "numeric", day: "numeric", weekday: "short" });
const timeFormat = formatter({ hour: "2-digit", minute: "2-digit", hour12: false });
const dateTimeFormat = formatter({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const monthTitleFormat = formatter({ year: "numeric", month: "long" });
const fullDateFormat = formatter({
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export const formatDate = (date: Date) => dateFormat.format(date);
export const formatShortDate = (date: Date) => shortDateFormat.format(date);
export const formatWeekdayDate = (date: Date) => weekdayDateFormat.format(date);
export const formatTime = (date: Date) => timeFormat.format(date);
export const formatDateTime = (date: Date) => dateTimeFormat.format(date);
export const formatMonthTitle = (date: Date) => monthTitleFormat.format(date);
export const formatFullDate = (date: Date) => fullDateFormat.format(date);

/** 予定の期間表示。同日なら "8/1 10:00 – 11:00"、またがるなら両方の日付を出す。 */
export function formatRange(start: Date, end: Date, allDay: boolean): string {
  if (allDay) {
    // 終日の end は「翌 0 時」で持っているため、表示は 1 日戻す
    const lastDay = addDays(end, -1);
    return isSameDay(start, lastDay)
      ? `${formatWeekdayDate(start)}（終日）`
      : `${formatWeekdayDate(start)} – ${formatWeekdayDate(lastDay)}（終日）`;
  }

  return isSameDay(start, end)
    ? `${formatWeekdayDate(start)} ${formatTime(start)} – ${formatTime(end)}`
    : `${formatWeekdayDate(start)} ${formatTime(start)} – ${formatWeekdayDate(end)} ${formatTime(end)}`;
}

/** 締切までの残り。過ぎていれば負の日数。当日は 0。 */
export function daysUntil(target: Date, now: Date): number {
  return Math.round(
    (startOfDay(target).getTime() - startOfDay(now).getTime()) / MS_PER_DAY
  );
}

/** 「今日」「明日」「3日後」「2日超過」のような相対表現。 */
export function formatRelativeDay(target: Date, now: Date): string {
  const diff = daysUntil(target, now);

  if (diff === 0) return "今日";
  if (diff === 1) return "明日";
  if (diff === -1) return "昨日";
  if (diff < 0) return `${-diff}日超過`;
  return `${diff}日後`;
}
