"use client";

import { useState } from "react";
import { FolderIcon, InboxIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { deleteCredential, deleteSection } from "@/features/credentials/actions";
import type { CredentialItem, SectionGroup } from "@/features/credentials/schema";
import { CredentialTable } from "@/components/credentials/credential-table";
import { CredentialSheet } from "@/components/credentials/credential-sheet";
import { SectionSheet } from "@/components/credentials/section-sheet";
import { ConfirmDeleteDialog } from "@/components/credentials/confirm-delete-dialog";
import { Button } from "@/components/ui/button";

type SectionCardProps = {
  section: SectionGroup;
  sections: SectionGroup[];
};

export function SectionCard({ section, sections }: SectionCardProps) {
  const [credentialSheet, setCredentialSheet] = useState<{
    open: boolean;
    credential?: CredentialItem;
  }>({ open: false });
  const [sectionSheetOpen, setSectionSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CredentialItem | null>(null);
  const [sectionDeleteOpen, setSectionDeleteOpen] = useState(false);

  const isUnsectioned = section.id === null;

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {isUnsectioned ? <InboxIcon className="size-4" /> : <FolderIcon className="size-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-heading text-sm font-semibold">{section.name}</h2>
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
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
            onClick={() => setCredentialSheet({ open: true })}
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
        onEdit={(credential) => setCredentialSheet({ open: true, credential })}
        onDelete={(credential) => setDeleteTarget(credential)}
      />

      <CredentialSheet
        open={credentialSheet.open}
        onOpenChange={(open) =>
          setCredentialSheet((prev) => (open ? { ...prev, open } : { open: false }))
        }
        credential={credentialSheet.credential}
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
            onConfirm={() => deleteSection(section.id as string)}
          />
        </>
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`「${deleteTarget?.name}」を削除しますか？`}
        description="この操作は取り消せません。保存されているパスワードとメモも完全に削除されます。"
        onConfirm={() => deleteCredential(deleteTarget?.id as string)}
      />
    </section>
  );
}
