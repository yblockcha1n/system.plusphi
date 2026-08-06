import "server-only";
import { revalidatePath } from "next/cache";

/**
 * プロジェクト / タスク / 予定はどれも複数の画面に同時に出る
 * （ホームの集計、プロジェクト詳細、タスク一覧、カレンダー）。
 * 1 箇所を書き換えたら関連画面をまとめて作り直す。
 *
 * Route Handler から呼ぶ共有ヘルパー。
 */
export function revalidateWorkspace(): void {
  revalidatePath("/home");
  revalidatePath("/projects");
  revalidatePath("/projects/[id]", "page");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}
