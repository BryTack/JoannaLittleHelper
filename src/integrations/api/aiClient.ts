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

export async function streamMessage(
  prompt: string,
  aiName: string,
  onChunk: (chunk: string) => void,
  context?: string,
  documentText?: string,
): Promise<void> {
  const res = await fetch(`${AI_SERVER}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aiName, context, documentText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error ?? `AI server returned ${res.status}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const event = JSON.parse(data) as { chunk?: string; error?: string };
        if (event.error) throw new Error(event.error);
        if (event.chunk) onChunk(event.chunk);
      } catch (e) {
        if (e instanceof Error && e.message !== data) throw e;
      }
    }
  }
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
