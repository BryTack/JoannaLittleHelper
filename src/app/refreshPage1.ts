import { retrievePage1 } from "../integrations/word/documentTools";

/** Retrieves the Page1 content (filename + first N chars of document body). */
export async function refreshPage1(): Promise<string> {
  return retrievePage1();
}
