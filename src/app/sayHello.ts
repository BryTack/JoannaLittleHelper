import { buildHelloMessage } from "../domain/messages";
import { insertParagraphAtStart } from "../integrations/word/wordClient";

export async function sayHello(): Promise<void> {
  const message = buildHelloMessage();
  await insertParagraphAtStart(message);
}
