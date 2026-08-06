"use client";

import { EllipsisVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  TASK_STATUSES,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABELS,
  type TaskItem,
} from "@/features/tasks/schema";
import { PROJECT_COLORS, type ProjectOption } from "@/features/projects/schema";
import type { UserOption } from "@/lib/env";
import {
  daysUntil,
  formatRange,
  formatRelativeDay,
  formatTime,
  formatWeekdayDate,
} from "@/lib/datetime";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { useApiMutation } from "@/components/shared/use-api";
import { useSheetTarget } from "@/components/shared/use-sheet-target";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type TaskListProps = {
  tasks: TaskItem[];
  projects: ProjectOption[];
  users: UserOption[];
  /** 新規作成時の既定プロジェクト（プロジェクト詳細から開いたとき用）。 */
  defaultProjectId?: string | null;
  /** プロジェクト詳細では所属プロジェクトが自明なので隠す。 */
  showProject?: boolean;
  emptyMessage?: string;
};

export function TaskList({
  tasks,
  projects,
  users,
  defaultProjectId,
  showProject = true,
  emptyMessage = "タスクがありません。",
}: TaskListProps) {
  const editSheet = useSheetTarget<TaskItem>();
  const deleteDialog = useSheetTarget<TaskItem>();

  if (tasks.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <>
      <ul className="divide-y">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            showProject={showProject}
            onEdit={() => editSheet.show(task)}
            onDelete={() => deleteDialog.show(task)}
          />
        ))}
      </ul>

      <TaskSheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        task={editSheet.target}
        defaultProjectId={defaultProjectId}
        projects={projects}
        users={users}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`「${deleteDialog.target?.title}」を削除しますか？`}
        description="この操作は取り消せません。カレンダー上の表示も消えます。"
        onConfirm={() => api.deleteTask(deleteDialog.target?.id as string)}
      />
    </>
  );
}

function TaskRow({
  task,
  showProject,
  onEdit,
  onDelete,
}: {
  task: TaskItem;
  showProject: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { run, pending } = useApiMutation();

  const changeStatus = (status: string) =>
    run(() => api.updateTaskStatus(task.id, status), { silent: true });

  const now = new Date();
  const deadline = task.deadlineAt ? new Date(task.deadlineAt) : null;
  const overdue = deadline !== null && task.status !== "done" && daysUntil(deadline, now) < 0;

  return (
    <li className={cn("flex items-start gap-2 px-3 py-3 transition-colors hover:bg-muted/40", pending && "opacity-60")}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={pending}
              aria-label={`${task.title} の状態を変更（現在: ${TASK_STATUS_LABELS[task.status]}）`}
              className={cn(
                "mt-0.5 shrink-0 border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
                TASK_STATUS_BADGE[task.status]
              )}
            >
              {TASK_STATUS_LABELS[task.status]}
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-auto min-w-36">
          <DropdownMenuLabel>状態を変更</DropdownMenuLabel>
          {TASK_STATUSES.map((status) => (
            <DropdownMenuItem
              key={status}
              disabled={status === task.status}
              onClick={() => changeStatus(status)}
            >
              {TASK_STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onEdit}
          className="block w-full text-left text-sm font-medium underline-offset-4 hover:underline"
        >
          <span className={cn("break-words", task.status === "done" && "text-muted-foreground line-through")}>
            {task.title}
          </span>
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {showProject && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn("size-2 shrink-0", PROJECT_COLORS[task.projectColor].dot)}
                aria-hidden
              />
              {task.projectName ?? "未分類"}
            </span>
          )}

          {task.assigneeName && <span>担当 {task.assigneeName}</span>}
          {task.reviewerName && <span>検収 {task.reviewerName}</span>}

          {task.startsAt && (
            <span>
              {task.endsAt
                ? formatRange(new Date(task.startsAt), new Date(task.endsAt), false)
                : `${formatWeekdayDate(new Date(task.startsAt))} ${formatTime(new Date(task.startsAt))} 〜`}
            </span>
          )}

          {deadline && (
            <span className={cn("font-medium", overdue ? "text-destructive" : "text-foreground")}>
              締切 {formatWeekdayDate(deadline)} {formatTime(deadline)}（
              {formatRelativeDay(deadline, now)}）
            </span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`${task.title} の操作`}>
              <EllipsisVerticalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-auto min-w-32">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon />
            編集
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
