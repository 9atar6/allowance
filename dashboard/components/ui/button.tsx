import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  const styles = {
    primary: "btn-accent",
    ghost: "neu-sm pressable text-[var(--text-muted)] hover:text-[var(--text)]",
    // Destructive: stamp-red outline that fills on hover/confirm. Red is
    // earned — it only appears where money stops.
    danger:
      "rounded-[4px] border border-[var(--stamp)] text-[var(--stamp)] transition-colors hover:bg-[var(--stamp)] hover:text-[var(--paper)]",
  }[variant];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium disabled:pointer-events-none disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}
