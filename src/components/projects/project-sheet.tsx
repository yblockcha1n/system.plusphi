"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import {
  PROJECT_COLORS,
  PROJECT_COLOR_KEYS,
  toProjectColor,
  type ProjectSummary,
} from "@/features/projects/schema";
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
import { cn } from "@/lib/utils";

type ProjectSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規作成 */
  project?: ProjectSummary;
};

const colorOptions: SelectOption[] = PROJECT_COLOR_KEYS.map((key) => ({
  value: key,
  label: PROJECT_COLORS[key].label,
}));

export function ProjectSheet({ open, onOpenChange, project }: ProjectSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createProject, api.updateProject),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(project);

  const initialColor = project?.color ?? "gray";
  const [color, setColor] = useState<string>(initialColor);

  // 開き直したときに前回の入力・選択が残らないようにする
  const formKey = useFormResetKey(open, () => setColor(initialColor));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "プロジェクトを編集" : "プロジェクトを作成"}</SheetTitle>
          <SheetDescription>
            タスクと予定をぶら下げる単位です。色はカレンダー上の識別に使われます。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="@container flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {project && <input type="hidden" name="id" value={project.id} />}

            <Field label="プロジェクト名" htmlFor="name" errors={state.fieldErrors?.name}>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                defaultValue={project?.name ?? ""}
                placeholder="コーポレートサイト刷新"
              />
            </Field>

            <Field label="説明" htmlFor="description" errors={state.fieldErrors?.description}>
              <Textarea
                id="description"
                name="description"
                rows={3}
                maxLength={500}
                defaultValue={project?.description ?? ""}
                placeholder="目的、関係者、成果物など"
              />
            </Field>

            <div className="flex flex-col gap-2">
              <SelectField
                label="識別色"
                id="color"
                name="color"
                value={color}
                onValueChange={setColor}
                options={colorOptions}
                errors={state.fieldErrors?.color}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn("size-3", PROJECT_COLORS[toProjectColor(color)].dot)}
                  aria-hidden
                />
                カレンダーではこの色で表示されます
              </div>
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
