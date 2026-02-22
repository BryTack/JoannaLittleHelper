/**
 * JLH AI Proxy Server
 * Runs on localhost:3003 — proxies AI requests so API keys never reach the browser.
 *
 * Start with:
 *   node --env-file=.env server\aiServer.js
 */

const http = require("http");
const { validate, readConfig, readProfiles, readGeneralButtons, readDocTypes, readObfuscates, CONFIG_FILE } = require("./configValidator");

const PORT = 3003;
const ALLOWED_ORIGIN = "https://localhost:3000";

// ── PATTERN ADAPTERS ──────────────────────────────────────────────────────────
// Each adapter receives (url, model, apiKey, prompt) from the config entry.
// Add new patterns here — no other code changes needed.

const PATTERNS = {
  "anthropic-messages": async (url, model, apiKey, prompt, systemPrompt, documentText) => {
    // Anthropic best practice: wrap document content in XML tags in the user turn
    const userMessage = documentText
      ? `<document>\n${documentText}\n</document>\n\n${prompt}`
      : prompt;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return data.content[0].text;
  },

  "openai-compatible": async (url, model, apiKey, prompt, systemPrompt, documentText) => {
    const userMessage = documentText
      ? `Document:\n${documentText}\n\n---\n\n${prompt}`
      : prompt;
    const messages = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: userMessage },
    ];
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return data.choices[0].message.content;
  },

  "gemini-generate": async (url, _model, apiKey, prompt, systemPrompt, documentText) => {
    const userMessage = documentText
      ? `Document:\n${documentText}\n\n---\n\n${prompt}`
      : prompt;
    const fullUrl = apiKey ? `${url}?key=${apiKey}` : url;
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
        contents: [{ parts: [{ text: userMessage }] }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return data.candidates[0].content.parts[0].text;
  },
};

// ── SERVER ────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /config/validate — run the full validation pipeline
  if (req.method === "GET" && req.url === "/config/validate") {
    validate()
      .then((result) => sendJson(res, 200, { ...result, configFile: CONFIG_FILE }))
      .catch((err) => sendJson(res, 500, { error: err.message }));
    return;
  }

  // GET /config/ais — return list of configured AIs for the UI dropdown
  if (req.method === "GET" && req.url === "/config/ais") {
    const ais = readConfig();
    if (!ais) {
      sendJson(res, 503, { error: "Config not available" });
      return;
    }
    const list = ais
      .filter((ai) => ai["@_name"] && ai.pattern && ai.url)
      .map((ai) => ({ name: ai["@_name"], description: ai.description || "" }));
    sendJson(res, 200, { ais: list });
    return;
  }

  // GET /config/profiles — return profiles in XML order, Default last
  if (req.method === "GET" && req.url === "/config/profiles") {
    const profiles = readProfiles();
    if (!profiles) {
      sendJson(res, 503, { error: "Config not available" });
      return;
    }
    sendJson(res, 200, { profiles });
    return;
  }

  // GET /config/doctypes — return list of document types
  if (req.method === "GET" && req.url === "/config/doctypes") {
    const docTypes = readDocTypes();
    if (!docTypes) {
      sendJson(res, 503, { error: "Config not available" });
      return;
    }
    sendJson(res, 200, { docTypes });
    return;
  }

  // GET /config/buttons — return GeneralButtons config
  if (req.method === "GET" && req.url === "/config/buttons") {
    const gb = readGeneralButtons();
    if (!gb) {
      sendJson(res, 503, { error: "Config not available" });
      return;
    }
    sendJson(res, 200, gb);
    return;
  }

  // GET /config/obfuscates — return custom obfuscation rules
  if (req.method === "GET" && req.url === "/config/obfuscates") {
    const rules = readObfuscates();
    sendJson(res, 200, { rules });
    return;
  }

  // POST /chat — send a prompt to a configured AI
  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { prompt, aiName, context, documentText } = JSON.parse(body);

        const ais = readConfig();
        if (!ais) {
          sendJson(res, 503, { error: "Config file not found — run start-jlh.bat" });
          return;
        }

        const ai = ais.find((a) => a["@_name"] === aiName);
        if (!ai) {
          sendJson(res, 400, { error: `AI '${aiName}' not found in config` });
          return;
        }

        const adapter = PATTERNS[ai.pattern];
        if (!adapter) {
          sendJson(res, 400, { error: `Unknown pattern '${ai.pattern}' for AI '${aiName}'` });
          return;
        }

        const apiKey = ai.api_key_name ? process.env[ai.api_key_name] : undefined;
        if (ai.api_key_name && !apiKey) {
          sendJson(res, 503, { error: `API key '${ai.api_key_name}' not set in .env` });
          return;
        }

        const text = await adapter(ai.url, ai.model, apiKey, prompt, context || "", documentText || "");
        sendJson(res, 200, { text });
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

server.listen(PORT, "localhost", () => {
  console.log(`[AI] Ready on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  console.log("\n[AI] Stopped.");
  process.exit(0);
});
