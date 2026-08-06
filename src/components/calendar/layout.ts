import {
  MINUTES_PER_DAY,
  addDays,
  dateKey,
  minutesFromStartOfDay,
  overlaps,
  startOfDay,
} from "@/lib/datetime";
import type { CalendarEntry } from "@/features/calendar/schema";

export type Positioned = {
  entry: CalendarEntry;
  start: Date;
  end: Date;
};

/** その日（JST の 0時〜翌0時）に掛かる帯だけを抜き出す。 */
export function entriesOnDay(entries: CalendarEntry[], day: Date): CalendarEntry[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  return entries.filter((entry) =>
    overlaps(new Date(entry.startsAt), new Date(entry.endsAt), dayStart, dayEnd)
  );
}

/** 終日、または日をまたぐ帯か。月表示ではこれらを横棒として繋げて描く。 */
export function isSpanning(entry: CalendarEntry): boolean {
  if (entry.allDay) return true;

  const start = new Date(entry.startsAt);
  const end = new Date(entry.endsAt);
  // 終了がちょうど 0 時なら前日までの扱いにする（半開区間のため）
  const lastMoment = new Date(end.getTime() - 1);

  return dateKey(start) !== dateKey(lastMoment);
}

/* --------------------------- 月表示（週ごとの帯） --------------------------- */

