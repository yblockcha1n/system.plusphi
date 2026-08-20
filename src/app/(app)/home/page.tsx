import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClockIcon, CalendarDaysIcon, ClipboardCheckIcon, ListChecksIcon } from "lucide-react";
import { listUsers } from "@/lib/env";
import { getHomeData } from "@/features/home/queries";
import { getProjectOptions } from "@/features/projects/queries";
import { getTaskTypeOptions } from "@/features/task-types/queries";
import { PROJECT_COLORS } from "@/features/projects/schema";
import { formatFullDate, formatRange } from "@/lib/datetime";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/shared/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { TaskToolbar } from "@/components/tasks/task-toolbar";
import { entryClassName } from "@/features/calendar/schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ホーム | plusphi",
};

/**
 * 一度に出す件数。
 *
 * ここは「今どうなっているか」を掴む場所で、一覧そのものは各画面にある。
 * 全部並べるとスクロールが長くなって掴めなくなるので上限を置く。
 * 特にスマホは 1 画面に入る量が少ないので、狭い画面では更に絞る。
 *
 * 溢れたぶんは CSS で隠すだけなので、画面を広げれば読み込み直さずに伸びる。
 * 隠した件数は各パネルの下に出し、「これで全部」と誤解させない。
 */
const LIMIT = {
  entries: { mobile: 3, desktop: 6 },
  tasks: { mobile: 4, desktop: 8 },
} as const;

