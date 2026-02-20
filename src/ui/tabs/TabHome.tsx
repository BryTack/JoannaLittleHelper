import React, { useState, useEffect } from "react";
import { Label, Select, Text, Spinner } from "@fluentui/react-components";
import { fetchProfiles, Profile } from "../../integrations/api/configClient";

export function TabHome(): React.ReactElement {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");

  useEffect(() => {
    fetchProfiles()
      .then((p) => {
        setProfiles(p);
        if (p.length > 0) setSelectedName(p[0].name);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = profiles.find((p) => p.name === selectedName);

  if (loading) {
    return (
      <div style={{ padding: "12px" }}>
        <Spinner size="tiny" label="Loading profiles…" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "12px" }}>
        <Text style={{ color: "#d13438" }}>Could not load profiles: {error}</Text>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div style={{ padding: "12px" }}>
        <Text>No profiles defined in config.</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <Label htmlFor="profile-select">Active profile</Label>
      <Select
        id="profile-select"
        value={selectedName}
        onChange={(_, data) => setSelectedName(data.value)}
      >
        {profiles.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </Select>
      {selected?.description && (
        <Text size={200} style={{ color: "#605e5c" }}>
          {selected.description}
        </Text>
      )}
      {selected?.ai && (
        <Text size={200} style={{ color: "#605e5c" }}>
          AI: {selected.ai}{selected.aiVersion ? ` (${selected.aiVersion})` : ""}
        </Text>
      )}
    </div>
  );
}
