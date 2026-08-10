"use client";

import { useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import {
  WEEKDAY_LABELS,
  addMonths,
  buildDayGrid,
  dateKey,
  formatFullDate,
  formatMonthTitle,
  monthGridStart,
  parseDateKey,
  partsOf,
  startOfDay,
} from "@/lib/datetime";
import { Field } from "@/components/shared/field";
import { TimeField } from "@/components/shared/time-field";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** 時刻を省いた日付だけの入力か、日付＋時刻か。 */
export type DateTimeMode = "date" | "datetime";

type DateTimeFieldProps = {
  label: string;
  id: string;
  /** hidden input の name。送信される値は "YYYY-MM-DD" または "YYYY-MM-DDTHH:mm"。 */
  name: string;
  /**
   * 初期値。非制御で持つので、開き直したときのリセットは
   * 親の `<form key={...}>` の作り直しに任せる（use-form-reset-key.ts）。
   */
  defaultValue?: string;
  mode?: DateTimeMode;
  /** 未入力に戻せるようにするか。任意項目は true。 */
  clearable?: boolean;
  /** 日付だけ選ばれたときに補う時刻。 */
  defaultTime?: string;
  errors?: string[];
  hint?: string;
};

/**
 * 日付はポップオーバーのカレンダーから、時刻は入力欄から選ぶフィールド。
 *
 * 値は lib/datetime.ts が解釈できる文字列（"YYYY-MM-DDTHH:mm"）のまま hidden input に
 * 載せる。サーバー側はこれを JST として解釈するため、端末のタイムゾーンに左右されない。
 * カレンダーの日付計算も同じ JST 固定のヘルパーを使っている。
 */
export function DateTimeField({
  label,
  id,
  name,
  defaultValue = "",
  mode = "datetime",
  clearable = true,
  defaultTime = "09:00",
  errors,
  hint,
}: DateTimeFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  const datePart = value.slice(0, 10);
  const timePart = value.length > 10 ? value.slice(11, 16) : "";
  const selected = parseDateKey(datePart);

  const compose = (nextDate: string, nextTime: string) => {
    if (!nextDate) return "";
    return mode === "date" ? nextDate : `${nextDate}T${nextTime || defaultTime}`;
  };

  const selectDate = (day: Date) => {
    setValue(compose(dateKey(day), timePart));
    setOpen(false);
  };

  return (
    <Field label={label} htmlFor={id} errors={errors} hint={hint}>
      <input type="hidden" name={name} value={value} />

      {/* 幅が足りないときは時刻を下へ折り返す。日付ボタンが潰れて
          「日…」になるのを防ぐため min-w を持たせている。 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                id={id}
                variant="outline"
                className={cn(
                  "h-8 min-w-36 flex-1 justify-start gap-1.5 font-normal",
                  !selected && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="shrink-0" />
                <span className="truncate" data-numeric>
                  {selected ? formatFullDate(selected) : "日付を選択"}
                </span>
              </Button>
            }
          />
          <PopoverContent align="start" className="w-auto p-0">
            <MonthCalendar selected={selected} onSelect={selectDate} />
          </PopoverContent>
        </Popover>

        {mode === "datetime" && (
          <TimeField
            label={label}
            value={timePart}
            // 日付が未選択なら時刻だけ持っていても意味がないので触らせない
            disabled={!datePart}
            onChange={(next) => setValue(compose(datePart, next))}
          />
        )}

        {clearable && value !== "" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${label}をクリア`}
            onClick={() => setValue("")}
          >
            <XIcon />
          </Button>
        )}
      </div>
    </Field>
  );
}

function MonthCalendar({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (day: Date) => void;
}) {
  // ポップオーバーは開いたときにだけマウントされるため、
  // ここで new Date() を読んでもハイドレーションのズレは起きない。
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(selected ?? today);

  const days = buildDayGrid(monthGridStart(viewMonth), 42);
  const viewMonthIndex = partsOf(viewMonth).month;
  const selectedKey = selected ? dateKey(selected) : null;
  const todayKey = dateKey(today);

  return (
    <div className="w-[21rem] max-w-[calc(100vw-1.5rem)] p-3">
      <div className="mb-1 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="前の月"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
        >
          <ChevronLeftIcon />
        </Button>

        <span className="flex-1 text-center text-sm font-medium" data-numeric>
          {formatMonthTitle(viewMonth)}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="次の月"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((weekday, index) => (
          <div
            key={weekday}
            className={cn(
              "pb-1.5 text-center text-xs font-medium",
              index === 0 && "text-destructive",
              index === 6 && "text-project-blue",
              index !== 0 && index !== 6 && "text-muted-foreground"
            )}
          >
            {weekday}
          </div>
        ))}

        {days.map((day) => {
          const key = dateKey(day);
          const { day: dayNumber, month } = partsOf(day);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              className={cn(
                "flex h-10 items-center justify-center border border-transparent text-sm transition-colors",
                month !== viewMonthIndex && "text-muted-foreground",
                !isSelected && "hover:bg-muted",
                isToday && !isSelected && "border-border font-semibold",
                isSelected && "bg-foreground font-semibold text-background"
              )}
              data-numeric
            >
              {dayNumber}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between border-t pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setViewMonth(today)}>
          今月
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onSelect(today)}>
          今日
        </Button>
      </div>
    </div>
  );
}
