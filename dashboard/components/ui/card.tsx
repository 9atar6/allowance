import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("neu p-7", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-faint)]",
        className,
      )}
      {...props}
    />
  );
}
