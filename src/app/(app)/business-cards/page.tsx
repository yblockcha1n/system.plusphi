import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { env } from "@/lib/env";
import { getBusinessCards } from "@/features/business-cards/queries";
import { getCompanyOptions } from "@/features/companies/queries";
import { getCompanyStatusOptions } from "@/features/company-statuses/queries";
import { PageHeader } from "@/components/shared/page-header";
import { BusinessCardList } from "@/components/business-cards/business-card-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "名刺 | plusphi",
};

/**
 * 名刺の一覧。
 *
 * 取引先の下だけに置くと、会社に属さない相手（個人事業主・知人など）の名刺が
 * どこからも見えなくなる。ここが全件の入口になる。
 */
export default async function BusinessCardsPage(props: PageProps<"/business-cards">) {
  const searchParams = await props.searchParams;

  const statusId = first(searchParams.status);
  const keyword = first(searchParams.q)?.trim() ?? "";
  // "none" は「会社に属さない名刺だけ」
  const scope = first(searchParams.scope);

  const [cards, companies, statuses] = await Promise.all([
    getBusinessCards({
      keyword: keyword || undefined,
      statusId,
      companyId: scope === "none" ? null : undefined,
    }),
    getCompanyOptions(),
    getCompanyStatusOptions(),
  ]);

  const hrefFor = (next: { status?: string; q?: string; scope?: string }) => {
    const params = new URLSearchParams();
    const merged = {
      status: next.status !== undefined ? next.status : statusId,
      q: next.q !== undefined ? next.q : keyword,
      scope: next.scope !== undefined ? next.scope : scope,
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }

    const query = params.toString();
    return query ? `/business-cards?${query}` : "/business-cards";
  };

  const chip = (active: boolean) =>
    cn(
      "border px-2 py-0.5 text-xs transition-colors",
      active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
    );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title="名刺"
        description={`${cards.length} 枚。ステータスのバッジを押すと、その場で進み具合を変えられます。`}
      />

      {/* GET フォームなので JS 無しでも動く */}
      <form action="/business-cards" className="flex flex-wrap items-center gap-2">
        {statusId && <input type="hidden" name="status" value={statusId} />}
        {scope && <input type="hidden" name="scope" value={scope} />}
        <Input
          name="q"
          type="search"
          defaultValue={keyword}
          placeholder="氏名・ふりがな・メール・部署で検索"
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

      <div className="flex flex-wrap gap-1.5">
        <Link href={hrefFor({ status: "", scope: "" })} className={chip(!statusId && !scope)}>
          すべて
        </Link>
        <Link
          href={hrefFor({ scope: scope === "none" ? "" : "none" })}
          className={chip(scope === "none")}
        >
          会社に属さない
        </Link>
        {statuses.map((status) => (
          <Link
            key={status.id}
            href={hrefFor({ status: status.id === statusId ? "" : status.id })}
            className={chip(status.id === statusId)}
          >
            {status.name}
          </Link>
        ))}
      </div>

      <BusinessCardList
        cards={cards}
        companies={companies}
        statuses={statuses}
        ocrEnabled={Boolean(env.PERPLEXITY_API_KEY)}
      />
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
