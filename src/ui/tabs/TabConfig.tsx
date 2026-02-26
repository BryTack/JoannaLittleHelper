import React, { useState, useEffect } from "react";
import { Button, Spinner, Select, Field } from "@fluentui/react-components";
import { ConfigState, fetchSettings, updateAnonymizeOperator } from "../../integrations/api/configClient";

interface TabConfigProps {
  configState: ConfigState;
  onRevalidate: () => void;
  onOperatorChange: (op: string) => void;
}

const LEVEL_ICON: Record<string, string> = { info: "ℹ", warning: "⚠", error: "✗" };
const LEVEL_COLOR: Record<string, string> = { info: "#0078d4", warning: "#c07f00", error: "#d13438" };

export function TabConfig({ configState, onRevalidate, onOperatorChange }: TabConfigProps): React.ReactElement {
  const [operator, setOperator] = useState("replace");

  useEffect(() => {
    fetchSettings()
      .then((s) => setOperator(s.anonymizeOperator))
      .catch(() => {});
  }, []);

  function handleOperatorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const op = e.target.value;
    setOperator(op);
    onOperatorChange(op);
    updateAnonymizeOperator(op).catch(() => {});
  }

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600 }}>Configuration</span>
        <Button size="small" onClick={onRevalidate} disabled={configState.status === "loading"}>
          {configState.status === "loading" ? <Spinner size="extra-tiny" /> : "Re-Load"}
        </Button>
      </div>

      <div style={{ fontSize: "11px", color: "#555" }}>
        <span style={{ color: "#888" }}>Config file: </span>
        <code style={{ wordBreak: "break-all" }}>
          {configState.status === "done" && configState.validation.configFile
            ? configState.validation.configFile
            : "…"}
        </code>
      </div>

      {configState.status === "loading" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#666" }}>
          <Spinner size="tiny" />
          <span style={{ fontSize: "13px" }}>Checking configuration…</span>
        </div>
      )}

      {configState.status === "unavailable" && (
        <div style={{
          padding: "8px 10px",
          background: "#fdf3f4",
          border: "1px solid #f1bbb8",
          borderRadius: 4,
          fontSize: "13px",
          color: "#d13438",
        }}>
          AI server not running. Start it with <code>start-jlh.bat</code>.
        </div>
      )}

      {configState.status === "done" && (
        <>
          {configState.validation.valid && (
            <div style={{
              padding: "8px 10px",
              background: "#f1faf1",
              border: "1px solid #b3d9b3",
              borderRadius: 4,
              fontSize: "13px",
              color: "#107c10",
            }}>
              ✓ Configuration is valid.
            </div>
          )}

          {configState.validation.messages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {configState.validation.messages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex",
                  gap: 8,
                  fontSize: "13px",
                  color: LEVEL_COLOR[msg.level] ?? "#333",
                }}>
                  <span style={{ flexShrink: 0 }}>{LEVEL_ICON[msg.level] ?? "?"}</span>
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>
          )}

          {!configState.validation.valid && (
            <div style={{ fontSize: "12px", color: "#666" }}>
              Edit the config file above then click Re-Load.
            </div>
          )}
        </>
      )}

      <Field label="Anonymisation method">
        <Select value={operator} onChange={handleOperatorChange}>
          <option value="replace">Obfuscate — label entities (e.g. &lt;PERSON_1&gt;)</option>
          <option value="redact">Redact — hide with spaces</option>
          <option value="mask">Mask — replace with asterisks</option>
        </Select>
      </Field>

    </div>
  );
}
