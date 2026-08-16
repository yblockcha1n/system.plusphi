import type { Metadata } from "next";
import { getCompanyStatuses } from "@/features/company-statuses/queries";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyStatusBoard } from "@/components/company-statuses/company-status-board";

export const metadata: Metadata = {
  title: "取引先ステータス | plusphi",
};

export default async function CompanyStatusesPage() {
  const statuses = await getCompanyStatuses();
  const active = statuses.filter((status) => status.archivedAt === null).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title="取引先ステータス"
        description={`${active} 件を利用中。掴んで上下に動かすと、選択肢と絞り込みの並び順が変わります。`}
      />

      <CompanyStatusBoard statuses={statuses} />
    </div>
  );
}