export type WeekSegment = {
  entry: CalendarEntry;
  /** 週の何日目から始まるか（0 = 週の左端） */
  startCol: number;
  /** 何日分ぶち抜くか */
  span: number;
  /** この週より前から続いている / この週より後ろへ続く */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type WeekLanes = {
  lanes: WeekSegment[][];
  /** 表示しきれずに隠れた件数（列ごと）。"+N 件" の表示に使う。 */
  overflowByCol: number[];
};

/**
 * 1 週間ぶんの帯を「レーン」に積む。
 *
 * 同じレーンには日が重ならないものだけを入れ、空いている最上段から詰める。
 * これで複数日にまたがる予定が途中で折り返さず 1 本の横棒として繋がる
 * （Google カレンダーの月表示と同じ見え方）。
 */
export function buildWeekLanes(
  days: Date[],
  entries: CalendarEntry[],
  maxLanes: number
): WeekLanes {
  const weekStart = startOfDay(days[0]);
  const weekEnd = addDays(startOfDay(days[days.length - 1]), 1);

  const segments = entries
    .filter((entry) =>
      overlaps(new Date(entry.startsAt), new Date(entry.endsAt), weekStart, weekEnd)
    )
    .map((entry) => toSegment(entry, days, weekStart, weekEnd))
    .sort(compareSegments);

  const lanes: WeekSegment[][] = [];
  const occupied: boolean[][] = [];
  const overflowByCol = new Array(days.length).fill(0);

  for (const segment of segments) {
    const laneIndex = findFreeLane(occupied, segment);

    if (laneIndex >= maxLanes) {
      for (let col = segment.startCol; col < segment.startCol + segment.span; col += 1) {
        overflowByCol[col] += 1;
      }
      continue;
    }

    lanes[laneIndex] ??= [];
    occupied[laneIndex] ??= new Array(days.length).fill(false);
    lanes[laneIndex].push(segment);

    for (let col = segment.startCol; col < segment.startCol + segment.span; col += 1) {
      occupied[laneIndex][col] = true;
    }
  }

  return { lanes, overflowByCol };
}

function toSegment(
  entry: CalendarEntry,
  days: Date[],
  weekStart: Date,
  weekEnd: Date
): WeekSegment {
  const start = new Date(entry.startsAt);
  const end = new Date(entry.endsAt);
  // 半開区間なので、最終日は「終了の 1ms 前」が属する日
  const lastMoment = new Date(Math.max(start.getTime(), end.getTime() - 1));

  const keys = days.map((day) => dateKey(day));
  const startCol = Math.max(0, keys.indexOf(dateKey(start)));
  const foundEnd = keys.indexOf(dateKey(lastMoment));
  const endCol = foundEnd === -1 ? days.length - 1 : foundEnd;

  return {
    entry,
    startCol,
    span: Math.max(1, endCol - startCol + 1),
    continuesBefore: start.getTime() < weekStart.getTime(),
    continuesAfter: end.getTime() > weekEnd.getTime(),
  };
}

/** 長い帯・終日を上に、そのあと開始が早い順。見た目の安定と可読性のため。 */
function compareSegments(a: WeekSegment, b: WeekSegment): number {
  if (a.span !== b.span) return b.span - a.span;

  const aAllDay = Number(a.entry.allDay);
  const bAllDay = Number(b.entry.allDay);
  if (aAllDay !== bAllDay) return bAllDay - aAllDay;

  const diff = new Date(a.entry.startsAt).getTime() - new Date(b.entry.startsAt).getTime();
  return diff !== 0 ? diff : a.entry.key.localeCompare(b.entry.key);
}

function findFreeLane(occupied: boolean[][], segment: WeekSegment): number {
  let lane = 0;

  while (true) {
    const row = occupied[lane];
    const free =
      !row ||
      Array.from({ length: segment.span }, (_, offset) => row[segment.startCol + offset]).every(
        (taken) => !taken
      );

    if (free) return lane;
    lane += 1;
  }
}

/* ------------------------- 週 / 日表示（時間軸） ------------------------- */

export type TimedBlock = {
  entry: CalendarEntry;
  /** 0〜100 の割合。1日の高さに対する位置と長さ。 */
  topPct: number;
  heightPct: number;
  /** 同時刻に重なるものを横に並べるための位置。 */
  leftPct: number;
  widthPct: number;
};

/** 時間軸に置いたときに潰れないよう、最低これだけの長さを確保する。 */
const MIN_BLOCK_MINUTES = 20;

/**
 * その日の時間軸に置く帯の位置を計算する。
 * 重なっているものは同じクラスタにまとめ、クラスタ内で列に振り分けて横幅を割る。
 */
export function layoutTimedEntries(entries: CalendarEntry[], day: Date): TimedBlock[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  const items = entries
    .filter((entry) => !isSpanning(entry))
    .map((entry) => {
      // 日をまたぐものはこの日の範囲に切り詰める
      const start = new Date(Math.max(new Date(entry.startsAt).getTime(), dayStart.getTime()));
      const end = new Date(Math.min(new Date(entry.endsAt).getTime(), dayEnd.getTime()));

      const startMin = minutesFromStartOfDay(start);
      const rawEndMin = start.getTime() === end.getTime() ? startMin : minutesFromStartOfDay(end) || MINUTES_PER_DAY;
      const endMin = Math.min(MINUTES_PER_DAY, Math.max(rawEndMin, startMin + MIN_BLOCK_MINUTES));

      return { entry, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const blocks: TimedBlock[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;

    // クラスタ内で、直前の終了を超えたものから順に同じ列を再利用する
    const columns: number[] = [];
    const assigned = cluster.map((item) => {
      let column = columns.findIndex((end) => end <= item.startMin);
      if (column === -1) {
        column = columns.length;
      }
      columns[column] = item.endMin;
      return { ...item, column };
    });

    const columnCount = columns.length;

    for (const item of assigned) {
      blocks.push({
        entry: item.entry,
        topPct: (item.startMin / MINUTES_PER_DAY) * 100,
        heightPct: ((item.endMin - item.startMin) / MINUTES_PER_DAY) * 100,
        leftPct: (item.column / columnCount) * 100,
        widthPct: 100 / columnCount,
      });
    }

    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of items) {
    if (item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();

  return blocks;
}

/** 週 / 日表示の上部に固定表示する、終日・複数日の帯。 */
export function spanningEntriesOnDay(entries: CalendarEntry[], day: Date): CalendarEntry[] {
  return entriesOnDay(entries, day).filter(isSpanning);
}
