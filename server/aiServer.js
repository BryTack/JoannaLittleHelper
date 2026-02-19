/**
 * JLH AI Proxy Server
 * Runs on localhost:3003 — proxies AI requests so the API key never reaches the browser.
 *
 * Start with:
 *   node --env-file=.env server\aiServer.js
 */

const http = require("http");
const Anthropic = require("@anthropic-ai/sdk");

const PORT = 3003;
const ALLOWED_ORIGIN = "https://localhost:3000";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey === "your-api-key-here") {
  console.error("[AI] ANTHROPIC_API_KEY not set. Edit .env in the project root.");
  process.exit(1);
}

const client = new Anthropic.default({ apiKey });

// Provider configurations — add new providers here
const PROVIDERS = {
  claude: {
    async chat(prompt) {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      const block = message.content[0];
      return block.type === "text" ? block.text : "";
    },
  },
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { prompt, provider = "claude" } = JSON.parse(body);
        const handler = PROVIDERS[provider];
        if (!handler) {
          sendJson(res, 400, { error: `Unknown provider: ${provider}` });
          return;
        }
        const text = await handler.chat(prompt);
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
