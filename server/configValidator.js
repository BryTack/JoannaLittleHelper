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
  isArray: (tagName) => ["AI", "Profile", "Button", "DocType", "Obfuscate", "Instruction"].includes(tagName),
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

  // Step 18: <GeneralButtons> exists with 'buttonColour' attribute
  if (config.JLHConfig.GeneralButtons === undefined || config.JLHConfig.GeneralButtons === "") {
    config.JLHConfig.GeneralButtons = { "@_buttonColour": "#ebebeb" };
    dirty = true;
    messages.push({ level: "info", text: "<GeneralButtons> section added to config" });
  } else {
    if (config.JLHConfig.GeneralButtons["@_buttonColour"] === undefined) {
      config.JLHConfig.GeneralButtons["@_buttonColour"] = "#ebebeb";
      dirty = true;
      messages.push({ level: "warning", text: "<GeneralButtons> buttonColour attribute missing — set to default (#ebebeb)" });
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

    // Steps 28–30: Check buttons within this <DocType> (zero or more allowed)
    if (dt.Button === undefined) dt.Button = [];
    if (!Array.isArray(dt.Button)) dt.Button = [dt.Button];

    for (let j = 0; j < dt.Button.length; j++) {
      const btn = dt.Button[j];
      const btnLabel = btn["@_name"] ? `Button '${btn["@_name"]}'` : `Button[${j + 1}]`;

      // Step 28: name attribute — required, warn if missing
      if (btn["@_name"] === undefined) {
        btn["@_name"] = "";
        dirty = true;
      }
      if (!btn["@_name"]) {
        messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${btnLabel} > name attribute: missing` });
      }

      // Step 29: description — optional, add silently if absent
      if (btn.description === undefined) {
        btn.description = "";
        dirty = true;
      }

      // Step 30: context — required, warn if blank
      if (btn.context === undefined) {
        btn.context = "";
        dirty = true;
        messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${btnLabel} > context: needs a value` });
      } else if (btn.context === "" || btn.context === null) {
        messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${btnLabel} > context: needs a value` });
      }
    }

    // Obfuscate elements within this <DocType> (zero or more allowed)
    if (dt.Obfuscate === undefined) dt.Obfuscate = [];
    if (!Array.isArray(dt.Obfuscate)) dt.Obfuscate = [dt.Obfuscate];

    for (let k = 0; k < dt.Obfuscate.length; k++) {
      const rule = dt.Obfuscate[k];
      const ruleLabel = `Obfuscate[${k + 1}]`;

      if (!rule["@_match"]) {
        messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${ruleLabel} > match: missing (must be "text" or "regex")` });
      } else if (!["text", "regex"].includes(rule["@_match"])) {
        messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${ruleLabel} > match: "${rule["@_match"]}" is not valid` });
      }
      if (!rule["@_ReplaceText"]) {
        messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${ruleLabel} > ReplaceText: missing` });
      }
      if (rule["@_match"] === "text" && !rule["@_FindText"]) {
        messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${ruleLabel} > FindText: required when match="text"` });
      }
      if (rule["@_match"] === "regex" && !rule["@_pattern"]) {
        messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${ruleLabel} > pattern: required when match="regex"` });
      }
      if (rule["@_score"] !== undefined) {
        const s = parseFloat(rule["@_score"]);
        if (isNaN(s) || s < 0 || s > 1) {
          messages.push({ level: "warning", text: `DocTypes > ${dtLabel} > ${ruleLabel} > score: must be 0–1` });
        }
      }
    }
  }

  // ── GROUP 6: OBFUSCATES ───────────────────────────────────────────────────

  // Step 31: <Obfuscates> must exist
  if (config.JLHConfig.Obfuscates === undefined || config.JLHConfig.Obfuscates === "") {
    config.JLHConfig.Obfuscates = {};
    dirty = true;
    messages.push({ level: "info", text: "<Obfuscates> section added to config" });
  }

  // Normalise: ensure Obfuscate is always an array
  if (!config.JLHConfig.Obfuscates) config.JLHConfig.Obfuscates = {};
  if (config.JLHConfig.Obfuscates.Obfuscate === undefined) config.JLHConfig.Obfuscates.Obfuscate = [];
  if (!Array.isArray(config.JLHConfig.Obfuscates.Obfuscate)) {
    config.JLHConfig.Obfuscates.Obfuscate = [config.JLHConfig.Obfuscates.Obfuscate];
  }

  // Steps 32–37: Validate each <Obfuscate>
  for (let i = 0; i < config.JLHConfig.Obfuscates.Obfuscate.length; i++) {
    const rule = config.JLHConfig.Obfuscates.Obfuscate[i];
    const ruleLabel = `Obfuscate[${i + 1}]`;

    // Step 32: match attribute — required, must be "text" or "regex"
    if (!rule["@_match"]) {
      messages.push({ level: "warning", text: `Obfuscates > ${ruleLabel} > match attribute: missing (must be "text" or "regex")` });
    } else if (!["text", "regex"].includes(rule["@_match"])) {
      messages.push({ level: "warning", text: `Obfuscates > ${ruleLabel} > match: "${rule["@_match"]}" is not valid (must be "text" or "regex")` });
    }

    // Step 33: ReplaceText attribute — required, non-empty
    if (!rule["@_ReplaceText"]) {
      messages.push({ level: "warning", text: `Obfuscates > ${ruleLabel} > ReplaceText attribute: missing` });
    }

    // Step 34: FindText required when match="text"
    if (rule["@_match"] === "text" && !rule["@_FindText"]) {
      messages.push({ level: "warning", text: `Obfuscates > ${ruleLabel} > FindText attribute: required when match="text"` });
    }

    // Step 35: pattern required when match="regex"
    if (rule["@_match"] === "regex" && !rule["@_pattern"]) {
      messages.push({ level: "warning", text: `Obfuscates > ${ruleLabel} > pattern attribute: required when match="regex"` });
    }

    // Step 36: score (regex only) — if present, must be numeric 0–1
    if (rule["@_score"] !== undefined) {
      const s = parseFloat(rule["@_score"]);
      if (isNaN(s) || s < 0 || s > 1) {
        messages.push({ level: "warning", text: `Obfuscates > ${ruleLabel} > score: must be a number between 0 and 1` });
      }
    }

    // Step 37: replacement — optional, any string or "mask" — no validation needed
  }

  // ── GROUP 7: INSTRUCTIONS ─────────────────────────────────────────────────

  // Step 38: <Instructions> must exist
  if (config.JLHConfig.Instructions === undefined || config.JLHConfig.Instructions === "") {
    config.JLHConfig.Instructions = {};
    dirty = true;
    messages.push({ level: "info", text: "<Instructions> section added to config" });
  }

  // Normalise: ensure Instruction is always an array
  if (!config.JLHConfig.Instructions) config.JLHConfig.Instructions = {};
  if (config.JLHConfig.Instructions.Instruction === undefined) config.JLHConfig.Instructions.Instruction = [];
  if (!Array.isArray(config.JLHConfig.Instructions.Instruction)) {
    config.JLHConfig.Instructions.Instruction = [config.JLHConfig.Instructions.Instruction];
  }

  // Step 39: At least one <Instruction> — add two defaults if none defined
  if (config.JLHConfig.Instructions.Instruction.length === 0) {
    config.JLHConfig.Instructions.Instruction.push(
      {
        "@_Name": "Format",
        "@_Description": "Ask the AI to return its response as Markdown",
        "@_Default": "true",
        "#text": "Return your response in MarkDown format.",
      },
      {
        "@_Name": "Give Para",
        "@_Description": "Ask the AI to cite paragraph numbers for exact quotes",
        "@_Default": "true",
        "#text": "When your response references an exact phrase or sentence also include the paragraph number. Use format '[[Para Number]]'",
      },
    );
    dirty = true;
    messages.push({ level: "info", text: "Instructions > Format and Give Para added as default reference entries" });
  }

  // Steps 40–43: Validate each <Instruction>
  for (let i = 0; i < config.JLHConfig.Instructions.Instruction.length; i++) {
    const inst = config.JLHConfig.Instructions.Instruction[i];
    const instLabel = inst["@_Name"] ? `Instruction '${inst["@_Name"]}'` : `Instruction[${i + 1}]`;

    // Step 40: Name attribute — required
    if (!inst["@_Name"]) {
      messages.push({ level: "warning", text: `Instructions > ${instLabel} > Name attribute: missing` });
    }

    // Step 41: Description — optional, no validation needed

    // Step 42: Instruction text content — required
    if (!String(inst["#text"] || "").trim()) {
      messages.push({ level: "warning", text: `Instructions > ${instLabel} > instruction text: missing` });
    }

    // Step 43: Default — optional; if present must be "true" or "false"
    if (inst["@_Default"] !== undefined) {
      const d = String(inst["@_Default"]).toLowerCase();
      if (d !== "true" && d !== "false") {
        messages.push({ level: "warning", text: `Instructions > ${instLabel} > Default: must be "true" or "false"` });
      }
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
    const buttonColour = gb["@_buttonColour"] || "#ebebeb";
    const raw = gb.Button ?? [];
    const buttons = (Array.isArray(raw) ? raw : [raw]).map((b) => {
      const btn = { name: b["@_name"] || "", description: b.description || "", context: b.context || "" };
      const override = b["@_buttonColour"];
      if (override) btn.colour = override;
      return btn;
    });
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
    return (Array.isArray(raw) ? raw : [raw]).map((dt) => {
      const docTypeColour = dt["@_buttonColour"] || null;
      const rawBtns = dt.Button ?? [];
      const buttons = (Array.isArray(rawBtns) ? rawBtns : [rawBtns]).map((b) => {
        const btn = { name: b["@_name"] || "", description: b.description || "", context: b.context || "" };
        const colour = b["@_buttonColour"] || docTypeColour;
        if (colour) btn.colour = colour;
        return btn;
      });
      const rawObf = dt.Obfuscate ?? [];
      const obfuscates = (Array.isArray(rawObf) ? rawObf : [rawObf])
        .map((item) => {
          const rule = { match: item["@_match"] || "", replaceText: item["@_ReplaceText"] || "" };
          if (item["@_FindText"]    !== undefined) rule.findText    = String(item["@_FindText"]);
          if (item["@_pattern"]     !== undefined) rule.pattern     = String(item["@_pattern"]);
          if (item["@_score"]       !== undefined) rule.score       = parseFloat(item["@_score"]);
          if (item["@_replacement"] !== undefined) rule.replacement = String(item["@_replacement"]);
          return rule;
        })
        .filter((r) => r.match && r.replaceText);
      const rawInst = dt.Instruction ?? [];
      const instructions = (Array.isArray(rawInst) ? rawInst : [rawInst])
        .map((item) => ({
          name:        item["@_Name"]        || "",
          description: item["@_Description"] || "",
          instruction: String(item["#text"]  || "").trim(),
          default:     item["@_Default"] === "true" || item["@_Default"] === true,
        }))
        .filter((i) => i.name && i.instruction);
      return {
        name: dt["@_name"] || "",
        description: dt.description || "",
        context: dt.context || "",
        buttons,
        obfuscates,
        instructions,
      };
    });
  } catch {
    return null;
  }
}

