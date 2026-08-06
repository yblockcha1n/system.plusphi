import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor: string;
  errors?: string[];
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

/** ラベル・入力・補足・エラーの並びを揃えるためのラッパー。 */
export function Field({ label, htmlFor, errors, hint, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors?.map((error) => (
        <p key={error} className="text-xs text-destructive">
          {error}
        </p>
      ))}
    </div>
  );
}
