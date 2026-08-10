/**
 * アプリ共通の 6 色パレット。
 *
 * UI 全体の配色はモノクロのまま変えず、「何かを identity で塗り分けたい」箇所だけ
 * この色を使う。今のところ用途は 2 つ:
 *  - プロジェクトの識別色（features/projects/schema.ts が PROJECT_COLORS として再公開）
 *  - 担当者・作成者の識別色（カレンダーの「色分け: 担当者」）
 *
 * 実体の色値は globals.css の --project-* に定義してある（先にプロジェクト用として
 * 入れたため名前が project- のまま。参照側の意味は上記のとおり広い）。
 *
 * lib に置いているのは env.ts（利用者の色）と features の両方から使うため。
 * features に置くと lib → features の逆流になる。
 */

export const ACCENT_COLOR_KEYS = [
  "gray",
  "blue",
  "green",
  "amber",
  "red",
  "purple",
] as const;

export type AccentColor = (typeof ACCENT_COLOR_KEYS)[number];

export type AccentColorStyle = {
  label: string;
  /** 名前の横に置く小さな四角 */
  dot: string;
  /** カレンダー上の予定チップ */
  chip: string;
  /** カード左端のアクセントバー */
  bar: string;
};

// Tailwind はソースを文字列として走査するため、クラス名は必ずリテラルで書く。
// テンプレートリテラルで組み立てると生成されないので注意。
export const ACCENT_COLORS: Record<AccentColor, AccentColorStyle> = {
  gray: {
    label: "グレー",
    dot: "bg-project-gray",
    chip: "border-project-gray/35 bg-project-gray/10 text-project-gray",
    bar: "bg-project-gray",
  },
  blue: {
    label: "ブルー",
    dot: "bg-project-blue",
    chip: "border-project-blue/35 bg-project-blue/10 text-project-blue",
    bar: "bg-project-blue",
  },
  green: {
    label: "グリーン",
    dot: "bg-project-green",
    chip: "border-project-green/35 bg-project-green/10 text-project-green",
    bar: "bg-project-green",
  },
  amber: {
    label: "アンバー",
    dot: "bg-project-amber",
    chip: "border-project-amber/35 bg-project-amber/10 text-project-amber",
    bar: "bg-project-amber",
  },
  red: {
    label: "レッド",
    dot: "bg-project-red",
    chip: "border-project-red/35 bg-project-red/10 text-project-red",
    bar: "bg-project-red",
  },
  purple: {
    label: "パープル",
    dot: "bg-project-purple",
    chip: "border-project-purple/35 bg-project-purple/10 text-project-purple",
    bar: "bg-project-purple",
  },
};

/** DB には自由文字列が入りうるため、既知のキー以外は gray に倒す。 */
export function toAccentColor(value: string | null | undefined): AccentColor {
  return ACCENT_COLOR_KEYS.includes(value as AccentColor) ? (value as AccentColor) : "gray";
}

/**
 * 自動採番に使う色。gray は「未割当」を表す色として空けておきたいので外す。
 */
const SEEDED_COLORS = ACCENT_COLOR_KEYS.filter((key) => key !== "gray");

/**
 * 文字列（メールアドレスを想定）から色を1つ決める。
 *
 * env に色を書かせず、誰にでも必ず色が付くようにするための導出。同じ文字列からは
 * 常に同じ色が出るので、サーバーとクライアント、実行環境をまたいでもぶれない。
 * ハッシュは FNV-1a（衝突耐性は不要で、分布と再現性だけあればよい）。
 *
 * 5 色しかないため、6 人以上いれば必ず同じ色の人が出る。色は「ぱっと見の手掛かり」
 * であって識別子ではない、という前提で使うこと。
 */
export function colorFromSeed(seed: string): AccentColor {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    // 32bit の乗算に畳む。Math.imul でないと精度が落ちて分布が偏る。
    hash = Math.imul(hash, 0x01000193);
  }

  // imul は符号付きを返すので、剰余を取る前に符号なしへ寄せる
  return SEEDED_COLORS[(hash >>> 0) % SEEDED_COLORS.length];
}
