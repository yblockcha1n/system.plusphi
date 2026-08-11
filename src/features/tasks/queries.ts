import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { ProjectRow, TaskRow } from "@/lib/database.types";
import { toProjectColor, type ProjectColor } from "@/features/projects/schema";
import { toTaskStatus, type TaskItem, type TaskScope } from "@/features/tasks/schema";

type ProjectLookup = Map<string, { name: string; color: ProjectColor }>;

/** タスクは project_id しか持たないため、表示用にプロジェクト名と色を引き当てる。 */
export function buildProjectLookup(rows: Pick<ProjectRow, "id" | "name" | "color">[]): ProjectLookup {
  return new Map(
    rows.map((row) => [row.id, { name: row.name, color: toProjectColor(row.color) }])
  );
}

/** 種別 id → 名称。タスクは id しか持たないため、表示用に引き当てる。 */
export type TaskTypeLookup = Map<string, string>;

export function mapTaskRow(
  row: TaskRow,
  projects: ProjectLookup,
  taskTypes?: TaskTypeLookup
): TaskItem {
  const project = row.project_id ? projects.get(row.project_id) : undefined;

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: project?.name ?? null,
    projectColor: project?.color ?? "gray",
    taskTypeId: row.task_type_id,
    // 種別のマスタを渡していない呼び出し（カレンダー等、名称を使わない箇所）では null
    taskTypeName: (row.task_type_id && taskTypes?.get(row.task_type_id)) || null,
    title: row.title,
    detail: row.detail,
    status: toTaskStatus(row.status),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    deadlineAt: row.deadline_at,
    assignee: row.assignee,
    assigneeName: displayName(row.assignee),
    reviewer: row.reviewer,
    reviewerName: displayName(row.reviewer),
    sortOrder: row.sort_order,
    createdBy: displayName(row.created_by),
    updatedAt: row.updated_at,
  };
}

/**
 * 並び順: 未完了が先、そのなかは締切が近い順、締切なしは最後、
 * 最後に手動の sort_order。一覧で「次にやること」が上に来るようにする。
 */
export function sortTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const doneDiff = Number(a.status === "done") - Number(b.status === "done");
    if (doneDiff !== 0) return doneDiff;

    const aDeadline = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Infinity;
    const bDeadline = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Infinity;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return a.sortOrder - b.sortOrder;
  });
}

export type TaskQueryOptions = {
  projectId?: string | null;
  scope?: TaskScope;
  /** 完了済みも含めるか。既定は含める（一覧で完了を確認したいため）。 */
  includeDone?: boolean;
};

export async function getTasks(options: TaskQueryOptions = {}): Promise<TaskItem[]> {
  const session = await requireSession();

  // 絞り込みは SQL 側で済ませる。全件引いてから JS で捨てると、
  // 件数が増えたぶんだけ転送量とメモリを無駄にすることになる。
  let query = supabase.from("tasks").select("*");

  if (options.projectId !== undefined) {
    query =
      options.projectId === null
        ? query.is("project_id", null)
        : query.eq("project_id", options.projectId);
  }

  if (options.includeDone === false) {
    query = query.neq("status", "done");
  }

  if (options.scope === "mine") {
    query = query.eq("assignee", session.email);
  } else if (options.scope === "review") {
    query = query.eq("reviewer", session.email);
  }

  const [tasksResult, projectsResult, taskTypesResult] = await Promise.all([
    query,
    // 引き当てに使うのは名前と色だけ。説明文まで運ぶ必要はない。
    supabase.from("projects").select("id, name, color"),
    supabase.from("task_types").select("id, name"),
  ]);

  if (tasksResult.error) {
    throw new Error(`タスクの取得に失敗しました: ${tasksResult.error.message}`);
  }
  if (projectsResult.error) {
    throw new Error(`プロジェクトの取得に失敗しました: ${projectsResult.error.message}`);
  }
  if (taskTypesResult.error) {
    throw new Error(`タスク種別の取得に失敗しました: ${taskTypesResult.error.message}`);
  }

  const projects = buildProjectLookup(projectsResult.data);
  // 閉じた種別も含めて引く。過去のタスクに付いている種別名は出したいため。
  const taskTypes: TaskTypeLookup = new Map(
    taskTypesResult.data.map((row) => [row.id, row.name])
  );

  return sortTasks(tasksResult.data.map((row) => mapTaskRow(row, projects, taskTypes)));
}
