const AI_SERVER = "http://localhost:3003";

export interface ConfigMessage {
  level: "info" | "warning" | "error";
  text: string;
}

export interface ConfigValidation {
  valid: boolean;
  messages: ConfigMessage[];
}

export type ConfigState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "done"; validation: ConfigValidation };

export async function fetchConfigValidation(): Promise<ConfigValidation> {
  const res = await fetch(`${AI_SERVER}/config/validate`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ConfigValidation>;
}
