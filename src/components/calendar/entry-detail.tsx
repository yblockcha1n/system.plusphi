"use client";

import {
  AlarmClockIcon,
  ClockIcon,
  FolderKanbanIcon,
  MapPinIcon,
  PencilIcon,
  RepeatIcon,
  TextIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import type { CalendarEntry, EventItem } from "@/features/calendar/schema";
import { describeRecurrence } from "@/features/calendar/recurrence";
import { PROJECT_COLORS } from "@/features/projects/schema";
import { TASK_STATUS_BADGE, TASK_STATUS_LABELS, type TaskItem } from "@/features/tasks/schema";
import { formatDateTime, formatRange, formatWeekdayDate } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 帯を押したときに出す確認カード。
 *
 * いきなり編集フォームを開くと、中身を見たいだけのときに重い。まずここで読み、
 * 直したいときだけ「編集」から編集シートへ進む。
 *
 * 予定とタスクで出す項目が違うので、kind で描き分ける。
 */

type EntryDetailProps = {
  entry: CalendarEntry;
  /** 予定由来の帯なら対応する予定。タスク由来なら null。 */
  event: EventItem | null;
  /** タスク由来の帯なら対応するタスク。予定由来なら null。 */
  task: TaskItem | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function EntryDetail({
  entry,
  event,
  task,
  onEdit,
  onDelete,
  onClose,
}: EntryDetailProps) {
  const start = new Date(entry.startsAt);
  const end = new Date(entry.endsAt);

  return (
    // 画面幅が足りないときは横幅を詰める（date-time-field と同じ考え方）
    <div className="flex w-80 max-w-[calc(100vw-1.5rem)] flex-col">
      {/* 操作は上に並べる。指で押せるよう、この行だけ大きめの的にする。 */}
      <div className="flex items-center justify-end gap-0.5 border-b px-1.5 py-1.5">
        <Button variant="ghost" size="icon" aria-label="編集" onClick={onEdit}>
          <PencilIcon />
        </Button>
        <Button variant="ghost" size="icon" aria-label="削除" onClick={onDelete}>
          <Trash2Icon />
        </Button>
        <Button variant="ghost" size="icon" aria-label="閉じる" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span
            className={cn("mt-1 size-3 shrink-0", PROJECT_COLORS[entry.color].dot)}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base leading-snug font-semibold break-words">{entry.title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {entry.kind === "deadline"
                ? `締切 ${formatDateTime(start)}`
                : formatRange(start, end, entry.allDay)}
            </p>
          </div>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          {event && (
            <>
              {event.recurrence && (
                <Row icon={<RepeatIcon />} label="繰り返し">
                  {describeRecurrence(event.recurrence)}
                </Row>
              )}

              {event.location && (
                <Row icon={<MapPinIcon />} label="場所">
                  {event.location}
                </Row>
              )}

              {event.assigneeNames.length > 0 && (
                <Row icon={<UsersIcon />} label="担当者">
                  {event.assigneeNames.join("、")}
                </Row>
              )}

              {event.projectName && (
                <Row icon={<FolderKanbanIcon />} label="プロジェクト">
                  {event.projectName}
                </Row>
              )}

              {event.description && (
                <Row icon={<TextIcon />} label="メモ">
                  <span className="whitespace-pre-wrap">{event.description}</span>
                </Row>
              )}
            </>
          )}

          {task && (
            <>
              <Row icon={<ClockIcon />} label="状態">
                <span
                  className={cn(
                    "inline-block border px-1.5 py-0.5 text-xs font-medium",
                    TASK_STATUS_BADGE[task.status]
                  )}
                >
                  {TASK_STATUS_LABELS[task.status]}
                </span>
              </Row>

              {task.deadlineAt && entry.kind !== "deadline" && (
                <Row icon={<AlarmClockIcon />} label="締切">
                  {formatDateTime(new Date(task.deadlineAt))}
                </Row>
              )}

              {entry.kind === "deadline" && task.startsAt && (
                <Row icon={<ClockIcon />} label="作業期間">
                  {task.endsAt
                    ? formatRange(new Date(task.startsAt), new Date(task.endsAt), false)
                    : formatWeekdayDate(new Date(task.startsAt))}
                </Row>
              )}

              {task.taskTypeName && (
                <Row icon={<TextIcon />} label="種別">
                  {task.taskTypeName}
                </Row>
              )}

              {(task.assigneeName || task.reviewerName) && (
                <Row icon={<UsersIcon />} label="担当">
                  {[
                    task.assigneeName && `担当 ${task.assigneeName}`,
                    task.reviewerName && `検収 ${task.reviewerName}`,
                  ]
                    .filter(Boolean)
                    .join(" ・ ")}
                </Row>
              )}

              {task.projectName && (
                <Row icon={<FolderKanbanIcon />} label="プロジェクト">
                  {task.projectName}
                </Row>
              )}

              {task.detail && (
                <Row icon={<TextIcon />} label="詳細">
                  {/* 長い詳細でカードが伸び切らないよう、はみ出したぶんはスクロールさせる */}
                  <span className="block max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {task.detail}
                  </span>
                </Row>
              )}
            </>
          )}
        </dl>

        {event?.createdByName && (
          <p className="border-t pt-2 text-xs text-muted-foreground">
            登録者 {event.createdByName}
          </p>
        )}
        {task?.createdBy && (
          <p className="border-t pt-2 text-xs text-muted-foreground">登録者 {task.createdBy}</p>
        )}
      </div>
    </div>
  );
}

/** アイコン＋内容の 1 行。ラベルは読み上げ用に持たせ、画面にはアイコンだけ出す。 */
function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}
