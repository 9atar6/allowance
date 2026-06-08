"use client";

import { useState } from "react";

// Lightweight shell-syntax coloring. Tokens: quoted strings, flags, URLs.
// Colors come in light/dark pairs so the block reads in both themes.
function classify(tok: string): string {
  if (/^["']/.test(tok)) return "text-amber-700 dark:text-amber-300";
  if (/^https?:\/\//.test(tok)) return "text-emerald-700 dark:text-emerald-400";
  if (/^-{1,2}[A-Za-z]/.test(tok)) return "text-sky-700 dark:text-sky-400";
  return "";
}

function Line({ line }: { line: string }) {
  if (line.trimStart().startsWith("#")) {
    return <div className="text-neutral-500">{line || " "}</div>;
  }
  const tokens = line.match(/("[^"]*"|'[^']*'|\s+|[^\s]+)/g) ?? [];
  if (tokens.length === 0) return <div>{" "}</div>;
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
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-[#f6f8fa] shadow-sm dark:border-neutral-800 dark:bg-[#0d1117] dark:shadow-xl">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
          <span className="ml-2 font-mono text-xs text-neutral-500">{label}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded px-2 py-1 font-mono text-xs text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 text-[13px] leading-relaxed text-neutral-800 dark:text-neutral-200">
        <code className="font-mono">
          {code.split("\n").map((line, i) => (
            <Line key={i} line={line} />
          ))}
        </code>
      </pre>
    </div>
  );
}
