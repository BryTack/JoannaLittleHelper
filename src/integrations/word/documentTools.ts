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

/**
 * Returns the selected text if a non-empty selection exists,
 * otherwise returns the full document body text.
 * Single Word.run round-trip.
 */
export async function getTextForAnonymization(): Promise<{ text: string; isSelection: boolean }> {
  let text = "";
  let isSelection = false;
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    const body = context.document.body;
    selection.load("text");
    body.load("text");
    await context.sync();
    if (selection.text.trim()) {
      text = selection.text;
      isSelection = true;
    } else {
      text = body.text;
    }
  });
  return { text, isSelection };
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

/**
 * Selects a specific occurrence (zero-based, wraps around) of a text string in the document.
 * Returns total match count; 0 if none found.
 */
export async function selectOccurrence(query: string, index: number): Promise<number> {
  let count = 0;
  await Word.run(async (context) => {
    const results = context.document.body.search(query, { matchWholeWord: false, matchCase: false });
    results.load("text");
    await context.sync();
    count = results.items.length;
    if (count > 0) {
      const i = ((index % count) + count) % count;
      results.items[i].select();
      await context.sync();
    }
  });
  return count;
}

/**
 * Selects and scrolls to the paragraph at the given zero-based index.
 * Returns true if the index was in range.
 */
export async function selectParagraph(index: number): Promise<boolean> {
  let found = false;
  await Word.run(async (context) => {
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load("text");
    await context.sync();
    if (index >= 0 && index < paragraphs.items.length) {
      paragraphs.items[index].getRange().select();
      await context.sync();
      found = true;
    }
  });
  return found;
}

/** Removes highlighting from the entire document body. */
export async function clearHighlights(): Promise<void> {
  await Word.run(async (context) => {
    const body = context.document.body;
    body.font.highlightColor = null;
    await context.sync();
  });
}

export interface DocumentSummary {
  fileName: string;
  title: string;
  subject: string;
  author: string;
  keywords: string;
  description: string;  // maps to props.comments in the Word API
  category: string;
  creationDate: Date | null;
  lastSaveTime: Date | null;
  lastPrintDate: Date | null;
  wordCount: number;
  charCount: number;
  paragraphCount: number;
}

/** Returns a summary of the active document's properties and statistics. */
export async function getDocumentSummary(): Promise<DocumentSummary> {
  const summary: DocumentSummary = {
    fileName: "",
    title: "",
    subject: "",
    author: "",
    keywords: "",
    description: "",
    category: "",
    creationDate: null,
    lastSaveTime: null,
    lastPrintDate: null,
    wordCount: 0,
    charCount: 0,
    paragraphCount: 0,
  };

  await Word.run(async (context) => {
    const props = context.document.properties;
    props.load("title,subject,author,keywords,comments,category,creationDate,lastSaveTime,lastPrintDate");
    const body = context.document.body;
    body.load("text");
    await context.sync();

    summary.title       = props.title    || "";
    summary.subject     = props.subject  || "";
    summary.author      = props.author   || "";
    summary.keywords    = props.keywords || "";
    summary.description = props.comments || "";
    summary.category    = props.category || "";

    // Treat dates before 1990 as "not set" (Word returns a default epoch-ish date)
    const toDate = (d: Date): Date | null => {
      const parsed = new Date(d);
      return parsed.getFullYear() >= 1990 ? parsed : null;
    };
    summary.creationDate  = props.creationDate  ? toDate(props.creationDate)  : null;
    summary.lastSaveTime  = props.lastSaveTime   ? toDate(props.lastSaveTime)  : null;
    summary.lastPrintDate = props.lastPrintDate  ? toDate(props.lastPrintDate) : null;

    const text = body.text;
    summary.wordCount      = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    summary.charCount      = text.length;
    // Paragraph count derived from \r separators in body.text (Word's native separator),
    // avoiding an extra paragraphs.load() round-trip.
    summary.paragraphCount = text ? text.split("\r").length : 0;
  });

  try {
    const url = Office.context.document.url;
    if (url) {
      const fullName = url.replace(/\\/g, "/").split("/").pop() || "";
      const isTempName = /^Document\d*$/i.test(fullName.replace(/\.[^.]+$/, ""))
        || /^Word add-in /i.test(fullName);
      if (!isTempName) summary.fileName = fullName;
    }
  } catch {
    // leave empty — document not yet saved
  }

  // If the document has never been saved, Word returns a bogus default date
  // (typically from Normal.dotm). Clear dates so nothing misleading is shown.
  if (!summary.fileName) {
    summary.creationDate = null;
    summary.lastSaveTime = null;
  }

  return summary;
}
