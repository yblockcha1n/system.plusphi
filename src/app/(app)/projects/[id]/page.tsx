import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { listUsers } from "@/lib/env";
import { getProject, getProjectOptions } from "@/features/projects/queries";
import { getTasks } from "@/features/tasks/queries";
import { getTaskTypeOptions } from "@/features/task-types/queries";
import { PROJECT_COLORS } from "@/features/projects/schema";
import { PageHeader, Panel, PanelHeader } from "@/components/shared/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { TaskToolbar } from "@/components/tasks/task-toolbar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProject(id);

  return { title: project ? `${project.name} | plusphi` : "プロジェクト | plusphi" };
}

export default async function ProjectDetailPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const [tasks, projects, taskTypes] = await Promise.all([
    getTasks({ projectId: project.id }),
    getProjectOptions(),
    getTaskTypeOptions(),
  ]);

  const users = listUsers();
  const progress =
    project.taskCount === 0 ? 0 : Math.round((project.doneCount / project.taskCount) * 100);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {/* 画面遷移なので <button> ではなく <a>。Button の見た目だけ borrow する。 */}
      <Link
        href="/projects"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}
      >
        <ArrowLeftIcon />
        プロジェクト一覧
      </Link>

      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5", PROJECT_COLORS[project.color].dot)} aria-hidden />
              {PROJECT_COLORS[project.color].label}
            </span>
            <span data-numeric>
              {project.doneCount} / {project.taskCount} 完了（{progress}%）
            </span>
            {project.overdueCount > 0 && (
              <span className="font-medium text-destructive">
                締切超過 {project.overdueCount} 件
              </span>
            )}
            {project.archivedAt && <span>完了済みのプロジェクトです</span>}
          </span>
        }
        actions={
          <TaskToolbar
            projects={projects}
            taskTypes={taskTypes}
            users={users}
            defaultProjectId={project.id}
          />
        }
      />

      {project.description && (
        <Panel className="p-3 text-sm whitespace-pre-wrap sm:p-4">{project.description}</Panel>
      )}

      <Panel>
        <PanelHeader>
          <h3 className="font-heading text-sm font-semibold">タスク</h3>
          <span className="ml-auto text-xs text-muted-foreground" data-numeric>
            {tasks.length} 件
          </span>
        </PanelHeader>

        <TaskList
          tasks={tasks}
          projects={projects}
          taskTypes={taskTypes}
          users={users}
          defaultProjectId={project.id}
          showProject={false}
          emptyMessage="このプロジェクトにはまだタスクがありません。"
        />
      </Panel>
    </div>
  );
}
