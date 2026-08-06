import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  /** 右側に置く操作ボタン群。モバイルでは下に折り返る。 */
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** 枠線で区切る箱。角は落とさない（globals.css の --radius: 0 に従う）。 */
export function Panel({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return <section className={cn("border bg-card", className)} {...props} />;
}

export function PanelHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex items-center gap-3 border-b bg-card px-3 py-2.5 sm:px-4", className)}
      {...props}
    />
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
