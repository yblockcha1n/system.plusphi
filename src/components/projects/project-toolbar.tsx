"use client";

import { useState } from "react";
import { FolderPlusIcon } from "lucide-react";
import { ProjectSheet } from "@/components/projects/project-sheet";
import { Button } from "@/components/ui/button";

export function ProjectToolbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FolderPlusIcon />
        プロジェクトを作成
      </Button>
      <ProjectSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
