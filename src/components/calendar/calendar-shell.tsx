"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  CALENDAR_COLOR_MODES,
  CALENDAR_COLOR_MODE_LABELS,
  CALENDAR_VIEWS,
  CALENDAR_VIEW_LABELS,
  type CalendarColorMode,
  type CalendarEntry,
  type CalendarView,
  type EventItem,
} from "@/features/calendar/schema";
import type { ProjectOption } from "@/features/projects/schema";
import type { TaskItem } from "@/features/tasks/schema";
import { ACCENT_COLORS } from "@/lib/colors";
import type { UserOption } from "@/lib/env";
import {
  addDays,
  addMonths,
  buildDayGrid,
  dateKey,
  formatMonthTitle,
  formatShortDate,
  formatWeekdayDate,
  monthGridStart,
  parseDateKey,
  startOfDay,
  startOfWeek,
} from "@/lib/datetime";
import { MonthView, defaultSlotForDay } from "@/components/calendar/month-view";
import { TimeGridView } from "@/components/calendar/time-grid-view";
import { EventSheet, type EventDraft } from "@/components/calendar/event-sheet";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { useSheetTarget } from "@/components/shared/use-sheet-target";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalendarShellProps = {
  view: CalendarView;
  /** 帯を何で塗り分けるか。URL から来る（色そのものは解決済みで entries に入っている）。 */
  colorMode: CalendarColorMode;
  /** 表示の基準日 "YYYY-MM-DD"（JST）。URL から来る。 */
  anchorKey: string;
  /** サーバーで求めた今日。クライアントで new Date() すると描画がずれるため。 */
  todayKey: string;
  entries: CalendarEntry[];
  events: EventItem[];
  tasks: TaskItem[];
  projects: ProjectOption[];
  users: UserOption[];
};

