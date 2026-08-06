import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { addDays, startOfDay } from "@/lib/datetime";
import { getCalendarData } from "@/features/calendar/queries";
import { getTasks } from "@/features/tasks/queries";
import { getProjects } from "@/features/projects/queries";
import type { CalendarEntry } from "@/features/calendar/schema";
import type { ProjectSummary } from "@/features/projects/schema";
import type { TaskItem } from "@/features/tasks/schema";

export type HomeData = {
  viewer: { email: string; name: string };
  /** ISO 文字列。表示は lib/datetime.ts 経由で JST 固定にする。 */
  today: string;
  todayEntries: CalendarEntry[];
  /** 自分が担当で未完了のタスク（締切が近い順）。 */
  myTasks: TaskItem[];
  /** 自分が検収者で「検収待ち」のタスク。 */
  awaitingReview: TaskItem[];
  /** 担当・検収を問わず締切を過ぎている未完了タスク。 */
  overdue: TaskItem[];
  projects: ProjectSummary[];
};

/** ホーム（マイページ）に出す情報をまとめて取る。 */
export async function getHomeData(): Promise<HomeData> {
  const session = await requireSession();

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const now = Date.now();

  const [calendar, tasks, projects] = await Promise.all([
    getCalendarData(today, tomorrow),
    // ここで使う 3 つの一覧はどれも未完了タスクだけが対象なので、
    // 完了ぶんは SQL の時点で落としておく。
    getTasks({ includeDone: false }),
    getProjects(),
  ]);

  const todayEntries = [...calendar.entries].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  // tasks は未完了だけなので、ここでの絞り込みに完了判定は要らない
  return {
    viewer: { email: session.email, name: displayName(session.email) ?? session.email },
    today: today.toISOString(),
    todayEntries,
    myTasks: tasks.filter((task) => task.assignee === session.email),
    awaitingReview: tasks.filter(
      (task) => task.status === "review" && task.reviewer === session.email
    ),
    overdue: tasks.filter(
      (task) => task.deadlineAt !== null && new Date(task.deadlineAt).getTime() < now
    ),
    projects,
  };
}
