"use client";

import type { CalendarEntry } from "@/features/calendar/schema";
import { WEEKDAY_LABELS, dateKey, fromParts, partsOf } from "@/lib/datetime";
import { buildWeekLanes } from "@/components/calendar/layout";
import { EntryChip } from "@/components/calendar/entry-chip";
import { cn } from "@/lib/utils";

/** 1 セルに積む帯の最大数。溢れたぶんは "+N" にまとめる。 */
const MAX_LANES = 3;

type MonthViewProps = {
  /** 6 週 × 7 日ぶんの日付（前後の月にはみ出したぶんを含む）。 */
  days: Date[];
  /** 表示中の月。当月外の日を淡く描くために使う。 */
  anchor: Date;
  entries: CalendarEntry[];
  todayKey: string;
  onSelectDay: (day: Date) => void;
  onSelectEntry: (entry: CalendarEntry) => void;
};

export function MonthView({
  days,
  anchor,
  entries,
  todayKey,
  onSelectDay,
  onSelectEntry,
}: MonthViewProps) {
  const anchorMonth = partsOf(anchor).month;
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7)
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col border">
      <div className="grid shrink-0 grid-cols-7 border-b bg-muted/50">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "border-r py-1.5 text-center text-xs font-medium last:border-r-0",
              index === 0 && "text-destructive",
              index === 6 && "text-project-blue"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {weeks.map((week) => (
          <WeekRow
            key={dateKey(week[0])}
            week={week}
            anchorMonth={anchorMonth}
            entries={entries}
            todayKey={todayKey}
            onSelectDay={onSelectDay}
            onSelectEntry={onSelectEntry}
          />
        ))}
      </div>
    </div>
  );
}

function WeekRow({
  week,
  anchorMonth,
  entries,
  todayKey,
  onSelectDay,
  onSelectEntry,
}: {
  week: Date[];
  anchorMonth: number;
  entries: CalendarEntry[];
  todayKey: string;
  onSelectDay: (day: Date) => void;
  onSelectEntry: (entry: CalendarEntry) => void;
}) {
  const { lanes, overflowByCol } = buildWeekLanes(week, entries, MAX_LANES);

  return (
    <div className="relative min-h-24 flex-1 border-b last:border-b-0 sm:min-h-28">
      {/* クリックで新規作成するための背景。縦罫線もここが持つ。 */}
      <div className="absolute inset-0 grid grid-cols-7">
        {week.map((day) => (
          <button
            key={dateKey(day)}
            type="button"
            onClick={() => onSelectDay(day)}
            aria-label={`${partsOf(day).month + 1}月${partsOf(day).day}日に予定を追加`}
            className={cn(
              "border-r transition-colors last:border-r-0 hover:bg-muted/40",
              partsOf(day).month !== anchorMonth && "bg-muted/30"
            )}
          />
        ))}
      </div>

      {/* 帯は背景の上に重ねる。ボタン以外はクリックを背景へ通す。 */}
      <div className="pointer-events-none relative grid grid-cols-7 gap-y-0.5 px-0.5 pb-1">
        {week.map((day, column) => {
          const { day: dayNumber, month } = partsOf(day);
          const isToday = dateKey(day) === todayKey;

          return (
            <div
              key={dateKey(day)}
              style={{ gridColumn: column + 1, gridRow: 1 }}
              className="px-1 pt-1 text-right"
            >
              <span
                className={cn(
                  "inline-block min-w-5 px-1 text-xs leading-5",
                  isToday && "bg-foreground font-semibold text-background",
                  !isToday && month !== anchorMonth && "text-muted-foreground"
                )}
                data-numeric
              >
                {dayNumber}
              </span>
            </div>
          );
        })}

        {lanes.map((lane, laneIndex) =>
          lane.map((segment) => (
            <div
              key={segment.entry.key}
              style={{
                gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                gridRow: laneIndex + 2,
              }}
              className="pointer-events-auto min-w-0 px-0.5"
            >
              <EntryChip
                entry={segment.entry}
                onSelect={onSelectEntry}
                hideTime={segment.span > 1 || segment.continuesBefore}
              />
            </div>
          ))
        )}

        {overflowByCol.map((count, column) =>
          count > 0 ? (
            <button
              key={`overflow-${column}`}
              type="button"
              onClick={() => onSelectDay(week[column])}
              style={{ gridColumn: column + 1, gridRow: MAX_LANES + 2 }}
              className="pointer-events-auto px-1 text-left text-[0.625rem] text-muted-foreground hover:underline"
            >
              ＋{count} 件
            </button>
          ) : null
        )}
      </div>
    </div>
  );
}

/** 月グリッドの日付から「その日の既定の予定時刻」を作る（9:00–10:00）。 */
export function defaultSlotForDay(day: Date): { start: Date; end: Date } {
  const { year, month, day: dayOfMonth } = partsOf(day);
  return {
    start: fromParts(year, month, dayOfMonth, 9, 0),
    end: fromParts(year, month, dayOfMonth, 10, 0),
  };
}
