import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { selectOccurrence, highlightMatches, selectParagraph } from "../../integrations/word/documentTools";

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

const BOX: React.CSSProperties = {
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

export function MarkdownResponse({ text }: { text: string }): React.ReactElement {
  const [menu,        setMenu]        = useState<MenuState | null>(null);
  const [subOpen,     setSubOpen]     = useState(false);
  const [hoverId,     setHoverId]     = useState<string | null>(null);
  const [findState,   setFindState]   = useState<{ text: string; index: number } | null>(null);
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
    setSubOpen(false);
    setHoverId(null);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const sel = window.getSelection()?.toString() ?? "";
    setMenu({ x: e.clientX, y: e.clientY, text: sel });
    setSubOpen(false);
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

  // ── Render ────────────────────────────────────────────────────────────

  if (!menu) {
    return (
      <div className="jlh-markdown" style={BOX} onContextMenu={handleContextMenu}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  const hasText     = !!menu.text.trim();
  const paraNum     = parseParaNumber(menu.text);
  const nearRight   = menu.x + 250 > window.innerWidth;
  const menuTop     = Math.min(menu.y, window.innerHeight - 120);

  const subSide: React.CSSProperties = nearRight
    ? { right: "100%", left: "auto" }
    : { left: "100%" };

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
          onMouseEnter={() => { setHoverId("copy"); setSubOpen(false); }}
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
            // Keep highlighted while submenu is open, even when mouse moves to submenu items
            backgroundColor: (hoverId === "find" || subOpen) && hasText ? "#e8f0fe" : "transparent",
          }}
          onMouseEnter={() => { setHoverId("find"); if (hasText) setSubOpen(true); }}
          onMouseLeave={() => { setHoverId(null); setSubOpen(false); }}
        >
          <span>Find</span>
          {hasText && <span style={{ fontSize: "9px", color: "#999" }}>▶</span>}

          {subOpen && hasText && (
            <div style={{ position: "absolute", top: 0, ...subSide, ...POPUP }}>
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
          onMouseEnter={() => { setHoverId("findpara"); setSubOpen(false); }}
          onMouseLeave={() => setHoverId(null)}
          onClick={paraNum ? handleFindParagraph : undefined}
        >
          Find Paragraph
        </div>

      </div>
    </div>
  );
}
