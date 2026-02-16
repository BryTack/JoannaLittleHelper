import { buildGreeting } from "../domain/messages";
import { insertParagraphAtStart } from "../integrations/word/wordClient";

export async function greet(): Promise<void> {
  const message = buildGreeting();
  await insertParagraphAtStart(message);
}
