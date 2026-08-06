import sharp from "sharp";
import { mkdir } from "node:fs/promises";

/**
 * 元のロゴ画像から、アプリ内で使うロゴと PWA / ファビコン用アイコンを作る。
 *
 *   npm run generate-icons [元画像のパス]
 *
 * 元画像は白背景・余白ありでよい。このスクリプトが
 *   1. 白を透過に変換
 *   2. 余白をトリム
 *   3. 各用途のサイズに書き出し
 * まで行う。ロゴを差し替えたら再実行すること。
 */

const SOURCE = process.argv[2] ?? "public/ファイのみ.png";

/** アプリ内で使うロゴの一辺。実際の表示は 20〜26px なので拡大に十分な解像度を確保する。 */
const LOGO_SIZE = 512;
/** 正方形の中でマークが占める割合。詰まって見えないよう少し余白を残す。 */
const LOGO_SCALE = 0.86;
/** maskable は端末が外周を最大 20% ほど削るため、さらに内側へ寄せる。 */
const MASKABLE_SCALE = 0.55;
const ICON_SCALE = 0.78;

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const white = { r: 255, g: 255, b: 255, alpha: 1 };

/** 中央にマークを置いた size×size の PNG を作る。 */
async function frame(
  mark: Buffer,
  size: number,
  scale: number,
  background: typeof transparent | typeof white
): Promise<Buffer> {
  const inner = Math.round(size * scale);
  const pad = Math.round((size - inner) / 2);

  const image = sharp(mark)
    .resize(inner, inner, { fit: "contain", background: transparent })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background });

  // 不透明にしたいアイコン（ホーム画面用）は白で焼き込む
  return (background === white ? image.flatten({ background: "#ffffff" }) : image).png().toBuffer();
}

const meta = await sharp(SOURCE).metadata();
console.log(`元画像: ${SOURCE} (${meta.width}x${meta.height}, alpha: ${meta.hasAlpha})`);

// 白背景を透過にする。マークは黒なので、グレースケールを反転した値が
// そのままアルファ（白 = 透明 / 黒 = 不透明）として使える。
// 元画像が既に透過済みならこの処理は結果を変えない。
const alpha = await sharp(SOURCE).removeAlpha().greyscale().negate().toBuffer();
const keyed = await sharp(SOURCE).removeAlpha().joinChannel(alpha).png().toBuffer();

const mark = await sharp(keyed).trim({ threshold: 1 }).toBuffer();
const trimmed = await sharp(mark).metadata();
console.log(`トリム後: ${trimmed.width}x${trimmed.height}`);

await mkdir("public/icons", { recursive: true });

const logo = await frame(mark, LOGO_SIZE, LOGO_SCALE, transparent);
await sharp(logo).toFile("public/logo.png");

const outputs: [string, Buffer][] = [
  ["public/icons/icon-192.png", await frame(mark, 192, ICON_SCALE, white)],
  ["public/icons/icon-512.png", await frame(mark, 512, ICON_SCALE, white)],
  ["public/icons/icon-maskable.png", await frame(mark, 512, MASKABLE_SCALE, white)],
  // Next.js の file convention。app/ に置くと <link> が自動で入る。
  ["src/app/apple-icon.png", await frame(mark, 180, 0.7, white)],
  ["src/app/icon.png", await frame(mark, 32, LOGO_SCALE, transparent)],
];

for (const [path, buffer] of outputs) {
  await sharp(buffer).toFile(path);
  console.log(`✅ ${path}`);
}

console.log("✅ public/logo.png");
