import { fetchObfuscates, ObfuscateRule } from "./configClient";

const PRESIDIO_URL = "http://localhost:3002";

export interface EntityInfo {
  type: string;
  original: string;
  label: string;
  score: number;
}

export interface AnonymizeResult {
  text: string;
  entities: EntityInfo[];
}

// Cache custom rules for the session — fetched once, reused on subsequent calls.
// Avoids a config round-trip on every anonymize() while still picking up rules
// set before the first call (e.g. when the Obfuscate tab activates).
let rulesCache: ObfuscateRule[] | null = null;

async function getCustomRules(): Promise<ObfuscateRule[]> {
  if (rulesCache !== null) return rulesCache;
  try {
    rulesCache = await fetchObfuscates();
  } catch {
    rulesCache = [];
  }
  return rulesCache;
}

/** Sends text to the local Presidio service and returns the anonymised version. */
export async function anonymize(text: string, language = "en"): Promise<AnonymizeResult> {
  const custom_rules = await getCustomRules();
  const response = await fetch(`${PRESIDIO_URL}/anonymize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, custom_rules }),
  });

  if (!response.ok) {
    throw new Error(`Presidio returned ${response.status}`);
  }

  return response.json() as Promise<AnonymizeResult>;
}
