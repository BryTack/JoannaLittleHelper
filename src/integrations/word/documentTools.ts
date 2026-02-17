/**
 * documentTools.ts — Word document querying, extraction, and highlighting.
 *
 * All functions operate within a Word.run() context.
 * Pure logic (deciding *what* to find or highlight) belongs in src/domain/.
 */

/** Represents a located piece of text within the document. */
export interface DocumentFragment {
  text: string;
  paragraphIndex: number;
}

/** Returns the full body text of the active document. */
export async function getBodyText(): Promise<string> {
  let text = "";
  await Word.run(async (context) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    text = body.text;
  });
  return text;
}

/** Returns the currently selected text, or empty string if nothing is selected. */
export async function getSelectedText(): Promise<string> {
  let text = "";
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();
    text = selection.text;
  });
  return text;
}

/** Returns all paragraphs as an array of DocumentFragments. */
export async function getParagraphs(): Promise<DocumentFragment[]> {
  const fragments: DocumentFragment[] = [];
  await Word.run(async (context) => {
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load("text");
    await context.sync();
    for (let i = 0; i < paragraphs.items.length; i++) {
      fragments.push({ text: paragraphs.items[i].text, paragraphIndex: i });
    }
  });
  return fragments;
}

/** Searches the document for a text string and returns all matches. */
export async function searchText(query: string): Promise<DocumentFragment[]> {
  const fragments: DocumentFragment[] = [];
  await Word.run(async (context) => {
    const results = context.document.body.search(query, { matchWholeWord: false, matchCase: false });
    results.load("text");
    await context.sync();
    for (let i = 0; i < results.items.length; i++) {
      fragments.push({ text: results.items[i].text, paragraphIndex: i });
    }
  });
  return fragments;
}

/** Highlights all occurrences of a text string with the given colour. */
export async function highlightMatches(query: string, colour = "Yellow"): Promise<number> {
  let count = 0;
  await Word.run(async (context) => {
    const results = context.document.body.search(query, { matchWholeWord: false, matchCase: false });
    results.load("font");
    await context.sync();
    for (const item of results.items) {
      item.font.highlightColor = colour;
    }
    count = results.items.length;
    await context.sync();
  });
  return count;
}

/** Removes highlighting from the entire document body. */
export async function clearHighlights(): Promise<void> {
  await Word.run(async (context) => {
    const body = context.document.body;
    body.font.highlightColor = null;
    await context.sync();
  });
}
