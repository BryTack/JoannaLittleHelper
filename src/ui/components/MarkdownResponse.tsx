import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { selectOccurrence, highlightMatches, selectParagraph, insertTextAtCursor, insertHtmlAtCursor } from "../../integrations/word/documentTools";

interface MenuState {
  x: number;
  y: number;
  text: string;
}

/** Parses [[Para N]], Para N, Paragraph N, or a bare integer. Returns 1-based number or null. */
function parseParaNumber(text: string): number | null {
  const m =
    text.match(/\[\[\s*[Pp]ara\s+(\d+)\s*\]\]/) ??
    text.match(/[Pp]ara(?:graph)?\s+(\d+)/) ??
    text.trim().replace(/^\D+|\D+$/g, "").match(/^(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 ? n : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(node: any): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value as string;
  if (node.type === "code") return (node.value as string) + "\n";
  if (!node.children) return "";
  const inner = (node.children as any[]).map(extractText).join("");
  if (node.type === "paragraph" || node.type === "heading") return inner + "\n\n";
  if (node.type === "listItem") return "• " + inner.trim() + "\n";
  return inner;
}

function markdownToText(markdown: string): string {
  return extractText(unified().use(remarkParse).use(remarkGfm).parse(markdown)).trim();
}

function markdownToHtml(markdown: string): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString();
}

const FOLLOW_UP_MENU = [
  { cat: "Clarify", items: [
    { label: "Explain in simpler terms",  q: "Explain this in simpler terms." },
    { label: "Give me an example",        q: "Give me an example of this." },
    { label: "Why is this the case?",     q: "Why is this the case?" },
    { label: "What does this mean?",      q: "What does this mean?" },
  ]},
  { cat: "Explore", items: [
    { label: "Tell me more",              q: "Tell me more about this." },
    { label: "What are the implications?",q: "What are the implications of this?" },
    { label: "What are the alternatives?",q: "What are the alternatives to this?" },
    { label: "Summarise this",            q: "Summarise this." },
  ]},
  { cat: "Document", items: [
    { label: "Is this in my document?",   q: "Is this mentioned in my document?" },
    { label: "How does this apply?",      q: "How does this apply to my document?" },
    { label: "Find similar text",         q: "Is there similar text elsewhere in my document?" },
  ]},
  { cat: "Verify", items: [
    { label: "Is this accurate?",         q: "Is this accurate?" },
    { label: "What are the risks?",       q: "What are the risks with this?" },
    { label: "Are there exceptions?",     q: "Are there exceptions to this?" },
  ]},
  { cat: "Transform", items: [
    { label: "Rewrite more formally",     q: "Rewrite this more formally." },
    { label: "Rewrite more concisely",    q: "Rewrite this more concisely." },
    { label: "Translate this",            q: "Translate this." },
  ]},
] as const;

const BOX: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  border: "1px solid #d0d0d0",
  borderRadius: "4px",
  padding: "8px 12px",
  fontSize: "14px",
  fontFamily: "Segoe UI, sans-serif",
  lineHeight: "1.5",
  color: "#333",
  backgroundColor: "#fafafa",
  width: "100%",
  boxSizing: "border-box",
};

const POPUP: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #c8c8c8",
  borderRadius: "4px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.20)",
  minWidth: "140px",
  fontSize: "12px",
  userSelect: "none",
  padding: "2px 0",
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  backgroundColor: "#e0e0e0",
  margin: "2px 0",
};

