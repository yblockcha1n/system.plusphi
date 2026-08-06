"use client";

import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/shared/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();

  // セッション Cookie は API 側で張られる。遷移はここで行う
  // （Route Handler はリダイレクトを返さず、成否だけを JSON で返すため）。
  const { state, pending, onSubmit } = useApiForm(api.login, () => router.replace("/home"));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">パスワード</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <LoaderCircleIcon className="animate-spin" />}
        ログイン
      </Button>
    </form>
  );
}
