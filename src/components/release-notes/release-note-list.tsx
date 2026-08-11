"use client";

import {
  EllipsisVerticalIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { ReleaseNoteItem } from "@/features/release-notes/schema";
import { formatDateTime } from "@/lib/datetime";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { ReleaseNoteSheet } from "@/components/release-notes/release-note-sheet";
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

export function ReleaseNoteList({ notes }: { notes: ReleaseNoteItem[] }) {
  const editSheet = useSheetTarget<ReleaseNoteItem>();
  const publishDialog = useSheetTarget<ReleaseNoteItem>();
  const deleteDialog = useSheetTarget<ReleaseNoteItem>();

  if (notes.length === 0) {
    return (
      <div className="border bg-card">
        <EmptyState>
          まだパッチノートがありません。prd ブランチへ push すると下書きが作られます。
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {notes.map((note) => (
          <ReleaseNoteCard
            key={note.id}
            note={note}
            onEdit={() => editSheet.show(note)}
            onPublish={() => publishDialog.show(note)}
            onDelete={() => deleteDialog.show(note)}
          />
        ))}
      </ul>

      <ReleaseNoteSheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        note={editSheet.target}
      />

      {/* 公開は全員へ通知が飛ぶので、削除と同じく必ず確認を挟む */}
      <ConfirmDeleteDialog
        open={publishDialog.open}
        onOpenChange={publishDialog.onOpenChange}
        title={`${publishDialog.target?.version} を公開しますか？`}
        description="公開すると、通知をオンにしている全員の端末にお知らせが届きます。"
        confirmLabel="公開する"
        confirmVariant="default"
        onConfirm={() => api.publishReleaseNote(publishDialog.target?.id as string)}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`${deleteDialog.target?.version} を削除しますか？`}
        description="この操作は取り消せません。"
        onConfirm={() => api.deleteReleaseNote(deleteDialog.target?.id as string)}
      />
    </>
  );
}

function ReleaseNoteCard({
  note,
  onEdit,
  onPublish,
  onDelete,
}: {
  note: ReleaseNoteItem;
  onEdit: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const { pending } = useApiMutation();
  const isDraft = note.status === "draft";

  return (
    <li
      className={cn(
        "flex flex-col border bg-card",
        // 下書きは「まだ誰にも見せていない」ことが一目で分かるようにする
        isDraft && "border-dashed",
        pending && "opacity-50"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <span className="font-heading text-sm font-semibold" data-numeric>
          {note.version}
        </span>

        <span
          className={cn(
            "border px-1.5 py-0.5 text-[0.625rem] font-medium",
            isDraft ? "text-muted-foreground" : "border-foreground bg-foreground text-background"
          )}
        >
          {isDraft ? "下書き" : "公開済み"}
        </span>

        <span className="text-xs text-muted-foreground" data-numeric>
          {note.commitCount > 0 && `${note.commitCount} コミット`}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {isDraft && (
            <Button size="sm" onClick={onPublish}>
              <SendIcon />
              公開
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`${note.version} の操作`}>
                  <EllipsisVerticalIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-auto min-w-36">
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
        </div>
      </div>

      <div className="flex flex-col gap-2 px-3 py-3">
        <h3 className="text-sm font-medium">{note.title}</h3>
        {/* 自動生成の本文は箇条書きなので、改行をそのまま活かす */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.body}</p>
      </div>

      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        {note.status === "published" && note.publishedAt
          ? `${formatDateTime(new Date(note.publishedAt))} に ${note.publisher ?? "不明"} が公開`
          : `${formatDateTime(new Date(note.createdAt))} に作成`}
        {note.generatedBy && ` ・ ${note.generatedBy} が生成`}
      </p>
    </li>
  );
}
