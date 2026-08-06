"use client";

import { ExternalLinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { CredentialItem } from "@/features/credentials/schema";
import { SecretCell } from "@/components/credentials/secret-cell";
import { EmptyState } from "@/components/shared/page-header";
import { formatDate } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CredentialTableProps = {
  credentials: CredentialItem[];
  onEdit: (credential: CredentialItem) => void;
  onDelete: (credential: CredentialItem) => void;
};

// border-collapse 下だと <thead> への sticky が効かないブラウザがあるため、
// border-separate + 各 <th> に sticky を当てる。
const headCell =
  "sticky top-0 z-10 border-b bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const bodyCell = "border-b px-3 py-2 align-middle";

const dash = <span className="text-muted-foreground">—</span>;

export function CredentialTable({ credentials, onEdit, onDelete }: CredentialTableProps) {
  if (credentials.length === 0) {
    return <EmptyState>まだ登録がありません。</EmptyState>;
  }

  return (
    <>
      {/* 幅が取れる画面では表。列が多いので横スクロールさせない。 */}
      <div className="hidden max-h-[60vh] overflow-auto lg:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className={headCell}>
                名称
              </th>
              <th scope="col" className={headCell}>
                ユーザー名 / ID
              </th>
              <th scope="col" className={headCell}>
                パスワード
              </th>
              <th scope="col" className={headCell}>
                URL
              </th>
              <th scope="col" className={headCell}>
                メモ
              </th>
              <th scope="col" className={headCell}>
                登録者
              </th>
              <th scope="col" className={headCell}>
                更新日
              </th>
              <th scope="col" className={cn(headCell, "text-right")}>
                操作
              </th>
            </tr>
          </thead>

          <tbody>
            {credentials.map((credential) => (
              <tr key={credential.id} className="transition-colors hover:bg-muted/40">
                <td className={cn(bodyCell, "font-medium")}>{credential.name}</td>

                <td className={bodyCell}>{credential.username ?? dash}</td>

                <td className={bodyCell}>
                  <SecretCell
                    credentialId={credential.id}
                    field="password"
                    hasValue={credential.hasPassword}
                  />
                </td>

                <td className={bodyCell}>
                  {credential.url ? <UrlLink url={credential.url} /> : dash}
                </td>

                <td className={bodyCell}>
                  <SecretCell
                    credentialId={credential.id}
                    field="notes"
                    hasValue={credential.hasNotes}
                  />
                </td>

                <td className={cn(bodyCell, "whitespace-nowrap")}>
                  {credential.createdBy ?? dash}
                </td>

                <td className={cn(bodyCell, "whitespace-nowrap text-muted-foreground")}>
                  {formatDate(new Date(credential.updatedAt))}
                </td>

                <td className={cn(bodyCell, "text-right")}>
                  <RowActions
                    credential={credential}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 狭い画面ではカード。表を横スクロールさせるとパスワードが探しにくい。 */}
      <ul className="divide-y lg:hidden">
        {credentials.map((credential) => (
          <li key={credential.id} className="flex flex-col gap-2 px-3 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">{credential.name}</p>
                {credential.username && (
                  <p className="mt-0.5 text-xs break-all text-muted-foreground">
                    {credential.username}
                  </p>
                )}
              </div>
              <RowActions credential={credential} onEdit={onEdit} onDelete={onDelete} />
            </div>

            <dl className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center gap-2">
                <dt className="w-16 shrink-0 text-muted-foreground">パスワード</dt>
                <dd className="min-w-0">
                  <SecretCell
                    credentialId={credential.id}
                    field="password"
                    hasValue={credential.hasPassword}
                  />
                </dd>
              </div>

              <div className="flex items-center gap-2">
                <dt className="w-16 shrink-0 text-muted-foreground">メモ</dt>
                <dd className="min-w-0">
                  <SecretCell
                    credentialId={credential.id}
                    field="notes"
                    hasValue={credential.hasNotes}
                  />
                </dd>
              </div>

              {credential.url && (
                <div className="flex items-center gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground">URL</dt>
                  <dd className="min-w-0">
                    <UrlLink url={credential.url} />
                  </dd>
                </div>
              )}
            </dl>

            <p className="text-[0.625rem] text-muted-foreground">
              登録者 {credential.createdBy ?? "—"} ・ 更新{" "}
              {formatDate(new Date(credential.updatedAt))}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function UrlLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-[16rem] items-center gap-1 truncate text-primary underline-offset-4 hover:underline"
    >
      <span className="truncate">{url}</span>
      <ExternalLinkIcon className="size-3 shrink-0" />
    </a>
  );
}

function RowActions({
  credential,
  onEdit,
  onDelete,
}: {
  credential: CredentialItem;
  onEdit: (credential: CredentialItem) => void;
  onDelete: (credential: CredentialItem) => void;
}) {
  return (
    <div className="flex shrink-0 justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onEdit(credential)}
        aria-label={`${credential.name} を編集`}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onDelete(credential)}
        aria-label={`${credential.name} を削除`}
      >
        <Trash2Icon className="text-destructive" />
      </Button>
    </div>
  );
}
