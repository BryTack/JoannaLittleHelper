import React, { useState, useEffect, useCallback } from "react";
import {
  FluentProvider,
  webLightTheme,
  TabList,
  Tab,
  Button,
  Tooltip,
} from "@fluentui/react-components";
import { Settings20Regular } from "@fluentui/react-icons";
import { TabHome } from "./tabs/TabHome";
import { TabObfuscate } from "./tabs/TabObfuscate";
import { TabAI } from "./tabs/TabAI";
import { TabConfig } from "./tabs/TabConfig";
import { fetchConfigValidation, ConfigState, fetchProfiles, Profile } from "../integrations/api/configClient";

type TabId = "home" | "config" | "obfuscate" | "ai";

export function App(): React.ReactElement {
  const [configVisible, setConfigVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [configState, setConfigState] = useState<ConfigState>({ status: "loading" });

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedProfileName, setSelectedProfileName] = useState<string>("");

  const runValidation = useCallback(async () => {
    setConfigState({ status: "loading" });
    try {
      const validation = await fetchConfigValidation();
      setConfigState({ status: "done", validation });
    } catch {
      setConfigState({ status: "unavailable" });
    }
  }, []);

  useEffect(() => {
    runValidation();
    fetchProfiles()
      .then((p) => {
        setProfiles(p);
        if (p.length > 0) setSelectedProfileName(p[0].name);
      })
      .catch((e: Error) => setProfileError(e.message))
      .finally(() => setProfilesLoading(false));
  }, [runValidation]);

  const configHasIssues =
    configState.status === "unavailable" ||
    (configState.status === "done" && !configState.validation.valid);

  const selectedProfile = profiles.find((p) => p.name === selectedProfileName);

  // Helper: wrapper that keeps a tab mounted but invisible when inactive,
  // preserving all component state across tab switches.
  const tabPane = (id: TabId, content: React.ReactElement) => (
    <div
      key={id}
      style={{ display: activeTab === id ? "block" : "none", height: "100%" }}
    >
      {content}
    </div>
  );

  return (
    <FluentProvider theme={webLightTheme} style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_, data) => setActiveTab(data.value as TabId)}
            style={{ flex: 1 }}
          >
            <Tab value="home">Home</Tab>
            <Tab value="obfuscate">Obfuscate</Tab>
            <Tab value="ai">AI</Tab>
            {configVisible && <Tab value="config">Config</Tab>}
          </TabList>
          <Tooltip content={configVisible ? "Hide config" : "Show config"} relationship="label">
            <Button style={{ marginRight: "28px" }}
              icon={
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <Settings20Regular />
                  {configHasIssues && (
                    <span style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#d13438",
                    }} />
                  )}
                </span>
              }
              appearance="subtle"
              size="small"
              onClick={() => {
                const next = !configVisible;
                setConfigVisible(next);
                if (next) setActiveTab("config");
                else if (activeTab === "config") setActiveTab("home");
              }}
            />
          </Tooltip>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {tabPane("home", <TabHome
            profiles={profiles}
            profilesLoading={profilesLoading}
            profileError={profileError}
            selectedName={selectedProfileName}
            onSelectName={setSelectedProfileName}
          />)}
          {tabPane("obfuscate", <TabObfuscate />)}
          {tabPane("ai", <TabAI selectedProfile={selectedProfile} />)}
          {configVisible && tabPane("config", <TabConfig configState={configState} onRevalidate={runValidation} />)}
        </div>
    </FluentProvider>
  );
}
