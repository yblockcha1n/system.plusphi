"use client";

import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  CARD_SOURCE_LABELS,
  type BusinessCardItem,
} from "@/features/business-cards/schema";
import type { CompanyStatusOption } from "@/features/company-statuses/schema";
import { BusinessCardSheet } from "@/components/business-cards/business-card-sheet";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { useApiMutation } from "@/components/shared/use-api";
import { useSheetTarget } from "@/components/shared/use-sheet-target";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type BusinessCardListProps = {
  cards: BusinessCardItem[];
  companies: { id: string; name: string }[];
  statuses: CompanyStatusOption[];
  ocrEnabled: boolean;
  /** 会社詳細から使うとき、新規登録の取引先を固定する。 */
  defaultCompanyId?: string | null;
  /** 会社名を各行に出すか。会社詳細では自明なので隠す。 */
  showCompany?: boolean;
};

export function BusinessCardList({
  cards,
  companies,
  statuses,
  ocrEnabled,
  defaultCompanyId,
  showCompany = true,
}: BusinessCardListProps) {
  const editSheet = useSheetTarget<BusinessCardItem>();
  const deleteDialog = useSheetTarget<BusinessCardItem>();

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => editSheet.show(undefined)}>
          <PlusIcon />
          名刺を登録
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="border bg-card">
          <EmptyState>
            名刺がまだありません。「名刺を登録」から撮影するか、手で入力してください。
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y border bg-card">
          {cards.map((card) => (
            <li key={card.id} className="flex items-start gap-3 px-3 py-3">
              {card.imageUrl && (
                // 署名付き URL は発行のたびに変わるので next/image の最適化が効かない
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-16 w-24 shrink-0 border object-cover sm:h-14"
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <CardStatusBadge card={card} statuses={statuses} />
                  <span className="text-sm font-medium">{card.fullName}</span>
                  {card.fullNameKana && (
                    <span className="text-xs text-muted-foreground">{card.fullNameKana}</span>
                  )}
                  <span className="border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                    {CARD_SOURCE_LABELS[card.source]}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {showCompany && card.companyName && <span>{card.companyName}</span>}
                  {[card.department, card.title].filter(Boolean).length > 0 && (
                    <span>{[card.department, card.title].filter(Boolean).join(" ")}</span>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {card.email && (
                    <a
                      href={`mailto:${card.email}`}
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    >
                      <MailIcon className="size-3" />
                      {card.email}
                    </a>
                  )}
                  {card.phone && (
                    <a
                      href={`tel:${card.phone}`}
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    >
                      <PhoneIcon className="size-3" />
                      {card.phone}
                    </a>
                  )}
                  {card.mobile && (
                    <a
                      href={`tel:${card.mobile}`}
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    >
                      <SmartphoneIcon className="size-3" />
                      {card.mobile}
                    </a>
                  )}
                  {card.digitalCardUrl && (
                    <a
                      href={card.digitalCardUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    >
                      <ExternalLinkIcon className="size-3" />
                      電子名刺
                    </a>
                  )}
                </div>

                {card.note && (
                  <p className="mt-1.5 text-xs whitespace-pre-wrap text-muted-foreground">
                    {card.note}
                  </p>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label={`${card.fullName} の操作`}>
                      <EllipsisVerticalIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-auto min-w-32">
                  <DropdownMenuItem onClick={() => editSheet.show(card)}>
                    <PencilIcon />
                    編集
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => deleteDialog.show(card)}>
                    <Trash2Icon />
                    削除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <BusinessCardSheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        card={editSheet.target}
        defaultCompanyId={defaultCompanyId}
        companies={companies}
        statuses={statuses}
        ocrEnabled={ocrEnabled}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`「${deleteDialog.target?.fullName}」の名刺を削除しますか？`}
        description="この操作は取り消せません。保存した名刺画像も一緒に削除されます。"
        onConfirm={() => api.deleteBusinessCard(deleteDialog.target?.id as string)}
      />
    </>
  );
}

/**
 * 名刺そのものの進み具合。押してその場で変えられる。
 *
 * 会社に属さない相手（個人事業主・知人など）も、これで単独で追える。
 */
function CardStatusBadge({
  card,
  statuses,
}: {
  card: BusinessCardItem;
  statuses: CompanyStatusOption[];
}) {
  const { run, pending } = useApiMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={pending}
            aria-label={`${card.fullName} のステータスを変更（現在: ${card.statusName ?? "未設定"}）`}
            className={cn(
              "shrink-0 border px-1.5 py-0.5 text-[0.625rem] font-medium whitespace-nowrap transition-colors",
              card.statusName
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground",
              pending && "opacity-60"
            )}
          >
            {card.statusName ?? "未設定"}
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-auto min-w-36">
        {/* DropdownMenuLabel は Group の中でしか使えない */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>ステータスを変更</DropdownMenuLabel>
          {statuses.map((status) => (
            <DropdownMenuItem
              key={status.id}
              disabled={status.id === card.statusId}
              onClick={() =>
                run(() => api.setBusinessCardStatus(card.id, status.id), { silent: true })
              }
            >
              {status.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={card.statusId === null}
            onClick={() => run(() => api.setBusinessCardStatus(card.id, ""), { silent: true })}
          >
            未設定に戻す
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
