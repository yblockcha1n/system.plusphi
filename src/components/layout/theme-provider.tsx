"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ダークテーマの土台。
 *
 * 配色は globals.css の `:root` / `.dark` に定義済みで、この Provider は
 * `<html>` に `class="dark"` を付け外しする役割だけを持つ（Tailwind の
 * `@custom-variant dark (&:is(.dark *))` がその class を見ている）。
 *
 * next-themes は「描画前に走る小さなスクリプト」を head に差し込むことで、
 * 最初の 1 フレームからテーマを確定させる。そのぶんサーバーが返した HTML と
 * class が食い違うため、`<html>` 側に suppressHydrationWarning が要る。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // 既定は端末の設定に従う。明示的に選んだときだけ localStorage に残る。
      defaultTheme="system"
      enableSystem
      // 切り替えの瞬間だけ transition を止める。UI 全体に transition-colors が
      // 掛かっているので、これが無いと色が一斉にゆっくり変わって目に痛い。
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
