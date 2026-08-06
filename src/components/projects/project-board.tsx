"use client";

import Link from "next/link";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { PROJECT_COLORS, type ProjectSummary } from "@/features/projects/schema";
import { ProjectSheet } from "@/components/projects/project-sheet";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { SortableGroup } from "@/components/shared/sortable-group";
import { useApiMutation } from "@/components/shared/use-api";
import { useSheetTarget } from "@/components/shared/use-sheet-target";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ProjectBoardProps = {
  projects: ProjectSummary[];
};

export function ProjectBoard({ projects }: ProjectBoardProps) {
  const editSheet = useSheetTarget<ProjectSummary>();
  const deleteDialog = useSheetTarget<ProjectSummary>();

  if (projects.length === 0) {
    return (
      <div className="border bg-card">
        <EmptyState>
          プロジェクトがまだありません。右上の「プロジェクトを作成」から追加してください。
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <SortableGroup
        id="projects"
        items={projects}
        getId={(project) => project.id}
        onReorder={api.reorderProjects}
        className="flex flex-col gap-2"
      >
        {(project, dragHandle) => (
          <ProjectCard
            project={project}
            dragHandle={dragHandle}
            onEdit={() => editSheet.show(project)}
            onDelete={() => deleteDialog.show(project)}
          />
        )}
      </SortableGroup>

      <ProjectSheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        project={editSheet.target}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`プロジェクト「${deleteDialog.target?.name}」を削除しますか？`}
        description="中のタスクと予定は削除されず、「未分類」に移動します。"
        onConfirm={() => api.deleteProject(deleteDialog.target?.id as string)}
      />
    </>
  );
}

function ProjectCard({
  project,
  dragHandle,
  onEdit,
  onDelete,
}: {
  project: ProjectSummary;
  dragHandle: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { run, pending } = useApiMutation();
  const archived = project.archivedAt !== null;

  const toggleArchived = () => run(() => api.setProjectArchived(project.id, !archived));

  const progress =
    project.taskCount === 0 ? 0 : Math.round((project.doneCount / project.taskCount) * 100);

  return (
    <div
      className={cn(
        "flex items-stretch border bg-card transition-colors hover:bg-muted/30",
        pending && "opacity-60"
      )}
    >
      {/* 左端のアクセントバーが識別色 */}
      <span className={cn("w-1 shrink-0", PROJECT_COLORS[project.color].bar)} aria-hidden />

      <div className="flex items-center self-stretch border-r px-0.5">{dragHandle}</div>

      <div className="min-w-0 flex-1 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="truncate font-heading text-sm font-semibold underline-offset-4 hover:underline"
          >
            {project.name}
          </Link>
          {archived && (
            <span className="border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
              完了
            </span>
          )}
          {project.overdueCount > 0 && (
            <span className="border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-destructive">
              締切超過 {project.overdueCount}
            </span>
          )}
        </div>

        {project.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
        )}

        <div className="mt-2 flex items-center gap-3">
          {/* 進捗バー。角は落としたままにする。 */}
          <div className="h-1.5 w-full max-w-40 bg-muted" aria-hidden>
            <div className="h-full bg-foreground" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs whitespace-nowrap text-muted-foreground" data-numeric>
            {project.doneCount} / {project.taskCount} 完了
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 px-2">
        {/* 画面遷移なので <button> ではなく <a>。Button の見た目だけ borrow する。 */}
        <Link
          href={`/projects/${project.id}`}
          aria-label={`${project.name} にタスクを追加`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <PlusIcon />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`${project.name} の操作`}>
                <EllipsisVerticalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon />
              編集
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleArchived}>
              {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {archived ? "進行中に戻す" : "完了にする"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
