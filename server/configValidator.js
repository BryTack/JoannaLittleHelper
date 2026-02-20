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
  isArray: (tagName) => ["AI", "Profile"].includes(tagName),
  allowBooleanAttributes: true,
  ignoreDeclaration: true,
};

const BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
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
      model: "gemini-1.5-flash",
      version: "1.5-flash",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      api_key_name: "GEMINI_API_KEY",
      description: "Google Gemini 1.5 Flash — free tier available at aistudio.google.com",
    });
    dirty = true;
    messages.push({ level: "info", text: "AIs > Gemini: added as default reference entry" });
  }

  // Steps 4–9: Check fields of each <AI>
  for (let i = 0; i < config.JLHConfig.AIs.AI.length; i++) {
    const ai = config.JLHConfig.AIs.AI[i];
    const aiLabel = ai["@_name"] ? `AI '${ai["@_name"]}'` : `AI[${i + 1}]`;

    const required = ["company", "model", "version", "url", "api_key_name"];
    const optional = ["description"];

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
    if (profile.description === undefined) {
      profile.description = "";
      dirty = true;
    }

    // Required fields
    for (const field of ["context", "ai"]) {
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
        level: "error",
        text: `Profiles > ${profileLabel} > ai: '${profile.ai}' is not defined in AIs`,
      });
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

module.exports = { validate, CONFIG_FILE, CONFIG_DIR };
