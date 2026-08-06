import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "ログイン | plusphi",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center border bg-background">
            <Image src="/logo.png" alt="plusphi" width={26} height={26} priority className="dark:invert" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold">plusphi 基幹システム</h1>
            <p className="mt-1 text-sm text-muted-foreground">社内用のため関係者のみログインできます</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
