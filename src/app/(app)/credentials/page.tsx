import type { Metadata } from "next";
import { getSectionsWithCredentials } from "@/features/credentials/queries";
import { SectionCard } from "@/components/credentials/section-card";
import { CredentialsToolbar } from "@/components/credentials/credentials-toolbar";

export const metadata: Metadata = {
  title: "クレデンシャル | plusphi",
};

export default async function CredentialsPage() {
  const sections = await getSectionsWithCredentials();
  const total = sections.reduce((sum, section) => sum + section.credentials.length, 0);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">クレデンシャル</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} 件を保管しています。パスワードとメモは暗号化された状態で保存されます。
          </p>
        </div>

        <CredentialsToolbar sections={sections} />
      </div>

      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <SectionCard key={section.id ?? "unsectioned"} section={section} sections={sections} />
        ))}
      </div>
    </div>
  );
}
