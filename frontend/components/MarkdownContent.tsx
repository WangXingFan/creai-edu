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
}

function normalizeMarkdownSource(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(
      /([。！？；：:，,、”"')）\]])[ \t]+(?=(\d+\.\s+|[-*•]\s+|>\s+))/g,
      "$1\n\n"
    );
}

export default function MarkdownContent({
  children,
  className,
}: MarkdownContentProps) {
  return (
    <div className={clsx("text-[13px] leading-[1.7] text-text-secondary break-words", className)}>
      <ReactMarkdown components={markdownComponents}>
        {normalizeMarkdownSource(children)}
      </ReactMarkdown>
    </div>
  );
}
