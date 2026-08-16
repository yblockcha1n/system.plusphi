"use client";

import { LoaderCircleIcon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import type { CompanyStatusItem } from "@/features/company-statuses/schema";
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

type CompanyStatusSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規作成 */
  status?: CompanyStatusItem;
};

export function CompanyStatusSheet({ open, onOpenChange, status }: CompanyStatusSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createCompanyStatus, api.updateCompanyStatus),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(status);

  // 開き直したときに前回の入力が残らないようにする
  const formKey = useFormResetKey(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "ステータスを編集" : "ステータスを追加"}</SheetTitle>
          <SheetDescription>
            取引先の進み具合を表す区分です。名前を変えると、既にそのステータスが
            付いている取引先の表示もまとめて変わります。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {status && <input type="hidden" name="id" value={status.id} />}

            <Field label="ステータス名" htmlFor="company-status-name" errors={state.fieldErrors?.name}>
              <Input
                id="company-status-name"
                name="name"
                required
                maxLength={60}
                defaultValue={status?.name ?? ""}
                placeholder="折衝済み"
              />
            </Field>

            <Field
              label="説明"
              htmlFor="company-status-description"
              errors={state.fieldErrors?.description}
              hint="このステータスがどの段階かの目安。マスタ画面にだけ出ます。"
            >
              <Textarea
                id="company-status-description"
                name="description"
                rows={3}
                maxLength={200}
                defaultValue={status?.description ?? ""}
                placeholder="話がまとまり、着手や発注を待っている"
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
