"use client";

import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="text-sm font-semibold text-text-primary mt-2 mb-1">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="text-sm font-semibold text-text-primary mt-2 mb-1">{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className="text-sm font-medium text-text-primary mt-1.5 mb-0.5">{children}</h5>
  ),
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="ml-4 mb-1.5 space-y-0.5 list-disc marker:text-text-muted">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="ml-4 mb-1.5 space-y-0.5 list-decimal marker:text-text-muted">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-text-primary">{children}</strong>
  ),
  em: ({ children }) => <em className="text-text-tertiary italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/30 pl-3 my-1.5 text-text-tertiary italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="text-xs px-1.5 py-0.5 rounded bg-surface-2 text-accent font-mono">
      {children}
    </code>
  ),
  a: ({ children, href }) => (
    <a
      className="text-accent underline underline-offset-2 hover:opacity-80"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
};

interface MarkdownContentProps {
  children: string;
  className?: string;
  /**
   * Whether to render an "AI 生成" badge alongside the rendered content.
   * Required by 《生成式人工智能服务管理暂行办法》 for visible AI-generated
   * text. Defaults to false so call sites can opt-in (e.g. judge speeches,
   * round summaries, final report).
   */
  aiGenerated?: boolean;
  /** Position of the AI 生成 badge. Defaults to "footer". */
  aiBadgePosition?: "header" | "footer";
}

function normalizeMarkdownSource(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(
      /([。！？；：:，,、”"')）\]])[ \t]+(?=(\d+\.\s+|[-*•]\s+|>\s+))/g,
      "$1\n\n"
    );
}

function AiBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent border border-accent/15",
        className,
      )}
      title="本段内容由生成式人工智能（AI）生成，依《生成式人工智能服务管理暂行办法》进行标识"
    >
      AI 生成
    </span>
  );
}

export default function MarkdownContent({
  children,
  className,
  aiGenerated = false,
  aiBadgePosition = "footer",
}: MarkdownContentProps) {
  return (
    <div className={clsx("text-[13px] leading-[1.7] text-text-secondary break-words", className)}>
      {aiGenerated && aiBadgePosition === "header" && (
        <div className="mb-1.5">
          <AiBadge />
        </div>
      )}
      <ReactMarkdown components={markdownComponents}>
        {normalizeMarkdownSource(children)}
      </ReactMarkdown>
      {aiGenerated && aiBadgePosition === "footer" && (
        <div className="mt-2 flex justify-end">
          <AiBadge />
        </div>
      )}
    </div>
  );
}
