import React, { useState, useEffect, useRef, useCallback } from "react";
import { Spinner } from "@fluentui/react-components";
import { getBodyText } from "../../integrations/word/documentTools";
import { anonymize, EntityInfo } from "../../integrations/api/presidioClient";

type State =
  | { status: "loading" }
  | { status: "done"; text: string; entities: EntityInfo[] }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 3000;
const MIN_PCT = 5;
const MAX_PCT = 95;
const DIVIDER_H = 8;
const PADDING = 8;

/** Deduplicate entities by label for display — one row per distinct replacement. */
function uniqueEntities(entities: EntityInfo[]): EntityInfo[] {
  const seen = new Map<string, EntityInfo>();
  for (const e of entities) {
    if (!seen.has(e.label)) seen.set(e.label, e);
  }
  return Array.from(seen.values());
}

/**
 * Returns the exact pixel offset of the character at `position` within a
 * textarea, accounting for word-wrap. Creates a hidden mirror div that
 * matches the textarea's layout, measures a marker span inserted at the
 * position, then removes the mirror.
 */
function getPixelOffsetInTextarea(ta: HTMLTextAreaElement, position: number): number {
  const cs = getComputedStyle(ta);
  const mirror = document.createElement("div");
  mirror.style.cssText = [
    "position:absolute", "top:-9999px", "left:-9999px", "visibility:hidden",
    `width:${ta.clientWidth}px`,
    `font-size:${cs.fontSize}`,
    `font-family:${cs.fontFamily}`,
    `font-weight:${cs.fontWeight}`,
    `line-height:${cs.lineHeight}`,
    `padding:${cs.padding}`,
    `border:${cs.border}`,
    `box-sizing:${cs.boxSizing}`,
    "white-space:pre-wrap",
    "word-wrap:break-word",
    "overflow-wrap:break-word",
  ].join(";");
  // Text before the target position
  mirror.textContent = ta.value.substring(0, position);
  // Marker at the exact position
  const marker = document.createElement("span");
  marker.textContent = "|";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const offset = marker.offsetTop;
  document.body.removeChild(mirror);
  return offset;
}

/** Return the start/end positions of every occurrence of label in text. */
function findOccurrences(text: string, label: string): Array<{ start: number; end: number }> {
  const results: Array<{ start: number; end: number }> = [];
  let idx = 0;
  while (idx < text.length) {
    const pos = text.indexOf(label, idx);
    if (pos === -1) break;
    results.push({ start: pos, end: pos + label.length });
    idx = pos + 1;
  }
  return results;
}

/** Navigate Word to the paragraph at the given index (scrolls Word's viewport). */
async function scrollWordToParagraph(idx: number): Promise<void> {
  try {
    await Word.run(async (context) => {
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("text");
      await context.sync();
      const safeIdx = Math.min(Math.max(idx, 0), paragraphs.items.length - 1);
      paragraphs.items[safeIdx].select(Word.SelectionMode.Select);
      await context.sync();
    });
  } catch {
    // Ignore — document may be busy or unavailable
  }
}

/**
 * Given the obfuscated paragraphs and the textarea's scroll state,
 * return the index of the paragraph whose text is at the top of the viewport.
 * Uses character-offset accumulation so paragraph-level alignment is exact
 * even when entity substitution changes individual paragraph lengths.
 */
function visibleParagraphIndex(
  paras: string[],
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  if (paras.length === 0) return 0;
  const fraction = scrollTop / Math.max(scrollHeight - clientHeight, 1);
  const totalChars = paras.reduce((sum, p) => sum + p.length + 1, 0); // +1 for newline
  const targetChar = totalChars * fraction;
  let cumulative = 0;
  for (let i = 0; i < paras.length; i++) {
    cumulative += paras[i].length + 1;
    if (cumulative > targetChar) return i;
  }
  return paras.length - 1;
}

