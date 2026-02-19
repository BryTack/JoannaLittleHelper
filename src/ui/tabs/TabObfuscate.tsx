import React, { useState, useEffect, useRef, useCallback } from "react";
import { Spinner } from "@fluentui/react-components";
import { getBodyText } from "../../integrations/word/documentTools";
import { anonymize, EntityInfo } from "../../integrations/api/presidioClient";

type State =
  | { status: "loading" }
  | { status: "done"; text: string; entities: EntityInfo[] }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 3000;

/** Deduplicate entities by label for display — one row per distinct replacement. */
function uniqueEntities(entities: EntityInfo[]): EntityInfo[] {
  const seen = new Map<string, EntityInfo>();
  for (const e of entities) {
    if (!seen.has(e.label)) seen.set(e.label, e);
  }
  return Array.from(seen.values());
}

export function TabObfuscate(): React.ReactElement {
  const [state, setState] = useState<State>({ status: "loading" });
  const [isPending, setIsPending] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const runAnonymize = useCallback(() => {
    setIsPending(false);
    if (cancelRef.current) cancelRef.current();
    let cancelled = false;
    cancelRef.current = () => { cancelled = true; };

    setState({ status: "loading" });

    (async () => {
      try {
        const bodyText = await getBodyText();
        const result = await anonymize(bodyText);
        if (!cancelled) setState({ status: "done", text: result.text, entities: result.entities });
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

  const pendingBg = isPending ? "#fff0f0" : "#fafafa";
  const pendingBorder = isPending ? "#f0c0c0" : "#d0d0d0";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "8px", gap: "6px", boxSizing: "border-box" }}>

      {/* Top 70% — anonymised text */}
      <div style={{ flex: 7, display: "flex", flexDirection: "column", minHeight: 0 }}>
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
            readOnly
            value={state.text || "(Document is empty)"}
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

      {/* Bottom 30% — obfuscation details */}
      <div style={{
        flex: 3,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        border: `1px solid ${pendingBorder}`,
        borderRadius: "4px",
        backgroundColor: pendingBg,
        overflow: "hidden",
      }}>
        <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
          {state.status === "done" && uniqueEntities(state.entities).length === 0 && (
            <div style={{ fontSize: "11px", color: "#999", padding: "4px 8px" }}>
              No PII detected
            </div>
          )}

          {state.status === "done" && uniqueEntities(state.entities).map((e) => (
            <div key={e.label} style={{
              display: "flex",
              gap: "8px",
              padding: "2px 8px",
              fontSize: "11px",
              fontFamily: "Segoe UI, sans-serif",
              lineHeight: "1.6",
            }}>
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
