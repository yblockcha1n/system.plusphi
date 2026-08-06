import type { Metadata } from "next";
import Link from "next/link";
import { listUsers } from "@/lib/env";
import { getProjectOptions } from "@/features/projects/queries";
import { getTasks } from "@/features/tasks/queries";
import {
  TASK_SCOPES,
  TASK_SCOPE_LABELS,
  TASK_STATUS_LABELS,
  toTaskScope,
} from "@/features/tasks/schema";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { TaskToolbar } from "@/components/tasks/task-toolbar";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "タスク | plusphi",
};

export default async function TasksPage(props: PageProps<"/tasks">) {
  const searchParams = await props.searchParams;
  const scope = toTaskScope(first(searchParams.scope));
  const showDone = first(searchParams.done) === "1";

  const [tasks, projects] = await Promise.all([
    getTasks({ scope, includeDone: showDone }),
    getProjectOptions(),
  ]);

  const users = listUsers();
  const openCount = tasks.filter((task) => task.status !== "done").length;

  const hrefFor = (nextScope: string, nextDone: boolean) =>
    `/tasks?scope=${nextScope}${nextDone ? "&done=1" : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        title="タスク"
        description={`未完了 ${openCount} 件。状態バッジを押すと「${TASK_STATUS_LABELS.todo} / ${TASK_STATUS_LABELS.doing} / ${TASK_STATUS_LABELS.review} / ${TASK_STATUS_LABELS.done}」をその場で切り替えられます。`}
        actions={<TaskToolbar projects={projects} users={users} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex border">
          {TASK_SCOPES.map((item) => (
            <Link
              key={item}
              href={hrefFor(item, showDone)}
              aria-current={item === scope ? "true" : undefined}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                item === scope
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {TASK_SCOPE_LABELS[item]}
            </Link>
          ))}
        </div>

        <Link
          href={hrefFor(scope, !showDone)}
          className={cn(
            "border px-3 py-1 text-xs font-medium transition-colors",
            showDone ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
          )}
        >
          完了も表示
        </Link>
      </div>

      <Panel>
        <TaskList
          tasks={tasks}
          projects={projects}
          users={users}
          emptyMessage={
            scope === "all"
              ? "タスクがまだありません。右上の「タスクを登録」から追加してください。"
              : "該当するタスクはありません。"
          }
        />
      </Panel>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
