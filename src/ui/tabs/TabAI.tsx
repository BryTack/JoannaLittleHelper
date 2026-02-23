import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
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

function buildInstructionText(instructions: Instruction[], checked: Set<string>): string {
  return instructions
    .filter((i) => checked.has(i.name))
    .map((i) => {
      const t = i.instruction.trim().replace(/[\r\n]+/g, " ");
      return /[.?]$/.test(t) ? t : `${t}.`;
    })
    .join(" ");
}

interface TabAIDocumentProps {
  selectedProfile: Profile | undefined;
  selectedDocTypeContext: string | undefined;
  docTypeObfuscates: ObfuscateRule[];
  generalButtons: GeneralButton[];
  buttonColour: string;
  instructions: Instruction[];
}

export function TabAIDocument({ selectedProfile, selectedDocTypeContext, docTypeObfuscates, generalButtons, buttonColour, instructions }: TabAIDocumentProps): React.ReactElement {
  const [prompt, setPrompt] = useState("");
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = questionRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 270;
    if (el.scrollHeight <= maxH) {
      el.style.height = `${el.scrollHeight}px`;
      el.style.overflowY = "hidden";
    } else {
      el.style.height = `${maxH}px`;
      el.style.overflowY = "auto";
    }
  }, [prompt]);
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const [isSelectionOnly, setIsSelectionOnly] = useState(false);
  const [checkedInstructions, setCheckedInstructions] = useState<Set<string>>(
    () => new Set(instructions.filter((i) => i.default).map((i) => i.name))
  );

  // Reset checked state and prompt to defaults whenever the instruction list changes (e.g. Re-Load)
  useEffect(() => {
    const defaults = instructions.filter((i) => i.default);
    setCheckedInstructions(new Set(defaults.map((i) => i.name)));
    setPrompt("");
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

  const combinedContext = [selectedProfile?.context, selectedDocTypeContext]
    .filter(Boolean)
    .join("\n\n") || undefined;

  function handleInstructionChange(inst: Instruction, checked: boolean) {
    setCheckedInstructions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(inst.name);
      else next.delete(inst.name);
      return next;
    });
  }

  async function send() {
    const instructionText = buildInstructionText(instructions, checkedInstructions);
    const fullPrompt = [instructionText, prompt.trim()].filter(Boolean).join("\n\n");
    if (!fullPrompt || !aiName) return;
    setSendState({ status: "loading" });
    setInputCollapsed(true);
    try {
      const { text: bodyText } = await getTextForAnonymization();
      const result = await anonymize(bodyText, "en", docTypeObfuscates);
      const documentText = result.text;
      const text = await sendMessage(fullPrompt, aiName, combinedContext, documentText);
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
              <div
                style={{
                  marginTop: "4px",
                  width: "100%",
                  maxHeight: "110px",
                  overflowY: "auto",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  padding: "8px",
                  fontSize: "12px",
                  fontFamily: "Segoe UI, sans-serif",
                  lineHeight: "1.5",
                  color: "#333",
                  backgroundColor: "#fafafa",
                  boxSizing: "border-box",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {combinedContext || "(no context set)"}
              </div>
            </details>

            {/* Instructions */}
            {instructions.length > 0 && (
              <details style={{ fontSize: "12px" }}>
                <summary style={{ cursor: "pointer", color: "#605e5c", userSelect: "none" }}>
                  Instructions
                </summary>
                <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {instructions.map((inst) => (
                      <span key={inst.name} title={inst.description || undefined}>
                        <Checkbox
                          label={inst.name}
                          checked={checkedInstructions.has(inst.name)}
                          onChange={(_, data) => handleInstructionChange(inst, !!data.checked)}
                          style={{ gap: 0, fontSize: "12px" }}
                        />
                      </span>
                    ))}
                  </div>
                  <div
                    style={{
                      width: "100%",
                      maxHeight: "110px",
                      overflowY: "auto",
                      border: "1px solid #d0d0d0",
                      borderRadius: "4px",
                      padding: "8px",
                      fontSize: "12px",
                      fontFamily: "Segoe UI, sans-serif",
                      lineHeight: "1.5",
                      color: "#333",
                      backgroundColor: "#fafafa",
                      boxSizing: "border-box",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {buildInstructionText(instructions, checkedInstructions) || "(no instructions selected)"}
                  </div>
                </div>
              </details>
            )}

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

            {/* Question */}
            <div style={{ height: "8px" }} />
            <details open style={{ fontSize: "12px" }}>
              <summary style={{ cursor: "pointer", color: "#605e5c", userSelect: "none" }}>
                Question
              </summary>
              <textarea
                ref={questionRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                style={{
                  marginTop: "4px",
                  minHeight: "90px",
                  overflowY: "hidden",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  padding: "8px",
                  fontSize: "12px",
                  fontFamily: "Segoe UI, sans-serif",
                  lineHeight: "1.5",
                  boxSizing: "border-box",
                  width: "100%",
                  resize: "none",
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
        const instructionText = buildInstructionText(instructions, checkedInstructions);
        const isDisabled = sendState.status === "loading" || (!prompt.trim() && !instructionText) || !aiName;
        return (
          <div style={{ display: "flex", alignItems: "center" }}>
            <Button
              appearance="primary"
              size="large"
              onClick={send}
              disabled={isDisabled}
              icon={sendState.status === "loading" ? <Spinner size="small" /> : undefined}
              style={{
                width: "100%",
                fontSize: "16px",
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
        <MarkdownResponse text={sendState.text} onFollowUp={(prompt) => {
          setInputCollapsed(false);
          setPrompt(prompt);
          requestAnimationFrame(() => {
            const el = questionRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          });
        }} />
      )}

    </div>
  );
}
