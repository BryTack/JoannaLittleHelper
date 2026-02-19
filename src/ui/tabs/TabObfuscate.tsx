import React, { useState, useEffect, useRef, useCallback } from "react";
import { Spinner } from "@fluentui/react-components";
import { getBodyText } from "../../integrations/word/documentTools";
import { anonymize } from "../../integrations/api/presidioClient";

type State =
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 3000;

export function TabObfuscate(): React.ReactElement {
  const [state, setState] = useState<State>({ status: "loading" });
  const cancelRef = useRef<(() => void) | null>(null);

  const runAnonymize = useCallback(() => {
    // Cancel any in-flight request
    if (cancelRef.current) cancelRef.current();
    let cancelled = false;
    cancelRef.current = () => { cancelled = true; };

    setState({ status: "loading" });

    (async () => {
      try {
        const bodyText = await getBodyText();
        const result = await anonymize(bodyText);
        if (!cancelled) setState({ status: "done", text: result.text });
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
        // Different document loaded — re-anonymize immediately
        lastUrl = currentUrl;
        runAnonymize();
      } else {
        // Same document edited — wait for typing to stop
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "8px", boxSizing: "border-box" }}>
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
            border: "1px solid #d0d0d0",
            borderRadius: "4px",
            padding: "8px",
            fontSize: "12px",
            fontFamily: "Segoe UI, sans-serif",
            lineHeight: "1.5",
            color: "#333",
            backgroundColor: "#fafafa",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      )}
    </div>
  );
}
