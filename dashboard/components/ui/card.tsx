import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass rounded-[var(--radius)] p-6", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]",
        className,
      )}
      {...props}
    />
  );
}
