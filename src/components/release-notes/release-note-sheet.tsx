"use client";

import { LoaderCircleIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import type { ReleaseNoteItem } from "@/features/release-notes/schema";
import { Field } from "@/components/shared/field";
import { useApiForm } from "@/components/shared/use-api";
import { useFormResetKey } from "@/components/shared/use-form-reset-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ReleaseNoteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: ReleaseNoteItem;
};

/** 自動生成された文面を人が直すためのシート。新規作成は CI からのみ。 */
export function ReleaseNoteSheet({ open, onOpenChange, note }: ReleaseNoteSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => api.updateReleaseNote(note?.id as string, values),
    () => onOpenChange(false)
  );

  // 開き直したときに前回の入力が残らないようにする
  const formKey = useFormResetKey(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>パッチノートを編集</SheetTitle>
          <SheetDescription>
            自動生成された文面です。公開前に、利用者に伝わる言葉へ直してください。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            <Field label="バージョン" htmlFor="release-version" errors={state.fieldErrors?.version}>
              <Input
                id="release-version"
                name="version"
                required
                maxLength={40}
                defaultValue={note?.version ?? ""}
                className="w-48"
              />
            </Field>

            <Field label="見出し" htmlFor="release-title" errors={state.fieldErrors?.title}>
              <Input
                id="release-title"
                name="title"
                required
                maxLength={200}
                defaultValue={note?.title ?? ""}
                placeholder="ナレッジ機能を追加しました"
              />
            </Field>

            <Field
              label="本文"
              htmlFor="release-body"
              errors={state.fieldErrors?.body}
              hint="改行はそのまま表示されます。"
            >
              <Textarea
                id="release-body"
                name="body"
                rows={16}
                maxLength={20000}
                defaultValue={note?.body ?? ""}
                className="font-mono text-xs"
              />
            </Field>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  キャンセル
                </Button>
              }
            />
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              保存
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
