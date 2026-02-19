import React, { useState } from "react";
import { Button, Spinner } from "@fluentui/react-components";
import { activeProvider } from "../../integrations/api/aiClient";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

const TEST_PROMPT = "what is the last letter of the alphabet";

export function TabClaude(): React.ReactElement {
  const [prompt, setPrompt] = useState(TEST_PROMPT);
  const [state, setState] = useState<State>({ status: "idle" });

  async function send() {
    if (!prompt.trim()) return;
    setState({ status: "loading" });
    try {
      const text = await activeProvider.sendMessage(prompt.trim());
      setState({ status: "done", text });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isConnectionError =
        msg.toLowerCase().includes("failed to fetch") ||
        msg.toLowerCase().includes("networkerror");
      setState({
        status: "error",
        message: isConnectionError
          ? "Cannot reach AI service. Is it running? (start-jlh.bat)"
          : msg,
      });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "8px", gap: "6px", boxSizing: "border-box" }}>

      {/* Prompt input */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        style={{
          resize: "vertical",
          border: "1px solid #d0d0d0",
          borderRadius: "4px",
          padding: "8px",
          fontSize: "12px",
          fontFamily: "Segoe UI, sans-serif",
          lineHeight: "1.5",
          boxSizing: "border-box",
          width: "100%",
        }}
      />

      {/* Send button */}
      <Button
        appearance="primary"
        size="small"
        onClick={send}
        disabled={state.status === "loading" || !prompt.trim()}
        icon={state.status === "loading" ? <Spinner size="tiny" /> : undefined}
      >
        {state.status === "loading" ? "Sending..." : `Send to ${activeProvider.name}`}
      </Button>

      {/* Error */}
      {state.status === "error" && (
        <div style={{ fontSize: "12px", color: "#a00", lineHeight: "1.5" }}>
          {state.message}
        </div>
      )}

      {/* Response */}
      {state.status === "done" && (
        <textarea
          readOnly
          value={state.text}
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
