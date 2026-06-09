import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  const styles = {
    primary: "btn-glow",
    ghost: "neu text-[var(--text-muted)] hover:text-white",
    danger:
      "bg-red-500/90 text-white hover:bg-red-500 shadow-[0_10px_30px_-12px_rgba(239,68,68,0.6)]",
  }[variant];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}
