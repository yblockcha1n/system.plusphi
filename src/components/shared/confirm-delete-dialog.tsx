"use client";

import { LoaderCircleIcon } from "lucide-react";
import type { ApiResult } from "@/lib/api-client";
import { useApiMutation } from "@/components/shared/use-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /**
   * 実行ボタンの文言と見た目。既定は削除。
   * 「公開」のように取り消せないが破壊的ではない操作にも使いたいので、
   * 赤い見た目を外せるようにしてある。
   */
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
  onConfirm: () => Promise<ApiResult>;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "削除する",
  confirmVariant = "destructive",
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const { run, pending } = useApiMutation();

  const handleConfirm = () => run(onConfirm, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row justify-end gap-2">
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={pending}>
                キャンセル
              </Button>
            }
          />
          <Button
            type="button"
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
