import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  const styles = {
    primary: "bg-white text-black hover:bg-neutral-200",
    ghost: "bg-transparent text-neutral-300 hover:bg-neutral-800",
    danger: "bg-red-600 text-white hover:bg-red-500",
  }[variant];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}
