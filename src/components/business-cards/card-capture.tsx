"use client";

import { useRef, useState } from "react";
import { CameraIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ScannedCard } from "@/features/business-cards/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 縮小後の長辺。
 *
 * Vercel のリクエストボディ上限は 4.5MB で変更できないため、スマートフォンの
 * 写真（3〜5MB、base64 にすると 1.33 倍）をそのまま送ると 413 になる。
 * 1600px あれば名刺の文字は十分読め、読み取りに渡す画像のトークン量
 *（幅 × 高さ ÷ 750）も 2,300 程度に収まる。
 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export type CaptureResult = {
  card: ScannedCard;
  candidates: { id: string; name: string }[];
  imageDataUrl: string;
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
 * 画像を縮小してデータ URI にする。
 *
 * canvas を通すので EXIF の回転情報は落ちるが、createImageBitmap に
 * imageOrientation を渡すことでブラウザ側に向きを直させている
 *（これをしないと横向きに撮った名刺が寝たまま送られる）。
 */
async function toResizedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を処理できませんでした。");

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
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

      if (!ocrEnabled) {
        // 読み取りは使えないが、画像だけは保存できるようにする
        onScanned({
          card: emptyCard(),
          candidates: [],
          imageDataUrl,
        });
        return;
      }

      const result = await api.scanBusinessCard(imageDataUrl);

      if (result.status === "error" || !result.data) {
        toast.error(result.message ?? "読み取りに失敗しました。");
        // 読めなくても画像は残し、手入力で続けられるようにする
        onScanned({ card: emptyCard(), candidates: [], imageDataUrl });
        return;
      }

      toast.success(result.message);
      onScanned({
        card: result.data.card as unknown as ScannedCard,
        candidates: result.data.candidates,
        imageDataUrl,
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
        // スマートフォンでは背面カメラが直接開く
        capture="environment"
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
          <img src={preview} alt="名刺の画像" className="max-h-56 w-full object-contain" />

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
            ? "撮り直す"
            : ocrEnabled
              ? "名刺を撮影して読み取る"
              : "名刺の画像を選ぶ"}
      </Button>
    </div>
  );
}

function emptyCard(): ScannedCard {
  return {
    companyName: null,
    fullName: null,
    fullNameKana: null,
    department: null,
    title: null,
    email: null,
    phone: null,
    mobile: null,
    website: null,
    address: null,
  };
}
