const AI_SERVER_URL = "http://localhost:3003";

/** Implement this interface to add a new AI provider. */
export interface AiProvider {
  id: string;
  name: string;
  sendMessage(prompt: string): Promise<string>;
}

class ClaudeProvider implements AiProvider {
  readonly id = "claude";
  readonly name = "Claude";

  async sendMessage(prompt: string): Promise<string> {
    const response = await fetch(`${AI_SERVER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, provider: this.id }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error((err as { error: string }).error ?? `AI server returned ${response.status}`);
    }

    const data = await response.json() as { text: string };
    return data.text;
  }
}

/** All available providers — add new ones here. */
export const providers: Record<string, AiProvider> = {
  claude: new ClaudeProvider(),
};

/** The currently active provider. Will be driven by Config tab in future. */
export const activeProvider: AiProvider = providers["claude"];
