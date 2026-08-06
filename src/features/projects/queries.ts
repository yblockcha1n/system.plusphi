import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { ProjectRow } from "@/lib/database.types";
import {
  toProjectColor,
  type ProjectOption,
  type ProjectSummary,
} from "@/features/projects/schema";

export const UNASSIGNED_PROJECT_LABEL = "未分類";

/**
 * プロジェクト一覧。件数の集計はタスクを全件引いて JS 側で数える。
 * 社内利用でタスク数はたかが知れているため、集計 SQL を用意するより
 * 1 クエリで済ませるほうが単純で速い。
 */
type TaskStat = { total: number; done: number; overdue: number };

/**
 * プロジェクトごとのタスク件数を DB 側で数える（0004 の project_task_stats）。
 * タスクを全件アプリへ引いてから JS で数えると、欲しいのが 3 つの数値だけなのに
 * 件数に比例して転送量が増えてしまう。
 */
async function fetchTaskStats(): Promise<Map<string, TaskStat>> {
  const { data, error } = await supabase.rpc("project_task_stats");

  if (error) {
    throw new Error(`タスクの集計に失敗しました: ${error.message}`);
  }

  return new Map(
    data.map((row) => [
      row.project_id,
      { total: Number(row.total), done: Number(row.done), overdue: Number(row.overdue) },
    ])
  );
}

export async function getProjects(
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<ProjectSummary[]> {
  await requireSession();

  const [projectsResult, stats] = await Promise.all([
    supabase.from("projects").select("*").order("sort_order").order("created_at"),
    fetchTaskStats(),
  ]);

  if (projectsResult.error) {
    throw new Error(`プロジェクトの取得に失敗しました: ${projectsResult.error.message}`);
  }

  return projectsResult.data
    .filter((row) => includeArchived || row.archived_at === null)
    .map((row) => toSummary(row, stats.get(row.id)));
}

export async function getProject(projectId: string): Promise<ProjectSummary | null> {
  await requireSession();

  const [projectResult, stats] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    fetchTaskStats(),
  ]);

  if (projectResult.error) {
    throw new Error(`プロジェクトの取得に失敗しました: ${projectResult.error.message}`);
  }
  if (!projectResult.data) return null;

  return toSummary(projectResult.data, stats.get(projectResult.data.id));
}

/** フォームの Select に渡す最小情報。アーカイブ済みは選択肢に出さない。 */
export async function getProjectOptions(): Promise<ProjectOption[]> {
  await requireSession();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, color, archived_at")
    .order("sort_order")
    .order("created_at");

  if (error) {
    throw new Error(`プロジェクトの取得に失敗しました: ${error.message}`);
  }

  return data
    .filter((row) => row.archived_at === null)
    .map((row) => ({ id: row.id, name: row.name, color: toProjectColor(row.color) }));
}

function toSummary(
  row: ProjectRow,
  stat: { total: number; done: number; overdue: number } | undefined
): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: toProjectColor(row.color),
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdBy: displayName(row.created_by),
    taskCount: stat?.total ?? 0,
    doneCount: stat?.done ?? 0,
    overdueCount: stat?.overdue ?? 0,
  };
}
