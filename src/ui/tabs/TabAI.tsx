import React, { useState, useEffect } from "react";
import { Button, Spinner, Checkbox } from "@fluentui/react-components";
import { QuickButton } from "../components/QuickButton";
import { MarkdownResponse } from "../components/MarkdownResponse";
import { ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";
import { sendMessage } from "../../integrations/api/aiClient";
import { Profile, GeneralButton, ObfuscateRule, Instruction } from "../../integrations/api/configClient";
import { getTextForAnonymization, getSelectedText } from "../../integrations/word/documentTools";
import { anonymize } from "../../integrations/api/presidioClient";

type SendState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

const TEST_PROMPT = "";

interface TabAIDocumentProps {
  selectedProfile: Profile | undefined;
  selectedDocTypeContext: string | undefined;
  docTypeObfuscates: ObfuscateRule[];
  generalButtons: GeneralButton[];
  buttonColour: string;
  instructions: Instruction[];
}

export function TabAIDocument({ selectedProfile, selectedDocTypeContext, docTypeObfuscates, generalButtons, buttonColour, instructions }: TabAIDocumentProps): React.ReactElement {
  const [prompt, setPrompt] = useState(TEST_PROMPT);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const [isSelectionOnly, setIsSelectionOnly] = useState(false);
  const [checkedInstructions, setCheckedInstructions] = useState<Set<string>>(
    () => new Set(instructions.filter((i) => i.default).map((i) => i.name))
  );

  // Reset checked state to defaults whenever the instruction list changes (e.g. Re-Load)
  useEffect(() => {
    setCheckedInstructions(new Set(instructions.filter((i) => i.default).map((i) => i.name)));
  }, [instructions]);

  // Keep isSelectionOnly in sync with the live Word selection
  useEffect(() => {
    function handleSelectionChange() {
      getSelectedText().then((t) => setIsSelectionOnly(t.trim().length > 0)).catch(() => {});
    }
    Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, handleSelectionChange);
    handleSelectionChange(); // check immediately on mount
    return () => {
      Office.context.document.removeHandlerAsync(Office.EventType.DocumentSelectionChanged, { handler: handleSelectionChange });
    };
  }, []);

  const aiName = selectedProfile?.ai ?? "";
  const aiLabel = aiName
    ? `${aiName}${selectedProfile?.aiVersion ? ` (${selectedProfile.aiVersion})` : ""}`
    : "";

  const checkedInstructionTexts = instructions
    .filter((i) => checkedInstructions.has(i.name))
    .map((i) => i.instruction);

  const combinedContext = [selectedProfile?.context, selectedDocTypeContext, ...checkedInstructionTexts]
    .filter(Boolean)
    .join("\n\n") || undefined;

  async function send() {
    if (!prompt.trim() || !aiName) return;
    setSendState({ status: "loading" });
    setInputCollapsed(true);
    try {
      const { text: bodyText } = await getTextForAnonymization();
      const result = await anonymize(bodyText, "en", docTypeObfuscates);
      const documentText = result.text;
      const text = await sendMessage(prompt.trim(), aiName, combinedContext, documentText);
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
                value={combinedContext || "(no context set)"}
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
            {generalButtons.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {generalButtons.map((btn) => (
                  <QuickButton
                    key={btn.name}
                    btn={btn}
                    fallbackColour={buttonColour}
                    onClick={() => setPrompt(btn.context)}
                  />
                ))}
              </div>
            )}

            {/* Instructions */}
            {instructions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {instructions.map((inst) => (
                  <span key={inst.name} title={inst.description || undefined}>
                    <Checkbox
                      label={inst.name}
                      checked={checkedInstructions.has(inst.name)}
                      onChange={(_, data) =>
                        setCheckedInstructions((prev) => {
                          const next = new Set(prev);
                          if (data.checked) next.add(inst.name);
                          else next.delete(inst.name);
                          return next;
                        })
                      }
                      style={{ gap: 0, fontSize: "12px" }}
                    />
                  </span>
                ))}
              </div>
            )}

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

      {/* ── Selection warning ─────────────────────────────────── */}
      {isSelectionOnly && (
        <div style={{ fontSize: "11px", color: "#8a6000", marginBottom: "-2px" }}>
          Selection only — not the full document
        </div>
      )}

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
        <MarkdownResponse text={sendState.text} />
      )}

    </div>
  );
}
