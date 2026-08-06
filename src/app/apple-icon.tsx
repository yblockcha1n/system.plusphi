import { ImageResponse } from "next/og";

/** iOS のホーム画面用アイコン。link タグは Next.js が自動で入れる。 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const frame = Math.round(size.width * 0.62);
  const stroke = Math.max(2, Math.round(size.width * 0.045));
  const barLength = Math.round(frame * 0.52);

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
          <div
            style={{ position: "absolute", width: barLength, height: stroke, background: "#ffffff" }}
          />
          <div
            style={{ position: "absolute", width: stroke, height: barLength, background: "#ffffff" }}
          />
        </div>
      </div>
    ),
    size
  );
}
