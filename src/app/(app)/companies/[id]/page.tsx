import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { env } from "@/lib/env";
import { getCompany, getCompanyOptions } from "@/features/companies/queries";
import { getCompanyStatusOptions } from "@/features/company-statuses/queries";
import { getBusinessCards } from "@/features/business-cards/queries";
import { PageHeader, Panel, PanelHeader } from "@/components/shared/page-header";
import { BusinessCardList } from "@/components/business-cards/business-card-list";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata(props: PageProps<"/companies/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const company = await getCompany(id);

  return { title: company ? `${company.name} | plusphi` : "取引先 | plusphi" };
}

export default async function CompanyDetailPage(props: PageProps<"/companies/[id]">) {
  const { id } = await props.params;
  const company = await getCompany(id);

  if (!company) {
    notFound();
  }

  const [cards, companies, statuses] = await Promise.all([
    getBusinessCards({ companyId: company.id }),
    getCompanyOptions(),
    getCompanyStatusOptions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {/* 画面遷移なので <button> ではなく <a>。Button の見た目だけ borrow する。 */}
      <Link
        href="/companies"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}
      >
        <ArrowLeftIcon />
        取引先一覧
      </Link>

      <PageHeader
        title={company.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="border px-1.5 py-0.5 text-xs">
              {company.statusName ?? "ステータス未設定"}
            </span>
            <span data-numeric>名刺 {company.cardCount} 枚</span>
            {company.phone && <span>{company.phone}</span>}
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                <ExternalLinkIcon className="size-3" />
                サイト
              </a>
            )}
          </span>
        }
      />

      {(company.address || company.note) && (
        <Panel className="flex flex-col gap-2 p-3 text-sm sm:p-4">
          {company.address && <p>{company.address}</p>}
          {company.note && <p className="whitespace-pre-wrap">{company.note}</p>}
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <h3 className="font-heading text-sm font-semibold">名刺</h3>
        </PanelHeader>

        <div className="flex flex-col gap-3 p-3">
          <BusinessCardList
            cards={cards}
            companies={companies}
            statuses={statuses}
            ocrEnabled={Boolean(env.PERPLEXITY_API_KEY)}
            defaultCompanyId={company.id}
            showCompany={false}
          />
        </div>
      </Panel>
    </div>
  );
}
