/**
 * JLH Config Validator
 *
 * Runs a strictly ordered pipeline against Documents\JLH\config.xml.
 * Missing structural elements are added automatically.
 * Fields that require human values generate messages.
 *
 * Returns: { valid: boolean, messages: [{ level: 'info'|'warning'|'error', text: string }] }
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const { XMLParser, XMLBuilder } = require("fast-xml-parser");

// Use the Windows known-folder API so we land in the right Documents
// even when OneDrive has redirected the folder.
function getDocumentsPath() {
  try {
    return execSync(
      'powershell -NoProfile -Command "[Environment]::GetFolderPath(\'MyDocuments\')"',
      { encoding: "utf8" }
    ).trim();
  } catch {
    return path.join(os.homedir(), "Documents");
  }
}

const CONFIG_DIR = path.join(getDocumentsPath(), "JLH");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.xml");

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (tagName) => ["AI", "Profile", "Button", "DocType"].includes(tagName),
  allowBooleanAttributes: true,
  ignoreDeclaration: true,
  commentPropName: "#comment",
};

const BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  commentPropName: "#comment",
  indentBy: "  ",
  suppressEmptyNode: false,
};

const MINIMAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<JLHConfig>
</JLHConfig>
`;

const parser = new XMLParser(PARSER_OPTIONS);
const builder = new XMLBuilder(BUILDER_OPTIONS);

async function validate() {
  const messages = [];
  let dirty = false;

  // ── GROUP 1: FILE ─────────────────────────────────────────────────────────

  // Step 1: Config file exists
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, MINIMAL_XML, "utf8");
    messages.push({ level: "info", text: `Config file created at ${CONFIG_FILE}` });
  }

  // Parse file — bail out if not valid XML
  let config;
  try {
    const xmlText = fs.readFileSync(CONFIG_FILE, "utf8");
    config = parser.parse(xmlText);
  } catch (e) {
    messages.push({ level: "error", text: `Config file is not valid XML: ${e.message}` });
    return { valid: false, messages };
  }

  if (!config.JLHConfig) config.JLHConfig = {};

  // ── GROUP 2: AIs ──────────────────────────────────────────────────────────

  // Step 2: <AIs> exists
  if (config.JLHConfig.AIs === undefined || config.JLHConfig.AIs === "") {
    config.JLHConfig.AIs = { AI: [] };
    dirty = true;
    messages.push({ level: "info", text: "<AIs> section added to config" });
  }

  // Normalise: ensure AI is always an array
  if (!config.JLHConfig.AIs) config.JLHConfig.AIs = {};
  if (config.JLHConfig.AIs.AI === undefined) config.JLHConfig.AIs.AI = [];
  if (!Array.isArray(config.JLHConfig.AIs.AI)) {
    config.JLHConfig.AIs.AI = [config.JLHConfig.AIs.AI];
  }

  // Step 3: Gemini must always be present as a reference entry
  const hasGemini = config.JLHConfig.AIs.AI.some((ai) => ai["@_name"] === "Gemini");
  if (!hasGemini) {
    config.JLHConfig.AIs.AI.push({
      "@_name": "Gemini",
      company: "google",
      "#comment": [
        " Supported patterns: anthropic-messages | openai-compatible | gemini-generate ",
        " Enter the name of your API key as defined in the .env file. Get a free key at aistudio.google.com ",
      ],
      pattern: "gemini-generate",
      model: "gemini-1.5-flash",
      version: "1.5-flash",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      api_key_name: "",
      good_for: "General tasks, summarisation, and quick analysis — free tier available",
      description: "Google Gemini 1.5 Flash — free tier available at aistudio.google.com",
    });
    dirty = true;
    messages.push({ level: "info", text: "AIs > Gemini: added as default reference entry" });
  }

  // Steps 4–9: Check fields of each <AI>
  for (let i = 0; i < config.JLHConfig.AIs.AI.length; i++) {
    const ai = config.JLHConfig.AIs.AI[i];
    const aiLabel = ai["@_name"] ? `AI '${ai["@_name"]}'` : `AI[${i + 1}]`;

    const required = ["company", "pattern", "model", "version", "url"];
    const optional = ["description", "api_key_name", "good_for"];

    for (const field of required) {
      if (ai[field] === undefined) {
        ai[field] = "";
        dirty = true;
        messages.push({ level: "warning", text: `AIs > ${aiLabel} > ${field}: needs a value` });
      } else if (ai[field] === "" || ai[field] === null) {
        messages.push({ level: "warning", text: `AIs > ${aiLabel} > ${field}: needs a value` });
      }
    }

    for (const field of optional) {
      if (ai[field] === undefined) {
        ai[field] = "";
        dirty = true;
      }
    }

    // Backfill good_for for known AIs if the user left it blank
    if (ai["@_name"] === "Gemini" && !ai.good_for) {
      ai.good_for = "General tasks, summarisation, and quick analysis — free tier available";
      dirty = true;
    }

    // Step 9: api_key_name must exist in environment
    if (ai.api_key_name && process.env[ai.api_key_name] === undefined) {
      messages.push({
        level: "error",
        text: `AIs > ${aiLabel} > api_key_name: environment variable '${ai.api_key_name}' not found in .env`,
      });
    }
  }

  // ── GROUP 3: PROFILES ─────────────────────────────────────────────────────

  // Step 10: <Profiles> exists
  if (config.JLHConfig.Profiles === undefined || config.JLHConfig.Profiles === "") {
    config.JLHConfig.Profiles = { Profile: [] };
    dirty = true;
    messages.push({ level: "info", text: "<Profiles> section added to config" });
  }

  // Normalise: ensure Profile is always an array
  if (!config.JLHConfig.Profiles) config.JLHConfig.Profiles = {};
  if (config.JLHConfig.Profiles.Profile === undefined) config.JLHConfig.Profiles.Profile = [];
  if (!Array.isArray(config.JLHConfig.Profiles.Profile)) {
    config.JLHConfig.Profiles.Profile = [config.JLHConfig.Profiles.Profile];
  }

  // Step 11: Default profile must always be present
  const hasDefault = config.JLHConfig.Profiles.Profile.some((p) => p["@_Name"] === "Default");
  if (!hasDefault) {
    config.JLHConfig.Profiles.Profile.push({
      "@_Name": "Default",
      description: "Default profile",
      context: "",
      ai: "Gemini",
    });
    dirty = true;
    messages.push({ level: "info", text: "Profiles > Default: added as default reference profile" });
  }

  // Steps 12–17: Check fields of each <Profile>
  const validAiNames = config.JLHConfig.AIs.AI.map((ai) => ai["@_name"]).filter(Boolean);

  for (let i = 0; i < config.JLHConfig.Profiles.Profile.length; i++) {
    const profile = config.JLHConfig.Profiles.Profile[i];
    const profileLabel = profile["@_Name"] ? `Profile '${profile["@_Name"]}'` : `Profile[${i + 1}]`;

    // Step 12: Name attribute
    if (profile["@_Name"] === undefined) {
      profile["@_Name"] = "";
      dirty = true;
    }
    if (!profile["@_Name"]) {
      messages.push({ level: "warning", text: `Profiles > ${profileLabel} > Name attribute: missing` });
    }

    // Optional fields — ensure tag present, no message
    for (const field of ["description", "context"]) {
      if (profile[field] === undefined) {
        profile[field] = "";
        dirty = true;
      }
    }

    // Required fields
    for (const field of ["ai"]) {
      if (profile[field] === undefined) {
        profile[field] = "";
        dirty = true;
        messages.push({ level: "warning", text: `Profiles > ${profileLabel} > ${field}: needs a value` });
      } else if (profile[field] === "" || profile[field] === null) {
        messages.push({ level: "warning", text: `Profiles > ${profileLabel} > ${field}: needs a value` });
      }
    }

    // Step 17: <ai> must reference a defined AI
    if (profile.ai && !validAiNames.includes(String(profile.ai))) {
      messages.push({
        level: "warning",
        text: `Profiles > ${profileLabel} > ai: '${profile.ai}' is not defined in AIs`,
      });
    }
  }

  // ── GROUP 4: GENERAL BUTTONS ──────────────────────────────────────────────

  // Step 18: <GeneralButtons> exists with 'Button Colour' attribute
  if (config.JLHConfig.GeneralButtons === undefined || config.JLHConfig.GeneralButtons === "") {
    config.JLHConfig.GeneralButtons = { "@_Button Colour": "#ebebeb" };
    dirty = true;
    messages.push({ level: "info", text: "<GeneralButtons> section added to config" });
  } else {
    if (config.JLHConfig.GeneralButtons["@_Button Colour"] === undefined) {
      config.JLHConfig.GeneralButtons["@_Button Colour"] = "#ebebeb";
      dirty = true;
      messages.push({ level: "warning", text: "<GeneralButtons> Button Colour attribute missing — set to default (#ebebeb)" });
    }
  }

  // Normalise: ensure Button is always an array
  if (config.JLHConfig.GeneralButtons.Button === undefined) config.JLHConfig.GeneralButtons.Button = [];
  if (!Array.isArray(config.JLHConfig.GeneralButtons.Button)) {
    config.JLHConfig.GeneralButtons.Button = [config.JLHConfig.GeneralButtons.Button];
  }

  // Step 19: At least one <Button> must exist
  if (config.JLHConfig.GeneralButtons.Button.length === 0) {
    config.JLHConfig.GeneralButtons.Button.push({
      "@_name": "Summarise",
      description: "Summarises the document into a short overview of the key points.",
      context: "Summarise the following document concisely, highlighting the key points, main arguments, and any important conclusions. Keep the summary to 3–5 short paragraphs.",
    });
    dirty = true;
    messages.push({ level: "info", text: "GeneralButtons > Summarise button added as default reference entry" });
  }

  // Steps 20–22: Check fields of each <Button>
  for (let i = 0; i < config.JLHConfig.GeneralButtons.Button.length; i++) {
    const btn = config.JLHConfig.GeneralButtons.Button[i];
    const btnLabel = btn["@_name"] ? `Button '${btn["@_name"]}'` : `Button[${i + 1}]`;

    // Step 20: name attribute
    if (btn["@_name"] === undefined) {
      btn["@_name"] = "";
      dirty = true;
    }
    if (!btn["@_name"]) {
      messages.push({ level: "warning", text: `GeneralButtons > ${btnLabel} > name attribute: missing` });
    }

    // Step 21: description — optional, add silently if absent
    if (btn.description === undefined) {
      btn.description = "";
      dirty = true;
    }

    // Step 22: context — required, warn if blank
    if (btn.context === undefined) {
      btn.context = "";
      dirty = true;
      messages.push({ level: "warning", text: `GeneralButtons > ${btnLabel} > context: needs a value` });
    } else if (btn.context === "" || btn.context === null) {
      messages.push({ level: "warning", text: `GeneralButtons > ${btnLabel} > context: needs a value` });
    }
  }

  // ── GROUP 5: DOC TYPES ────────────────────────────────────────────────────

  // Step 23: <DocTypes> exists
  if (config.JLHConfig.DocTypes === undefined || config.JLHConfig.DocTypes === "") {
    config.JLHConfig.DocTypes = { DocType: [] };
    dirty = true;
    messages.push({ level: "info", text: "<DocTypes> section added to config" });
  }

  // Normalise: ensure DocType is always an array
  if (!config.JLHConfig.DocTypes) config.JLHConfig.DocTypes = {};
  if (config.JLHConfig.DocTypes.DocType === undefined) config.JLHConfig.DocTypes.DocType = [];
  if (!Array.isArray(config.JLHConfig.DocTypes.DocType)) {
    config.JLHConfig.DocTypes.DocType = [config.JLHConfig.DocTypes.DocType];
  }

  // Step 24: At least one <DocType> must exist
  if (config.JLHConfig.DocTypes.DocType.length === 0) {
    config.JLHConfig.DocTypes.DocType.push({
      "@_name": "General",
      description: "General documents that do not match any specific document type.",
      context: "",
    });
    dirty = true;
    messages.push({ level: "info", text: "DocTypes > General: added as default reference entry" });
  }

  // Steps 25–27: Check fields of each <DocType>
  for (let i = 0; i < config.JLHConfig.DocTypes.DocType.length; i++) {
    const dt = config.JLHConfig.DocTypes.DocType[i];
    const dtLabel = dt["@_name"] ? `DocType '${dt["@_name"]}'` : `DocType[${i + 1}]`;

    // Step 25: name attribute — required, warn if missing
    if (dt["@_name"] === undefined) {
      dt["@_name"] = "";
      dirty = true;
    }
    if (!dt["@_name"]) {
      messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > name attribute: missing` });
    }

    // Step 26: description — optional, add silently if absent
    if (dt.description === undefined) {
      dt.description = "";
      dirty = true;
    }

    // Step 27: context — optional, empty allowed; add silently if absent
    if (dt.context === undefined) {
      dt.context = "";
      dirty = true;
    }
  }

  // ── WRITE BACK IF MODIFIED ────────────────────────────────────────────────

  if (dirty) {
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(config);
    fs.writeFileSync(CONFIG_FILE, xml, "utf8");
  }

  const valid = !messages.some((m) => m.level === "warning" || m.level === "error");
  return { valid, messages };
}

// Read and parse config without running validation — for use by aiServer.js
function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const xmlText = fs.readFileSync(CONFIG_FILE, "utf8");
    const config = parser.parse(xmlText);
    return config.JLHConfig?.AIs?.AI ?? [];
  } catch {
    return null;
  }
}

// Return GeneralButtons config: button colour and button list
function readGeneralButtons() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const xmlText = fs.readFileSync(CONFIG_FILE, "utf8");
    const config = parser.parse(xmlText);
    const gb = config.JLHConfig?.GeneralButtons;
    if (!gb) return null;
    const buttonColour = gb["@_Button Colour"] || "#ebebeb";
    const raw = gb.Button ?? [];
    const buttons = (Array.isArray(raw) ? raw : [raw]).map((b) => ({
      name: b["@_name"] || "",
      description: b.description || "",
      context: b.context || "",
    }));
    return { buttonColour, buttons };
  } catch {
    return null;
  }
}

// Return profiles in XML order with Default moved to the end
function readProfiles() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const xmlText = fs.readFileSync(CONFIG_FILE, "utf8");
    const config = parser.parse(xmlText);
    const rawProfiles = config.JLHConfig?.Profiles?.Profile ?? [];
    const rawAIs = config.JLHConfig?.AIs?.AI ?? [];
    const ais = Array.isArray(rawAIs) ? rawAIs : [rawAIs];
    const profiles = (Array.isArray(rawProfiles) ? rawProfiles : [rawProfiles]).map((p) => {
      const aiName = p.ai || "";
      const aiEntry = ais.find((a) => a["@_name"] === aiName);
      return {
        name: p["@_Name"] || "",
        description: p.description || "",
        context: p.context || "",
        ai: aiName,
        aiVersion: aiEntry?.version || "",
        aiGoodFor: aiEntry?.good_for || "",
      };
    });
    const nonDefault = profiles.filter((p) => p.name !== "Default");
    const defaultProfile = profiles.filter((p) => p.name === "Default");
    return [...nonDefault, ...defaultProfile];
  } catch {
    return null;
  }
}

// Return all DocTypes as a flat array
function readDocTypes() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const xmlText = fs.readFileSync(CONFIG_FILE, "utf8");
    const config = parser.parse(xmlText);
    const raw = config.JLHConfig?.DocTypes?.DocType ?? [];
    return (Array.isArray(raw) ? raw : [raw]).map((dt) => ({
      name: dt["@_name"] || "",
      description: dt.description || "",
      context: dt.context || "",
    }));
  } catch {
    return null;
  }
}

module.exports = { validate, readConfig, readProfiles, readGeneralButtons, readDocTypes, CONFIG_FILE, CONFIG_DIR };
