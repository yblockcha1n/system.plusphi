"use client";

import Link from "next/link";
import { EllipsisVerticalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { api } from "@/lib/api-client";
import type { CompanyItem } from "@/features/companies/schema";
import type { CompanyStatusOption } from "@/features/company-statuses/schema";
import { CompanySheet } from "@/components/companies/company-sheet";
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

type CompanyListProps = {
  companies: CompanyItem[];
  statuses: CompanyStatusOption[];
  emptyMessage?: string;
};

export function CompanyList({ companies, statuses, emptyMessage }: CompanyListProps) {
  const editSheet = useSheetTarget<CompanyItem>();
  const deleteDialog = useSheetTarget<CompanyItem>();

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => editSheet.show(undefined)}>
          <PlusIcon />
          取引先を登録
        </Button>
      </div>

      {companies.length === 0 ? (
        <div className="border bg-card">
          <EmptyState>
            {emptyMessage ?? "取引先がまだありません。「取引先を登録」から追加してください。"}
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y border bg-card">
          {companies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              statuses={statuses}
              onEdit={() => editSheet.show(company)}
              onDelete={() => deleteDialog.show(company)}
            />
          ))}
        </ul>
      )}

      <CompanySheet
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        company={editSheet.target}
        statuses={statuses}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.onOpenChange}
        title={`「${deleteDialog.target?.name}」を削除しますか？`}
        description={
          deleteDialog.target && deleteDialog.target.cardCount > 0
            ? `この取引先の名刺 ${deleteDialog.target.cardCount} 枚は「会社未設定」になります。名刺自体は消えません。`
            : "この操作は取り消せません。"
        }
        onConfirm={() => api.deleteCompany(deleteDialog.target?.id as string)}
      />
    </>
  );
}

function CompanyRow({
  company,
  statuses,
  onEdit,
  onDelete,
}: {
  company: CompanyItem;
  statuses: CompanyStatusOption[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { run, pending } = useApiMutation();

  return (
    <li className={cn("flex items-start gap-2 px-3 py-3", pending && "opacity-60")}>
      {/* ステータスはタスクの状態バッジと同じく、押してその場で変えられる */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={pending}
              aria-label={`${company.name} のステータスを変更（現在: ${company.statusName ?? "未設定"}）`}
              className={cn(
                "mt-0.5 shrink-0 border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
                company.statusName
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground"
              )}
            >
              {company.statusName ?? "未設定"}
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-auto min-w-40">
          {/* DropdownMenuLabel は Group の中でしか使えない */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>ステータスを変更</DropdownMenuLabel>
            {statuses.map((status) => (
              <DropdownMenuItem
                key={status.id}
                disabled={status.id === company.statusId}
                onClick={() => run(() => api.setCompanyStatus(company.id, status.id), { silent: true })}
              >
                {status.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={company.statusId === null}
              onClick={() => run(() => api.setCompanyStatus(company.id, ""), { silent: true })}
            >
              未設定に戻す
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="min-w-0 flex-1">
        <Link
          href={`/companies/${company.id}`}
          className="block text-sm font-medium underline-offset-4 hover:underline"
        >
          <span className="break-words">{company.name}</span>
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span data-numeric>名刺 {company.cardCount} 枚</span>
          {company.phone && <span>{company.phone}</span>}
          {company.address && <span className="truncate">{company.address}</span>}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`${company.name} の操作`}>
              <EllipsisVerticalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-auto min-w-32">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon />
            編集
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
