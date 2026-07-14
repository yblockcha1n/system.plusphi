"use client";

import { useState } from "react";
import { FolderPlusIcon, PlusIcon } from "lucide-react";
import type { SectionGroup } from "@/features/credentials/schema";
import { CredentialSheet } from "@/components/credentials/credential-sheet";
import { SectionSheet } from "@/components/credentials/section-sheet";
import { Button } from "@/components/ui/button";

export function CredentialsToolbar({ sections }: { sections: SectionGroup[] }) {
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setSectionOpen(true)}>
        <FolderPlusIcon />
        セクションを作成
      </Button>

      <Button onClick={() => setCredentialOpen(true)}>
        <PlusIcon />
        クレデンシャルを登録
      </Button>

      <SectionSheet open={sectionOpen} onOpenChange={setSectionOpen} />
      <CredentialSheet
        open={credentialOpen}
        onOpenChange={setCredentialOpen}
        sections={sections}
      />
    </div>
  );
}
