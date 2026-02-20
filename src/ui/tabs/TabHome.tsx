import React, { useState, useEffect } from "react";
import { Label, Select, Text, Spinner } from "@fluentui/react-components";
import { Profile } from "../../integrations/api/configClient";
import { getDocumentSummary, DocumentSummary } from "../../integrations/word/documentTools";

function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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
        {row("File",         summary.fileName)}
        {row("Title",        summary.title)}
        {row("Subject",      summary.subject)}
        {row("Author",       summary.author)}
        {row("Keywords",     summary.keywords)}
        {row("Description",  summary.description)}
        {row("Category",     summary.category)}
        {row("Created",      formatDate(summary.creationDate))}
        {row("Last saved",   formatDate(summary.lastSaveTime))}
        {row("Last printed", formatDate(summary.lastPrintDate))}
        {row("Words",        summary.wordCount.toLocaleString(),      true)}
        {row("Characters",   summary.charCount.toLocaleString(),      true)}
        {row("Paragraphs",   summary.paragraphCount.toLocaleString(), true)}
        {row("Pages",        "",                                      true)}
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
}

export function TabHome({ profiles, profilesLoading, profileError, selectedName, onSelectName }: TabHomeProps): React.ReactElement {
  const [summary, setSummary]               = useState<DocumentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError]     = useState<string | null>(null);

  useEffect(() => {
    getDocumentSummary()
      .then(setSummary)
      .catch((e: Error) => setSummaryError(e.message))
      .finally(() => setSummaryLoading(false));
  }, []);

  const selected = profiles.find((p) => p.name === selectedName);

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* ── Profile ─────────────────────────────────────── */}
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
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </Select>
          {selected?.description && (
            <Text size={200} style={{ color: "#605e5c" }}>{selected.description}</Text>
          )}
          {selected?.ai && (
            <Text size={200} style={{ color: "#605e5c" }}>
              AI: {selected.ai}{selected.aiVersion ? ` (${selected.aiVersion})` : ""}
            </Text>
          )}
        </div>
      )}

      {/* ── Document summary ─────────────────────────────── */}
      <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "10px" }}>
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
