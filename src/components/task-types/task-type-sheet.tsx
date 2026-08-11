"use client";

import { LoaderCircleIcon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import type { TaskTypeItem } from "@/features/task-types/schema";
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

type TaskTypeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規作成 */
  taskType?: TaskTypeItem;
};

export function TaskTypeSheet({ open, onOpenChange, taskType }: TaskTypeSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createTaskType, api.updateTaskType),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(taskType);

  // 開き直したときに前回の入力が残らないようにする
  const formKey = useFormResetKey(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "種別を編集" : "種別を追加"}</SheetTitle>
          <SheetDescription>
            タスクを登録するときに選べる区分です。名前を変えると、既にその種別が
            付いているタスクの表示もまとめて変わります。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {taskType && <input type="hidden" name="id" value={taskType.id} />}

            <Field label="種別名" htmlFor="task-type-name" errors={state.fieldErrors?.name}>
              <Input
                id="task-type-name"
                name="name"
                required
                maxLength={60}
                defaultValue={taskType?.name ?? ""}
                placeholder="開発"
              />
            </Field>

            <Field
              label="説明"
              htmlFor="task-type-description"
              errors={state.fieldErrors?.description}
              hint="この種別をどんなタスクに使うかの目安。一覧にだけ出ます。"
            >
              <Textarea
                id="task-type-description"
                name="description"
                rows={3}
                maxLength={200}
                defaultValue={taskType?.description ?? ""}
                placeholder="実装・修正・環境構築"
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
