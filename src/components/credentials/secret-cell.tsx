"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

const AUTO_HIDE_MS = 30_000;

type SecretCellProps = {
  credentialId: string;
  field: "password" | "notes";
  hasValue: boolean;
};

export function SecretCell({ credentialId, field, hasValue }: SecretCellProps) {
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  if (!hasValue) {
    return <span className="text-muted-foreground">—</span>;
  }

  const hide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setValue(null);
  };

  const reveal = () => {
    if (value !== null) {
      hide();
      return;
    }

    startTransition(async () => {
      const result = await api.revealSecret(credentialId, field);

      if (result.status === "error" || !result.data) {
        toast.error(result.message ?? "取得に失敗しました。");
        return;
      }

      setValue(result.data.value);
      // 画面に出しっぱなしにしない
      hideTimer.current = setTimeout(() => setValue(null), AUTO_HIDE_MS);
    });
  };

  const copy = () => {
    startTransition(async () => {
      const result = await api.revealSecret(credentialId, field);

      if (result.status === "error" || !result.data) {
        toast.error(result.message ?? "取得に失敗しました。");
        return;
      }

      try {
        await navigator.clipboard.writeText(result.data.value);
        setCopied(true);
        copyTimer.current = setTimeout(() => setCopied(false), 1500);
      } catch {
        toast.error("クリップボードにコピーできませんでした。");
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className={
          value === null
            ? "select-none font-mono text-muted-foreground"
            : "max-w-[22rem] truncate font-mono break-all whitespace-pre-wrap"
        }
        title={value ?? undefined}
      >
        {value ?? "••••••••"}
      </span>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={reveal}
        disabled={pending}
        aria-label={value === null ? "表示" : "隠す"}
      >
        {pending ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : value === null ? (
          <EyeIcon />
        ) : (
          <EyeOffIcon />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={copy}
        disabled={pending}
        aria-label="コピー"
      >
        {copied ? <CheckIcon className="text-emerald-600" /> : <CopyIcon />}
      </Button>
    </div>
  );
}
