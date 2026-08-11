"use client";

import { useState } from "react";
import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { api, upsert } from "@/lib/api-client";
import {
  EVENT_TITLE_PRESETS,
  stripTitlePreset,
  type EventItem,
} from "@/features/calendar/schema";
import type { ProjectOption } from "@/features/projects/schema";
import {
  RECURRENCE_FREQS,
  RECURRENCE_LABELS,
  describeRecurrence,
} from "@/features/calendar/recurrence";
import type { UserOption } from "@/lib/env";
import { NONE_VALUE } from "@/lib/form";
import { addDays, toDateInput, toDateTimeInput } from "@/lib/datetime";
import { DateTimeField } from "@/components/shared/date-time-field";
import { Field } from "@/components/shared/field";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import { UserChecklist } from "@/components/shared/user-checklist";
import { useApiForm } from "@/components/shared/use-api";
import { useFormResetKey } from "@/components/shared/use-form-reset-key";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  users: UserOption[];
  /**
   * 削除の要求。繰り返しの予定は「この回だけ」と「すべての回」で意味が違うので、
   * どちらを押されたかを呼び出し側へ伝える（実際の確認と実行は呼び出し側）。
   */
  onDelete?: (event: EventItem, scope: "occurrence" | "series") => void;
};

export function EventSheet({
  open,
  onOpenChange,
  event,
  draft,
  projects,
  users,
  onDelete,
}: EventSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createEvent, api.updateEvent),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(event);

  const initialAllDay = event?.allDay ?? draft?.allDay ?? false;
  const initialProject = event?.projectId ?? NONE_VALUE;
  const initialFreq = event?.recurrence?.freq ?? NONE_VALUE;
  const initialTitle = event?.title ?? "";

  const [allDay, setAllDay] = useState(initialAllDay);
  const [projectId, setProjectId] = useState<string>(initialProject);
  const [freq, setFreq] = useState<string>(initialFreq);
  // 種別ボタンから書き換えるため、タイトルだけは制御された入力にする
  const [title, setTitle] = useState(initialTitle);

  // 開き直したときに前回の入力・選択が残らないようにする
  const formKey = useFormResetKey(open, () => {
    setAllDay(initialAllDay);
    setProjectId(initialProject);
    setFreq(initialFreq);
    setTitle(initialTitle);
  });

  /**
   * 種別を付け外しする。同じものを押したら外し、違うものを押したら差し替える。
   * 積み重ならないよう、先頭に付いている種別は常に取り除いてから付ける。
   */
  const togglePreset = (preset: string) => {
    setTitle((current) =>
      (current.startsWith(preset)
        ? stripTitlePreset(current)
        : `${preset}${stripTitlePreset(current)}`
      ).slice(0, 200)
    );
  };

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

  const freqOptions: SelectOption[] = [
    { value: NONE_VALUE, label: "繰り返さない" },
    ...RECURRENCE_FREQS.map((value) => ({ value, label: RECURRENCE_LABELS[value] })),
  ];

  const repeats = freq !== NONE_VALUE;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "予定を編集" : "予定を登録"}</SheetTitle>
          <SheetDescription>
            {event?.recurrence
              ? `${describeRecurrence(event.recurrence)}の繰り返しです。ここでの変更はすべての回に反映されます。`
              : "日時は日本時間で保存されます。プロジェクトを選ぶとカレンダー上で色分けされます。"}
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
                value={title}
                onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                placeholder="定例ミーティング"
              />

              {/* よく使う種別。押すとタイトルの頭に差し込む。 */}
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TITLE_PRESETS.map((preset) => {
                  const active = title.startsWith(preset);

                  return (
                    <Button
                      key={preset}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="xs"
                      aria-pressed={active}
                      onClick={() => togglePreset(preset)}
                    >
                      {preset}
                    </Button>
                  );
                })}
              </div>
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

            {/* 繰り返しの設定。定例のように毎週・隔週で回るものを 1 行で表す。 */}
            <div className="grid gap-5 @md:grid-cols-2">
              <SelectField
                label="繰り返し"
                id="event-recurrenceFreq"
                name="recurrenceFreq"
                value={freq}
                onValueChange={setFreq}
                options={freqOptions}
                errors={state.fieldErrors?.recurrenceFreq}
                hint={
                  isEdit && event?.recurrence
                    ? "変更するとすべての回に反映されます。"
                    : undefined
                }
              />

              {repeats && (
                <Field
                  label="間隔"
                  htmlFor="event-recurrenceInterval"
                  errors={state.fieldErrors?.recurrenceInterval}
                  hint={
                    freq === "weekly"
                      ? "2 にすると隔週になります。"
                      : "1 なら毎回、2 なら 1 回おきです。"
                  }
                >
                  <Input
                    id="event-recurrenceInterval"
                    name="recurrenceInterval"
                    type="number"
                    min={1}
                    max={52}
                    defaultValue={event?.recurrence?.interval ?? 1}
                    className="w-24"
                  />
                </Field>
              )}
            </div>

            {repeats && (
              <DateTimeField
                label="繰り返しの終了日"
                id="recurrenceUntil"
                name="recurrenceUntil"
                mode="date"
                defaultValue={event?.recurrence?.until ?? ""}
                errors={state.fieldErrors?.recurrenceUntil}
                hint="空のままなら終わりなく繰り返します。"
              />
            )}

            <UserChecklist
              label="担当者"
              id="event-assignees"
              name="assignees"
              users={users}
              defaultValue={event?.assignees ?? []}
              errors={state.fieldErrors?.assignees}
              hint="複数選べます。カレンダーを担当者で色分けすると、先頭の人の色になります。"
            />

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
            {isEdit &&
              onDelete &&
              (event?.recurrence ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button type="button" variant="destructive" disabled={pending}>
                        <Trash2Icon />
                        削除
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="start" className="w-auto min-w-44">
                    <DropdownMenuItem onClick={() => onDelete(event, "occurrence")}>
                      この回だけ削除
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(event, "series")}>
                      すべての回を削除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => onDelete(event as EventItem, "series")}
                >
                  <Trash2Icon />
                  削除
                </Button>
              ))}

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
