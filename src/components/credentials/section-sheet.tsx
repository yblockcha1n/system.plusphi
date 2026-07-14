"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { saveSection } from "@/features/credentials/actions";
import { idleState, type ActionState, type SectionGroup } from "@/features/credentials/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type SectionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規作成 */
  section?: SectionGroup;
};

export function SectionSheet({ open, onOpenChange, section }: SectionSheetProps) {
  const [state, formAction, pending] = useActionState(saveSection, idleState);
  const isEdit = Boolean(section?.id);

  // 同じ結果を二度処理しないガード（詳細は credential-sheet.tsx のコメント参照）
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "セクションを編集" : "セクションを作成"}</SheetTitle>
          <SheetDescription>
            クレデンシャルをグルーピングする枠です。用途や環境ごとに作成します。
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {section?.id && <input type="hidden" name="id" value={section.id} />}

            <div className="flex flex-col gap-2">
              <Label htmlFor="section-name">セクション名</Label>
              <Input
                id="section-name"
                name="name"
                required
                defaultValue={section?.name ?? ""}
                placeholder="AWS 本番"
              />
              {state.fieldErrors?.name?.map((error) => (
                <p key={error} className="text-xs text-destructive">
                  {error}
                </p>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="section-description">説明</Label>
              <Textarea
                id="section-description"
                name="description"
                rows={3}
                defaultValue={section?.description ?? ""}
                placeholder="本番環境で使用するアカウント一式"
              />
              {state.fieldErrors?.description?.map((error) => (
                <p key={error} className="text-xs text-destructive">
                  {error}
                </p>
              ))}
            </div>
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
