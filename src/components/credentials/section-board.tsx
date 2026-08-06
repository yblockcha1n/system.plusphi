"use client";

import { api } from "@/lib/api-client";
import type { SectionGroup } from "@/features/credentials/schema";
import { SectionCard } from "@/components/credentials/section-card";
import { SortableGroup } from "@/components/shared/sortable-group";

type SectionBoardProps = {
  sections: SectionGroup[];
};

/**
 * セクションを掴んで並べ替えられるようにする。
 *
 * 「未分類（単一登録）」は DB 上の行ではなく queries.ts が最後に足している枠なので、
 * 並べ替えの対象から外し、常に末尾に固定して描く。
 */
export function SectionBoard({ sections }: SectionBoardProps) {
  const sortable = sections.filter((section) => section.id !== null);
  const unsectioned = sections.find((section) => section.id === null);

  return (
    <div className="flex flex-col gap-4">
      <SortableGroup
        id="credential-sections"
        items={sortable}
        getId={(section) => section.id as string}
        onReorder={api.reorderSections}
        className="flex flex-col gap-4"
      >
        {(section, dragHandle) => (
          <SectionCard section={section} sections={sections} dragHandle={dragHandle} />
        )}
      </SortableGroup>

      {unsectioned && <SectionCard section={unsectioned} sections={sections} />}
    </div>
  );
}
