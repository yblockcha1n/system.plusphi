import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { addMinutes } from "@/lib/datetime";
import { toProjectColor } from "@/features/projects/schema";
import { buildProjectLookup, mapTaskRow } from "@/features/tasks/queries";
import type { CalendarEntry, EventItem } from "@/features/calendar/schema";
import type { TaskItem } from "@/features/tasks/schema";

export type CalendarData = {
  events: EventItem[];
  entries: CalendarEntry[];
};

/**
 * [rangeStart, rangeEnd) に掛かる予定とタスクをまとめて取得し、
 * カレンダーが描く「帯」の配列（entries）に正規化する。
 *
 * タスクは 2 種類の帯になる。
 *  - 開始〜終了が入っていれば作業期間の帯
 *  - 締切が入っていれば、その時刻に短い帯（deadline）
 * どちらも入っていれば両方出る（作業期間と締切は別概念のため）。
 */
export async function getCalendarData(rangeStart: Date, rangeEnd: Date): Promise<CalendarData> {
  await requireSession();

  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  // 終了が未設定のタスク（開始から1時間の帯）と締切の帯（30分）を取りこぼさない
  // ぶんだけ手前に広げる。厳密な重なり判定はこのあと toTaskEntries が行う。
  const paddedStartIso = addMinutes(rangeStart, -60).toISOString();

  const [eventsResult, tasksResult, projectsResult] = await Promise.all([
    // 半開区間の重なり判定: starts_at < rangeEnd かつ ends_at > rangeStart
    supabase.from("events").select("*").lt("starts_at", endIso).gt("ends_at", startIso),
    // タスクは「作業期間の帯」か「締切の帯」が範囲に掛かるものだけ引く。
    // カレンダーは月でも 6 週ぶんなので、全件引くと表示に使わない行が大半になる。
    supabase
      .from("tasks")
      .select("*")
      .or(
        [
          // 値は二重引用符で囲む。or() の中では "." や ":" が区切りと紛らわしいため。
          // 作業期間（終了あり）
          `and(starts_at.lt."${endIso}",ends_at.gt."${startIso}")`,
          // 作業期間（終了なし = 開始から1時間の帯として置く）
          `and(starts_at.lt."${endIso}",starts_at.gte."${paddedStartIso}",ends_at.is.null)`,
          // 締切の帯
          `and(deadline_at.lt."${endIso}",deadline_at.gte."${paddedStartIso}")`,
        ].join(",")
      ),
    supabase.from("projects").select("id, name, color"),
  ]);

  if (eventsResult.error) {
    throw new Error(`予定の取得に失敗しました: ${eventsResult.error.message}`);
  }
  if (tasksResult.error) {
    throw new Error(`タスクの取得に失敗しました: ${tasksResult.error.message}`);
  }
  if (projectsResult.error) {
    throw new Error(`プロジェクトの取得に失敗しました: ${projectsResult.error.message}`);
  }

  const projects = buildProjectLookup(projectsResult.data);

  const events: EventItem[] = eventsResult.data.map((row) => {
    const project = row.project_id ? projects.get(row.project_id) : undefined;

    return {
      id: row.id,
      projectId: row.project_id,
      projectName: project?.name ?? null,
      projectColor: project?.color ?? toProjectColor(null),
      title: row.title,
      description: row.description,
      location: row.location,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      allDay: row.all_day,
      createdBy: row.created_by,
      createdByName: displayName(row.created_by),
    };
  });

  const tasks = tasksResult.data.map((row) => mapTaskRow(row, projects));

  return {
    events,
    entries: [...toEventEntries(events), ...toTaskEntries(tasks, rangeStart, rangeEnd)],
  };
}

function toEventEntries(events: EventItem[]): CalendarEntry[] {
  return events.map((event) => ({
    key: `event:${event.id}`,
    kind: "event",
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    color: event.projectColor,
    projectName: event.projectName,
  }));
}

/** 締切だけの帯に持たせる長さ。時間軸ビューで潰れないよう 30 分幅にする。 */
const DEADLINE_SPAN_MIN = 30;

function toTaskEntries(tasks: TaskItem[], rangeStart: Date, rangeEnd: Date): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const inRange = (start: Date, end: Date) =>
    start.getTime() < rangeEnd.getTime() && end.getTime() > rangeStart.getTime();

  for (const task of tasks) {
    if (task.startsAt) {
      const start = new Date(task.startsAt);
      // 終了未設定のタスクは開始から 1 時間の帯として置く
      const end = task.endsAt ? new Date(task.endsAt) : addMinutes(start, 60);

      if (inRange(start, end)) {
        entries.push({
          key: `task:${task.id}`,
          kind: "task",
          id: task.id,
          title: task.title,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          allDay: false,
          color: task.projectColor,
          projectName: task.projectName,
        });
      }
    }

    if (task.deadlineAt) {
      const start = new Date(task.deadlineAt);
      const end = addMinutes(start, DEADLINE_SPAN_MIN);

      if (inRange(start, end)) {
        entries.push({
          key: `deadline:${task.id}`,
          kind: "deadline",
          id: task.id,
          title: task.title,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          allDay: false,
          color: task.projectColor,
          projectName: task.projectName,
        });
      }
    }
  }

  return entries;
}
