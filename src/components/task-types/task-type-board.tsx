"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { TaskTypeItem } from "@/features/task-types/schema";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { SortableGroup } from "@/components/shared/sortable-group";
import { TaskTypeSheet } from "@/components/task-types/task-type-sheet";
import { useApiMutation } from "@/components/shared/use-api";
import { useSheetTarget } from "@/components/shared/use-sheet-target";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * タスク種別のマスタ管理。掴んで並べ替えた順が、タスク登録時の選択肢の順になる。
 */
export function TaskTypeBoard({ taskTypes }: { taskTypes: TaskTypeItem[] }) {
  const editSheet = useSheetTarget<TaskTypeItem>();
  const deleteDialog = useSheetTarget<TaskTypeItem>();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={() => editSheet.show(undefined)}>
          <PlusIcon />
          種別を追加
        </Button>
      </div>

      {taskTypes.length === 0 ? (
        <div className="border bg-card">
          <EmptyState>
            種別がまだありません。「種別を追加」から作成してください。
          </EmptyState>
        </div>
      ) : (
        <SortableGroup
          id="task-types"
          items={taskTypes}
          getId={(taskType) => taskType.id}
          onReorder={api.reorderTaskTypes}
          className="flex flex-col gap-2"
        >
          {(taskType, dragHandle) => (
            <TaskTypeRow
              taskType={taskType}
              dragHandle={dragHandle}
              onEdit={() => editSheet.show(taskType)}
              onDelete={() => deleteDialog.show(taskType)}
            />
          )}
        </SortableGroup>
      )}

      <TaskTypeSheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        taskType={editSheet.target}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`種別「${deleteDialog.target?.name}」を削除しますか？`}
        description={
          deleteDialog.target && deleteDialog.target.taskCount > 0
            ? `この種別が付いた ${deleteDialog.target.taskCount} 件のタスクは「種別なし」になります。タスク自体は消えません。選択肢から外すだけなら「使用を停止」を使ってください。`
            : "この操作は取り消せません。"
        }
        onConfirm={() => api.deleteTaskType(deleteDialog.target?.id as string)}
      />
    </div>
  );
}

function TaskTypeRow({
  taskType,
  dragHandle,
  onEdit,
  onDelete,
}: {
  taskType: TaskTypeItem;
  dragHandle: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { run, pending } = useApiMutation();
  const archived = taskType.archivedAt !== null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 border bg-card px-2 py-2 transition-colors sm:px-3",
        archived && "opacity-60",
        pending && "opacity-50"
      )}
    >
      {dragHandle}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">{taskType.name}</span>
          {archived && (
            <span className="shrink-0 border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
              使用停止中
            </span>
          )}
        </div>
        {taskType.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {taskType.description}
          </p>
        )}
      </div>

      <span className="shrink-0 text-xs text-muted-foreground" data-numeric>
        {taskType.taskCount} 件
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`${taskType.name} の操作`}>
              <EllipsisVerticalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-auto min-w-40">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon />
            編集
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={pending}
            onClick={() => run(() => api.setTaskTypeArchived(taskType.id, !archived))}
          >
            {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
            {archived ? "使用を再開" : "使用を停止"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
