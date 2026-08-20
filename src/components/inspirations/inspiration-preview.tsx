"use client";

import { ExternalLinkIcon } from "lucide-react";
import type { InspirationItem } from "@/features/inspirations/schema";
import {
  CONTENT_KIND_LABELS,
  PLATFORM_LABELS,
  embedAspect,
  type ContentKind,
  type Platform,
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
  // プロフィールとタイムラインは中で縦にスクロールする。縦横比で箱を作ると
  // 細長くなりすぎるので、画面の高さに対して決める。
  const isAccount = inspiration.contentKind === "account";
  // Web ページは画面まるごとが中身なので、縦横比ではなく画面の高さで箱を決める
  const isPage = inspiration.contentKind === "website" || inspiration.contentKind === "link";
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
              // Web ページはサイト名だけで分かるので「その他」は出さない
              isPage ? null : PLATFORM_LABELS[inspiration.platform],
              inspiration.authorName &&
                (isPage ? inspiration.authorName : `@${inspiration.authorName}`),
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
              isAccount || isPage ? "h-[70svh]" : portrait ? "aspect-[9/16]" : "aspect-video"
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
            {unavailableReason(inspiration.platform, inspiration.contentKind)}
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
            {isPage ? "サイトを開く" : "元の投稿を開く"}
          </a>
          <DialogClose render={<Button type="button">閉じる</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 埋め込めないときの文面。理由が分かるものは書き分ける。
 * 「対応していません」だけだと、こちらの不具合と区別が付かないため。
 */
function unavailableReason(platform: Platform, contentKind: ContentKind): string {
  if (contentKind === "link") {
    return "このサイトは外部のページへの埋め込みを許可していません。下のリンクから開いてください。";
  }

  if (contentKind !== "account") {
    return "この URL は埋め込みに対応していません。下のリンクから開いてください。";
  }

  switch (platform) {
    case "youtube":
      return "YouTube はチャンネルの埋め込みを提供していません。下のリンクから開いてください。";
    case "x":
      return "X は未ログインでのプロフィール表示を強く制限しているため、埋め込むと高い確率で表示できません。下のリンクから開いてください。";
    default:
      return "このアカウントは埋め込みに対応していません。下のリンクから開いてください。";
  }
}
