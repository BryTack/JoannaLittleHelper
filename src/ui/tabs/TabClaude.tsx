import React, { useState, useEffect } from "react";
import { Button, Select, Spinner } from "@fluentui/react-components";
import { fetchAvailableAIs, sendMessage, AiOption } from "../../integrations/api/aiClient";

type SendState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

const TEST_PROMPT = "what is the last letter of the alphabet";

export function TabClaude(): React.ReactElement {
  const [prompt, setPrompt] = useState(TEST_PROMPT);
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const [ais, setAis] = useState<AiOption[]>([]);
  const [selectedAi, setSelectedAi] = useState("");

  useEffect(() => {
    fetchAvailableAIs()
      .then((list) => {
        setAis(list);
        if (list.length > 0) setSelectedAi(list[0].name);
      })
      .catch(() => {
        // Server unavailable — empty list, send button will be disabled
      });
  }, []);

  async function send() {
    if (!prompt.trim() || !selectedAi) return;
    setSendState({ status: "loading" });
    try {
      const text = await sendMessage(prompt.trim(), selectedAi);
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

      {/* AI selector */}
      <Select
        value={selectedAi}
        onChange={(_, data) => setSelectedAi(data.value)}
        disabled={ais.length === 0 || sendState.status === "loading"}
        size="small"
      >
        {ais.length === 0
          ? <option value="">No AIs configured</option>
          : ais.map((ai) => (
              <option key={ai.name} value={ai.name} title={ai.description}>
                {ai.name}
              </option>
            ))
        }
      </Select>

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
        disabled={sendState.status === "loading" || !prompt.trim() || !selectedAi}
        icon={sendState.status === "loading" ? <Spinner size="tiny" /> : undefined}
      >
        {sendState.status === "loading" ? "Sending…" : `Send to ${selectedAi || "AI"}`}
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
