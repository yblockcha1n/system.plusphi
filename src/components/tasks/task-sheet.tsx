"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskItem,
} from "@/features/tasks/schema";
import type { ProjectOption } from "@/features/projects/schema";
import type { TaskTypeOption } from "@/features/task-types/schema";
import type { UserOption } from "@/lib/env";
import { NONE_VALUE } from "@/lib/form";
import { toDateTimeInput } from "@/lib/datetime";
import { DateTimeField } from "@/components/shared/date-time-field";
import { Field } from "@/components/shared/field";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import { useApiForm } from "@/components/shared/use-api";
import { useFormResetKey } from "@/components/shared/use-form-reset-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type TaskSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規作成 */
  task?: TaskItem;
  /** 新規作成時にあらかじめ選んでおくプロジェクト */
  defaultProjectId?: string | null;
  projects: ProjectOption[];
  taskTypes: TaskTypeOption[];
  users: UserOption[];
};

const toInput = (iso: string | null | undefined) =>
  iso ? toDateTimeInput(new Date(iso)) : "";

export function TaskSheet({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  projects,
  taskTypes,
  users,
}: TaskSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createTask, api.updateTask),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(task);

  const initialProject = task?.projectId ?? defaultProjectId ?? NONE_VALUE;
  const initialTaskType = task?.taskTypeId ?? NONE_VALUE;
  const initialAssignee = task?.assignee ?? NONE_VALUE;
  const initialReviewer = task?.reviewer ?? NONE_VALUE;
  const initialStatus = task?.status ?? "todo";

  const [projectId, setProjectId] = useState<string>(initialProject);
  const [taskTypeId, setTaskTypeId] = useState<string>(initialTaskType);
  const [assignee, setAssignee] = useState<string>(initialAssignee);
  const [reviewer, setReviewer] = useState<string>(initialReviewer);
  const [status, setStatus] = useState<string>(initialStatus);

  // 開き直したときに前回の入力・選択が残らないようにする
  const formKey = useFormResetKey(open, () => {
    setProjectId(initialProject);
    setTaskTypeId(initialTaskType);
    setAssignee(initialAssignee);
    setReviewer(initialReviewer);
    setStatus(initialStatus);
  });

  const projectOptions: SelectOption[] = [
    { value: NONE_VALUE, label: "プロジェクトなし（未分類）" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];

  // 編集中のタスクに付いている種別が「使用停止」にされていると選択肢から消える。
  // そのまま保存すると種別が黙って外れてしまうので、現在値だけは足しておく。
  const missingCurrentType =
    task?.taskTypeId && !taskTypes.some((taskType) => taskType.id === task.taskTypeId)
      ? [{ id: task.taskTypeId, name: `${task.taskTypeName ?? "不明な種別"}（使用停止中）` }]
      : [];

  const taskTypeOptions: SelectOption[] = [
    { value: NONE_VALUE, label: "種別なし" },
    ...[...taskTypes, ...missingCurrentType].map((taskType) => ({
      value: taskType.id,
      label: taskType.name,
    })),
  ];

  const userOptions: SelectOption[] = [
    { value: NONE_VALUE, label: "未設定" },
    ...users.map((user) => ({ value: user.email, label: user.name })),
  ];

  const statusOptions: SelectOption[] = TASK_STATUSES.map((value) => ({
    value,
    label: TASK_STATUS_LABELS[value],
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "タスクを編集" : "タスクを登録"}</SheetTitle>
          <SheetDescription>
            開始・終了は作業する期間、Deadline は締切です。どちらも任意で、カレンダーに表示されます。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="@container flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {task && <input type="hidden" name="id" value={task.id} />}

            <Field label="タイトル" htmlFor="title" errors={state.fieldErrors?.title}>
              <Input
                id="title"
                name="title"
                required
                maxLength={200}
                defaultValue={task?.title ?? ""}
                placeholder="請求書テンプレートの刷新"
              />
            </Field>

            <Field label="詳細" htmlFor="detail" errors={state.fieldErrors?.detail}>
              <Textarea
                id="detail"
                name="detail"
                rows={4}
                maxLength={4000}
                defaultValue={task?.detail ?? ""}
                placeholder="背景、完了条件、参考リンクなど"
              />
            </Field>

            <div className="grid gap-5 @md:grid-cols-2">
              <SelectField
                label="プロジェクト"
                id="projectId"
                name="projectId"
                value={projectId}
                onValueChange={setProjectId}
                options={projectOptions}
                errors={state.fieldErrors?.projectId}
              />

              <SelectField
                label="状態"
                id="status"
                name="status"
                value={status}
                onValueChange={setStatus}
                options={statusOptions}
                errors={state.fieldErrors?.status}
              />
            </div>

            <SelectField
              label="種別"
              id="taskTypeId"
              name="taskTypeId"
              value={taskTypeId}
              onValueChange={setTaskTypeId}
              options={taskTypeOptions}
              errors={state.fieldErrors?.taskTypeId}
              hint="選択肢は「設定 › タスク種別」で追加・並べ替えできます。"
            />

            <div className="grid gap-5 @md:grid-cols-2">
              <DateTimeField
                label="開始日時"
                id="startsAt"
                name="startsAt"
                defaultValue={toInput(task?.startsAt)}
                errors={state.fieldErrors?.startsAt}
              />

              <DateTimeField
                label="終了日時"
                id="endsAt"
                name="endsAt"
                defaultValue={toInput(task?.endsAt)}
                defaultTime="18:00"
                errors={state.fieldErrors?.endsAt}
              />
            </div>

            <DateTimeField
              label="Deadline（締切）"
              id="deadlineAt"
              name="deadlineAt"
              defaultValue={toInput(task?.deadlineAt)}
              defaultTime="18:00"
              errors={state.fieldErrors?.deadlineAt}
              hint="超過するとホームとプロジェクト一覧で警告として集計されます。"
            />

            <div className="grid gap-5 @md:grid-cols-2">
              <SelectField
                label="担当者"
                id="assignee"
                name="assignee"
                value={assignee}
                onValueChange={setAssignee}
                options={userOptions}
                errors={state.fieldErrors?.assignee}
              />

              <SelectField
                label="検収者"
                id="reviewer"
                name="reviewer"
                value={reviewer}
                onValueChange={setReviewer}
                options={userOptions}
                errors={state.fieldErrors?.reviewer}
              />
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  キャンセル
                </Button>
              }
            />
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              保存
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
