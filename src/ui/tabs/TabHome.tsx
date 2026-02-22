import React, { useState, useEffect } from "react";
import pkg from "../../../package.json";
const { version } = pkg;
import { Label, Select, Text, Spinner } from "@fluentui/react-components";
import { Profile, DocType } from "../../integrations/api/configClient";
import { getDocumentSummary, DocumentSummary } from "../../integrations/word/documentTools";

function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function SummaryTable({ summary }: { summary: DocumentSummary }) {
  const tdLabel: React.CSSProperties = {
    color: "#605e5c",
    paddingRight: "10px",
    whiteSpace: "nowrap",
    verticalAlign: "top",
    fontSize: "12px",
    fontWeight: 600,
  };
  const tdValue: React.CSSProperties = { fontSize: "12px", wordBreak: "break-word" };
  const tdNA: React.CSSProperties = { ...tdValue, color: "#a0a0a0", fontStyle: "italic" };

  const row = (label: string, value: string, alwaysShow = false) => {
    if (!alwaysShow && !value) return null;
    return (
      <tr key={label}>
        <td style={tdLabel}>{label}</td>
        <td style={value ? tdValue : tdNA}>{value || "not available"}</td>
      </tr>
    );
  };

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <tbody>
        {row("Filename",     summary.fileName)}
        {row("Title",        summary.title)}
        {row("Subject",      summary.subject)}
        {row("Author",       summary.author)}
        {row("Keywords",     summary.keywords)}
        {row("Description",  summary.description)}
        {row("Category",     summary.category)}
        {row("Created",      formatDateTime(summary.creationDate))}
        {row("Last saved",   formatDateTime(summary.lastSaveTime))}
        {row("Last printed", formatDate(summary.lastPrintDate))}
        {row("Words",        summary.wordCount.toLocaleString(),      true)}
        {row("Characters",   summary.charCount.toLocaleString(),      true)}
        {row("Paragraphs",   summary.paragraphCount.toLocaleString(), true)}
      </tbody>
    </table>
  );
}

interface TabHomeProps {
  profiles: Profile[];
  profilesLoading: boolean;
  profileError: string | null;
  selectedName: string;
  onSelectName: (name: string) => void;
  docTypes: DocType[];
  selectedDocTypeName: string;
  onSelectDocTypeName: (name: string) => void;
  summaryKey: number;
}

export function TabHome({
  profiles, profilesLoading, profileError, selectedName, onSelectName,
  docTypes, selectedDocTypeName, onSelectDocTypeName, summaryKey,
}: TabHomeProps): React.ReactElement {
  const [summary, setSummary]               = useState<DocumentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError]     = useState<string | null>(null);

  useEffect(() => {
    if (!summary) setSummaryLoading(true);  // spinner only on first load
    setSummaryError(null);
    getDocumentSummary()
      .then(setSummary)
      .catch((e: Error) => setSummaryError(e.message))
      .finally(() => setSummaryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryKey]);

  const selected = profiles.find((p) => p.name === selectedName);
  const selectedDocType = docTypes.find((dt) => dt.name === selectedDocTypeName);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Scrollable controls ───────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* ── Profile ───────────────────────────────────── */}
        {profilesLoading ? (
          <Spinner size="tiny" label="Loading profiles…" />
        ) : profileError ? (
          <Text style={{ color: "#d13438" }}>Could not load profiles: {profileError}</Text>
        ) : profiles.length === 0 ? (
          <Text size={200}>No profiles defined in config.</Text>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Label htmlFor="profile-select">Active profile</Label>
            <Select
              id="profile-select"
              value={selectedName}
              onChange={(_, data) => onSelectName(data.value)}
            >
              {profiles.map((p) => (
                <option key={p.name} value={p.name}>{p.name}{p.description ? `: ${p.description}` : ""}</option>
              ))}
            </Select>
            {selected?.ai && (
              <Text size={200} style={{ color: "#605e5c" }}>
                {selected.ai}{selected.aiVersion ? ` (${selected.aiVersion})` : ""}{selected.aiGoodFor ? `: ${selected.aiGoodFor}` : ""}
              </Text>
            )}
          </div>
        )}

        {/* ── Document type ─────────────────────────────── */}
        {docTypes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Label htmlFor="doctype-select">Document type</Label>
            <Select
              id="doctype-select"
              value={selectedDocTypeName}
              onChange={(_, data) => onSelectDocTypeName(data.value)}
            >
              {docTypes.map((dt) => (
                <option key={dt.name} value={dt.name}>{dt.name}{dt.description ? `: ${dt.description}` : ""}</option>
              ))}
            </Select>
            {selectedDocType?.context && (
              <Text size={200} style={{ color: "#605e5c" }}>{selectedDocType.context}</Text>
            )}
          </div>
        )}

        {/* ── Version ───────────────────────────────────── */}
        <div style={{ marginTop: "auto", paddingTop: "4px", textAlign: "right" }}>
          <Text size={100} style={{ color: "#c0c0c0" }}>v{version}</Text>
        </div>

      </div>

      {/* ── Document summary — anchored to bottom ────────── */}
      <div style={{
        flexShrink: 0,
        margin: "0 12px 12px",
        padding: "10px",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        backgroundColor: "#fafafa",
      }}>
        <Text weight="semibold" size={200} style={{ display: "block", marginBottom: "6px" }}>
          Document
        </Text>
        {summaryLoading ? (
          <Spinner size="tiny" label="Reading document…" />
        ) : summaryError ? (
          <Text size={200} style={{ color: "#d13438" }}>Could not read document: {summaryError}</Text>
        ) : summary ? (
          <SummaryTable summary={summary} />
        ) : null}
      </div>

    </div>
  );
}
