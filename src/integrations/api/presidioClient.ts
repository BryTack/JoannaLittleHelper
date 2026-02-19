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

/** Sends text to the local Presidio service and returns the anonymised version. */
export async function anonymize(text: string, language = "en"): Promise<AnonymizeResult> {
  const response = await fetch(`${PRESIDIO_URL}/anonymize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });

  if (!response.ok) {
    throw new Error(`Presidio returned ${response.status}`);
  }

  return response.json() as Promise<AnonymizeResult>;
}