export function TabObfuscate(): React.ReactElement {
  const [state, setState] = useState<State>({ status: "loading" });
  const [isPending, setIsPending] = useState(false);
  const [splitPct, setSplitPct] = useState(70);
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const obfuscatedParasRef = useRef<string[]>([]);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOurScrollRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const occurrenceIdxRef = useRef<Record<string, number>>({});
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const runAnonymize = useCallback(() => {
    setIsPending(false);
    occurrenceIdxRef.current = {};
    if (cancelRef.current) cancelRef.current();
    let cancelled = false;
    cancelRef.current = () => { cancelled = true; };

    setState({ status: "loading" });

    (async () => {
      try {
        const bodyText = await getBodyText();
        const result = await anonymize(bodyText);
        if (!cancelled) {
          obfuscatedParasRef.current = result.text.split(/\r\n|\r|\n/);
          setState({ status: "done", text: result.text, entities: result.entities });
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          const isConnectionError =
            msg.toLowerCase().includes("failed to fetch") ||
            msg.toLowerCase().includes("networkerror");
          setState({
            status: "error",
            message: isConnectionError
              ? "Cannot reach Presidio service. Is it running? (start-jlh.bat)"
              : msg,
          });
        }
      }
    })();
  }, []);

  // Initial anonymization on mount
  useEffect(() => {
    runAnonymize();
    return () => { if (cancelRef.current) cancelRef.current(); };
  }, [runAnonymize]);

  // Re-anonymize on document changes, debounced
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastUrl = Office.context.document.url;

    function handleChange() {
      if (isOurScrollRef.current) return;
      const currentUrl = Office.context.document.url;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        setIsPending(false);
        runAnonymize();
      } else {
        setIsPending(true);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          runAnonymize();
        }, DEBOUNCE_MS);
      }
    }

    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      handleChange
    );

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      Office.context.document.removeHandlerAsync(
        Office.EventType.DocumentSelectionChanged,
        { handler: handleChange }
      );
    };
  }, [runAnonymize]);

  function handleEntityClick(label: string) {
    if (state.status !== "done" || !textareaRef.current) return;
    const ta = textareaRef.current;
    // Search ta.value (browser-normalised to \n) so that offsets, line counting,
    // and setSelectionRange all use the same string — avoids \r\n vs \n mismatch
    // between state.text (raw from Word) and the DOM-normalised textarea value.
    const taText = ta.value;
    const occurrences = findOccurrences(taText, label);
    if (occurrences.length === 0) return;
    const idx = (occurrenceIdxRef.current[label] ?? 0) % occurrences.length;
    occurrenceIdxRef.current[label] = (idx + 1) % occurrences.length;
    const { start, end } = occurrences[idx];
    ta.focus();
    ta.setSelectionRange(start, end);
    // setSelectionRange on a readOnly textarea does not reliably scroll in WebView2.
    // Use a mirror div to get the exact pixel offset (accounts for word-wrap),
    // then position the match in the upper third of the visible area.
    const pixelOffset = getPixelOffsetInTextarea(ta, start);
    ta.scrollTop = Math.max(0, pixelOffset - ta.clientHeight / 3);
  }

  function handleTextareaScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      const idx = visibleParagraphIndex(
        obfuscatedParasRef.current,
        scrollTop,
        scrollHeight,
        clientHeight,
      );
      isOurScrollRef.current = true;
      scrollWordToParagraph(idx).finally(() => {
        setTimeout(() => { isOurScrollRef.current = false; }, 1000);
      });
    }, 150);
  }

  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    function onMouseMove(ev: MouseEvent) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const effectiveTop    = rect.top + PADDING;
      const effectiveHeight = rect.height - PADDING * 2;
      const pct = ((ev.clientY - effectiveTop) / effectiveHeight) * 100;
      setSplitPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
    }

    function onMouseUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  const pendingBg     = isPending ? "#fff0f0" : "#fafafa";
  const pendingBorder = isPending ? "#f0c0c0" : "#d0d0d0";

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: `${PADDING}px`,
        boxSizing: "border-box",
      }}
    >
      {/* Top pane — anonymised text */}
      <div style={{ flex: `0 0 ${splitPct}%`, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {state.status === "loading" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
            <Spinner size="tiny" />
            <span style={{ fontSize: "12px", color: "#666" }}>Analysing document...</span>
          </div>
        )}

        {state.status === "error" && (
          <div style={{ fontSize: "12px", color: "#a00", lineHeight: "1.5" }}>
            {state.message}
          </div>
        )}

        {state.status === "done" && (
          <textarea
            ref={textareaRef}
            readOnly
            value={state.text || "(Document is empty)"}
            onScroll={handleTextareaScroll}
            style={{
              flex: 1,
              resize: "none",
              border: `1px solid ${pendingBorder}`,
              borderRadius: "4px",
              padding: "8px",
              fontSize: "12px",
              fontFamily: "Segoe UI, sans-serif",
              lineHeight: "1.5",
              color: "#333",
              backgroundColor: pendingBg,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={onDividerMouseDown}
        style={{
          height: `${DIVIDER_H}px`,
          flexShrink: 0,
          cursor: "ns-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ebebeb",
          userSelect: "none",
        }}
      >
        <div style={{ width: "32px", height: "2px", background: "#b0b0b0", borderRadius: "1px" }} />
      </div>

      {/* Bottom pane — obfuscation details */}
      <div style={{
        flex: 1,
        minHeight: 0,
        border: `1px solid ${pendingBorder}`,
        borderRadius: "4px",
        backgroundColor: pendingBg,
        overflow: "hidden",
      }}>
        <div style={{ height: "100%", overflow: "auto", padding: "4px 0" }}>
          {state.status === "done" && uniqueEntities(state.entities).length === 0 && (
            <div style={{ fontSize: "11px", color: "#999", padding: "4px 8px" }}>
              No PII detected
            </div>
          )}

          {state.status === "done" && uniqueEntities(state.entities).map((e) => (
            <div
              key={e.label}
              onClick={() => handleEntityClick(e.label)}
              onMouseEnter={() => setHoveredLabel(e.label)}
              onMouseLeave={() => setHoveredLabel(null)}
              style={{
                display: "flex",
                gap: "8px",
                padding: "2px 8px",
                fontSize: "11px",
                fontFamily: "Segoe UI, sans-serif",
                lineHeight: "1.6",
                cursor: "pointer",
                background: hoveredLabel === e.label ? "#e8e8e8" : "transparent",
                borderRadius: "2px",
              }}
            >
              <span style={{ color: "#b00", fontWeight: 600, minWidth: "110px", flexShrink: 0 }}>
                {e.label}
              </span>
              <span style={{ color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.original}
              </span>
              <span style={{ color: "#999", flexShrink: 0 }}>
                {Math.round(e.score * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
