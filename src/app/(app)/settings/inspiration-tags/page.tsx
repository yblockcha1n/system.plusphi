import type { Metadata } from "next";
import { getInspirationTags } from "@/features/inspiration-tags/queries";
import { PageHeader } from "@/components/shared/page-header";
import { InspirationTagBoard } from "@/components/inspiration-tags/inspiration-tag-board";

export const metadata: Metadata = {
  title: "ナレッジタグ | plusphi",
};

export default async function InspirationTagsPage() {
  const tags = await getInspirationTags();
  const active = tags.filter((tag) => tag.archivedAt === null).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title="ナレッジタグ"
        description={`${active} 件を利用中。掴んで上下に動かすと、登録時と絞り込みの並び順が変わります。`}
      />

      <InspirationTagBoard tags={tags} />
    </div>
  );
}
