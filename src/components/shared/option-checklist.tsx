"use client";

import { useState } from "react";
import { Field } from "@/components/shared/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type ChecklistOption = {
  value: string;
  label: string;
  /** ラベルの前に置く印（色のドットなど）。 */
  adornment?: React.ReactNode;
};

type OptionChecklistProps = {
  label: string;
  id: string;
  /** hidden input の name。値は選択された value のカンマ区切り。 */
  name: string;
  options: ChecklistOption[];
  defaultValue?: string[];
  errors?: string[];
  hint?: string;
  emptyMessage?: string;
};

/**
 * 複数選択のチェックボックス群。
 *
 * 選択結果は hidden input 1 つにカンマ区切りで詰める。同名のチェックボックスを
 * 並べても、useApiForm が FormData を Object.fromEntries しているため最後の 1 つ
 * しか送られないため（DateTimeField が hidden input に値を組み立てるのと同じ考え方）。
 *
 * 利用者を選ぶ UserChecklist を、任意の選択肢に使えるようにしたもの。
 */
export function OptionChecklist({
  label,
  id,
  name,
  options,
  defaultValue = [],
  errors,
  hint,
  emptyMessage = "選べる項目がありません。",
}: OptionChecklistProps) {
  const [selected, setSelected] = useState<string[]>(defaultValue);

  const toggle = (value: string, checked: boolean) => {
    setSelected((previous) =>
      checked ? [...previous, value] : previous.filter((item) => item !== value)
    );
  };

  return (
    <Field label={label} htmlFor={id} errors={errors} hint={hint}>
      <input type="hidden" name={name} value={selected.join(",")} />

      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div id={id} className="flex flex-wrap gap-x-4 gap-y-2">
          {options.map((option) => {
            const checkboxId = `${id}-${option.value}`;

            return (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(next) => toggle(option.value, next === true)}
                />
                <Label htmlFor={checkboxId} className="flex items-center gap-1.5">
                  {option.adornment}
                  {option.label}
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </Field>
  );
}
