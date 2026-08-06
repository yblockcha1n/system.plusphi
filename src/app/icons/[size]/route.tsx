import { ImageResponse } from "next/og";

/**
 * PWA の manifest から参照する固定 URL のアイコンを PNG で生成する。
 *
 * app/icon.tsx が出す URL はハッシュ付きで manifest から指しづらいため、
 * /icons/192 のような安定したパスを Route Handler で用意している。
 * 図形だけで描いていてフォントに依存しない（生成が環境で揺れない）。
 */
const VARIANTS = {
  "192": { size: 192, safeRatio: 1 },
  "512": { size: 512, safeRatio: 1 },
  // maskable は端末が最大 20% ほど外周を削るため、絵柄を内側に寄せる
  maskable: { size: 512, safeRatio: 0.75 },
} as const;

type Variant = keyof typeof VARIANTS;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((size) => ({ size }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;

  if (!(size in VARIANTS)) {
    return new Response("Not Found", { status: 404 });
  }

  const { size: pixels, safeRatio } = VARIANTS[size as Variant];

  const frame = Math.round(pixels * 0.62 * safeRatio);
  const stroke = Math.max(2, Math.round(pixels * 0.045));
  const barLength = Math.round(frame * 0.52);
  const barWidth = stroke;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        {/* 角を落とした四角い枠。アプリ全体の角張ったデザインに合わせている。 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            width: frame,
            height: frame,
            alignItems: "center",
            justifyContent: "center",
            border: `${stroke}px solid #ffffff`,
          }}
        >
          {/* plusphi の "plus" を図形で表す */}
          <div
            style={{
              position: "absolute",
              width: barLength,
              height: barWidth,
              background: "#ffffff",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: barWidth,
              height: barLength,
              background: "#ffffff",
            }}
          />
        </div>
      </div>
    ),
    { width: pixels, height: pixels }
  );
}
