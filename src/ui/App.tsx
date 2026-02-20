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
import { TabDocType } from "./tabs/TabDocType";
import { TabObfuscate } from "./tabs/TabObfuscate";
import { TabClaude } from "./tabs/TabClaude";
import { TabConfig } from "./tabs/TabConfig";
import { fetchConfigValidation, ConfigState } from "../integrations/api/configClient";

type TabId = "doctype" | "config" | "obfuscate" | "claude";

export function App(): React.ReactElement {
  const [configVisible, setConfigVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("doctype");
  const [configState, setConfigState] = useState<ConfigState>({ status: "loading" });

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
  }, [runValidation]);

  // If Claude tab becomes disabled, redirect away from it
  useEffect(() => {
    const claudeDisabled =
      configState.status === "unavailable" ||
      (configState.status === "done" && !configState.validation.valid);
    if (claudeDisabled && activeTab === "claude") {
      setActiveTab("doctype");
    }
  }, [configState, activeTab]);

  const configHasIssues =
    configState.status === "unavailable" ||
    (configState.status === "done" && !configState.validation.valid);

  const claudeDisabled =
    configState.status === "unavailable" ||
    (configState.status === "done" && !configState.validation.valid);

  const renderTab = () => {
    switch (activeTab) {
      case "doctype":   return <TabDocType />;
      case "config":    return <TabConfig configState={configState} onRevalidate={runValidation} />;
      case "obfuscate": return <TabObfuscate />;
      case "claude":    return <TabClaude />;
    }
  };

  return (
    <FluentProvider theme={webLightTheme} style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px 0 8px",
          borderBottom: "1px solid #e0e0e0",
        }}>
          <span style={{ fontWeight: 600, fontSize: "13px" }}>Joanna's Little Helper</span>
          <Tooltip content={configVisible ? "Hide config" : "Show config"} relationship="label">
            <Button
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
                if (!next && activeTab === "config") setActiveTab("doctype");
              }}
            />
          </Tooltip>
        </div>

        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, data) => setActiveTab(data.value as TabId)}
          style={{ padding: "0 4px" }}
        >
          <Tab value="doctype">Doc Type</Tab>
          {configVisible && <Tab value="config">Config</Tab>}
          <Tab value="obfuscate">Obfuscate</Tab>
          <Tab value="claude" disabled={claudeDisabled}>Claude</Tab>
        </TabList>

        <div style={{ flex: 1, overflow: "auto" }}>
          {renderTab()}
        </div>
    </FluentProvider>
  );
}
