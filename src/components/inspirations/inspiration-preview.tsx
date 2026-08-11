"use client";

import { ExternalLinkIcon } from "lucide-react";
import type { InspirationItem } from "@/features/inspirations/schema";
import {
  CONTENT_KIND_LABELS,
  PLATFORM_LABELS,
  embedAspect,
} from "@/features/inspirations/url";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type InspirationPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspiration?: InspirationItem;
};

/**
 * 参考動画の再生。
 *
 * iframe はここでしか使わない。一覧に並べると 1 件あたり 200KB 超を読み込むため、
 * 20 件で 4MB を超えてしまう。一覧はサムネだけにして、開いたときに 1 枚だけ読む。
 */
export function InspirationPreview({
  open,
  onOpenChange,
  inspiration,
}: InspirationPreviewProps) {
  if (!inspiration) return null;

  const portrait = embedAspect(inspiration.platform, inspiration.contentKind) === "portrait";
  const heading =
    inspiration.title ??
    `${PLATFORM_LABELS[inspiration.platform]}の${CONTENT_KIND_LABELS[inspiration.contentKind]}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[calc(100svh-2rem)] overflow-y-auto",
          // 縦動画は幅を絞らないと画面からはみ出す
          portrait ? "sm:max-w-md" : "sm:max-w-3xl"
        )}
      >
        <DialogHeader>
          <DialogTitle className="break-words">{heading}</DialogTitle>
          <DialogDescription>
            {[
              PLATFORM_LABELS[inspiration.platform],
              inspiration.authorName && `@${inspiration.authorName}`,
              inspiration.createdBy && `登録者 ${inspiration.createdBy}`,
            ]
              .filter(Boolean)
              .join(" ・ ")}
          </DialogDescription>
        </DialogHeader>

        {inspiration.embedUrl ? (
          <div
            className={cn(
              "w-full overflow-hidden border bg-muted/30",
              portrait ? "aspect-[9/16]" : "aspect-video"
            )}
          >
            <iframe
              // URL が変わったら読み直させる（前の動画が残らないように）
              key={inspiration.embedUrl}
              src={inspiration.embedUrl}
              title={heading}
              className="size-full"
              // 埋め込み先での再生・全画面を許可する。
              // allowFullScreen は付けない（allow に fullscreen があると打ち消され、
              // ブラウザが「allow が優先される」と警告を出すだけになる）。
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
              // 外部サイトなので権限は最小限に。再生に必要なぶんだけ開ける。
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              loading="lazy"
            />
          </div>
        ) : (
          <p className="border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            {inspiration.contentKind === "account"
              ? "アカウントのページは埋め込みに対応していません。下のリンクから開いてください。"
              : "この URL は埋め込みに対応していません。下のリンクから開いてください。"}
          </p>
        )}

        {inspiration.note && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">メモ</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{inspiration.note}</p>
          </div>
        )}

        {inspiration.tagNames.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {inspiration.tagNames.map((name) => (
              <li key={name} className="border px-1.5 py-0.5 text-xs text-muted-foreground">
                {name}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <a
            href={inspiration.url}
            target="_blank"
            rel="noreferrer noopener"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLinkIcon />
            元の投稿を開く
          </a>
          <DialogClose render={<Button type="button">閉じる</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
