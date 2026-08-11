"use client";

import { BellIcon, BellOffIcon, BellRingIcon } from "lucide-react";
import { usePushSubscription } from "@/components/pwa/use-push-subscription";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * この端末の通知設定。
 *
 * 通知は「利用者 × 端末」ごとなので、PC で有効にしてもスマートフォンでは
 * 別途この操作が要る。文言もその前提で書いてある。
 */
export function NotificationToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const { state, pending, enable, disable, sendTest } = usePushSubscription(vapidPublicKey);

  // 対応していない端末ではボタン自体を出さない（押せないボタンは邪魔なだけ）
  if (state === "loading" || state === "unsupported") return null;

  const enabled = state === "on";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={enabled ? "通知の設定（この端末は有効）" : "通知の設定（この端末は無効）"}
          >
            {enabled ? <BellRingIcon /> : <BellIcon />}
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-auto max-w-72 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>この端末の通知</DropdownMenuLabel>

          {state === "denied" ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              ブラウザ側で通知がブロックされています。アプリからは戻せないので、
              サイトの設定から通知を「許可」に変えてください。
            </p>
          ) : (
            <>
              <DropdownMenuItem disabled={pending} onClick={() => (enabled ? disable() : enable())}>
                {enabled ? <BellOffIcon /> : <BellIcon />}
                {enabled ? "この端末の通知を止める" : "この端末で通知を受け取る"}
              </DropdownMenuItem>

              {enabled && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={pending} onClick={() => sendTest()}>
                    <BellRingIcon />
                    テスト通知を送る
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
