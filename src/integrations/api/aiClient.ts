const AI_SERVER = "http://localhost:3003";

export interface AiOption {
  name: string;
  description: string;
}

export async function fetchAvailableAIs(): Promise<AiOption[]> {
  const res = await fetch(`${AI_SERVER}/config/ais`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { ais: AiOption[] };
  return data.ais;
}

export async function sendMessage(prompt: string, aiName: string, context?: string, documentText?: string): Promise<string> {
  const res = await fetch(`${AI_SERVER}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aiName, context, documentText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error ?? `AI server returned ${res.status}`);
  }
  const data = await res.json() as { text: string };
  return data.text;
}
