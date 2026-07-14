"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { saveCredential } from "@/features/credentials/actions";
import {
  NO_SECTION,
  idleState,
  type ActionState,
  type CredentialItem,
  type SectionGroup,
} from "@/features/credentials/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function Field({
  label,
  htmlFor,
  errors,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors?.map((error) => (
        <p key={error} className="text-xs text-destructive">
          {error}
        </p>
      ))}
    </div>
  );
}

export function CredentialSheet({
  open,
  onOpenChange,
  credential,
  defaultSectionId,
  sections,
}: CredentialSheetProps) {
  const [state, formAction, pending] = useActionState(saveCredential, idleState);
  const isEdit = Boolean(credential);

  const initialSection = credential?.sectionId ?? defaultSectionId ?? NO_SECTION;
  const [sectionId, setSectionId] = useState<string>(initialSection);

  // Sheet を開き直したときに前回の選択が残らないようにする。
  // （effect ではなくレンダー中に追随させる: https://react.dev/learn/you-might-not-need-an-effect）
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSectionId(initialSection);
    }
  }

  // useActionState の state は結果が返ったときだけ新しいオブジェクトになる。
  // 「同じ結果を二度処理しない」ガードが無いと、onOpenChange の identity 変化で
  // effect が再実行され、status が success のままなので閉じる→再レンダリング→
  // また閉じる…と無限ループする。
  const handledState = useRef<ActionState | null>(null);

  useEffect(() => {
    if (handledState.current === state) return;
    handledState.current = state;

    if (state.status === "success") {
      toast.success(state.message);
      onOpenChange(false);
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onOpenChange]);

  // Select に毎回新しいオブジェクトを渡すと参照が変わり続けて再レンダリングが
  // 収束しなくなるため、必ずメモ化する。
  const sectionOptions = useMemo<Record<string, React.ReactNode>>(
    () => ({
      [NO_SECTION]: "セクションなし（単一登録）",
      ...Object.fromEntries(
        sections
          .filter((group) => group.id !== null)
          .map((group) => [group.id as string, group.name])
      ),
    }),
    [sections]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "クレデンシャルを編集" : "クレデンシャルを登録"}</SheetTitle>
          <SheetDescription>
            パスワードとメモは AES-256-GCM で暗号化して保存されます。
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {credential && <input type="hidden" name="id" value={credential.id} />}
            <input type="hidden" name="sectionId" value={sectionId} />

            <Field label="セクション" htmlFor="sectionId" errors={state.fieldErrors?.sectionId}>
              <Select
                items={sectionOptions}
                value={sectionId}
                onValueChange={(value) => setSectionId(value as string)}
              >
                <SelectTrigger id="sectionId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sectionOptions).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

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
              hint={
                isEdit
                  ? "空欄のままにすると現在のパスワードを維持します。"
                  : undefined
              }
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
