import { CopyButton } from "@/components/copy-button";

// Lightweight, restrained shell-syntax coloring.
function classify(tok: string): string {
  if (/^["']/.test(tok)) return "text-[var(--text)]";
  if (/^https?:\/\//.test(tok)) return "text-[var(--accent)]";
  if (/^-{1,2}[A-Za-z]/.test(tok)) return "text-[var(--text-muted)]";
  return "";
}

function Line({ line }: { line: string }) {
  if (line.trimStart().startsWith("#")) {
    return <div className="text-[var(--text-faint)]">{line || " "}</div>;
  }
  const tokens = line.match(/("[^"]*"|'[^']*'|\s+|[^\s]+)/g) ?? [];
  if (tokens.length === 0) return <div> </div>;
  return (
    <div>
      {tokens.map((t, i) => {
        const c = classify(t);
        return c ? (
          <span key={i} className={c}>
            {t}
          </span>
        ) : (
          <span key={i}>{t}</span>
        );
      })}
    </div>
  );
}

interface CodeBlockProps {
  code: string;
  label?: string;
}

export function CodeBlock({ code, label = "bash" }: CodeBlockProps) {
  return (
    <div className="neu-inset overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
          <span className="ml-2 font-mono text-xs text-[var(--text-faint)]">
            {label}
          </span>
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto px-5 pb-4 text-[13px] leading-relaxed text-[var(--text-muted)]">
        <code className="font-mono">
          {code.split("\n").map((line, i) => (
            <Line key={i} line={line} />
          ))}
        </code>
      </pre>
    </div>
  );
}
