const AI_SERVER = "http://localhost:3003";

export interface Profile {
  name: string;
  description: string;
  ai: string;
  aiVersion: string;
  aiGoodFor: string;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const res = await fetch(`${AI_SERVER}/config/profiles`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { profiles: Profile[] };
  return data.profiles;
}

export interface ConfigMessage {
  level: "info" | "warning" | "error";
  text: string;
}

export interface ConfigValidation {
  valid: boolean;
  messages: ConfigMessage[];
  configFile?: string;
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
