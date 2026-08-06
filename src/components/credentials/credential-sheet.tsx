"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import { NO_SECTION, type CredentialItem, type SectionGroup } from "@/features/credentials/schema";
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

type CredentialSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規作成 */
  credential?: CredentialItem;
  /** 新規作成時にあらかじめ選択しておくセクション */
  defaultSectionId?: string | null;
  sections: SectionGroup[];
};

export function CredentialSheet({
  open,
  onOpenChange,
  credential,
  defaultSectionId,
  sections,
}: CredentialSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createCredential, api.updateCredential),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(credential);

  const initialSection = credential?.sectionId ?? defaultSectionId ?? NO_SECTION;
  const [sectionId, setSectionId] = useState<string>(initialSection);

  // Sheet を開き直したときに前回の入力・選択が残らないようにする
  const formKey = useFormResetKey(open, () => setSectionId(initialSection));

  const sectionOptions: SelectOption[] = [
    { value: NO_SECTION, label: "セクションなし（単一登録）" },
    ...sections
      .filter((group) => group.id !== null)
      .map((group) => ({ value: group.id as string, label: group.name })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "クレデンシャルを編集" : "クレデンシャルを登録"}</SheetTitle>
          <SheetDescription>
            パスワードとメモは AES-256-GCM で暗号化して保存されます。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="@container flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {credential && <input type="hidden" name="id" value={credential.id} />}

            <SelectField
              label="セクション"
              id="sectionId"
              name="sectionId"
              value={sectionId}
              onValueChange={setSectionId}
              options={sectionOptions}
              errors={state.fieldErrors?.sectionId}
            />

            <Field label="名称" htmlFor="name" errors={state.fieldErrors?.name}>
              <Input
                id="name"
                name="name"
                required
                defaultValue={credential?.name ?? ""}
                placeholder="AWS 本番アカウント"
              />
            </Field>

            <Field label="ユーザー名 / ID" htmlFor="username" errors={state.fieldErrors?.username}>
              <Input
                id="username"
                name="username"
                autoComplete="off"
                defaultValue={credential?.username ?? ""}
                placeholder="admin@plusphi.jp"
              />
            </Field>

            <Field
              label="パスワード"
              htmlFor="password"
              errors={state.fieldErrors?.password}
              hint={isEdit ? "空欄のままにすると現在のパスワードを維持します。" : undefined}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={isEdit ? "変更する場合のみ入力" : ""}
              />
            </Field>

            <Field label="URL" htmlFor="url" errors={state.fieldErrors?.url}>
              <Input
                id="url"
                name="url"
                type="url"
                defaultValue={credential?.url ?? ""}
                placeholder="https://console.aws.amazon.com"
              />
            </Field>

            <Field
              label="メモ"
              htmlFor="notes"
              errors={state.fieldErrors?.notes}
              hint={isEdit ? "空欄のままにすると現在のメモを維持します。" : undefined}
            >
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder={isEdit ? "変更する場合のみ入力" : "MFA の設定先、契約者名など"}
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
