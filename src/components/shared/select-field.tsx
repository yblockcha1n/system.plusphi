"use client";

import { useMemo } from "react";
import { Field } from "@/components/shared/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: string;
  id: string;
  /** hidden input の name。フォーム送信はこの値で行う。 */
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  errors?: string[];
  hint?: string;
  className?: string;
};

/**
 * Select + hidden input + ラベル/エラー表示をまとめたもの。
 *
 * Base UI の Select は <select> ではないためフォームに値が乗らない。
 * hidden input を並べて送信している（credential-sheet.tsx と同じやり方）。
 */
export function SelectField({
  label,
  id,
  name,
  value,
  onValueChange,
  options,
  errors,
  hint,
  className,
}: SelectFieldProps) {
  // 毎回新しいオブジェクトを渡すと参照が変わり続けて再レンダリングが収束しないため、
  // 必ずメモ化する。
  const items = useMemo(
    () => Object.fromEntries(options.map((option) => [option.value, option.label])),
    [options]
  );

  return (
    <Field label={label} htmlFor={id} errors={errors} hint={hint} className={className}>
      <input type="hidden" name={name} value={value} />
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onValueChange(next as string)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
