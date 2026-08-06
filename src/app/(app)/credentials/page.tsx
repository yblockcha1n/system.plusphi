import type { Metadata } from "next";
import { getSectionsWithCredentials } from "@/features/credentials/queries";
import { SectionBoard } from "@/components/credentials/section-board";
import { CredentialsToolbar } from "@/components/credentials/credentials-toolbar";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "クレデンシャル | plusphi",
};

export default async function CredentialsPage() {
  const sections = await getSectionsWithCredentials();
  const total = sections.reduce((sum, section) => sum + section.credentials.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <PageHeader
        title="クレデンシャル"
        description={`${total} 件を保管しています。パスワードとメモは暗号化された状態で保存され、セクションは掴んで並べ替えられます。`}
        actions={<CredentialsToolbar sections={sections} />}
      />

      <SectionBoard sections={sections} />
    </div>
  );
}
