import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownResponseProps {
  text: string;
}

/**
 * Renders an AI response as formatted Markdown.
 * Supports GFM: tables, strikethrough, task lists, autolinks.
 */
export function MarkdownResponse({ text }: MarkdownResponseProps): React.ReactElement {
  return (
    <div
      className="jlh-markdown"
      style={{
        flex: 1,
        overflow: "auto",
        border: "1px solid #d0d0d0",
        borderRadius: "4px",
        padding: "8px 12px",
        fontSize: "12px",
        fontFamily: "Segoe UI, sans-serif",
        lineHeight: "1.5",
        color: "#333",
        backgroundColor: "#fafafa",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
