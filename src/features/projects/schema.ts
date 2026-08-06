import { z } from "zod";
import { optionalText } from "@/lib/form";

/**
 * プロジェクトの識別色。アプリ全体の配色（モノクロ）は変えず、
 * カレンダーのチップとプロジェクトのドットだけをこの色で塗り分ける。
 * 実体の色値は globals.css の --color-project-* に定義してある。
 */
export const PROJECT_COLOR_KEYS = [
  "gray",
  "blue",
  "green",
  "amber",
  "red",
  "purple",
] as const;

export type ProjectColor = (typeof PROJECT_COLOR_KEYS)[number];

type ColorStyle = {
  label: string;
  /** プロジェクト名の横に置く小さな四角 */
  dot: string;
  /** カレンダー上の予定チップ */
  chip: string;
  /** カード左端のアクセントバー */
  bar: string;
};

// Tailwind はソースを文字列として走査するため、クラス名は必ずリテラルで書く。
// テンプレートリテラルで組み立てると生成されないので注意。
export const PROJECT_COLORS: Record<ProjectColor, ColorStyle> = {
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
export function toProjectColor(value: string | null | undefined): ProjectColor {
  return PROJECT_COLOR_KEYS.includes(value as ProjectColor)
    ? (value as ProjectColor)
    : "gray";
}

export const projectFormSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "プロジェクト名は必須です").max(120),
  description: optionalText(500),
  color: z.enum(PROJECT_COLOR_KEYS).catch("gray"),
});

export type ProjectFormInput = z.input<typeof projectFormSchema>;

/** 一覧に渡す DTO。 */
export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  color: ProjectColor;
  sortOrder: number;
  /** null = 進行中 */
  archivedAt: string | null;
  createdBy: string | null;
  /** 集計値（一覧のカードに出す） */
  taskCount: number;
  doneCount: number;
  overdueCount: number;
};

/** Select 用の最小情報。プロジェクトを選ぶだけの場面で使う。 */
export type ProjectOption = {
  id: string;
  name: string;
  color: ProjectColor;
};
