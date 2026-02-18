import React, { useState } from "react";
import {
  FluentProvider,
  webLightTheme,
  TabList,
  Tab,
  Button,
  Tooltip,
} from "@fluentui/react-components";
import { Settings20Regular } from "@fluentui/react-icons";
import { ResizeGuard } from "./ResizeGuard";
import { TabDocType } from "./tabs/TabDocType";
import { TabObfuscate } from "./tabs/TabObfuscate";
import { TabClaude } from "./tabs/TabClaude";
import { TabConfig } from "./tabs/TabConfig";

type TabId = "doctype" | "config" | "obfuscate" | "claude";

export function App(): React.ReactElement {
  const [configVisible, setConfigVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("doctype");

  const renderTab = () => {
    switch (activeTab) {
      case "doctype":   return <TabDocType />;
      case "config":    return <TabConfig />;
      case "obfuscate": return <TabObfuscate />;
      case "claude":    return <TabClaude />;
    }
  };

  return (
    <FluentProvider theme={webLightTheme} style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <ResizeGuard>
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
              icon={<Settings20Regular />}
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
          <Tab value="claude">Claude</Tab>
        </TabList>

        <div style={{ flex: 1, overflow: "auto" }}>
          {renderTab()}
        </div>
      </ResizeGuard>
    </FluentProvider>
  );
}
