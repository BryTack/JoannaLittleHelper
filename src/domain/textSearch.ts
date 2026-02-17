/** Represents a match found within a text string. */
export interface TextMatch {
  text: string;
  index: number;
}

/** Returns all case-insensitive occurrences of query within text. */
export function findMatches(text: string, query: string): TextMatch[] {
  if (!query) return [];

  const matches: TextMatch[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let start = 0;

  while (true) {
    const index = lowerText.indexOf(lowerQuery, start);
    if (index === -1) break;
    matches.push({ text: text.substring(index, index + query.length), index });
    start = index + 1;
  }

  return matches;
}

/** Returns the number of case-insensitive occurrences of query within text. */
export function countMatches(text: string, query: string): number {
  return findMatches(text, query).length;
}

/** Returns true if text contains at least one case-insensitive match of query. */
export function containsMatch(text: string, query: string): boolean {
  return findMatches(text, query).length > 0;
}
