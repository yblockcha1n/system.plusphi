"use client";

import { useRef, useState } from "react";
import { CameraIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ScannedCard } from "@/features/business-cards/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 送信量の目安（データ URI にしたあとの文字数）。
 *
 * ここが読み取りの待ち時間を大きく左右する。実測では、細かい模様が多い
 * 1,270KB の画像で 56 秒かかったのに対し、36KB の画像は 4 秒で返った。
 * 実機の写真（380KB）は Vercel から投げて 100 秒でも返らなかった。
 *
 * Vercel のリクエストボディ上限（4.5MB・変更不可）に収めるだけでは足りず、
 * 「速く返ってくる大きさ」まで落とす必要がある。
 */
const TARGET_BYTES = 200 * 1024;

/**
 * 縮小の試行順。上から順に試し、TARGET_BYTES に収まった時点で止める。
 *
 * まず画質を落とし、それでも大きければ寸法を下げる。名刺の文字は大きいので、
 * 多少眠い画でも読み取りには足りる（1,000px あれば 6pt の文字で 20px 以上）。
 */
const ATTEMPTS: { edge: number; quality: number }[] = [
  { edge: 1280, quality: 0.78 },
  { edge: 1280, quality: 0.62 },
  { edge: 1100, quality: 0.6 },
  { edge: 1000, quality: 0.55 },
  { edge: 900, quality: 0.5 },
];

export type CaptureResult = {
  card: ScannedCard;
  candidates: { id: string; name: string }[];
  /** 保存済み画像の Storage 上のパス。保存時はこれを送る。 */
  imagePath: string;
};

type CardCaptureProps = {
  /** 読み取れたら呼ぶ。画面側はフォームへ流し込む。 */
  onScanned: (result: CaptureResult) => void;
  /** 撮影だけして読み取らない（OCR 未設定のとき）。 */
  ocrEnabled: boolean;
  /** 既に選ばれている画像。編集時は保存済みのものを出す。 */
  previewUrl?: string | null;
  onClear?: () => void;
};

/**
 * 画像を縮小してデータ URI にする。目安の大きさに収まるまで段階的に落とす。
 *
 * canvas を通すので EXIF の回転情報は落ちるが、createImageBitmap に
 * imageOrientation を渡すことでブラウザ側に向きを直させている
 *（これをしないと横向きに撮った名刺が寝たまま送られる）。
 */
async function toResizedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
    let last = "";

    for (const { edge, quality } of ATTEMPTS) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("画像を処理できませんでした。");

      context.drawImage(bitmap, 0, 0, width, height);
      last = canvas.toDataURL("image/jpeg", quality);

      if (last.length <= TARGET_BYTES) return last;
    }

    // 一番小さい設定でも収まらなければ、それを使う（送れないよりはよい）
    return last;
  } finally {
    bitmap.close();
  }
}

export function CardCapture({
  onScanned,
  ocrEnabled,
  previewUrl,
  onClear,
}: CardCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(previewUrl ?? null);

  const handleFile = async (file: File) => {
    setPending(true);

    try {
      const imageDataUrl = await toResizedDataUrl(file);
      setPreview(imageDataUrl);

      // 読み取りが遅いときに「どれだけ送ったか」を追えるようにしておく
      console.info(
        `[名刺] 元 ${Math.round(file.size / 1024)}KB → 送信 ${Math.round(imageDataUrl.length / 1024)}KB`
      );

      // 画像の保存と読み取りはサーバー側でまとめて行う。
      // 読み取りへ画像そのものを送らず URL を渡すため（storage.ts 参照）。
      const result = await api.scanBusinessCard(imageDataUrl);

      if (result.status === "error" || !result.data) {
        toast.error(result.message ?? "画像を保存できませんでした。");
        return;
      }

      // 読み取りに失敗しても画像は保存できている。手入力で続けられる。
      if (result.data.failed) {
        toast.error(result.message ?? "読み取れませんでした。");
      } else if (ocrEnabled) {
        toast.success(result.message);
      }

      onScanned({
        card: result.data.card as unknown as ScannedCard,
        candidates: result.data.candidates,
        imagePath: result.data.imagePath,
      });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? `画像を読み込めませんでした: ${cause.message}` : "画像を読み込めませんでした。"
      );
    } finally {
      setPending(false);
      // 同じファイルを選び直しても change が発火するようにする
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        /*
         * capture は付けない。付けるとカメラが直接開いてしまい、
         * 保存済みの写真から選べなくなる。付けなければ iOS / Android とも
         * 「写真を撮る / ライブラリから選ぶ / ファイル」を選ばせる画面が出る。
         */
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {preview ? (
        <div className="relative overflow-hidden border bg-muted/30">
          {/* 名刺は横長。署名付き URL もデータ URI も素の img で出す。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="名刺の画像" className="max-h-72 w-full bg-black/5 object-contain dark:bg-white/5" />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="画像を外す"
            className="absolute top-1 right-1 bg-background/80"
            onClick={() => {
              setPreview(null);
              onClear?.();
            }}
          >
            <XIcon />
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className={cn(pending && "opacity-70")}
      >
        {pending ? <LoaderCircleIcon className="animate-spin" /> : <CameraIcon />}
        {pending
          ? "読み取っています…"
          : preview
            ? "撮り直す・選び直す"
            : ocrEnabled
              ? "名刺を撮影 / 選択して読み取る"
              : "名刺の画像を選ぶ"}
      </Button>
    </div>
  );
}

