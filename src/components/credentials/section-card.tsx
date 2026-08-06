"use client";

import { useState } from "react";
import { FolderIcon, InboxIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { api } from "@/lib/api-client";
import type { CredentialItem, SectionGroup } from "@/features/credentials/schema";
import { CredentialTable } from "@/components/credentials/credential-table";
import { CredentialSheet } from "@/components/credentials/credential-sheet";
import { SectionSheet } from "@/components/credentials/section-sheet";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { useSheetTarget } from "@/components/shared/use-sheet-target";
import { Button } from "@/components/ui/button";

type SectionCardProps = {
  section: SectionGroup;
  sections: SectionGroup[];
  /** 並べ替え用の掴み手。「未分類」には渡さない。 */
  dragHandle?: React.ReactNode;
};

export function SectionCard({ section, sections, dragHandle }: SectionCardProps) {
  // 閉じても対象を保持する（詳細は use-sheet-target.ts のコメント参照）
  const credentialSheet = useSheetTarget<CredentialItem>();
  const credentialDelete = useSheetTarget<CredentialItem>();
  const [sectionSheetOpen, setSectionSheetOpen] = useState(false);
  const [sectionDeleteOpen, setSectionDeleteOpen] = useState(false);

  const isUnsectioned = section.id === null;

  return (
    <section className="overflow-hidden border bg-card">
      <header className="flex items-center gap-2 border-b bg-card px-2 py-3 sm:gap-3 sm:px-3">
        {dragHandle}

        <div className="flex size-8 shrink-0 items-center justify-center bg-muted text-muted-foreground">
          {isUnsectioned ? <InboxIcon className="size-4" /> : <FolderIcon className="size-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-heading text-sm font-semibold">{section.name}</h2>
            <span className="shrink-0 bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" data-numeric>
              {section.credentials.length}
            </span>
          </div>
          {section.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{section.description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => credentialSheet.show()}
          >
            <PlusIcon />
            追加
          </Button>

          {!isUnsectioned && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSectionSheetOpen(true)}
                aria-label={`${section.name} を編集`}
              >
                <PencilIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSectionDeleteOpen(true)}
                aria-label={`${section.name} を削除`}
              >
                <Trash2Icon className="text-destructive" />
              </Button>
            </>
          )}
        </div>
      </header>

      <CredentialTable
        credentials={section.credentials}
        onEdit={(credential) => credentialSheet.show(credential)}
        onDelete={(credential) => credentialDelete.show(credential)}
      />

      <CredentialSheet
        open={credentialSheet.open}
        onOpenChange={credentialSheet.onOpenChange}
        credential={credentialSheet.target}
        defaultSectionId={section.id}
        sections={sections}
      />

      {!isUnsectioned && (
        <>
          <SectionSheet
            open={sectionSheetOpen}
            onOpenChange={setSectionSheetOpen}
            section={section}
          />
          <ConfirmDeleteDialog
            open={sectionDeleteOpen}
            onOpenChange={setSectionDeleteOpen}
            title={`セクション「${section.name}」を削除しますか？`}
            description="中のクレデンシャルは削除されず、「未分類（単一登録）」に移動します。"
            onConfirm={() => api.deleteSection(section.id as string)}
          />
        </>
      )}

      <ConfirmDeleteDialog
        open={credentialDelete.open}
        onOpenChange={credentialDelete.onOpenChange}
        title={`「${credentialDelete.target?.name}」を削除しますか？`}
        description="この操作は取り消せません。保存されているパスワードとメモも完全に削除されます。"
        onConfirm={() => api.deleteCredential(credentialDelete.target?.id as string)}
      />
    </section>
  );
}
