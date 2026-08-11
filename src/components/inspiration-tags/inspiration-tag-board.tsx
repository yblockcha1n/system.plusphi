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
import type { InspirationTagItem } from "@/features/inspiration-tags/schema";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { SortableGroup } from "@/components/shared/sortable-group";
import { InspirationTagSheet } from "@/components/inspiration-tags/inspiration-tag-sheet";
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
 * ナレッジタグのマスタ管理。掴んで並べ替えた順が、登録時と絞り込みの選択肢の順になる。
 */
export function InspirationTagBoard({ tags }: { tags: InspirationTagItem[] }) {
  const editSheet = useSheetTarget<InspirationTagItem>();
  const deleteDialog = useSheetTarget<InspirationTagItem>();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={() => editSheet.show(undefined)}>
          <PlusIcon />
          タグを追加
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="border bg-card">
          <EmptyState>
            タグがまだありません。「タグを追加」から作成してください。
          </EmptyState>
        </div>
      ) : (
        <SortableGroup
          id="inspiration-tags"
          items={tags}
          getId={(tag) => tag.id}
          onReorder={api.reorderInspirationTags}
          className="flex flex-col gap-2"
        >
          {(tag, dragHandle) => (
            <InspirationTagRow
              tag={tag}
              dragHandle={dragHandle}
              onEdit={() => editSheet.show(tag)}
              onDelete={() => deleteDialog.show(tag)}
            />
          )}
        </SortableGroup>
      )}

      <InspirationTagSheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        tag={editSheet.target}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`タグ「${deleteDialog.target?.name}」を削除しますか？`}
        description={
          deleteDialog.target && deleteDialog.target.usageCount > 0
            ? `このタグが付いた ${deleteDialog.target.usageCount} 件のナレッジからタグが外れます。ナレッジ自体は消えません。選択肢から外すだけなら「使用を停止」を使ってください。`
            : "この操作は取り消せません。"
        }
        onConfirm={() => api.deleteInspirationTag(deleteDialog.target?.id as string)}
      />
    </div>
  );
}

function InspirationTagRow({
  tag,
  dragHandle,
  onEdit,
  onDelete,
}: {
  tag: InspirationTagItem;
  dragHandle: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { run, pending } = useApiMutation();
  const archived = tag.archivedAt !== null;

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
          <span className="truncate text-sm font-medium">{tag.name}</span>
          {archived && (
            <span className="shrink-0 border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
              使用停止中
            </span>
          )}
        </div>
        {tag.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {tag.description}
          </p>
        )}
      </div>

      <span className="shrink-0 text-xs text-muted-foreground" data-numeric>
        {tag.usageCount} 件
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`${tag.name} の操作`}>
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
            onClick={() => run(() => api.setInspirationTagArchived(tag.id, !archived))}
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
