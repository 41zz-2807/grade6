import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-white shadow-sm", className)}>
      {(title || description) && (
        <div className="border-b px-4 py-3 sm:px-5">
          {title ? <h2 className="text-sm font-semibold sm:text-base">{title}</h2> : null}
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{description}</p>
          ) : null}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Label + input/select/textarea dengan pesan error yang konsisten. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export const selectClass = inputClass;

export function StatusMessage({
  kind,
  children,
}: {
  kind: "success" | "error" | "info";
  children: React.ReactNode;
}) {
  if (!children) return null;
  const tones = {
    success: "bg-emerald-50 text-emerald-800",
    error: "bg-red-50 text-red-700",
    info: "bg-blue-50 text-blue-800",
  } as const;
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("rounded-md px-3 py-2 text-sm", tones[kind])}>
      {children}
    </p>
  );
}
