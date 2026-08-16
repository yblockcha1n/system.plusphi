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
import type { CompanyStatusItem } from "@/features/company-statuses/schema";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { SortableGroup } from "@/components/shared/sortable-group";
import { CompanyStatusSheet } from "@/components/company-statuses/company-status-sheet";
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
 * 取引先ステータスのマスタ管理。掴んで並べ替えた順が、選択肢と絞り込みの並び順になる。
 */
export function CompanyStatusBoard({ statuses }: { statuses: CompanyStatusItem[] }) {
  const editSheet = useSheetTarget<CompanyStatusItem>();
  const deleteDialog = useSheetTarget<CompanyStatusItem>();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={() => editSheet.show(undefined)}>
          <PlusIcon />
          ステータスを追加
        </Button>
      </div>

      {statuses.length === 0 ? (
        <div className="border bg-card">
          <EmptyState>
            ステータスがまだありません。「ステータスを追加」から作成してください。
          </EmptyState>
        </div>
      ) : (
        <SortableGroup
          id="company-statuses"
          items={statuses}
          getId={(status) => status.id}
          onReorder={api.reorderCompanyStatuses}
          className="flex flex-col gap-2"
        >
          {(status, dragHandle) => (
            <CompanyStatusRow
              status={status}
              dragHandle={dragHandle}
              onEdit={() => editSheet.show(status)}
              onDelete={() => deleteDialog.show(status)}
            />
          )}
        </SortableGroup>
      )}

      <CompanyStatusSheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        status={editSheet.target}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`ステータス「${deleteDialog.target?.name}」を削除しますか？`}
        description={
          deleteDialog.target && deleteDialog.target.companyCount > 0
            ? `このステータスが付いた ${deleteDialog.target.companyCount} 件の取引先は「未設定」になります。取引先自体は消えません。選択肢から外すだけなら「使用を停止」を使ってください。`
            : "この操作は取り消せません。"
        }
        onConfirm={() => api.deleteCompanyStatus(deleteDialog.target?.id as string)}
      />
    </div>
  );
}

function CompanyStatusRow({
  status,
  dragHandle,
  onEdit,
  onDelete,
}: {
  status: CompanyStatusItem;
  dragHandle: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { run, pending } = useApiMutation();
  const archived = status.archivedAt !== null;

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
          <span className="truncate text-sm font-medium">{status.name}</span>
          {archived && (
            <span className="shrink-0 border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
              使用停止中
            </span>
          )}
        </div>
        {status.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {status.description}
          </p>
        )}
      </div>

      <span className="shrink-0 text-xs text-muted-foreground" data-numeric>
        {status.companyCount} 件
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`${status.name} の操作`}>
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
            onClick={() => run(() => api.setCompanyStatusArchived(status.id, !archived))}
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
