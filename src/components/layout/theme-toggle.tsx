"use client";

import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = [
  { value: "light", label: "ライト", icon: SunIcon },
  { value: "dark", label: "ダーク", icon: MoonIcon },
  { value: "system", label: "端末の設定に合わせる", icon: MonitorIcon },
] as const;

/**
 * テーマの切り替え。
 *
 * トリガーのアイコンは `theme` を読まずに CSS（dark: バリアント）で出し分ける。
 * next-themes が持つ値はサーバーでは分からないため、それを見て描き分けると
 * ハイドレーションのズレになる。メニューの中身は開いたときにしか描かれないので、
 * そちらは値を読んでよい。
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="テーマを変更">
            <SunIcon className="dark:hidden" />
            <MoonIcon className="hidden dark:block" />
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {/* DropdownMenuLabel は Base UI の Menu.GroupLabel なので Group の中に置く */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>テーマ</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
            {THEMES.map((item) => {
              const Icon = item.icon;

              return (
                <DropdownMenuRadioItem key={item.value} value={item.value}>
                  <Icon />
                  {item.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
