import type { Metadata } from "next";
import { getReleaseNotes } from "@/features/release-notes/queries";
import { PageHeader } from "@/components/shared/page-header";
import { ReleaseNoteList } from "@/components/release-notes/release-note-list";

export const metadata: Metadata = {
  title: "パッチノート | plusphi",
};

export default async function ReleaseNotesPage() {
  const notes = await getReleaseNotes();
  const drafts = notes.filter((note) => note.status === "draft").length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title="パッチノート"
        description={
          drafts > 0
            ? "未公開の下書きがあります。内容を確認して公開すると、全員に通知が届きます。"
            : "このシステムの更新履歴です。prd への push ごとに下書きが自動で作られます。"
        }
      />

      <ReleaseNoteList notes={notes} />
    </div>
  );
}