export function MarkdownResponse({ text, onFollowUp }: { text: string; onFollowUp?: (prompt: string) => void }): React.ReactElement {
  const [menu,          setMenu]          = useState<MenuState | null>(null);
  const [openSub,       setOpenSub]       = useState<string | null>(null);
  const [openCategory,  setOpenCategory]  = useState<string | null>(null);
  const [hoverId,       setHoverId]       = useState<string | null>(null);
  const [findState,     setFindState]     = useState<{ text: string; index: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside mousedown or Escape
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown",   onKey);
    };
  }, [menu]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeMenu() {
    setMenu(null);
    setOpenSub(null);
    setOpenCategory(null);
    setHoverId(null);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const sel = window.getSelection()?.toString() ?? "";
    setMenu({ x: e.clientX, y: e.clientY, text: sel });
    setOpenSub(null);
    setOpenCategory(null);
    setHoverId(null);
  }

  // ── Action handlers ───────────────────────────────────────────────────

  function handleCopy() {
    if (menu?.text) navigator.clipboard.writeText(menu.text);
    closeMenu();
  }

  async function handleFindFirst() {
    if (!menu?.text) return;
    const term = menu.text;
    closeMenu();
    setFindState({ text: term, index: 0 });
    await selectOccurrence(term, 0);
  }

  async function handleFindNext() {
    if (!menu?.text) return;
    const term = menu.text;
    const idx = findState?.text === term ? findState.index + 1 : 0;
    closeMenu();
    setFindState({ text: term, index: idx });
    await selectOccurrence(term, idx);
  }

  async function handleHighlightAll() {
    if (!menu?.text) return;
    const term = menu.text;
    closeMenu();
    await highlightMatches(term);
  }

  async function handleFindParagraph() {
    if (!menu) return;
    const n = parseParaNumber(menu.text);
    if (!n) return;
    closeMenu();
    await selectParagraph(n - 1);
  }

  async function handleInsertText() {
    const selection = menu?.text?.trim();
    closeMenu();
    await insertTextAtCursor(selection || markdownToText(text));
  }

  async function handleInsertFormatted() {
    const selection = menu?.text?.trim();
    closeMenu();
    if (selection) {
      await insertTextAtCursor(selection);
    } else {
      await insertHtmlAtCursor(markdownToHtml(text));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (!menu) {
    return (
      <div className="jlh-markdown" style={BOX} onContextMenu={handleContextMenu}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  const hasText    = !!menu.text.trim();
  const paraNum    = parseParaNumber(menu.text);
  const nearRight  = menu.x + 250 > window.innerWidth;
  const nearBottom = menu.y > window.innerHeight * 0.6;
  const menuTop    = Math.min(menu.y, window.innerHeight - 135);

  const subSide: React.CSSProperties = nearRight
    ? { right: "100%", left: "auto" }
    : { left: "100%" };

  const subVert: React.CSSProperties = nearBottom
    ? { bottom: 0, top: "auto" }
    : { top: 0 };

  function itemStyle(id: string, disabled: boolean): React.CSSProperties {
    return {
      padding: "5px 12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      cursor: disabled ? "default" : "pointer",
      color: disabled ? "#bbb" : "#222",
      backgroundColor: hoverId === id && !disabled ? "#e8f0fe" : "transparent",
      whiteSpace: "nowrap",
    };
  }

  return (
    <div className="jlh-markdown" style={BOX} onContextMenu={handleContextMenu}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>

      {/* ── Context menu ──────────────────────────────────────────── */}
      <div
        ref={menuRef}
        style={{ position: "fixed", top: menuTop, left: menu.x, zIndex: 9999, ...POPUP }}
      >

        {/* Copy */}
        <div
          style={itemStyle("copy", !hasText)}
          onMouseEnter={() => { setHoverId("copy"); setOpenSub(null); }}
          onMouseLeave={() => setHoverId(null)}
          onClick={hasText ? handleCopy : undefined}
        >
          Copy
        </div>

        <div style={DIVIDER} />

        {/* Find → submenu */}
        <div
          style={{
            ...itemStyle("find", !hasText),
            position: "relative",
            backgroundColor: (hoverId === "find" || openSub === "find") && hasText ? "#e8f0fe" : "transparent",
          }}
          onMouseEnter={() => { setHoverId("find"); if (hasText) setOpenSub("find"); }}
          onMouseLeave={() => { setHoverId(null); setOpenSub(null); }}
        >
          <span>Find</span>
          {hasText && <span style={{ fontSize: "9px", color: "#999" }}>▶</span>}

          {openSub === "find" && hasText && (
            <div style={{ position: "absolute", ...subVert, ...subSide, ...POPUP }}>
              {(["First", "Next", "All"] as const).map((label) => {
                const id = `find-${label}`;
                const handler =
                  label === "First" ? handleFindFirst :
                  label === "Next"  ? handleFindNext  :
                                      handleHighlightAll;
                return (
                  <div
                    key={id}
                    style={itemStyle(id, false)}
                    onMouseEnter={() => setHoverId(id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={handler}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={DIVIDER} />

        {/* Find Paragraph */}
        <div
          style={itemStyle("findpara", !paraNum)}
          onMouseEnter={() => { setHoverId("findpara"); setOpenSub(null); }}
          onMouseLeave={() => setHoverId(null)}
          onClick={paraNum ? handleFindParagraph : undefined}
        >
          Find paragraph reference
        </div>

        <div style={DIVIDER} />

        {/* Insert → submenu */}
        <div
          style={{
            ...itemStyle("insert", false),
            position: "relative",
            backgroundColor: (hoverId === "insert" || openSub === "insert") ? "#e8f0fe" : "transparent",
          }}
          onMouseEnter={() => { setHoverId("insert"); setOpenSub("insert"); }}
          onMouseLeave={() => { setHoverId(null); setOpenSub(null); }}
        >
          <span>Insert</span>
          <span style={{ fontSize: "9px", color: "#999" }}>▶</span>

          {openSub === "insert" && (
            <div style={{ position: "absolute", ...subVert, ...subSide, ...POPUP }}>
              {(["as plain text", "formatted"] as const).map((label) => {
                const id = label === "as plain text" ? "insert-text" : "insert-formatted";
                const handler = label === "as plain text" ? handleInsertText : handleInsertFormatted;
                return (
                  <div
                    key={id}
                    style={itemStyle(id, false)}
                    onMouseEnter={() => setHoverId(id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={handler}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Follow up → category accordion submenu */}
        {onFollowUp && (
          <>
            <div style={DIVIDER} />
            <div
              style={{
                ...itemStyle("followup", !hasText),
                position: "relative",
                backgroundColor: (hoverId === "followup" || openSub === "followup") && hasText ? "#e8f0fe" : "transparent",
              }}
              onMouseEnter={() => { setHoverId("followup"); if (hasText) setOpenSub("followup"); }}
              onMouseLeave={() => { setHoverId(null); setOpenSub(null); setOpenCategory(null); }}
            >
              <span>Follow up</span>
              {hasText && <span style={{ fontSize: "9px", color: "#999" }}>▶</span>}

              {openSub === "followup" && hasText && (
                <div style={{ position: "absolute", ...subVert, ...subSide, ...POPUP, minWidth: "180px", maxHeight: `${window.innerHeight * 0.75}px`, overflowY: "auto" }}>

                  {/* My own question */}
                  <div
                    style={itemStyle("fu-own", false)}
                    onMouseEnter={() => { setHoverId("fu-own"); setOpenCategory(null); }}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => { closeMenu(); onFollowUp(`About this: "${menu.text}"\n`); }}
                  >
                    My own question...
                  </div>

                  <div style={DIVIDER} />

                  {/* Categories with inline-expanding questions */}
                  {FOLLOW_UP_MENU.map(({ cat, items }) => {
                    const catId = `fu-${cat.toLowerCase()}`;
                    const expanded = openCategory === cat;
                    return (
                      <div
                        key={cat}
                        onMouseEnter={() => { setHoverId(catId); setOpenCategory(cat); }}
                        onMouseLeave={() => { setHoverId(null); setOpenCategory(null); }}
                      >
                        {/* Category header */}
                        <div style={{
                          padding: "5px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          cursor: "pointer",
                          color: "#222",
                          backgroundColor: expanded ? "#e8f0fe" : "transparent",
                          whiteSpace: "nowrap",
                        }}>
                          <span>{cat}</span>
                          <span style={{ fontSize: "9px", color: "#999" }}>{expanded ? "▼" : "▶"}</span>
                        </div>

                        {/* Inline questions */}
                        {expanded && (
                          <div style={{ backgroundColor: "#f5f5f5", borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
                            {items.map(({ label, q }, i) => {
                              const qId = `${catId}-${i}`;
                              return (
                                <div
                                  key={qId}
                                  style={{
                                    ...itemStyle(qId, false),
                                    paddingLeft: "20px",
                                    fontSize: "11px",
                                  }}
                                  onMouseEnter={() => setHoverId(qId)}
                                  onMouseLeave={() => setHoverId(null)}
                                  onClick={() => { closeMenu(); onFollowUp(`About this: "${menu.text}"\n${q}`); }}
                                >
                                  {label}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