export function CalendarShell({
  view,
  colorMode,
  anchorKey,
  todayKey,
  entries,
  events,
  tasks,
  projects,
  users,
}: CalendarShellProps) {
  const router = useRouter();

  const today = parseDateKey(todayKey) as Date;
  const anchor = parseDateKey(anchorKey) ?? today;
  const days = daysFor(view, anchor);

  // 予定シートは「既存の編集」と「クリック位置からの新規作成」の両方を扱うので、
  // どちらか一方だけが入った1つの対象として持つ。
  const eventSheet = useSheetTarget<{ event?: EventItem; draft?: EventDraft }>();
  const taskSheet = useSheetTarget<TaskItem>();
  const deleteDialog = useSheetTarget<EventItem>();

  /**
   * 表示状態はすべて URL に載せる。指定しなかったぶんは現在の値を引き継ぐので、
   * 例えば色分けを切り替えても見ている日付とビューはそのまま残る。
   */
  const hrefFor = (
    next: { view?: CalendarView; date?: Date; color?: CalendarColorMode } = {}
  ) => {
    const params = new URLSearchParams({
      view: next.view ?? view,
      date: dateKey(next.date ?? anchor),
      color: next.color ?? colorMode,
    });

    return `/calendar?${params}`;
  };

  const step = (direction: 1 | -1) => {
    if (view === "month") return addMonths(anchor, direction);
    return addDays(anchor, direction * (view === "week" ? 7 : 1));
  };

  const openDraft = (start: Date, end: Date, allDay = false) => {
    eventSheet.show({
      draft: { startsAt: start.toISOString(), endsAt: end.toISOString(), allDay },
    });
  };

  const selectEntry = (entry: CalendarEntry) => {
    if (entry.kind === "event") {
      const found = events.find((item) => item.id === entry.id);
      if (found) eventSheet.show({ event: found });
      return;
    }

    // タスク由来の帯（作業期間・締切）はタスクの編集を開く
    const task = tasks.find((item) => item.id === entry.id);
    if (task) taskSheet.show(task);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* 画面遷移なので <button> ではなく <a>。Button の見た目だけ borrow する。 */}
        <Link href={hrefFor({ date: today })} className={buttonVariants({ variant: "outline", size: "sm" })}>
          今日
        </Link>

        <div className="flex">
          <Link
            href={hrefFor({ date: step(-1) })}
            aria-label="前へ"
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          >
            <ChevronLeftIcon />
          </Link>
          <Link
            href={hrefFor({ date: step(1) })}
            aria-label="次へ"
            className={buttonVariants({ variant: "outline", size: "icon-sm", className: "-ml-px" })}
          >
            <ChevronRightIcon />
          </Link>
        </div>

        <h2 className="font-heading text-sm font-semibold sm:text-base" data-numeric>
          {titleFor(view, anchor, days)}
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* 色分けの切り替え。表示切り替えと同じセグメント風に揃える。 */}
          <div className="flex items-center gap-1.5">
            <span className="hidden text-xs text-muted-foreground sm:inline">色分け</span>
            <div className="flex border" role="group" aria-label="帯の色分け">
              {CALENDAR_COLOR_MODES.map((item) => (
                <Link
                  key={item}
                  href={hrefFor({ color: item })}
                  aria-current={item === colorMode ? "true" : undefined}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors",
                    item === colorMode
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {CALENDAR_COLOR_MODE_LABELS[item]}
                </Link>
              ))}
            </div>
          </div>

          {/* 表示切り替え。角を落としたセグメント風にする。 */}
          <div className="flex border">
            {CALENDAR_VIEWS.map((item) => (
              <Link
                key={item}
                href={hrefFor({ view: item })}
                aria-current={item === view ? "true" : undefined}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors",
                  item === view
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {CALENDAR_VIEW_LABELS[item]}
              </Link>
            ))}
          </div>

          <Button
            size="sm"
            onClick={() => {
              const slot = defaultSlotForDay(anchor);
              openDraft(slot.start, slot.end);
            }}
          >
            <PlusIcon />
            <span className="hidden sm:inline">予定を登録</span>
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <MonthView
          days={days}
          anchor={anchor}
          entries={entries}
          todayKey={todayKey}
          onSelectDay={(day) => {
            const slot = defaultSlotForDay(day);
            openDraft(slot.start, slot.end);
          }}
          onSelectEntry={selectEntry}
        />
      ) : (
        <TimeGridView
          days={days}
          entries={entries}
          todayKey={todayKey}
          onSelectRange={(start, end) => openDraft(start, end)}
          onSelectDay={(day) => router.push(hrefFor({ view: "day", date: day }))}
          onSelectEntry={selectEntry}
        />
      )}

      {colorMode === "user" && <UserLegend users={users} />}

      <p className="text-xs text-muted-foreground">
        空いているところをクリック（週・日表示はドラッグ）すると予定を登録できます。実線はタスクの作業期間、破線は締切です。
        {colorMode === "user"
          ? "色は予定なら作成者、タスクなら担当者を表します。"
          : "色は所属プロジェクトを表します。"}
      </p>

      <EventSheet
        open={eventSheet.open}
        onOpenChange={eventSheet.onOpenChange}
        event={eventSheet.target?.event}
        draft={eventSheet.target?.draft}
        projects={projects}
        onDelete={(event) => deleteDialog.show(event)}
      />

      <TaskSheet
        open={taskSheet.open}
        onOpenChange={taskSheet.onOpenChange}
        task={taskSheet.target}
        projects={projects}
        users={users}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`予定「${deleteDialog.target?.title}」を削除しますか？`}
        description="この操作は取り消せません。"
        onConfirm={async () => {
          const result = await api.deleteEvent(deleteDialog.target?.id as string);
          // 削除できたら、裏に残っている編集シートも閉じる
          if (result.status === "success") eventSheet.onOpenChange(false);
          return result;
        }}
      />
    </div>
  );
}

/**
 * 誰が何色かの対応表。色はメールアドレスから導出しているので利用者は選べない。
 * それを覚えてもらうのは無理なので、担当者で色分けしている間だけ凡例を出す。
 */
function UserLegend({ users }: { users: UserOption[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {users.map((user) => (
        <li key={user.email} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 shrink-0", ACCENT_COLORS[user.color].dot)} aria-hidden />
          {user.name}
        </li>
      ))}
      {/* 担当者が未設定のタスクはこの色になる（features/calendar/queries.ts） */}
      <li className="flex items-center gap-1.5">
        <span className={cn("size-2.5 shrink-0", ACCENT_COLORS.gray.dot)} aria-hidden />
        未割当
      </li>
    </ul>
  );
}

function daysFor(view: CalendarView, anchor: Date): Date[] {
  if (view === "month") return buildDayGrid(monthGridStart(anchor), 42);
  if (view === "week") return buildDayGrid(startOfWeek(anchor), 7);
  return [startOfDay(anchor)];
}

function titleFor(view: CalendarView, anchor: Date, days: Date[]): string {
  if (view === "month") return formatMonthTitle(anchor);
  if (view === "day") return formatWeekdayDate(anchor);
  return `${formatShortDate(days[0])} 〜 ${formatShortDate(days[days.length - 1])}`;
}
