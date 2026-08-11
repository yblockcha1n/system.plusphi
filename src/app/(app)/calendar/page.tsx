import type { Metadata } from "next";
import { listUsers } from "@/lib/env";
import {
  addDays,
  dateKey,
  monthGridStart,
  parseDateKey,
  startOfDay,
  startOfWeek,
} from "@/lib/datetime";
import { getHolidayMap } from "@/lib/holidays";
import { getCalendarData } from "@/features/calendar/queries";
import { getProjectOptions } from "@/features/projects/queries";
import { getTasks } from "@/features/tasks/queries";
import { getTaskTypeOptions } from "@/features/task-types/queries";
import {
  toCalendarColorMode,
  toCalendarView,
  type CalendarView,
} from "@/features/calendar/schema";
import { CalendarShell } from "@/components/calendar/calendar-shell";

export const metadata: Metadata = {
  title: "カレンダー | plusphi",
};

/**
 * 表示範囲は URL（?view=&date=）だけで決まる。
 * サーバーとクライアントで「今どこを見ているか」の解釈がずれないようにするため、
 * 基準日をクライアント state ではなく URL に置いている。
 */
function rangeFor(view: CalendarView, anchor: Date): { start: Date; end: Date } {
  if (view === "month") {
    const start = monthGridStart(anchor);
    return { start, end: addDays(start, 42) };
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }

  const start = startOfDay(anchor);
  return { start, end: addDays(start, 1) };
}

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const searchParams = await props.searchParams;

  const view = toCalendarView(first(searchParams.view));
  const colorMode = toCalendarColorMode(first(searchParams.color));
  const today = startOfDay(new Date());
  const anchor = parseDateKey(first(searchParams.date)) ?? today;
  const { start, end } = rangeFor(view, anchor);

  const [calendar, tasks, projects, taskTypes] = await Promise.all([
    getCalendarData(start, end, colorMode),
    getTasks(),
    getProjectOptions(),
    getTaskTypeOptions(),
  ]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col">
      <CalendarShell
        view={view}
        colorMode={colorMode}
        anchorKey={dateKey(anchor)}
        todayKey={dateKey(today)}
        entries={calendar.entries}
        events={calendar.events}
        tasks={tasks}
        projects={projects}
        taskTypes={taskTypes}
        users={listUsers()}
        // 祝日は決まりきった計算なのでサーバーで求めて渡す
        // （クライアントにライブラリを積む必要がない）
        holidays={getHolidayMap(start, end)}
      />
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
