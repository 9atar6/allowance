"use client";

import { useState } from "react";

// Lightweight shell-syntax coloring on the obsidian terminal.
function classify(tok: string): string {
  if (/^["']/.test(tok)) return "text-amber-300";
  if (/^https?:\/\//.test(tok)) return "text-[var(--indigo-bright)]";
  if (/^-{1,2}[A-Za-z]/.test(tok)) return "text-sky-400";
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
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="glass-strong overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
          <span className="ml-2 font-mono text-xs text-[var(--text-faint)]">
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg px-2 py-1 font-mono text-xs text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 text-[13px] leading-relaxed text-[var(--text)]">
        <code className="font-mono">
          {code.split("\n").map((line, i) => (
            <Line key={i} line={line} />
          ))}
        </code>
      </pre>
    </div>
  );
}
