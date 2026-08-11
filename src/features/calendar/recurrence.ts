import { addDays, addMonths, dateKey, parseDateKey, partsOf } from "@/lib/datetime";

/**
 * 予定の繰り返し。
 *
 * 大元の 1 行（starts_at / ends_at が 1 回目）にルールを持たせ、表示する範囲ぶんだけ
 * ここで展開する。DB に何百行も並べない理由は 0006 のマイグレーションのコメント参照。
 *
 * 日付の計算は lib/datetime.ts の JST 固定ヘルパーだけを使う。ブラウザのローカル
 * タイムゾーンで解釈すると、サーバーとクライアントで回数がずれる。
 */

export const RECURRENCE_FREQS = ["daily", "weekly", "monthly"] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

export type Recurrence = {
  freq: RecurrenceFreq;
  /** 何回ごとか。weekly かつ 2 なら隔週。 */
  interval: number;
  /** 繰り返しの終わり（この日を含む）。"YYYY-MM-DD"。null なら終わりなし。 */
  until: string | null;
  /** 「この回だけ削除」した回の開始日（"YYYY-MM-DD"）。 */
  excludedDates: string[];
};

export type Occurrence = {
  /** この回の開始・終了（ISO 文字列）。 */
  startsAt: string;
  endsAt: string;
  /** この回を指す日付キー。「この回だけ削除」で使う。 */
  occurrenceDate: string;
};

/**
 * 際限なく回らないための上限。範囲が数週間ぶんしか無いのに毎日の繰り返しを
 * 何年ぶんも回すことは無いが、until 無し × 不正な interval のような入力で
 * 止まらなくなるのを防ぐ。
 */
const MAX_OCCURRENCES = 400;

function shift(from: Date, freq: RecurrenceFreq, steps: number, interval: number): Date {
  if (freq === "daily") return addDays(from, steps * interval);
  if (freq === "weekly") return addDays(from, steps * interval * 7);
  // monthly は「同じ日」。月末はクランプされる（1/31 の 1ヶ月後は 2/28）。
  return addMonths(from, steps * interval);
}

/**
 * [rangeStart, rangeEnd) に掛かる回を列挙する。
 *
 * 繰り返しでない予定は、範囲に掛かっていれば 1 件、掛かっていなければ 0 件。
 * 呼び出し側で分岐しなくて済むよう、ここで両方を扱う。
 */
export function expandOccurrences(
  event: {
    startsAt: string;
    endsAt: string;
    recurrence: Recurrence | null;
  },
  rangeStart: Date,
  rangeEnd: Date
): Occurrence[] {
  const firstStart = new Date(event.startsAt);
  const firstEnd = new Date(event.endsAt);
  const durationMs = firstEnd.getTime() - firstStart.getTime();

  const overlaps = (start: Date, end: Date) =>
    start.getTime() < rangeEnd.getTime() && end.getTime() > rangeStart.getTime();

  if (!event.recurrence) {
    return overlaps(firstStart, firstEnd)
      ? [
          {
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            occurrenceDate: dateKey(firstStart),
          },
        ]
      : [];
  }

  const { freq, interval, until, excludedDates } = event.recurrence;
  const safeInterval = Number.isFinite(interval) && interval >= 1 ? Math.floor(interval) : 1;

  // until はその日を含めたいので、翌 0 時を上限にする
  const untilDate = parseDateKey(until);
  const limit = untilDate ? addDays(untilDate, 1) : null;

  const excluded = new Set(excludedDates);
  const occurrences: Occurrence[] = [];

  // 範囲の手前から始まる回も拾う必要がある（長い予定や月またぎ）。
  // 1 回目から順に進め、範囲を追い越したら打ち切る。
  const startIndex = firstOccurrenceIndex(firstStart, freq, safeInterval, rangeStart, durationMs);

  for (let step = startIndex; step < startIndex + MAX_OCCURRENCES; step += 1) {
    const start = shift(firstStart, freq, step, safeInterval);

    // 範囲より後ろに出たら、以降はすべて範囲外
    if (start.getTime() >= rangeEnd.getTime()) break;
    if (limit && start.getTime() >= limit.getTime()) break;

    const end = new Date(start.getTime() + durationMs);
    const occurrenceDate = dateKey(start);

    if (!excluded.has(occurrenceDate) && overlaps(start, end)) {
      occurrences.push({
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        occurrenceDate,
      });
    }
  }

  return occurrences;
}

/**
 * 範囲の手前にある回を 1 件ずつ数えずに飛ばすための概算。
 *
 * 毎日の繰り返しを何年ぶんも 1 日ずつ進めると、月表示を開くたびに数千回の
 * ループになる。1 回ぶん手前から始めることで、予定の長さで範囲に掛かる回も
 * 取りこぼさない。
 */
function firstOccurrenceIndex(
  firstStart: Date,
  freq: RecurrenceFreq,
  interval: number,
  rangeStart: Date,
  durationMs: number
): number {
  // 予定の長さぶん手前から探し始める（長い予定が範囲に掛かっている場合に備える）
  const target = new Date(rangeStart.getTime() - durationMs);
  const diffMs = target.getTime() - firstStart.getTime();

  if (diffMs <= 0) return 0;

  if (freq === "monthly") {
    const from = partsOf(firstStart);
    const to = partsOf(target);
    const months = (to.year - from.year) * 12 + (to.month - from.month);
    return Math.max(0, Math.floor(months / interval) - 1);
  }

  const unitMs = (freq === "daily" ? 1 : 7) * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor(diffMs / (unitMs * interval)) - 1);
}

/** DB の行から Recurrence を組み立てる。freq が無ければ繰り返しなし。 */
export function toRecurrence(row: {
  recurrence_freq: RecurrenceFreq | null;
  recurrence_interval: number;
  recurrence_until: string | null;
  recurrence_excluded_dates: string[];
}): Recurrence | null {
  if (!row.recurrence_freq) return null;

  return {
    freq: row.recurrence_freq,
    interval: row.recurrence_interval,
    until: row.recurrence_until,
    excludedDates: row.recurrence_excluded_dates ?? [],
  };
}

/* -------------------------------- 表示 -------------------------------- */

export const RECURRENCE_LABELS: Record<RecurrenceFreq, string> = {
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
};

/** 「毎週」「隔週」「3ヶ月ごと」のような表示。 */
export function describeRecurrence(recurrence: Recurrence | null): string | null {
  if (!recurrence) return null;

  const { freq, interval, until } = recurrence;

  const base =
    interval === 1
      ? RECURRENCE_LABELS[freq]
      : freq === "weekly" && interval === 2
        ? "隔週"
        : `${interval}${freq === "daily" ? "日" : freq === "weekly" ? "週間" : "ヶ月"}ごと`;

  const untilDate = parseDateKey(until);

  return untilDate ? `${base}（${dateKey(untilDate)} まで）` : base;
}
