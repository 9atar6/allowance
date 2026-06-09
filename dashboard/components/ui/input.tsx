import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl neu px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] transition-colors focus:border-[var(--indigo-bright)] focus:outline-none";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "font-mono leading-relaxed", className)} {...props} />;
}
