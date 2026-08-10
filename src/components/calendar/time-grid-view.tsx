"use client";

import { useEffect, useState } from "react";
import { entryClassName, type CalendarEntry } from "@/features/calendar/schema";
import { useScrollRestore } from "@/components/shared/use-scroll-restore";
import {
  MINUTES_PER_DAY,
  WEEKDAY_LABELS,
  dateKey,
  fromParts,
  minutesFromStartOfDay,
  partsOf,
} from "@/lib/datetime";
import { layoutTimedEntries, spanningEntriesOnDay } from "@/components/calendar/layout";
import { EntryChip } from "@/components/calendar/entry-chip";
import { cn } from "@/lib/utils";

/** 1 時間あたりの高さ(px)。24 時間ぶんで 1152px。 */
const HOUR_PX = 48;
/** ドラッグ選択の刻み(分)。 */
const SNAP_MIN = 30;
/** クリック（ドラッグせず離した）ときに作る予定の長さ(分)。 */
const CLICK_SPAN_MIN = 60;
/** 初期スクロール位置。早朝を隠して業務時間から見せる（前回位置が無いときだけ使う）。 */
const INITIAL_SCROLL_HOUR = 7;

type TimeGridViewProps = {
  days: Date[];
  entries: CalendarEntry[];
  todayKey: string;
  onSelectRange: (start: Date, end: Date) => void;
  onSelectDay: (day: Date) => void;
  onSelectEntry: (entry: CalendarEntry) => void;
};

type Selection = { column: number; fromMin: number; toMin: number };

