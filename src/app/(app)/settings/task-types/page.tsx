import type { Metadata } from "next";
import { getTaskTypes } from "@/features/task-types/queries";
import { PageHeader } from "@/components/shared/page-header";
import { TaskTypeBoard } from "@/components/task-types/task-type-board";

export const metadata: Metadata = {
  title: "タスク種別 | plusphi",
};

export default async function TaskTypesPage() {
  const taskTypes = await getTaskTypes();
  const active = taskTypes.filter((taskType) => taskType.archivedAt === null).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title="タスク種別"
        description={`${active} 件を利用中。掴んで上下に動かすと、タスク登録時の選択肢の並び順が変わります。`}
      />

      <TaskTypeBoard taskTypes={taskTypes} />
    </div>
  );
}
