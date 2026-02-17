import { retrievePage1 } from "../integrations/word/documentTools";
import { countMatches } from "../domain/textSearch";

/** Retrieves the Page1 content (filename + first N chars of document body). */
export async function refreshPage1(): Promise<string> {
  return retrievePage1();
}

/** Counts occurrences of a query within the current Page1 text. */
export async function countPage1Matches(query: string): Promise<number> {
  const page1 = await retrievePage1();
  return countMatches(page1, query);
}
