import React, { useState } from "react";
import { Button, Checkbox, Spinner } from "@fluentui/react-components";
import { ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";
import { sendMessage } from "../../integrations/api/aiClient";
import { Profile } from "../../integrations/api/configClient";
import { getBodyText } from "../../integrations/word/documentTools";
import { anonymize } from "../../integrations/api/presidioClient";

type SendState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

const TEST_PROMPT = "";

const PROMPT_SUMMARISE =
  "Please provide a concise summary of the document, highlighting the key points and main conclusions.";

const PROMPT_RESEARCH =
  "Please research the main topics covered in this document and provide relevant background information, context, and important considerations.";

interface TabAIProps {
  selectedProfile: Profile | undefined;
}

export function TabAI({ selectedProfile }: TabAIProps): React.ReactElement {
  const [prompt, setPrompt] = useState(TEST_PROMPT);
  const [includeObfuscated, setIncludeObfuscated] = useState(true);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });

  const aiName = selectedProfile?.ai ?? "";
  const aiLabel = aiName
    ? `${aiName}${selectedProfile?.aiVersion ? ` (${selectedProfile.aiVersion})` : ""}`
    : "";

  async function send() {
    if (!prompt.trim() || !aiName) return;
    setSendState({ status: "loading" });
    setInputCollapsed(true);
    try {
      let documentText: string | undefined;
      if (includeObfuscated) {
        const bodyText = await getBodyText();
        const result = await anonymize(bodyText);
        documentText = result.text;
      }
      const text = await sendMessage(prompt.trim(), aiName, selectedProfile?.context, documentText);
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

      {/* ── Collapsible input section ─────────────────────────── */}
      <div style={{ borderBottom: "1px solid #e0e0e0", paddingBottom: "6px" }}>

        {/* Toggle header — always visible */}
        <div
          onClick={() => setInputCollapsed((c) => !c)}
          style={{ display: "flex", alignItems: "center", cursor: "pointer", userSelect: "none", color: "#605e5c" }}
        >
          {inputCollapsed ? <ChevronRight16Regular /> : <ChevronDown16Regular />}
        </div>

        {/* Collapsible content */}
        {!inputCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>

            {/* Context */}
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

            {/* Quick-prompt buttons */}
            <div style={{ display: "flex", gap: "6px" }}>
              <Button size="small" appearance="outline" onClick={() => setPrompt(PROMPT_SUMMARISE)}>
                Summarise
              </Button>
              <Button size="small" appearance="outline" onClick={() => setPrompt(PROMPT_RESEARCH)}>
                Research
              </Button>
            </div>

            {/* Question */}
            <details open style={{ fontSize: "12px" }}>
              <summary style={{ cursor: "pointer", color: "#605e5c", userSelect: "none" }}>
                Question
              </summary>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                style={{
                  marginTop: "4px",
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
            </details>

          </div>
        )}
      </div>

      {/* ── Ask + checkbox row ────────────────────────────────── */}
      {(() => {
        const isDisabled = sendState.status === "loading" || !prompt.trim() || !aiName;
        return (
          <div style={{ display: "flex", alignItems: "center" }}>
            <Button
              appearance="primary"
              size="small"
              onClick={send}
              disabled={isDisabled}
              icon={sendState.status === "loading" ? <Spinner size="tiny" /> : undefined}
              style={{
                width: "50%",
                ...(!isDisabled ? { backgroundColor: "#c50f1f", borderColor: "#c50f1f" } : {}),
              }}
            >
              {sendState.status === "loading" ? "Asking…" : "Ask"}
            </Button>
            {!inputCollapsed && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <Checkbox
                  label="Include obfuscated text?"
                  checked={includeObfuscated}
                  onChange={(_, data) => setIncludeObfuscated(!!data.checked)}
                  size="small"
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Error ─────────────────────────────────────────────── */}
      {sendState.status === "error" && (
        <div style={{ fontSize: "12px", color: "#a00", lineHeight: "1.5" }}>
          {sendState.message}
        </div>
      )}

      {/* ── Response ──────────────────────────────────────────── */}
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
