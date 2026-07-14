"use client";

import { ExternalLinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { CredentialItem } from "@/features/credentials/schema";
import { SecretCell } from "@/components/credentials/secret-cell";
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

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function CredentialTable({ credentials, onEdit, onDelete }: CredentialTableProps) {
  if (credentials.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        まだ登録がありません。
      </p>
    );
  }

  return (
    // スクロールをこのコンテナに閉じ込めることで、上の sticky ヘッダーが固定される
    <div className="max-h-[60vh] overflow-auto">
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

              <td className={bodyCell}>
                {credential.username ?? <span className="text-muted-foreground">—</span>}
              </td>

              <td className={bodyCell}>
                <SecretCell
                  credentialId={credential.id}
                  field="password"
                  hasValue={credential.hasPassword}
                />
              </td>

              <td className={bodyCell}>
                {credential.url ? (
                  <a
                    href={credential.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-[16rem] items-center gap-1 truncate text-primary underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{credential.url}</span>
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>

              <td className={bodyCell}>
                <SecretCell
                  credentialId={credential.id}
                  field="notes"
                  hasValue={credential.hasNotes}
                />
              </td>

              <td className={cn(bodyCell, "whitespace-nowrap")}>
                {credential.createdBy ?? <span className="text-muted-foreground">—</span>}
              </td>

              <td className={cn(bodyCell, "whitespace-nowrap text-muted-foreground")}>
                {dateFormatter.format(new Date(credential.updatedAt))}
              </td>

              <td className={cn(bodyCell, "text-right")}>
                <div className="flex justify-end gap-1">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
