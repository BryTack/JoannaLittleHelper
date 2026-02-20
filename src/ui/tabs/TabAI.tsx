import React, { useState } from "react";
import { Button, Spinner, Text } from "@fluentui/react-components";
import { sendMessage } from "../../integrations/api/aiClient";
import { Profile } from "../../integrations/api/configClient";

type SendState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

const TEST_PROMPT = "what is the last letter of the alphabet";

interface TabAIProps {
  selectedProfile: Profile | undefined;
}

export function TabAI({ selectedProfile }: TabAIProps): React.ReactElement {
  const [prompt, setPrompt] = useState(TEST_PROMPT);
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });

  const aiName = selectedProfile?.ai ?? "";
  const aiLabel = aiName
    ? `${aiName}${selectedProfile?.aiVersion ? ` (${selectedProfile.aiVersion})` : ""}`
    : "";

  async function send() {
    if (!prompt.trim() || !aiName) return;
    setSendState({ status: "loading" });
    try {
      const text = await sendMessage(prompt.trim(), aiName, selectedProfile?.context);
      setSendState({ status: "done", text });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isConnectionError =
        msg.toLowerCase().includes("failed to fetch") ||
        msg.toLowerCase().includes("networkerror");
      setSendState({
        status: "error",
        message: isConnectionError
          ? "Cannot reach AI service. Is it running? (start-jlh.bat)"
          : msg,
      });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "8px", gap: "6px", boxSizing: "border-box" }}>

      {/* AI label */}
      <Text size={200} style={{ color: "#605e5c" }}>
        {aiLabel ? `AI: ${aiLabel}` : "No profile selected — choose one on the Home tab"}
      </Text>

      {/* Context (collapsed by default) */}
      <details style={{ fontSize: "12px" }}>
        <summary style={{ cursor: "pointer", color: "#605e5c", userSelect: "none" }}>
          Context
        </summary>
        <textarea
          readOnly
          value={selectedProfile?.context || "(no context set for this profile)"}
          rows={5}
          style={{
            marginTop: "4px",
            width: "100%",
            resize: "vertical",
            border: "1px solid #d0d0d0",
            borderRadius: "4px",
            padding: "8px",
            fontSize: "12px",
            fontFamily: "Segoe UI, sans-serif",
            lineHeight: "1.5",
            color: "#333",
            backgroundColor: "#fafafa",
            boxSizing: "border-box",
          }}
        />
      </details>

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
        disabled={sendState.status === "loading" || !prompt.trim() || !aiName}
        icon={sendState.status === "loading" ? <Spinner size="tiny" /> : undefined}
      >
        {sendState.status === "loading" ? "Sending…" : `Send to ${aiName || "AI"}`}
      </Button>

      {/* Error */}
      {sendState.status === "error" && (
        <div style={{ fontSize: "12px", color: "#a00", lineHeight: "1.5" }}>
          {sendState.message}
        </div>
      )}

      {/* Response */}
      {sendState.status === "done" && (
        <textarea
          readOnly
          value={sendState.text}
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
