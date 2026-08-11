import { getHolidaysInYear } from "jp-holidays";
import { partsOf } from "@/lib/datetime";

/**
 * 日本の祝日。
 *
 * jp-holidays はルールから計算するため、内閣府の公表を待たずに将来の年も出せる
 * （1948〜2099）。カレンダーは何年先へでもめくれるので、データ埋め込み型より
 * こちらが向いている。
 *
 * 注意: このライブラリが返す Date は「ローカル時刻の 0 時」で作られている。
 * 絶対時刻としては実行環境のタイムゾーンでずれるため、lib/datetime.ts の
 * dateKey（JST に直してから読む）を通してはいけない。ローカルの
 * 年・月・日をそのまま読むのが正しい。
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** ライブラリが返す Date から "YYYY-MM-DD" を作る。ローカルの暦日をそのまま読む。 */
function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 年ごとの結果は変わらないので、プロセス内で使い回す。 */
const cache = new Map<number, Record<string, string>>();

function holidaysOf(year: number): Record<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const map: Record<string, string> = {};

  for (const holiday of getHolidaysInYear(year)) {
    map[localDateKey(holiday.date)] = holiday.name;
  }

  cache.set(year, map);
  return map;
}

/**
 * [rangeStart, rangeEnd) に掛かる祝日を "YYYY-MM-DD" → 名称 で返す。
 *
 * 月表示は前後の月にはみ出すため、範囲が年をまたぐことがある。
 * 年の判定は JST で行う（partsOf）。
 */
export function getHolidayMap(rangeStart: Date, rangeEnd: Date): Record<string, string> {
  const fromYear = partsOf(rangeStart).year;
  const toYear = partsOf(rangeEnd).year;

  const map: Record<string, string> = {};

  for (let year = fromYear; year <= toYear; year += 1) {
    Object.assign(map, holidaysOf(year));
  }

  return map;
}
