"use client";

import { LoaderCircleIcon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import type { InspirationTagItem } from "@/features/inspiration-tags/schema";
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

type InspirationTagSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規作成 */
  tag?: InspirationTagItem;
};

export function InspirationTagSheet({ open, onOpenChange, tag }: InspirationTagSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createInspirationTag, api.updateInspirationTag),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(tag);

  // 開き直したときに前回の入力が残らないようにする
  const formKey = useFormResetKey(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "タグを編集" : "タグを追加"}</SheetTitle>
          <SheetDescription>
            ナレッジを登録するときに選べる観点です。名前を変えると、既にその
            タグが付いているナレッジの表示もまとめて変わります。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {tag && <input type="hidden" name="id" value={tag.id} />}

            <Field label="タグ名" htmlFor="inspiration-tag-name" errors={state.fieldErrors?.name}>
              <Input
                id="inspiration-tag-name"
                name="name"
                required
                maxLength={40}
                defaultValue={tag?.name ?? ""}
                placeholder="構図"
              />
            </Field>

            <Field
              label="説明"
              htmlFor="inspiration-tag-description"
              errors={state.fieldErrors?.description}
              hint="このタグをどんな観点に使うかの目安。マスタ画面にだけ出ます。"
            >
              <Textarea
                id="inspiration-tag-description"
                name="description"
                rows={3}
                maxLength={200}
                defaultValue={tag?.description ?? ""}
                placeholder="カメラワーク・画角・レイアウトの参考"
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
