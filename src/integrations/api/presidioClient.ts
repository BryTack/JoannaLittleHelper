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

// ── Session-only obfuscation terms (blacklist) ────────────────────────────────
// Added at runtime via the Obfuscate tab context menu. Never persisted.

const sessionTerms: string[] = [];

// ── Session-only allow list (whitelist) ───────────────────────────────────────
// Added at runtime via the entity list context menu. Never persisted.

const sessionAllowList: string[] = [];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Add a term to the session allow list — Presidio won't obfuscate it this session. */
export function addSessionAllow(term: string): void {
  const t = term.trim();
  if (!t) return;
  if (!sessionAllowList.some((s) => s.toLowerCase() === t.toLowerCase())) {
    sessionAllowList.push(t);
  }
}

/** Remove a term from the session blacklist. */
export function removeSessionTerm(term: string): void {
  const t = term.trim().toLowerCase();
  const idx = sessionTerms.findIndex((s) => s.toLowerCase() === t);
  if (idx !== -1) sessionTerms.splice(idx, 1);
}

/** Add a term to the session-only obfuscation list (case-insensitive dedup). */
export function addSessionTerm(term: string): void {
  const t = term.trim();
  if (!t) return;
  if (!sessionTerms.some((s) => s.toLowerCase() === t.toLowerCase())) {
    sessionTerms.push(t);
  }
}

/** Replace all session terms in text with same-length strings of X characters. */
export function applySessionTerms(text: string): string {
  let result = text;
  for (const term of sessionTerms) {
    result = result.replace(
      new RegExp(escapeRegex(term), "gi"),
      (match) => "X".repeat(match.length),
    );
  }
  return result;
}

/** Sends text to the local Presidio service and returns the anonymised version. */
export async function anonymize(text: string, language = "en", extraRules: ObfuscateRule[] = []): Promise<AnonymizeResult> {
  const custom_rules = [...(await getCustomRules()), ...extraRules];
  const response = await fetch(`${PRESIDIO_URL}/anonymize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, custom_rules }),
  });

  if (!response.ok) {
    throw new Error(`Presidio returned ${response.status}`);
  }

  const result = await response.json() as AnonymizeResult;

  // Reverse substitutions for any term in the session allow list
  if (sessionAllowList.length > 0) {
    const reverseMap = new Map<string, string>(); // label → original
    result.entities = result.entities.filter((e) => {
      if (sessionAllowList.some((a) => a.toLowerCase() === e.original.toLowerCase())) {
        reverseMap.set(e.label, e.original);
        return false;
      }
      return true;
    });
    for (const [label, original] of reverseMap) {
      result.text = result.text.split(label).join(original);
    }
  }

  result.text = applySessionTerms(result.text);
  return result;
}
