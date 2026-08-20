"use client";

import {
  AtSignIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  ImageOffIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { InspirationItem } from "@/features/inspirations/schema";
import type { InspirationTagOption } from "@/features/inspiration-tags/schema";
import {
  CONTENT_KIND_LABELS,
  PLATFORM_LABELS,
  embedAspect,
} from "@/features/inspirations/url";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { InspirationPreview } from "@/components/inspirations/inspiration-preview";
import { InspirationSheet } from "@/components/inspirations/inspiration-sheet";
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

type InspirationGridProps = {
  inspirations: InspirationItem[];
  tags: InspirationTagOption[];
  emptyMessage?: string;
};

export function InspirationGrid({
  inspirations,
  tags,
  emptyMessage = "まだ登録がありません。",
}: InspirationGridProps) {
  const preview = useSheetTarget<InspirationItem>();
  const editSheet = useSheetTarget<InspirationItem>();
  const deleteDialog = useSheetTarget<InspirationItem>();

  return (
    <>
      {inspirations.length === 0 ? (
        <div className="border bg-card">
          <EmptyState>{emptyMessage}</EmptyState>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {inspirations.map((inspiration) => (
            <InspirationCard
              key={inspiration.id}
              inspiration={inspiration}
              onOpen={() => preview.show(inspiration)}
              onEdit={() => editSheet.show(inspiration)}
              onDelete={() => deleteDialog.show(inspiration)}
            />
          ))}
        </ul>
      )}

      <InspirationPreview
        open={preview.open}
        onOpenChange={preview.onOpenChange}
        inspiration={preview.target}
      />

      <InspirationSheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        inspiration={editSheet.target}
        tags={tags}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title="このナレッジを削除しますか？"
        description="この操作は取り消せません。保存したサムネイルも一緒に削除されます。"
        onConfirm={() => api.deleteInspiration(deleteDialog.target?.id as string)}
      />
    </>
  );
}

function InspirationCard({
  inspiration,
  onOpen,
  onEdit,
  onDelete,
}: {
  inspiration: InspirationItem;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { run, pending } = useApiMutation();
  const portrait = embedAspect(inspiration.platform, inspiration.contentKind) === "portrait";
  const isAccount = inspiration.contentKind === "account";

  const heading =
    inspiration.title ??
    inspiration.note ??
    `${PLATFORM_LABELS[inspiration.platform]}の${CONTENT_KIND_LABELS[inspiration.contentKind]}`;

  return (
    <li className={cn("flex flex-col border bg-card", pending && "opacity-50")}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${heading} を開く`}
        className={cn(
          "group relative w-full overflow-hidden bg-muted/40 transition-opacity hover:opacity-90",
          portrait ? "aspect-[9/16]" : "aspect-video"
        )}
      >
        {inspiration.thumbnailUrl ? (
          // next/image を使わないのは、署名付き URL が発行のたびに変わって
          // 最適化キャッシュが効かず、変換だけが無駄に走るため。表示サイズが
          // 小さいサムネなので素の img で足りる。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={inspiration.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : isAccount ? (
          // アカウントはプロフィール画像を取れないことが普通にある（Instagram の
          // 非公開など）。壊れた画像のように見せず、アカウントだと分かる形にする。
          <span className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-muted-foreground">
            <AtSignIcon className="size-6" />
            <span className="line-clamp-2 text-center text-[0.6875rem] break-all">
              {inspiration.authorName ?? PLATFORM_LABELS[inspiration.platform]}
            </span>
          </span>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOffIcon className="size-5" />
            <span className="text-[0.625rem]">サムネなし</span>
          </span>
        )}

        {/* 再生できるものだけ再生アイコンを重ねる。アカウントは動画ではないので付けない */}
        {inspiration.embedUrl && !isAccount && (
          <span
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-110">
              <PlayIcon className="size-4 fill-current" />
            </span>
          </span>
        )}

        <span className="absolute top-1 left-1 bg-black/65 px-1.5 py-0.5 text-[0.625rem] font-medium text-white">
          {PLATFORM_LABELS[inspiration.platform]}
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-start gap-1">
          <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug font-medium">
            {heading}
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-xs" aria-label="操作" className="-mt-0.5">
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
                onClick={() => run(() => api.refreshInspiration(inspiration.id))}
              >
                <RefreshCwIcon />
                情報を取り直す
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open(inspiration.url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLinkIcon />
                元の投稿を開く
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {inspiration.authorName && (
          <p className="truncate text-[0.625rem] text-muted-foreground">
            @{inspiration.authorName}
          </p>
        )}

        {inspiration.tagNames.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {inspiration.tagNames.slice(0, 3).map((name) => (
              <li
                key={name}
                className="border px-1 py-0.5 text-[0.625rem] text-muted-foreground"
              >
                {name}
              </li>
            ))}
            {inspiration.tagNames.length > 3 && (
              <li className="px-1 py-0.5 text-[0.625rem] text-muted-foreground">
                +{inspiration.tagNames.length - 3}
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}
