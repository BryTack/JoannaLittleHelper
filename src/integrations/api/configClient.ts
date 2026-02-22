const AI_SERVER = "http://localhost:3003";

export interface Profile {
  name: string;
  description: string;
  context: string;
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

export interface GeneralButton {
  name: string;
  description: string;
  context: string;
  colour?: string;
}

export interface DocType {
  name: string;
  description: string;
  context: string;
  buttons: GeneralButton[];
  obfuscates: ObfuscateRule[];
  instructions: Instruction[];
}

export async function fetchDocTypes(): Promise<DocType[]> {
  const res = await fetch(`${AI_SERVER}/config/doctypes`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { docTypes: DocType[] };
  return data.docTypes;
}

export interface GeneralButtons {
  buttonColour: string;
  buttons: GeneralButton[];
}

export async function fetchGeneralButtons(): Promise<GeneralButtons> {
  const res = await fetch(`${AI_SERVER}/config/buttons`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<GeneralButtons>;
}

export interface ObfuscateRule {
  match: "text" | "regex";
  replaceText: string;
  findText?: string;
  pattern?: string;
  score?: number;
  replacement?: string;
}

export async function fetchObfuscates(): Promise<ObfuscateRule[]> {
  const res = await fetch(`${AI_SERVER}/config/obfuscates`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { rules: ObfuscateRule[] };
  return data.rules;
}

export interface Instruction {
  name: string;
  description: string;
  instruction: string;
  default: boolean;
}

export async function fetchInstructions(): Promise<Instruction[]> {
  const res = await fetch(`${AI_SERVER}/config/instructions`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { instructions: Instruction[] };
  return data.instructions;
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
