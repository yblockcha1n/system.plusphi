"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import type { InspirationTagOption } from "@/features/inspiration-tags/schema";
import { InspirationSheet } from "@/components/inspirations/inspiration-sheet";
import { Button } from "@/components/ui/button";

export function InspirationToolbar({ tags }: { tags: InspirationTagOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        <span className="hidden sm:inline">ナレッジを登録</span>
        <span className="sm:hidden">登録</span>
      </Button>

      <InspirationSheet open={open} onOpenChange={setOpen} tags={tags} />
    </>
  );
}
