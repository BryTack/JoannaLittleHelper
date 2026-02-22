import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { TabAIDocument } from "./tabs/TabAI";
import { TabAIGeneral } from "./tabs/TabAIGeneral";
import { TabConfig } from "./tabs/TabConfig";
import { fetchConfigValidation, ConfigState, fetchProfiles, Profile, fetchGeneralButtons, GeneralButton, fetchDocTypes, DocType } from "../integrations/api/configClient";

type TabId = "home" | "config" | "obfuscate" | "ai-document" | "ai-general";

export function App(): React.ReactElement {
  const [configVisible, setConfigVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [configState, setConfigState] = useState<ConfigState>({ status: "loading" });

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedProfileName, setSelectedProfileName] = useState<string>("");

  const [generalButtons, setGeneralButtons] = useState<GeneralButton[]>([]);
  const [buttonColour, setButtonColour] = useState("#ebebeb");

  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [selectedDocTypeName, setSelectedDocTypeName] = useState<string>("");

  // Document summary refresh
  const [summaryKey, setSummaryKey] = useState(0);
  const activeTabRef = useRef<TabId>("home");
  const summaryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    fetchGeneralButtons()
      .then((gb) => {
        setGeneralButtons(gb.buttons);
        setButtonColour(gb.buttonColour);
      })
      .catch(() => { /* use defaults */ });

    fetchDocTypes()
      .then((dt) => {
        setDocTypes(dt);
        if (dt.length > 0) setSelectedDocTypeName(dt[0].name);
      })
      .catch(() => { /* leave empty */ });
  }, [runValidation]);

  // Keep ref in sync so Office callbacks can read current tab without stale closure
  useEffect(() => {
    activeTabRef.current = activeTab;
    // Always re-fetch when switching to Home tab
    if (activeTab === "home") {
      setSummaryKey((k) => k + 1);
    }
  }, [activeTab]);

  // Register Office document selection-change handler once on mount.
  // DocumentSelectionChanged fires after every edit (cursor moves with each keystroke),
  // so it reliably detects typing. Debounced to avoid rapid successive fetches.
  useEffect(() => {
    const handler = () => {
      if (summaryDebounceRef.current) clearTimeout(summaryDebounceRef.current);
      summaryDebounceRef.current = setTimeout(() => {
        if (activeTabRef.current === "home") {
          setSummaryKey((k) => k + 1);
        }
      }, 1000);
    };

    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      handler
    );

    return () => {
      Office.context.document.removeHandlerAsync(
        Office.EventType.DocumentSelectionChanged,
        { handler }
      );
    };
  }, []);

  const configHasIssues =
    configState.status === "unavailable" ||
    (configState.status === "done" && !configState.validation.valid);

  const selectedProfile = profiles.find((p) => p.name === selectedProfileName);
  const selectedDocType = docTypes.find((dt) => dt.name === selectedDocTypeName);
  const documentButtons = [...generalButtons, ...(selectedDocType?.buttons ?? [])];

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
            <Tab value="ai-document">AI Document</Tab>
            <Tab value="ai-general">AI General</Tab>
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
            docTypes={docTypes}
            selectedDocTypeName={selectedDocTypeName}
            onSelectDocTypeName={setSelectedDocTypeName}
            summaryKey={summaryKey}
          />)}
          {tabPane("obfuscate", <TabObfuscate isActive={activeTab === "obfuscate"} />)}
          {tabPane("ai-document", <TabAIDocument selectedProfile={selectedProfile} selectedDocTypeContext={selectedDocType?.context} generalButtons={documentButtons} buttonColour={buttonColour} />)}
          {tabPane("ai-general", <TabAIGeneral selectedProfile={selectedProfile} generalButtons={generalButtons} buttonColour={buttonColour} />)}
          {configVisible && tabPane("config", <TabConfig configState={configState} onRevalidate={runValidation} />)}
        </div>
    </FluentProvider>
  );
}
