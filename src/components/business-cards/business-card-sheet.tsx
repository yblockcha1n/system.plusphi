"use client";

import { useState } from "react";
import { FileUpIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { api, upsert } from "@/lib/api-client";
import {
  CARD_SOURCE_LABELS,
  type BusinessCardItem,
  type CardSource,
  type ScannedCard,
} from "@/features/business-cards/schema";
import { parseVCard } from "@/features/business-cards/vcard";
import type { CompanyStatusOption } from "@/features/company-statuses/schema";
import { NONE_VALUE } from "@/lib/form";
import { CardCapture, type CaptureResult } from "@/components/business-cards/card-capture";
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

type BusinessCardSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 未指定なら新規登録 */
  card?: BusinessCardItem;
  /** 会社詳細から開いたときにあらかじめ選んでおく取引先 */
  defaultCompanyId?: string | null;
  companies: { id: string; name: string }[];
  statuses: CompanyStatusOption[];
  /** PERPLEXITY_API_KEY が設定されているか。未設定なら読み取りボタンを出さない。 */
  ocrEnabled: boolean;
};

/** 読み取り・取り込みでフォームへ流し込む値。制御された入力にしている項目だけ。 */
type Draft = {
  fullName: string;
  fullNameKana: string;
  department: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
};

export function BusinessCardSheet({
  open,
  onOpenChange,
  card,
  defaultCompanyId,
  companies,
  statuses,
  ocrEnabled,
}: BusinessCardSheetProps) {
  const { state, pending, onSubmit } = useApiForm(
    (values) => upsert(values, api.createBusinessCard, api.updateBusinessCard),
    () => onOpenChange(false)
  );
  const isEdit = Boolean(card);

  const initialCompany = card?.companyId ?? defaultCompanyId ?? NONE_VALUE;
  const initialStatus = card?.statusId ?? NONE_VALUE;
  const initialSource: CardSource = card?.source ?? "manual";

  const initialDraft: Draft = {
    fullName: card?.fullName ?? "",
    fullNameKana: card?.fullNameKana ?? "",
    department: card?.department ?? "",
    title: card?.title ?? "",
    email: card?.email ?? "",
    phone: card?.phone ?? "",
    mobile: card?.mobile ?? "",
  };

  const [companyId, setCompanyId] = useState<string>(initialCompany);
  const [statusId, setStatusId] = useState<string>(initialStatus);
  const [source, setSource] = useState<CardSource>(initialSource);
  /*
   * 読み取れた会社名。取引先が選ばれていないときだけ保存時に使い、
   * 同名が無ければサーバー側で取引先を作る。ここで作らないのは、
   * 登録をやめた場合に空の取引先が残らないようにするため。
   */
  const [companyName, setCompanyName] = useState("");
  const [draft, setDraft] = useState<Draft>(initialDraft);
  // 読み取り時に保存された画像のパス。空なら「変えない」（編集時は既存が残る）。
  const [imagePath, setImagePath] = useState("");

  // 開き直したときに前回の入力・選択が残らないようにする
  const formKey = useFormResetKey(open, () => {
    setCompanyId(initialCompany);
    setStatusId(initialStatus);
    setSource(initialSource);
    setCompanyName("");
    setDraft(initialDraft);
    setImagePath("");
  });

  /** 読み取り結果・vCard をフォームへ流し込む。空の項目は今の値を残す。 */
  const applyScanned = (scanned: ScannedCard, candidates: { id: string; name: string }[]) => {
    setDraft((current) => ({
      fullName: scanned.fullName ?? current.fullName,
      fullNameKana: scanned.fullNameKana ?? current.fullNameKana,
      department: scanned.department ?? current.department,
      title: scanned.title ?? current.title,
      email: scanned.email ?? current.email,
      phone: scanned.phone ?? current.phone,
      mobile: scanned.mobile ?? current.mobile,
    }));

    // 読めた会社名は控えておく。取引先が選ばれないまま保存されたら、
    // サーバー側が同名を探し、無ければ作る。
    setCompanyName(scanned.companyName ?? "");

    if (candidates.length === 1) {
      setCompanyId(candidates[0].id);
      toast.info(`取引先「${candidates[0].name}」を選びました。違う場合は変えてください。`);
    } else if (candidates.length > 1) {
      toast.info("似た名前の取引先が複数あります。どれかを選んでください。");
    } else if (scanned.companyName) {
      toast.info(`保存すると取引先「${scanned.companyName}」も作られます。`);
    }
  };

  const handleCapture = (result: CaptureResult) => {
    setImagePath(result.imagePath);
    // スクリーンショットか紙かは人にしか分からないので、既定は紙にしておく
    setSource((current) => (current === "manual" ? "paper" : current));
    applyScanned(result.card, result.candidates);
  };

  const handleVCard = async (file: File) => {
    try {
      const fields = parseVCard(await file.text());

      if (!fields.fullName && !fields.companyName && !fields.email) {
        toast.error("vCard として読み取れませんでした。");
        return;
      }

      setSource("vcard");
      applyScanned(
        {
          companyName: fields.companyName,
          fullName: fields.fullName,
          fullNameKana: fields.fullNameKana,
          department: fields.department,
          title: fields.title,
          email: fields.email,
          phone: fields.phone,
          mobile: fields.mobile,
          website: fields.website,
          address: fields.address,
        },
        // vCard には会社の id が無いので、名前の一致は画面側では判断しない
        []
      );
      toast.success("vCard を読み込みました。");
    } catch {
      toast.error("ファイルを読めませんでした。");
    }
  };

  const companyOptions: SelectOption[] = [
    {
      value: NONE_VALUE,
      // 個人事業主や知人など、どこの会社にも属さない相手のための選択肢
      label: companyName ? `${companyName}（保存時に作成）` : "会社に属さない（個人）",
    },
    ...companies.map((company) => ({ value: company.id, label: company.name })),
  ];

  // 使用停止にされたステータスが付いていると選択肢から消えるので、現在値だけ足す
  const missingStatus =
    card?.statusId && !statuses.some((status) => status.id === card.statusId)
      ? [{ value: card.statusId, label: `${card.statusName ?? "不明"}（使用停止中）` }]
      : [];

  const statusOptions: SelectOption[] = [
    { value: NONE_VALUE, label: "ステータスなし" },
    ...statuses.map((status) => ({ value: status.id, label: status.name })),
    ...missingStatus,
  ];

  const sourceOptions: SelectOption[] = (
    Object.keys(CARD_SOURCE_LABELS) as CardSource[]
  ).map((value) => ({ value, label: CARD_SOURCE_LABELS[value] }));

  const field = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "名刺を編集" : "名刺を登録"}</SheetTitle>
          <SheetDescription>
            撮影か vCard から項目を埋められます。読み取りは間違えることがあるので、
            保存する前に内容を確かめてください。
          </SheetDescription>
        </SheetHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="@container flex min-w-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto p-4">
            {card && <input type="hidden" name="id" value={card.id} />}
            <input type="hidden" name="imagePath" value={imagePath} />
            <input type="hidden" name="companyName" value={companyName} />

            {/* 取り込みの入り口。ここで埋めてから下の項目を直す流れ。 */}
            <div className="flex flex-col gap-2 border bg-muted/30 p-3">
              <CardCapture
                onScanned={handleCapture}
                ocrEnabled={ocrEnabled}
                previewUrl={card?.imageUrl}
                onClear={() => setImagePath("")}
              />

              <label className="flex cursor-pointer items-center justify-center gap-1.5 border bg-background px-2.5 py-2 text-sm font-medium transition-colors hover:bg-muted">
                <FileUpIcon className="size-4" />
                vCard（.vcf）から取り込む
                <input
                  type="file"
                  accept=".vcf,text/vcard,text/x-vcard"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleVCard(file);
                    event.target.value = "";
                  }}
                />
              </label>

              {!ocrEnabled && (
                <p className="text-xs text-muted-foreground">
                  読み取りは未設定です。画像の保存と手入力、vCard の取り込みは使えます。
                </p>
              )}
            </div>

            <div className="grid gap-5 *:min-w-0 @md:grid-cols-2">
              <Field label="氏名" htmlFor="card-fullName" errors={state.fieldErrors?.fullName}>
                <Input id="card-fullName" name="fullName" required maxLength={100} {...field("fullName")} />
              </Field>

              <Field
                label="ふりがな"
                htmlFor="card-fullNameKana"
                errors={state.fieldErrors?.fullNameKana}
              >
                <Input id="card-fullNameKana" name="fullNameKana" maxLength={100} {...field("fullNameKana")} />
              </Field>
            </div>

            <div className="grid gap-5 *:min-w-0 @md:grid-cols-2">
              <SelectField
                label="取引先"
                id="card-companyId"
                name="companyId"
                value={companyId}
                onValueChange={setCompanyId}
                options={companyOptions}
                errors={state.fieldErrors?.companyId}
                hint="個人や知人など、会社に属さない相手はそのままで構いません。"
              />

              <SelectField
                label="ステータス"
                id="card-statusId"
                name="statusId"
                value={statusId}
                onValueChange={setStatusId}
                options={statusOptions}
                errors={state.fieldErrors?.statusId}
                hint="この相手との進み具合。会社とは別に持てます。"
              />
            </div>

            <div className="grid gap-5 *:min-w-0 @md:grid-cols-2">
              <Field label="部署" htmlFor="card-department" errors={state.fieldErrors?.department}>
                <Input id="card-department" name="department" maxLength={100} {...field("department")} />
              </Field>

              <Field label="役職" htmlFor="card-title" errors={state.fieldErrors?.title}>
                <Input id="card-title" name="title" maxLength={100} {...field("title")} />
              </Field>
            </div>

            <Field label="メール" htmlFor="card-email" errors={state.fieldErrors?.email}>
              <Input id="card-email" name="email" type="email" maxLength={200} {...field("email")} />
            </Field>

            <div className="grid gap-5 *:min-w-0 @md:grid-cols-2">
              <Field label="電話" htmlFor="card-phone" errors={state.fieldErrors?.phone}>
                <Input id="card-phone" name="phone" inputMode="tel" maxLength={40} {...field("phone")} />
              </Field>

              <Field label="携帯" htmlFor="card-mobile" errors={state.fieldErrors?.mobile}>
                <Input id="card-mobile" name="mobile" inputMode="tel" maxLength={40} {...field("mobile")} />
              </Field>
            </div>

            <Field
              label="電子名刺の URL"
              htmlFor="card-digitalCardUrl"
              errors={state.fieldErrors?.digitalCardUrl}
              hint="Eight や Sansan などのプロフィールページ。カードから開けるようになります。"
            >
              <Input
                id="card-digitalCardUrl"
                name="digitalCardUrl"
                inputMode="url"
                maxLength={500}
                defaultValue={card?.digitalCardUrl ?? ""}
                placeholder="https://8card.net/p/..."
              />
            </Field>

            <div className="grid gap-5 *:min-w-0 @md:grid-cols-2">
              <SelectField
                label="入手経路"
                id="card-source"
                name="source"
                value={source}
                onValueChange={(value) => setSource(value as CardSource)}
                options={sourceOptions}
                errors={state.fieldErrors?.source}
              />

              <Field
                label="受け取った日"
                htmlFor="card-receivedAt"
                errors={state.fieldErrors?.receivedAt}
              >
                <Input
                  id="card-receivedAt"
                  name="receivedAt"
                  type="date"
                  defaultValue={card?.receivedAt ?? ""}
                />
              </Field>
            </div>

            <Field label="メモ" htmlFor="card-note" errors={state.fieldErrors?.note}>
              <Textarea
                id="card-note"
                name="note"
                rows={3}
                maxLength={2000}
                defaultValue={card?.note ?? ""}
                placeholder="どこで会ったか、何を話したか"
              />
            </Field>
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
