"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import type { ApiResult } from "@/lib/api-client";
import { useApiMutation } from "@/components/shared/use-api";
import { cn } from "@/lib/utils";

type SortableGroupProps<T> = {
  /**
   * DndContext を識別する固定の文字列。画面内で一意にすること。
   *
   * 省略すると dnd-kit がモジュールレベルのカウンタで id を採番するが、
   * このカウンタはサーバー側でリクエストをまたいで増え続ける一方、
   * クライアントは 0 から始まるため aria-describedby がズレて
   * ハイドレーションエラーになる。
   */
  id: string;
  items: T[];
  getId: (item: T) => string;
  /** 並べ替え結果を保存する Server Action。失敗したら元の順序に戻す。 */
  onReorder: (ids: string[]) => Promise<ApiResult>;
  className?: string;
  /** 第2引数の dragHandle を、掴ませたい位置に置く。 */
  children: (item: T, dragHandle: React.ReactNode) => React.ReactNode;
};

/**
 * 縦並びのドラッグ&ドロップ並べ替え。
 *
 * 表示順はローカル state で先に動かし（楽観的更新）、保存に失敗したときだけ戻す。
 * サーバーの revalidate で新しい順序が降ってきたら、その順序に同期し直す。
 */
export function SortableGroup<T>({
  id,
  items,
  getId,
  onReorder,
  className,
  children,
}: SortableGroupProps<T>) {
  const ids = items.map(getId);
  const [order, setOrder] = useState<string[]>(ids);
  const { run } = useApiMutation();

  // props が変わったらレンダー中に追随させる（effect を挟むと一瞬古い順序が見える）
  // https://react.dev/learn/you-might-not-need-an-effect
  const [syncedIds, setSyncedIds] = useState<string>(ids.join());
  if (ids.join() !== syncedIds) {
    setSyncedIds(ids.join());
    setOrder(ids);
  }

  // マウスとタッチで開始条件を分ける。PointerSensor ひとつで両方を賄うと、
  // タッチでは「距離で判定 = 指を置いて少し動かした時点で開始」になり、
  // 縦スクロールと取り合って掴めたり掴めなかったりする。
  const sensors = useSensors(
    // マウス: 6px 動かすまでは開始しない。カード内のボタンが押せなくなるのを防ぐ。
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // タッチ: 長押しで開始する。tolerance を超えて指が動いたらスクロール優先。
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const byId = new Map(items.map((item) => [getId(item), item]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const previous = order;
    const next = arrayMove(order, from, to);
    setOrder(next);

    // 並べ替えは頻度が高いので成功トーストは出さない。失敗したときだけ元に戻す。
    run(() => onReorder(next), { silent: true, onError: () => setOrder(previous) });
  };

  return (
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {ordered.map((item) => (
            <SortableRow key={getId(item)} id={getId(item)}>
              {(dragHandle) => children(item, dragHandle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const dragHandle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="ドラッグして並べ替え（スマートフォンでは長押し）"
      // touch-none: 掴み手の上ではブラウザにスクロールを始めさせない。
      // select-none: 長押ししたときに文字選択が走らないようにする。
      // モバイルは指で押さえる的が要るので、狭い画面では一回り大きくする。
      className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground active:cursor-grabbing sm:size-7"
    >
      <GripVerticalIcon className="size-4" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      {children(dragHandle)}
    </div>
  );
}
