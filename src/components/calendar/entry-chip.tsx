"use client";

import { AlarmClockIcon } from "lucide-react";
import { entryClassName, type CalendarEntry } from "@/features/calendar/schema";
import { formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type EntryChipProps = {
  entry: CalendarEntry;
  onSelect: (entry: CalendarEntry) => void;
  /** 時刻を省いてタイトルだけ出す（終日や横棒のとき）。 */
  hideTime?: boolean;
  className?: string;
};

export function EntryChip({ entry, onSelect, hideTime, className }: EntryChipProps) {
  const start = new Date(entry.startsAt);
  const showTime = !hideTime && !entry.allDay;

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        // 背景のセルにあるスロット作成のクリックまで伝播させない
        clickEvent.stopPropagation();
        onSelect(entry);
      }}
      title={`${entry.projectName ? `[${entry.projectName}] ` : ""}${entry.title}`}
      className={cn(
        "flex w-full items-center gap-1 overflow-hidden px-1 py-0.5 text-left text-[0.6875rem] leading-tight transition-opacity hover:opacity-80",
        entryClassName(entry),
        className
      )}
    >
      {entry.kind === "deadline" && <AlarmClockIcon className="size-3 shrink-0" />}
      {showTime && <span className="shrink-0 tabular-nums">{formatTime(start)}</span>}
      <span className="truncate">{entry.title}</span>
    </button>
  );
}
