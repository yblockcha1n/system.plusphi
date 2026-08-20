"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import type { CompanyItem } from "@/features/companies/schema";
import type { CompanyStatusOption } from "@/features/company-statuses/schema";
import { NONE_VALUE } from "@/lib/form";
import { Field } from "@/components/shared/field";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
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

type CompanySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規登録 */
  company?: CompanyItem;
  statuses: CompanyStatusOption[];
  /** 名刺から会社名が読めているとき、名前を先に入れておく。 */
  defaultName?: string;
};

export function CompanySheet({
  open,
  onOpenChange,
  company,
  statuses,
  defaultName,
}: CompanySheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createCompany, api.updateCompany),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(company);

  const initialStatus = company?.statusId ?? NONE_VALUE;
  const [statusId, setStatusId] = useState<string>(initialStatus);

  // 開き直したときに前回の選択が残らないようにする
  const formKey = useFormResetKey(open, () => setStatusId(initialStatus));

  // 使用停止にされたステータスが付いていると選択肢から消えるので、現在値だけ足す
  const missing =
    company?.statusId && !statuses.some((status) => status.id === company.statusId)
      ? [{ value: company.statusId, label: `${company.statusName ?? "不明"}（使用停止中）` }]
      : [];

  const statusOptions: SelectOption[] = [
    { value: NONE_VALUE, label: "ステータスなし" },
    ...statuses.map((status) => ({ value: status.id, label: status.name })),
    ...missing,
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "取引先を編集" : "取引先を登録"}</SheetTitle>
          <SheetDescription>
            まだ取引が無い相手も登録できます。進み具合はステータスで表します。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="@container flex min-w-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto p-4">
            {company && <input type="hidden" name="id" value={company.id} />}

            <Field label="会社名" htmlFor="company-name" errors={state.fieldErrors?.name}>
              <Input
                id="company-name"
                name="name"
                required
                maxLength={200}
                defaultValue={company?.name ?? defaultName ?? ""}
                placeholder="株式会社プラスファイ"
              />
            </Field>

            <Field label="ふりがな" htmlFor="company-nameKana" errors={state.fieldErrors?.nameKana}>
              <Input
                id="company-nameKana"
                name="nameKana"
                maxLength={200}
                defaultValue={company?.nameKana ?? ""}
              />
            </Field>

            <SelectField
              label="ステータス"
              id="company-statusId"
              name="statusId"
              value={statusId}
              onValueChange={setStatusId}
              options={statusOptions}
              errors={state.fieldErrors?.statusId}
              hint="選択肢は「設定 › 取引先ステータス」で増やせます。"
            />

            <Field label="ウェブサイト" htmlFor="company-website" errors={state.fieldErrors?.website}>
              <Input
                id="company-website"
                name="website"
                inputMode="url"
                maxLength={500}
                defaultValue={company?.website ?? ""}
                placeholder="https://example.co.jp"
              />
            </Field>

            <div className="grid gap-5 *:min-w-0 @md:grid-cols-2">
              <Field label="電話" htmlFor="company-phone" errors={state.fieldErrors?.phone}>
                <Input
                  id="company-phone"
                  name="phone"
                  inputMode="tel"
                  maxLength={40}
                  defaultValue={company?.phone ?? ""}
                />
              </Field>

              <Field label="住所" htmlFor="company-address" errors={state.fieldErrors?.address}>
                <Input
                  id="company-address"
                  name="address"
                  maxLength={300}
                  defaultValue={company?.address ?? ""}
                />
              </Field>
            </div>

            <Field label="メモ" htmlFor="company-note" errors={state.fieldErrors?.note}>
              <Textarea
                id="company-note"
                name="note"
                rows={4}
                maxLength={2000}
                defaultValue={company?.note ?? ""}
                placeholder="経緯、担当、次にやること"
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
