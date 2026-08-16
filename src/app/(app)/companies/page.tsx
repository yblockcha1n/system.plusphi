import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { getCompanies } from "@/features/companies/queries";
import { getCompanyStatusOptions } from "@/features/company-statuses/queries";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyList } from "@/components/companies/company-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "取引先 | plusphi",
};

export default async function CompaniesPage(props: PageProps<"/companies">) {
  const searchParams = await props.searchParams;

  // 絞り込みの状態はカレンダーと同じく URL だけで決まるようにする
  const statusId = first(searchParams.status);
  const keyword = first(searchParams.q)?.trim() ?? "";

  const [companies, statuses] = await Promise.all([
    getCompanies({ statusId, keyword: keyword || undefined }),
    getCompanyStatusOptions(),
  ]);

  const filtered = Boolean(statusId || keyword);

  const hrefFor = (next: { status?: string; q?: string }) => {
    const params = new URLSearchParams();
    const merged = {
      status: next.status !== undefined ? next.status : statusId,
      q: next.q !== undefined ? next.q : keyword,
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }

    const query = params.toString();
    return query ? `/companies?${query}` : "/companies";
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader
        title="取引先"
        description={`${companies.length} 件。ステータスのバッジを押すと、その場で進み具合を変えられます。`}
      />

      {/* GET フォームなので JS 無しでも動く */}
      <form action="/companies" className="flex flex-wrap items-center gap-2">
        {statusId && <input type="hidden" name="status" value={statusId} />}
        <Input
          name="q"
          type="search"
          defaultValue={keyword}
          placeholder="会社名・ふりがな・メモで検索"
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
        <Link
          href={hrefFor({ status: "" })}
          aria-current={statusId ? undefined : "true"}
          className={cn(
            "border px-2 py-0.5 text-xs transition-colors",
            statusId ? "text-muted-foreground hover:bg-muted" : "bg-foreground text-background"
          )}
        >
          すべて
        </Link>
        {statuses.map((status) => (
          <Link
            key={status.id}
            href={hrefFor({ status: status.id === statusId ? "" : status.id })}
            aria-current={status.id === statusId ? "true" : undefined}
            className={cn(
              "border px-2 py-0.5 text-xs transition-colors",
              status.id === statusId
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {status.name}
          </Link>
        ))}
      </div>

      <CompanyList
        companies={companies}
        statuses={statuses}
        emptyMessage={
          filtered
            ? "条件に合う取引先がありません。絞り込みを外してみてください。"
            : undefined
        }
      />
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
