import { z } from "zod";
import { optionalText } from "@/lib/form";
import { ACCENT_COLORS, ACCENT_COLOR_KEYS, toAccentColor, type AccentColor } from "@/lib/colors";

/**
 * プロジェクトの識別色。アプリ全体の配色（モノクロ）は変えず、
 * カレンダーのチップとプロジェクトのドットだけをこの色で塗り分ける。
 *
 * パレットの実体は lib/colors.ts にあり、担当者の色分け（カレンダーの
 * 「色分け: 担当者」）と共有している。ここは従来の名前で使えるようにする別名。
 */
export const PROJECT_COLOR_KEYS = ACCENT_COLOR_KEYS;
export const PROJECT_COLORS = ACCENT_COLORS;
export const toProjectColor = toAccentColor;
export type ProjectColor = AccentColor;

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
