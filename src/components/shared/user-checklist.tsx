"use client";

import { useState } from "react";
import type { UserOption } from "@/lib/env";
import { ACCENT_COLORS } from "@/lib/colors";
import { Field } from "@/components/shared/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type UserChecklistProps = {
  label: string;
  id: string;
  /** hidden input の name。値はメールアドレスのカンマ区切り。 */
  name: string;
  users: UserOption[];
  defaultValue?: string[];
  errors?: string[];
  hint?: string;
};

/**
 * 複数人を選ぶチェックボックス群。予定の担当者のように「0 人以上」を選ぶ用途。
 *
 * 選択結果は hidden input 1 つにカンマ区切りで詰める。同名のチェックボックスを
 * 並べても、useApiForm が FormData を Object.fromEntries しているため最後の 1 つ
 * しか送られない。DateTimeField が hidden input に値を組み立てるのと同じ考え方。
 */
export function UserChecklist({
  label,
  id,
  name,
  users,
  defaultValue = [],
  errors,
  hint,
}: UserChecklistProps) {
  const [selected, setSelected] = useState<string[]>(defaultValue);

  const toggle = (email: string, checked: boolean) => {
    setSelected((previous) =>
      checked ? [...previous, email] : previous.filter((item) => item !== email)
    );
  };

  return (
    <Field label={label} htmlFor={id} errors={errors} hint={hint}>
      <input type="hidden" name={name} value={selected.join(",")} />

      {users.length === 0 ? (
        <p className="text-xs text-muted-foreground">選べる利用者がいません。</p>
      ) : (
        <div id={id} className="flex flex-wrap gap-x-4 gap-y-2">
          {users.map((user) => {
            const checkboxId = `${id}-${user.email}`;
            const checked = selected.includes(user.email);

            return (
              <div key={user.email} className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={checked}
                  onCheckedChange={(next) => toggle(user.email, next === true)}
                />
                <Label htmlFor={checkboxId} className="flex items-center gap-1.5">
                  {/* カレンダーを担当者で色分けしたときの色。対応が分かるように添える。 */}
                  <span
                    className={cn("size-2.5 shrink-0", ACCENT_COLORS[user.color].dot)}
                    aria-hidden
                  />
                  {user.name}
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </Field>
  );
}
