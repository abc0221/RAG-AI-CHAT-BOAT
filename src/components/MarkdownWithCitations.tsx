import { Check, Copy } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import type { RetrievedSource } from "../types/rag";

interface MarkdownWithCitationsProps {
  content: string;
  sources: RetrievedSource[];
  activeCitationIndex: number | null;
  onSelectCitation: (citationIndex: number) => void;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  return (
    <div className="my-3 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-slate-200 bg-slate-100/70">
        <span className="font-mono text-[11px] text-slate-500">
          {language || "snippet"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded px-1"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[13px] leading-relaxed font-mono text-slate-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownWithCitations({
  content,
  sources,
  activeCitationIndex,
  onSelectCitation,
}: MarkdownWithCitationsProps) {
  const validSourceNumbers = new Set(sources.map((s) => s.citationIndex));

  const renderTextWithCitations = (text: string, keyPrefix: string): ReactNode[] => {
    const parts = text.split(/(\[\d+(?:\s*,\s*\d+)*\])/g);
    const nodes: ReactNode[] = [];

    parts.forEach((part, idx) => {
      const citationMatch = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
      if (citationMatch) {
        const nums = citationMatch[1]
          .split(",")
          .map((n) => Number(n.trim()))
          .filter((n) => !Number.isNaN(n));

        const allValid = nums.length > 0 && nums.every((n) => validSourceNumbers.has(n));
        if (allValid) {
          nodes.push(
            <span key={`${keyPrefix}-cit-${idx}`} className="inline-flex items-center gap-0.5 mx-0.5 align-baseline">
              {nums.map((num) => {
                const isSelected = activeCitationIndex === num;
                const matched = sources.find((s) => s.citationIndex === num);
                return (
                  <button
                    key={`${keyPrefix}-cit-${idx}-${num}`}
                    type="button"
                    onClick={() => onSelectCitation(num)}
                    title={
                      matched
                        ? `Inspect [${num}] ${matched.documentTitle} (${(matched.similarity * 100).toFixed(1)}% match)`
                        : `Inspect source ${num}`
                    }
                    className={`inline-flex items-center justify-center min-w-[1.35rem] h-5 px-1 text-[11px] font-mono font-medium rounded border transition-colors tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </span>
          );
          return;
        }
      }

      if (part.length > 0) {
        nodes.push(<Fragment key={`${keyPrefix}-txt-${idx}`}>{part}</Fragment>);
      }
    });

    return nodes;
  };

  const renderInline = (line: string, keyPrefix: string): ReactNode[] => {
    const tokens = line.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    const result: ReactNode[] = [];

    tokens.forEach((token, idx) => {
      if (!token) {
        return;
      }
      if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
        result.push(
          <code
            key={`${keyPrefix}-code-${idx}`}
            className="font-mono text-[0.875em] px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200/80"
          >
            {token.slice(1, -1)}
          </code>
        );
        return;
      }
      if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
        result.push(
          <strong key={`${keyPrefix}-bold-${idx}`} className="font-semibold text-slate-900">
            {renderTextWithCitations(token.slice(2, -2), `${keyPrefix}-b-${idx}`)}
          </strong>
        );
        return;
      }
      if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
        result.push(
          <em key={`${keyPrefix}-em-${idx}`} className="italic">
            {renderTextWithCitations(token.slice(1, -1), `${keyPrefix}-e-${idx}`)}
          </em>
        );
        return;
      }
      result.push(...renderTextWithCitations(token, `${keyPrefix}-t-${idx}`));
    });

    return result;
  };

  const blocks: ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <CodeBlock key={`block-${i}`} code={codeLines.join("\n")} language={language} />
      );
      continue;
    }

    if (trimmed === "") {
      i += 1;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) {
        blocks.push(
          <h3 key={`h-${i}`} className="font-display text-lg font-semibold text-slate-900 mt-4 mb-2 first:mt-0">
            {renderInline(text, `h1-${i}`)}
          </h3>
        );
      } else if (level === 2) {
        blocks.push(
          <h4 key={`h-${i}`} className="font-display text-base font-semibold text-slate-900 mt-4 mb-1.5 first:mt-0">
            {renderInline(text, `h2-${i}`)}
          </h4>
        );
      } else {
        blocks.push(
          <h5 key={`h-${i}`} className="text-sm font-semibold text-slate-900 mt-3 mb-1 first:mt-0">
            {renderInline(text, `h3-${i}`)}
          </h5>
        );
      }
      i += 1;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2.5 space-y-1.5 pl-5 list-disc marker:text-slate-400">
          {items.map((item, idx) => (
            <li key={`uli-${i}-${idx}`} className="text-[15px] leading-relaxed text-slate-700">
              {renderInline(item, `uli-${i}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-2.5 space-y-1.5 pl-5 list-decimal marker:text-slate-500 marker:font-mono marker:text-xs">
          {items.map((item, idx) => (
            <li key={`oli-${i}-${idx}`} className="text-[15px] leading-relaxed text-slate-700">
              {renderInline(item, `oli-${i}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (gather contiguous text lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^#{1,3}\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }

    blocks.push(
      <p key={`p-${i}`} className="my-2.5 text-[15px] leading-[1.65] text-slate-700 first:mt-0 last:mb-0">
        {renderInline(paraLines.join(" "), `p-${i}`)}
      </p>
    );
  }

  return <div className="max-w-[70ch]">{blocks}</div>;
}
