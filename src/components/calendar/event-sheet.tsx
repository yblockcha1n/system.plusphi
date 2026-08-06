"use client";

import { useState } from "react";
import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import type { EventItem } from "@/features/calendar/schema";
import type { ProjectOption } from "@/features/projects/schema";
import { NONE_VALUE } from "@/lib/form";
import { addDays, toDateInput, toDateTimeInput } from "@/lib/datetime";
import { DateTimeField } from "@/components/shared/date-time-field";
import { Field } from "@/components/shared/field";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import { useApiForm } from "@/components/shared/use-api";
import { useFormResetKey } from "@/components/shared/use-form-reset-key";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** 新規作成時にカレンダーのクリック位置から渡ってくる初期値。 */
export type EventDraft = {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

type EventSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規作成 */
  event?: EventItem;
  draft?: EventDraft;
  projects: ProjectOption[];
  onDelete?: (event: EventItem) => void;
};

export function EventSheet({
  open,
  onOpenChange,
  event,
  draft,
  projects,
  onDelete,
}: EventSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createEvent, api.updateEvent),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(event);

  const initialAllDay = event?.allDay ?? draft?.allDay ?? false;
  const initialProject = event?.projectId ?? NONE_VALUE;

  const [allDay, setAllDay] = useState(initialAllDay);
  const [projectId, setProjectId] = useState<string>(initialProject);

  // 開き直したときに前回の入力・選択が残らないようにする
  const formKey = useFormResetKey(open, () => {
    setAllDay(initialAllDay);
    setProjectId(initialProject);
  });

  const startSource = event?.startsAt ?? draft?.startsAt ?? null;
  const endSource = event?.endsAt ?? draft?.endsAt ?? null;

  const start = startSource ? new Date(startSource) : null;
  const rawEnd = endSource ? new Date(endSource) : null;
  // 終日の ends_at は「翌 0 時」で持っているため、入力欄には 1 日戻して見せる
  const end = rawEnd && initialAllDay ? addDays(rawEnd, -1) : rawEnd;

  const projectOptions: SelectOption[] = [
    { value: NONE_VALUE, label: "プロジェクトなし" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "予定を編集" : "予定を登録"}</SheetTitle>
          <SheetDescription>
            日時は日本時間で保存されます。プロジェクトを選ぶとカレンダー上で色分けされます。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="@container flex flex-1 flex-col gap-5 overflow-y-auto p-4">
            {event && <input type="hidden" name="id" value={event.id} />}

            <Field label="タイトル" htmlFor="event-title" errors={state.fieldErrors?.title}>
              <Input
                id="event-title"
                name="title"
                required
                maxLength={200}
                defaultValue={event?.title ?? ""}
                placeholder="定例ミーティング"
              />
            </Field>

            <div className="flex items-center gap-2">
              <Checkbox
                id="allDay"
                name="allDay"
                checked={allDay}
                onCheckedChange={(checked) => setAllDay(checked === true)}
              />
              <Label htmlFor="allDay">終日</Label>
            </div>

            {/* 終日を切り替えると値の形（日付のみ / 日時）が変わるので key で作り直す */}
            <div className="grid gap-5 @md:grid-cols-2">
              <DateTimeField
                key={`start-${allDay}`}
                label="開始"
                id="startsAt"
                name="startsAt"
                mode={allDay ? "date" : "datetime"}
                clearable={false}
                defaultValue={allDay ? toDateInput(start) : toDateTimeInput(start)}
                errors={state.fieldErrors?.startsAt}
              />

              <DateTimeField
                key={`end-${allDay}`}
                label="終了"
                id="endsAt"
                name="endsAt"
                mode={allDay ? "date" : "datetime"}
                clearable={false}
                defaultValue={allDay ? toDateInput(end) : toDateTimeInput(end)}
                defaultTime="10:00"
                errors={state.fieldErrors?.endsAt}
                hint={allDay ? "終了日も予定に含まれます。" : undefined}
              />
            </div>

            <SelectField
              label="プロジェクト"
              id="event-projectId"
              name="projectId"
              value={projectId}
              onValueChange={setProjectId}
              options={projectOptions}
              errors={state.fieldErrors?.projectId}
            />

            <Field label="場所" htmlFor="location" errors={state.fieldErrors?.location}>
              <Input
                id="location"
                name="location"
                maxLength={300}
                defaultValue={event?.location ?? ""}
                placeholder="本社 3F 会議室 / Google Meet"
              />
            </Field>

            <Field label="メモ" htmlFor="description" errors={state.fieldErrors?.description}>
              <Textarea
                id="description"
                name="description"
                rows={4}
                maxLength={4000}
                defaultValue={event?.description ?? ""}
                placeholder="議題、事前準備など"
              />
            </Field>
          </div>

          <SheetFooter className="flex-row items-center gap-2 border-t">
            {isEdit && onDelete && (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => onDelete(event as EventItem)}
              >
                <Trash2Icon />
                削除
              </Button>
            )}

            <div className="ml-auto flex gap-2">
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
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