// Return all Obfuscate rules as a flat array of rule objects
function readObfuscates() {
  if (!fs.existsSync(CONFIG_FILE)) return [];
  try {
    const xmlText = fs.readFileSync(CONFIG_FILE, "utf8");
    const config = parser.parse(xmlText);
    const raw = config.JLHConfig?.Obfuscates?.Obfuscate ?? [];
    const items = Array.isArray(raw) ? raw : [raw];
    return items
      .map((item) => {
        const rule = {
          match: item["@_match"] || "",
          replaceText: item["@_ReplaceText"] || "",
        };
        if (item["@_FindText"]    !== undefined) rule.findText    = String(item["@_FindText"]);
        if (item["@_pattern"]     !== undefined) rule.pattern     = String(item["@_pattern"]);
        if (item["@_score"]       !== undefined) rule.score       = parseFloat(item["@_score"]);
        if (item["@_replacement"] !== undefined) rule.replacement = String(item["@_replacement"]);
        return rule;
      })
      .filter((r) => r.match && r.replaceText); // discard incomplete rules
  } catch {
    return [];
  }
}

// Return all Instructions as a flat array
function readInstructions() {
  if (!fs.existsSync(CONFIG_FILE)) return [];
  try {
    const xmlText = fs.readFileSync(CONFIG_FILE, "utf8");
    const config = parser.parse(xmlText);
    const raw = config.JLHConfig?.Instructions?.Instruction ?? [];
    const items = Array.isArray(raw) ? raw : [raw];
    return items
      .map((item) => ({
        name:        item["@_Name"]        || "",
        description: item["@_Description"] || "",
        instruction: String(item["#text"]  || "").trim(),
        default:     item["@_Default"] === "true" || item["@_Default"] === true,
      }))
      .filter((i) => i.name && i.instruction);
  } catch {
    return [];
  }
}

module.exports = { validate, readConfig, readProfiles, readGeneralButtons, readDocTypes, readObfuscates, readInstructions, CONFIG_FILE, CONFIG_DIR };