export default async function HomePage() {
  const [home, projects, taskTypes] = await Promise.all([
    getHomeData(),
    getProjectOptions(),
    getTaskTypeOptions(),
  ]);
  const users = listUsers();
  const today = new Date(home.today);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader
        title={`${home.viewer.name} さんのページ`}
        description={`${formatFullDate(today)} の状況です。`}
        actions={<TaskToolbar projects={projects} taskTypes={taskTypes} users={users} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<ListChecksIcon className="size-4" />}
          label="自分の担当（未完了）"
          value={home.myTasks.length}
          href="/tasks?scope=mine"
        />
        <StatCard
          icon={<ClipboardCheckIcon className="size-4" />}
          label="検収待ち"
          value={home.awaitingReview.length}
          href="/tasks?scope=review"
        />
        <StatCard
          icon={<AlarmClockIcon className="size-4" />}
          label="締切超過"
          value={home.overdue.length}
          href="/tasks"
          alert={home.overdue.length > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
            <h3 className="font-heading text-sm font-semibold">今日の予定</h3>
            <Link
              href="/calendar"
              className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              カレンダーへ
            </Link>
          </PanelHeader>

          {home.todayEntries.length === 0 ? (
            <EmptyState>参加している今日の予定はありません。</EmptyState>
          ) : (
            <ul className="divide-y">
              {home.todayEntries.slice(0, LIMIT.entries.desktop).map((entry, index) => (
                <li
                  key={entry.key}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5",
                    index >= LIMIT.entries.mobile && "max-sm:hidden"
                  )}
                >
                  <span
                    className={cn("w-1 shrink-0 self-stretch", PROJECT_COLORS[entry.color].bar)}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRange(new Date(entry.startsAt), new Date(entry.endsAt), entry.allDay)}
                      {entry.projectName && ` · ${entry.projectName}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 px-1.5 py-0.5 text-[0.625rem]",
                      entryClassName(entry)
                    )}
                  >
                    {entry.kind === "event" ? "予定" : entry.kind === "task" ? "作業" : "締切"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <MoreLink total={home.todayEntries.length} limit={LIMIT.entries} href="/calendar" />
        </Panel>

        <Panel>
          <PanelHeader>
            <ListChecksIcon className="size-4 shrink-0 text-muted-foreground" />
            <h3 className="font-heading text-sm font-semibold">自分の担当タスク</h3>
            <Link
              href="/tasks?scope=mine"
              className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              すべて見る
            </Link>
          </PanelHeader>

          <TaskList
            tasks={home.myTasks.slice(0, LIMIT.tasks.desktop)}
            projects={projects}
            taskTypes={taskTypes}
            users={users}
            mobileLimit={LIMIT.tasks.mobile}
            emptyMessage="担当しているタスクはありません。"
          />

          <MoreLink total={home.myTasks.length} limit={LIMIT.tasks} href="/tasks?scope=mine" />
        </Panel>

        {home.awaitingReview.length > 0 && (
          <Panel>
            <PanelHeader>
              <ClipboardCheckIcon className="size-4 shrink-0 text-muted-foreground" />
              <h3 className="font-heading text-sm font-semibold">自分が検収するタスク</h3>
            </PanelHeader>
            <TaskList
              tasks={home.awaitingReview.slice(0, LIMIT.tasks.desktop)}
              projects={projects}
              taskTypes={taskTypes}
              users={users}
              mobileLimit={LIMIT.tasks.mobile}
            />

            <MoreLink
              total={home.awaitingReview.length}
              limit={LIMIT.tasks}
              href="/tasks?scope=review"
            />
          </Panel>
        )}

        {home.overdue.length > 0 && (
          <Panel className="border-destructive/40">
            <PanelHeader className="border-destructive/40 bg-destructive/5">
              <AlarmClockIcon className="size-4 shrink-0 text-destructive" />
              <h3 className="font-heading text-sm font-semibold text-destructive">締切超過</h3>
            </PanelHeader>
            <TaskList
              tasks={home.overdue.slice(0, LIMIT.tasks.desktop)}
              projects={projects}
              taskTypes={taskTypes}
              users={users}
              mobileLimit={LIMIT.tasks.mobile}
            />

            <MoreLink total={home.overdue.length} limit={LIMIT.tasks} href="/tasks" />
          </Panel>
        )}
      </div>

      <Panel>
        <PanelHeader>
          <h3 className="font-heading text-sm font-semibold">進行中のプロジェクト</h3>
          <Link
            href="/projects"
            className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            すべて見る
          </Link>
        </PanelHeader>

        {home.projects.length === 0 ? (
          <EmptyState>進行中のプロジェクトはありません。</EmptyState>
        ) : (
          <ul className="divide-y">
            {home.projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn("size-2.5 shrink-0", PROJECT_COLORS[project.color].dot)}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {project.name}
                  </span>
                  {project.overdueCount > 0 && (
                    <span className="shrink-0 text-xs font-medium text-destructive" data-numeric>
                      超過 {project.overdueCount}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground" data-numeric>
                    {project.doneCount} / {project.taskCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/**
 * 隠したぶんの件数と、続きを見る先。
 *
 * 出す件数が画面幅で違うので、余りの数も 2 つ書いて CSS で切り替える。
 * 幅を JavaScript で測ると、サーバーで描いたものと食い違って一瞬ちらつくため。
 */
function MoreLink({
  total,
  limit,
  href,
}: {
  total: number;
  limit: { mobile: number; desktop: number };
  href: string;
}) {
  const className =
    "block border-t px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/40";

  const restMobile = total - limit.mobile;
  const restDesktop = total - limit.desktop;

  if (restMobile <= 0) return null;

  return (
    <>
      {restDesktop > 0 && (
        <Link href={href} className={cn(className, "max-sm:hidden")}>
          ほか {restDesktop} 件を見る
        </Link>
      )}

      <Link href={href} className={cn(className, "sm:hidden")}>
        ほか {restMobile} 件を見る
      </Link>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 border bg-card px-4 py-3 transition-colors hover:bg-muted/40",
        alert && "border-destructive/40 bg-destructive/5"
      )}
    >
      <span className={cn("shrink-0 text-muted-foreground", alert && "text-destructive")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{label}</span>
      <span
        className={cn("font-heading text-xl font-semibold", alert && "text-destructive")}
        data-numeric
      >
        {value}
      </span>
    </Link>
  );
}
