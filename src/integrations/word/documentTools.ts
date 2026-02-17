/**
 * documentTools.ts — Word document querying, extraction, and highlighting.
 *
 * All functions operate within a Word.run() context.
 * Pure logic (deciding *what* to find or highlight) belongs in src/domain/.
 */

import { findMatches, TextMatch } from "../../domain/textSearch";

/** Maximum number of characters to include in Page1 content. */
export const PAGE1_LENGTH = 1200;

/** Placeholder name used when the document has no user-saved filename. */
const NO_NAME = "<<NoName>>";

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

/**
 * Retrieves "Page1": the document filename (without extension) wrapped in %%% delimiters,
 * followed by the first PAGE1_LENGTH characters of the document body.
 * If the filename is unavailable, the %%% section is omitted.
 */
export async function retrievePage1(): Promise<string> {
  let bodyText = "";
  let fileName = "";

  await Word.run(async (context) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    bodyText = body.text;
  });

  try {
    const url = Office.context.document.url;
    if (url) {
      const fullName = url.replace(/\\/g, "/").split("/").pop() || "";
      const nameWithoutExt = fullName.replace(/\.[^.]+$/, "");
      // Detect unsaved/temp documents: empty name, Word's default "DocumentN", or sideload temp files
      const isTempName = /^Document\d*$/i.test(nameWithoutExt)
        || /^Word add-in /i.test(nameWithoutExt);
      if (!nameWithoutExt || isTempName) {
        fileName = NO_NAME;
      } else {
        fileName = nameWithoutExt;
      }
    } else {
      fileName = NO_NAME;
    }
  } catch {
    fileName = NO_NAME;
  }

  return `%%%${fileName}%%%\n` + bodyText.substring(0, PAGE1_LENGTH);
}

/** Searches Page1 text for all case-insensitive occurrences of query. */
export async function searchPage1(query: string): Promise<TextMatch[]> {
  const page1 = await retrievePage1();
  return findMatches(page1, query);
}

/** Searches full document body for all case-insensitive occurrences of query. */
export async function searchDocument(query: string): Promise<TextMatch[]> {
  const body = await getBodyText();
  return findMatches(body, query);
}

/** Removes highlighting from the entire document body. */
export async function clearHighlights(): Promise<void> {
  await Word.run(async (context) => {
    const body = context.document.body;
    body.font.highlightColor = null;
    await context.sync();
  });
}
