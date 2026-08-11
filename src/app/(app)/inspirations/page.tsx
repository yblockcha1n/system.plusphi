import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { getInspirations } from "@/features/inspirations/queries";
import { getInspirationTagOptions } from "@/features/inspiration-tags/queries";
import { PLATFORMS, PLATFORM_LABELS, type Platform } from "@/features/inspirations/url";
import { PageHeader } from "@/components/shared/page-header";
import { InspirationGrid } from "@/components/inspirations/inspiration-grid";
import { InspirationToolbar } from "@/components/inspirations/inspiration-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ナレッジ | plusphi",
};

export default async function InspirationsPage(props: PageProps<"/inspirations">) {
  const searchParams = await props.searchParams;

  // 絞り込みの状態はカレンダーと同じく URL だけで決まるようにする
  const tagId = first(searchParams.tag);
  const platform = toPlatform(first(searchParams.platform));
  const keyword = first(searchParams.q)?.trim() ?? "";

  const [inspirations, tags] = await Promise.all([
    getInspirations({ tagId, platform, keyword: keyword || undefined }),
    getInspirationTagOptions(),
  ]);

  const filtered = Boolean(tagId || platform || keyword);

  const hrefFor = (next: { tag?: string; platform?: string; q?: string }) => {
    const params = new URLSearchParams();
    const merged = {
      tag: next.tag !== undefined ? next.tag : tagId,
      platform: next.platform !== undefined ? next.platform : platform,
      q: next.q !== undefined ? next.q : keyword,
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }

    const query = params.toString();
    return query ? `/inspirations?${query}` : "/inspirations";
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader
        title="ナレッジ"
        description={`参考になった投稿の置き場です。${inspirations.length} 件。カードを押すとこの画面のまま再生できます。`}
        actions={<InspirationToolbar tags={tags} />}
      />

      {/* キーワード検索。GET フォームなので JS 無しでも動く。 */}
      <form action="/inspirations" className="flex flex-wrap items-center gap-2">
        {tagId && <input type="hidden" name="tag" value={tagId} />}
        {platform && <input type="hidden" name="platform" value={platform} />}
        <Input
          name="q"
          type="search"
          defaultValue={keyword}
          placeholder="タイトル・メモ・投稿者で検索"
          className="w-full sm:w-72"
          aria-label="キーワード検索"
        />
        <Button type="submit" variant="outline" size="sm">
          <SearchIcon />
          検索
        </Button>
        {keyword && (
          <Link
            href={hrefFor({ q: "" })}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            検索を解除
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex border">
          <Link
            href={hrefFor({ platform: "" })}
            aria-current={platform ? undefined : "true"}
            className={cn(
              "px-3 py-1 text-xs font-medium transition-colors",
              platform ? "text-muted-foreground hover:bg-muted" : "bg-foreground text-background"
            )}
          >
            すべて
          </Link>
          {PLATFORMS.filter((item) => item !== "other").map((item) => (
            <Link
              key={item}
              href={hrefFor({ platform: item })}
              aria-current={item === platform ? "true" : undefined}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                item === platform
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {PLATFORM_LABELS[item]}
            </Link>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={hrefFor({ tag: tag.id === tagId ? "" : tag.id })}
                aria-current={tag.id === tagId ? "true" : undefined}
                className={cn(
                  "border px-2 py-0.5 text-xs transition-colors",
                  tag.id === tagId
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <InspirationGrid
        inspirations={inspirations}
        tags={tags}
        emptyMessage={
          filtered
            ? "条件に合うナレッジがありません。絞り込みを外してみてください。"
            : "まだ登録がありません。右上の「ナレッジを登録」から参考になった投稿の URL を貼ってください。"
        }
      />
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toPlatform(value: string | undefined): Platform | undefined {
  return PLATFORMS.includes(value as Platform) ? (value as Platform) : undefined;
}
