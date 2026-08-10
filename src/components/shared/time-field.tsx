"use client";

import { useMemo, useRef, useState } from "react";
import { ClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * 一覧に並べる時刻の刻み。予定・締切はほぼこの粒度に収まる。
 * ここに無い時刻（07:37 など）は入力欄に直接打ち込む。
 */
const SLOT_MINUTES = 15;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * 打ち込まれた文字列を "HH:mm" に正規化する。解釈できなければ null。
 *
 * `<input type="time">` をやめた代わりに、ブラウザがやってくれていた
 * 「ゆるい入力の受け付け」をここで肩代わりする。想定する入力:
 *   "7" → 07:00 ／ "730" → 07:30 ／ "0730" → 07:30 ／ "7:5" → 07:05
 * 全角（"０７：３０"）も受ける。日本語 IME のまま打たれることがあるため。
 */
export function parseTimeInput(raw: string): string | null {
  const normalized = raw
    .trim()
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[：.。]/g, ":");

  if (normalized === "") return null;

  let hour: number;
  let minute: number;

  const withColon = /^(\d{1,2}):(\d{1,2})$/.exec(normalized);

  if (withColon) {
    hour = Number(withColon[1]);
    minute = Number(withColon[2]);
  } else if (/^\d{1,4}$/.test(normalized)) {
    // 区切り無しは桁数で解釈を変える。3桁は "H mm"、4桁は "HH mm"。
    if (normalized.length <= 2) {
      hour = Number(normalized);
      minute = 0;
    } else {
      const boundary = normalized.length - 2;
      hour = Number(normalized.slice(0, boundary));
      minute = Number(normalized.slice(boundary));
    }
  } else {
    return null;
  }

  if (hour > 23 || minute > 59) return null;

  return `${pad(hour)}:${pad(minute)}`;
}

/** 00:00 から 23:45 まで。現在値が刻みから外れていれば、その値も並びに混ぜる。 */
function buildSlots(value: string): string[] {
  const slots: string[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += SLOT_MINUTES) {
    slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }

  if (value === "" || slots.includes(value)) return slots;

  return [...slots, value].sort();
}

type TimeFieldProps = {
  /** "HH:mm"。未設定は ""。 */
  value: string;
  onChange: (next: string) => void;
  /** 付随するフィールドのラベル。読み上げ用の名前を組み立てるのに使う。 */
  label: string;
  disabled?: boolean;
};

/**
 * 時刻の入力。ブラウザ既定の `<input type="time">` の置き換え。
 *
 * 入力欄と一覧の 2 通りで入れられるようにしてある。既定の UI は端末ごとに
 * 見た目も操作もばらつくうえ、PC では 1 分刻みの長い一覧をスクロールさせられ、
 * スマートフォンでは的が小さい。ここでは
 *  - PC:       欄に "730" と打って Tab（一覧を開かずに終わる）
 *  - モバイル: 時計ボタンから 15 分刻みの一覧を 1 タップ
 * のどちらでも同じ結果になるようにしている。
 */
export function TimeField({ value, onChange, label, disabled }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // 親（日付のクリア等）で値が変わったらレンダー中に追随させる。
  // effect を挟むと一瞬古い値が見える。
  // https://react.dev/learn/you-might-not-need-an-effect
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  const slots = useMemo(() => buildSlots(value), [value]);

  /** 打ち込まれた内容を確定する。解釈できなければ直前の値に戻す。 */
  const commit = () => {
    if (draft.trim() === "") {
      setDraft("");
      onChange("");
      return;
    }

    const parsed = parseTimeInput(draft);

    if (parsed === null) {
      setDraft(value);
      return;
    }

    setDraft(parsed);
    onChange(parsed);
  };

  const select = (slot: string) => {
    setDraft(slot);
    onChange(slot);
    setOpen(false);
  };

  return (
    <div className="flex shrink-0">
      <Input
        type="text"
        // 数字だけの入力なのでモバイルではテンキーを出す
        inputMode="numeric"
        autoComplete="off"
        placeholder="--:--"
        aria-label={`${label}の時刻`}
        value={draft}
        disabled={disabled}
        onChange={(changeEvent) => setDraft(changeEvent.target.value)}
        onBlur={commit}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key !== "Enter") return;
          // フォームの送信ではなく「時刻の確定」として扱う
          keyEvent.preventDefault();
          commit();
        }}
        className="w-18 rounded-r-none text-center tabular-nums"
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label={`${label}の時刻を一覧から選ぶ`}
              className="-ml-px rounded-l-none"
            >
              <ClockIcon />
            </Button>
          }
        />

        <PopoverContent
          align="start"
          className="w-auto p-0"
          // 現在の時刻に合わせて開く。焦点が当たることで一覧もそこまでスクロールする。
          // 未設定なら null を返し、Base UI の既定（先頭）に任せる。
          initialFocus={() => selectedRef.current}
        >
          <ul className="max-h-64 w-28 overflow-y-auto p-1">
            {slots.map((slot) => {
              const isSelected = slot === value;

              return (
                <li key={slot}>
                  <button
                    type="button"
                    ref={
                      isSelected
                        ? (node) => {
                            selectedRef.current = node;
                            // 焦点による自動スクロールは端に寄るので、中央に置き直す
                            node?.scrollIntoView({ block: "center" });
                          }
                        : undefined
                    }
                    onClick={() => select(slot)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex h-9 w-full items-center justify-center text-sm transition-colors",
                      isSelected
                        ? "bg-foreground font-semibold text-background"
                        : "hover:bg-muted"
                    )}
                    data-numeric
                  >
                    {slot}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
