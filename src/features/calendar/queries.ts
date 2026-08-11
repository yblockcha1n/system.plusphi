import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName, userColor } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { addMinutes, dateKey } from "@/lib/datetime";
import { toProjectColor } from "@/features/projects/schema";
import { expandOccurrences, toRecurrence } from "@/features/calendar/recurrence";
import { buildProjectLookup, mapTaskRow } from "@/features/tasks/queries";
import type {
  CalendarColorMode,
  CalendarEntry,
  EventItem,
} from "@/features/calendar/schema";
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
 *
 * 帯の色は colorMode に応じてここで決めてしまう。描画側（月/週/日ビュー）に
 * モードを配って回ると、chip を出す全コンポーネントに引数が増えるため。
 */
export async function getCalendarData(
  rangeStart: Date,
  rangeEnd: Date,
  // 既定は担当者。ホームの「今日の予定」もカレンダーと同じ色で出したいため
  // （toCalendarColorMode の既定と揃えること）。
  colorMode: CalendarColorMode = "user"
): Promise<CalendarData> {
  await requireSession();

  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();
  // recurrence_until は date 型なので、比較には日付キーを使う
  const startDateKey = dateKey(rangeStart);

  // 終了が未設定のタスク（開始から1時間の帯）と締切の帯（30分）を取りこぼさない
  // ぶんだけ手前に広げる。厳密な重なり判定はこのあと toTaskEntries が行う。
  const paddedStartIso = addMinutes(rangeStart, -60).toISOString();

  const [eventsResult, tasksResult, projectsResult] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .or(
        [
          // 単発: 半開区間の重なり判定（starts_at < rangeEnd かつ ends_at > rangeStart）
          `and(recurrence_freq.is.null,starts_at.lt."${endIso}",ends_at.gt."${startIso}")`,
          // 繰り返し: starts_at は 1 回目なので範囲より前でも対象になりうる。
          // 終わり（recurrence_until）が範囲より前のものだけを落とす。
          // 実際にどの回が範囲に掛かるかは expandOccurrences が決める。
          `and(recurrence_freq.not.is.null,starts_at.lt."${endIso}",recurrence_until.is.null)`,
          `and(recurrence_freq.not.is.null,starts_at.lt."${endIso}",recurrence_until.gte."${startDateKey}")`,
        ].join(",")
      ),
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
      assignees: row.assignees ?? [],
      assigneeNames: (row.assignees ?? []).map((email) => displayName(email) ?? email),
      recurrence: toRecurrence(row),
      createdBy: row.created_by,
      createdByName: displayName(row.created_by),
    };
  });

  const tasks = tasksResult.data.map((row) => mapTaskRow(row, projects));

  return {
    events,
    entries: [
      ...toEventEntries(events, rangeStart, rangeEnd, colorMode),
      ...toTaskEntries(tasks, rangeStart, rangeEnd, colorMode),
    ],
  };
}

/**
 * 予定を帯にする。繰り返しはここで範囲ぶんだけ展開するので、1 つの予定から
 * 複数の帯が出る。key に日付を混ぜて回ごとに一意にする。
 *
 * 「担当者」で色分けするときは先頭の担当者を使う。複数人を 1 色では表せないため、
 * 誰も指定されていなければ作成者に落とす。
 */
function toEventEntries(
  events: EventItem[],
  rangeStart: Date,
  rangeEnd: Date,
  colorMode: CalendarColorMode
): CalendarEntry[] {
  return events.flatMap((event) => {
    const owner = event.assignees[0] ?? event.createdBy;
    const ownerName = event.assigneeNames[0] ?? event.createdByName;

    return expandOccurrences(event, rangeStart, rangeEnd).map((occurrence) => ({
      key: `event:${event.id}:${occurrence.occurrenceDate}`,
      kind: "event" as const,
      id: event.id,
      title: event.title,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      allDay: event.allDay,
      color: colorMode === "user" ? userColor(owner) : event.projectColor,
      projectName: event.projectName,
      ownerName,
      occurrenceDate: occurrence.occurrenceDate,
      repeating: event.recurrence !== null,
    }));
  });
}

/** 締切だけの帯に持たせる長さ。時間軸ビューで潰れないよう 30 分幅にする。 */
const DEADLINE_SPAN_MIN = 30;

function toTaskEntries(
  tasks: TaskItem[],
  rangeStart: Date,
  rangeEnd: Date,
  colorMode: CalendarColorMode
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const inRange = (start: Date, end: Date) =>
    start.getTime() < rangeEnd.getTime() && end.getTime() > rangeStart.getTime();

  for (const task of tasks) {
    // 担当者が未設定なら userColor が gray を返す = 凡例の「未割当」と揃う
    const color = colorMode === "user" ? userColor(task.assignee) : task.projectColor;

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
          color,
          projectName: task.projectName,
          ownerName: task.assigneeName,
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
          color,
          projectName: task.projectName,
          ownerName: task.assigneeName,
        });
      }
    }
  }

  return entries;
}
