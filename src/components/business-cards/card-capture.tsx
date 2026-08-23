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

/** canvas に描ける形にしたもの。後始末の仕方が入力によって違うのでまとめて持つ。 */
type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

type Format = "jpeg" | "png" | "webp" | "gif" | "heic" | "tiff" | "pdf" | "unknown";

const FORMAT_LABELS: Record<Format, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  heic: "HEIC",
  tiff: "TIFF",
  pdf: "PDF",
  unknown: "不明な形式",
};

/**
 * 先頭のバイト列から形式を見分ける。
 *
 * 拡張子も file.type も当てにならない。Mac で書き出すと HEIC のまま .jpg という
 * 名前が付くことがあり、名前だけ見ていると原因を取り違える。中身で判断する。
 */
async function sniffFormat(file: File): Promise<Format> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...head.subarray(from, to));

  // ISO BMFF。4〜8 バイト目が ftyp で、そのあとのブランドで中身が決まる。
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    const heif = ["heic", "heix", "heim", "heis", "hevc", "hevm", "hevs", "mif1", "msf1"];
    if (heif.includes(brand)) return "heic";
  }

  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 3) === "GIF") return "gif";
  if (ascii(0, 4) === "%PDF") return "pdf";
  if (ascii(0, 4) === "II*\u0000" || ascii(0, 4) === "MM\u0000*") return "tiff";

  return "unknown";
}

/**
 * どんな入力でも canvas に描ける形にする。
 *
 * createImageBitmap はブラウザが復号できる形式しか受け付けず、駄目なときは
 * "The source image could not be decoded" としか言わない。実際に上げられる
 * ものの中には、これで落ちるものが 2 種類ある。
 *
 *  - HEIC : Mac や iPhone から上げると普通に混ざるが、Chrome も Firefox も
 *           復号できない。ここだけ変換を挟む（wasm で重いので動的 import。
 *           HEIC を渡されたときにしか読み込まれない）
 *  - SVG  : <img> なら描けるのに createImageBitmap は受け取らない
 *
 * それ以外は何を渡されたのかを添えて諦める。「読み込めませんでした」だけだと、
 * 撮り直せば直るのか、形式が悪いのかが利用者に分からない。
 */
async function decodeImage(file: File): Promise<Decoded> {
  let reason = "";

  const attempts = [
    () => createImageBitmap(file, { imageOrientation: "from-image" }),
    // 向きの指定を外すと通ることがある。EXIF が壊れている写真がこれで救える。
    () => createImageBitmap(file),
  ];

  for (const attempt of attempts) {
    try {
      return fromBitmap(await attempt());
    } catch (cause) {
      reason = cause instanceof Error ? cause.message : String(cause);
    }
  }

  const format = await sniffFormat(file);

  // 何を渡されて何と言われたのかを残す。利用者から見えるのは下の文言だけなので、
  // 追いかけるときの手掛かりをここに置いておく。
  console.warn("[名刺] 復号できませんでした", {
    name: file.name,
    type: file.type || "(なし)",
    sizeKb: Math.round(file.size / 1024),
    format,
    reason,
  });

  if (format === "pdf") {
    throw new Error(
      "PDF は画像として読み取れません。ページを画像として書き出すか、画面を撮影したものをお使いください。"
    );
  }

  if (format === "tiff") {
    throw new Error(
      "TIFF 形式はブラウザが表示できません。JPEG か PNG で保存し直してください。"
    );
  }

  if (format === "heic") {
    const { heicTo } = await import("heic-to");

    return fromBitmap(
      await heicTo({
        blob: file,
        type: "bitmap",
        options: { imageOrientation: "from-image" },
      })
    );
  }

  return await decodeWithImgElement(file, format);
}

function fromBitmap(bitmap: ImageBitmap): Decoded {
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close(),
  };
}

/** <img> に読ませる最後の手段。SVG のように createImageBitmap が断る形式のため。 */
function decodeWithImgElement(file: File, format: Format): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(unsupportedMessage(file, format)));
        return;
      }

      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => URL.revokeObjectURL(objectUrl),
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(unsupportedMessage(file, format)));
    };

    image.src = objectUrl;
  });
}

/**
 * 扱えなかったときの説明。
 *
 * 中身が普通の画像形式なのに復号できない場合は、形式ではなくその 1 枚に
 * 原因がある（CMYK・特殊な圧縮・途中で切れているなど）。そこを言い分けないと、
 * 「JPEG にしてください」と言われた JPEG を前に手が止まる。
 */
function unsupportedMessage(file: File, format: Format): string {
  const label = FORMAT_LABELS[format];
  const sizeKb = Math.round(file.size / 1024);
  const known = format === "jpeg" || format === "png" || format === "webp" || format === "gif";

  if (known) {
    return `この ${label}（${sizeKb}KB）はブラウザが開けませんでした。CMYK や特殊な圧縮の可能性があります。「プレビュー」などで開いて別名で書き出したものをお使いください。`;
  }

  return `この画像を読み込めません（中身は ${label} / ${sizeKb}KB）。JPEG か PNG で保存し直すか、画面を撮影したものをお使いください。`;
}

/**
 * 画像を縮小してデータ URI にする。目安の大きさに収まるまで段階的に落とす。
 *
 * canvas を通すので EXIF の回転情報は落ちるが、復号のときに
 * imageOrientation を渡してブラウザ側に向きを直させている
 *（これをしないと横向きに撮った名刺が寝たまま送られる）。
 */
async function toResizedDataUrl(file: File): Promise<string> {
  const decoded = await decodeImage(file);

  try {
    let last = "";

    for (const { edge, quality } of ATTEMPTS) {
      const scale = Math.min(1, edge / Math.max(decoded.width, decoded.height));
      const width = Math.round(decoded.width * scale);
      const height = Math.round(decoded.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("画像を処理できませんでした。");

      context.drawImage(decoded.source, 0, 0, width, height);
      last = canvas.toDataURL("image/jpeg", quality);

      if (last.length <= TARGET_BYTES) return last;
    }

    // 一番小さい設定でも収まらなければ、それを使う（送れないよりはよい）
    return last;
  } finally {
    decoded.release();
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
        /* 環境によっては image/* に HEIC が含まれず、Finder で選べなくなる */
        accept="image/*,.heic,.heif"
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

