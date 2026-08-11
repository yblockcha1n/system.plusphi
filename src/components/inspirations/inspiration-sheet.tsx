"use client";

import { LoaderCircleIcon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import type { InspirationItem } from "@/features/inspirations/schema";
import type { InspirationTagOption } from "@/features/inspiration-tags/schema";
import { Field } from "@/components/shared/field";
import { OptionChecklist } from "@/components/shared/option-checklist";
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

type InspirationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規登録 */
  inspiration?: InspirationItem;
  tags: InspirationTagOption[];
};

export function InspirationSheet({
  open,
  onOpenChange,
  inspiration,
  tags,
}: InspirationSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createInspiration, api.updateInspiration),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(inspiration);

  // 開き直したときに前回の入力が残らないようにする
  const formKey = useFormResetKey(open);

  // 使用停止にされたタグが既に付いている場合、選択肢から消えると保存時に外れてしまう。
  // 現在値だけは選択肢に残す（task-sheet と同じ考え方）。
  const missing = (inspiration?.tagIds ?? [])
    .map((id, index) => ({ id, name: inspiration?.tagNames[index] }))
    .filter((item) => item.name && !tags.some((tag) => tag.id === item.id))
    .map((item) => ({ value: item.id, label: `${item.name}（使用停止中）` }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "ナレッジを編集" : "ナレッジを登録"}</SheetTitle>
          <SheetDescription>
            URL を貼るだけで登録できます。タイトルと投稿者は保存時に自動で取りに行き、
            取れなかったぶんは空のままになります（あとから手で入れられます）。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {inspiration && <input type="hidden" name="id" value={inspiration.id} />}

            <Field
              label="URL"
              htmlFor="inspiration-url"
              errors={state.fieldErrors?.url}
              hint="Instagram のリール・投稿、TikTok、YouTube、X に対応しています。"
            >
              <Input
                id="inspiration-url"
                name="url"
                required
                inputMode="url"
                maxLength={2000}
                defaultValue={inspiration?.url ?? ""}
                placeholder="https://www.instagram.com/reel/..."
              />
            </Field>

            <Field
              label="メモ"
              htmlFor="inspiration-note"
              errors={state.fieldErrors?.note}
              hint="何が参考になるのかを一言。あとで探すときの手掛かりになります。"
            >
              <Textarea
                id="inspiration-note"
                name="note"
                rows={4}
                maxLength={2000}
                defaultValue={inspiration?.note ?? ""}
                placeholder="冒頭 1 秒の引きが強い。商品を映さずに結果から見せている。"
              />
            </Field>

            <OptionChecklist
              label="タグ"
              id="inspiration-tags"
              name="tagIds"
              options={[
                ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
                ...missing,
              ]}
              defaultValue={inspiration?.tagIds ?? []}
              errors={state.fieldErrors?.tagIds}
              hint="複数選べます。選択肢は「設定 › ナレッジタグ」で増やせます。"
              emptyMessage="タグがまだありません。「設定 › ナレッジタグ」から追加してください。"
            />

            <Field
              label="タイトル"
              htmlFor="inspiration-title"
              errors={state.fieldErrors?.title}
              hint="空のままなら自動取得を試みます（Instagram は取得できないため手入力です）。"
            >
              <Input
                id="inspiration-title"
                name="title"
                maxLength={300}
                defaultValue={inspiration?.title ?? ""}
                placeholder="自動取得できなかった場合はここに入力"
              />
            </Field>

            <Field
              label="投稿者"
              htmlFor="inspiration-author"
              errors={state.fieldErrors?.authorName}
            >
              <Input
                id="inspiration-author"
                name="authorName"
                maxLength={100}
                defaultValue={inspiration?.authorName ?? ""}
                placeholder="kevin"
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
