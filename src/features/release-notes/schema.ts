import { z } from "zod";

/**
 * パッチノート。
 *
 * 下書きは GitHub Actions が作り、人が確認して公開したときに全員へ通知が飛ぶ。
 * 本文は自動生成されたものを人が直せる前提なので、編集は自由に効かせる。
 */
export const releaseNoteFormSchema = z.object({
  id: z.uuid().optional(),
  version: z.string().trim().min(1, "バージョンは必須です").max(40),
  title: z.string().trim().min(1, "タイトルは必須です").max(200),
  body: z.string().trim().min(1, "本文は必須です").max(20000),
});

export type ReleaseNoteFormInput = z.input<typeof releaseNoteFormSchema>;

/** CI から受け取る下書き。人の入力ではないので別スキーマにする。 */
export const releaseNoteDraftSchema = z.object({
  version: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  baseSha: z.string().trim().max(64).nullable().catch(null),
  headSha: z.string().trim().max(64).nullable().catch(null),
  commitCount: z.number().int().min(0).max(10000).catch(0),
  generatedBy: z.string().trim().max(80).nullable().catch(null),
});

export type ReleaseNoteItem = {
  id: string;
  version: string;
  title: string;
  body: string;
  status: "draft" | "published";
  publishedAt: string | null;
  baseSha: string | null;
  headSha: string | null;
  commitCount: number;
  generatedBy: string | null;
  /** 公開した人の表示名。下書きなら null。 */
  publisher: string | null;
  createdAt: string;
};
