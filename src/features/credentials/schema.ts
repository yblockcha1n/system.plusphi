import { z } from "zod";
import { NONE_VALUE, optionalText, optionalUuid } from "@/lib/form";

/** Select で「セクションなし（単一登録）」を表す番兵。DB では section_id = null。 */
export const NO_SECTION = NONE_VALUE;

export const credentialFormSchema = z.object({
  id: z.uuid().optional(),
  sectionId: optionalUuid,
  name: z.string().trim().min(1, "名称は必須です").max(120),
  username: optionalText(200),
  password: optionalText(500),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^https?:\/\//.test(value),
      "http:// または https:// から始まる URL を入力してください"
    )
    .transform((value) => (value === "" ? null : value)),
  notes: optionalText(2000),
});

export const sectionFormSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "セクション名は必須です").max(80),
  description: optionalText(300),
});

export type CredentialFormInput = z.input<typeof credentialFormSchema>;
export type SectionFormInput = z.input<typeof sectionFormSchema>;

/** 一覧に渡す DTO。暗号文そのものはクライアントへ出さない。 */
export type CredentialItem = {
  id: string;
  sectionId: string | null;
  name: string;
  username: string | null;
  url: string | null;
  hasPassword: boolean;
  hasNotes: boolean;
  /** 登録者の表示名（例: 渡邉）。移行前に登録された行は null。 */
  createdBy: string | null;
  updatedAt: string;
};

export type SectionGroup = {
  id: string | null; // null = 未分類（単一登録）
  name: string;
  description: string | null;
  credentials: CredentialItem[];
};

export { idleState } from "@/lib/form";
export type { ActionState } from "@/lib/form";