export function TimeGridView({
  days,
  entries,
  todayKey,
  onSelectRange,
  onSelectDay,
  onSelectEntry,
}: TimeGridViewProps) {
  // 週/日をまたいでも「何時あたりを見ていたか」は引き継ぎたいので、
  // 表示範囲ではなくビュー種別ごとに 1 つのキーで覚える。
  const scroller = useScrollRestore<HTMLDivElement>(
    "calendar:time-grid",
    INITIAL_SCROLL_HOUR * HOUR_PX
  );
  const [selection, setSelection] = useState<Selection | null>(null);

  const columns = `repeat(${days.length}, minmax(0, 1fr))`;

  const beginSelection = (column: number, event: React.PointerEvent<HTMLDivElement>) => {
    // 帯（ボタン）の上から始まったドラッグはスロット選択にしない
    if ((event.target as HTMLElement).closest("button")) return;

    const minute = minuteAt(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection({ column, fromMin: minute, toMin: minute });
  };

  const extendSelection = (column: number, event: React.PointerEvent<HTMLDivElement>) => {
    if (!selection || selection.column !== column) return;
    setSelection({ ...selection, toMin: minuteAt(event) });
  };

  const finishSelection = (column: number) => {
    if (!selection || selection.column !== column) return;

    const { fromMin, toMin } = selection;
    setSelection(null);

    const startMin = Math.min(fromMin, toMin);
    // ドラッグせずに離したときは 1 時間の予定にする
    const endMin =
      Math.abs(toMin - fromMin) < SNAP_MIN
        ? Math.min(MINUTES_PER_DAY, startMin + CLICK_SPAN_MIN)
        : Math.max(fromMin, toMin) + SNAP_MIN;

    const { year, month, day } = partsOf(days[column]);
    onSelectRange(
      fromParts(year, month, day, 0, startMin),
      fromParts(year, month, day, 0, Math.min(MINUTES_PER_DAY, endMin))
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border">
      {/* 曜日ヘッダー */}
      <div className="flex shrink-0 border-b bg-muted/50">
        <div className="w-12 shrink-0 border-r sm:w-14" />
        <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
          {days.map((day) => {
            const { weekday, day: dayNumber } = partsOf(day);
            const isToday = dateKey(day) === todayKey;

            return (
              <button
                key={dateKey(day)}
                type="button"
                onClick={() => onSelectDay(day)}
                className="flex flex-col items-center gap-0.5 border-r py-1.5 transition-colors last:border-r-0 hover:bg-muted"
              >
                <span
                  className={cn(
                    "text-[0.625rem]",
                    weekday === 0 && "text-destructive",
                    weekday === 6 && "text-project-blue",
                    weekday !== 0 && weekday !== 6 && "text-muted-foreground"
                  )}
                >
                  {WEEKDAY_LABELS[weekday]}
                </span>
                <span
                  className={cn(
                    "min-w-6 px-1 text-sm leading-6 font-medium",
                    isToday && "bg-foreground text-background"
                  )}
                  data-numeric
                >
                  {dayNumber}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 終日・複数日の帯 */}
      <div className="flex shrink-0 border-b">
        <div className="flex w-12 shrink-0 items-center justify-end border-r px-1 py-1 text-[0.625rem] text-muted-foreground sm:w-14">
          終日
        </div>
        <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
          {days.map((day) => (
            <div
              key={dateKey(day)}
              className="flex min-h-8 flex-col gap-0.5 border-r p-0.5 last:border-r-0"
            >
              {spanningEntriesOnDay(entries, day).map((entry) => (
                <EntryChip key={entry.key} entry={entry} onSelect={onSelectEntry} hideTime />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 時間軸 */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex" style={{ height: HOUR_PX * 24 }}>
          <div className="w-12 shrink-0 border-r sm:w-14">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                style={{ height: HOUR_PX }}
                className="relative border-b text-right"
              >
                <span className="pr-1 text-[0.625rem] text-muted-foreground" data-numeric>
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
            {days.map((day, column) => (
              <DayColumn
                key={dateKey(day)}
                day={day}
                entries={entries}
                isToday={dateKey(day) === todayKey}
                selection={selection?.column === column ? selection : null}
                onPointerDown={(event) => beginSelection(column, event)}
                onPointerMove={(event) => extendSelection(column, event)}
                onPointerUp={() => finishSelection(column)}
                onSelectEntry={onSelectEntry}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  entries,
  isToday,
  selection,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSelectEntry,
}: {
  day: Date;
  entries: CalendarEntry[];
  isToday: boolean;
  selection: Selection | null;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onSelectEntry: (entry: CalendarEntry) => void;
}) {
  const blocks = layoutTimedEntries(entriesForColumn(entries, day), day);

  const selectionTop = selection ? Math.min(selection.fromMin, selection.toMin) : 0;
  const selectionSpan = selection
    ? Math.max(SNAP_MIN, Math.abs(selection.toMin - selection.fromMin))
    : 0;

  return (
    <div
      className="relative touch-none border-r last:border-r-0"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* 1 時間ごとの罫線 */}
      {Array.from({ length: 24 }, (_, hour) => (
        <div key={hour} style={{ height: HOUR_PX }} className="border-b" />
      ))}

      {selection && (
        <div
          className="pointer-events-none absolute inset-x-0.5 border border-foreground/40 bg-foreground/10"
          style={{
            top: `${(selectionTop / MINUTES_PER_DAY) * 100}%`,
            height: `${(selectionSpan / MINUTES_PER_DAY) * 100}%`,
          }}
        />
      )}

      {blocks.map((block) => (
        <div
          key={block.entry.key}
          className="absolute px-px"
          style={{
            top: `${block.topPct}%`,
            height: `${block.heightPct}%`,
            left: `${block.leftPct}%`,
            width: `${block.widthPct}%`,
          }}
        >
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onSelectEntry(block.entry);
            }}
            onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
            title={block.entry.title}
            className={cn(
              "flex h-full w-full flex-col items-start overflow-hidden px-1 py-0.5 text-left text-[0.6875rem] leading-tight transition-opacity hover:opacity-80",
              entryClassName(block.entry)
            )}
          >
            <span className="w-full truncate font-medium">{block.entry.title}</span>
          </button>
        </div>
      ))}

      {isToday && <NowIndicator />}
    </div>
  );
}

/** 現在時刻の横線。サーバーでは描かず、マウント後にだけ出す（描画のズレを避けるため）。 */
function NowIndicator() {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setMinutes(minutesFromStartOfDay(new Date()));
    update();

    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (minutes === null) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top: `${(minutes / MINUTES_PER_DAY) * 100}%` }}
      aria-hidden
    >
      <span className="size-1.5 shrink-0 bg-destructive" />
      <span className="h-px flex-1 bg-destructive" />
    </div>
  );
}

function entriesForColumn(entries: CalendarEntry[], day: Date): CalendarEntry[] {
  const key = dateKey(day);

  return entries.filter((entry) => {
    const start = new Date(entry.startsAt);
    const end = new Date(entry.endsAt);
    const lastMoment = new Date(Math.max(start.getTime(), end.getTime() - 1));

    // 時間軸に置くのはこの日に掛かるものだけ
    return dateKey(start) <= key && key <= dateKey(lastMoment);
  });
}

function minuteAt(event: React.PointerEvent<HTMLDivElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / rect.height;
  const raw = ratio * MINUTES_PER_DAY;
  const snapped = Math.floor(raw / SNAP_MIN) * SNAP_MIN;

  return Math.min(MINUTES_PER_DAY - SNAP_MIN, Math.max(0, snapped));
}
