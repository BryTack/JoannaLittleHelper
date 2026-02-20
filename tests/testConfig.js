/**
 * JLH Config Test Runner
 *
 * Runs the config validation pipeline and prints results.
 * Does not require Word, Presidio, or the AI server to be running.
 *
 * Usage:
 *   node --env-file=.env tests\testConfig.js
 */

const { validate, CONFIG_FILE } = require("../server/configValidator");

const ICONS = { info: "ℹ", warning: "⚠", error: "✗" };

async function run() {
  console.log("JLH Config Validator");
  console.log("═".repeat(50));
  console.log(`File: ${CONFIG_FILE}\n`);

  const result = await validate();

  if (result.messages.length === 0) {
    console.log("  No issues found.");
  } else {
    for (const msg of result.messages) {
      console.log(`  ${ICONS[msg.level] || "?"} [${msg.level.toUpperCase()}] ${msg.text}`);
    }
  }

  console.log("\n" + "═".repeat(50));
  console.log(`Result: ${result.valid ? "VALID ✓" : "NEEDS ATTENTION ✗"}`);
  console.log("═".repeat(50));
}

run().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
