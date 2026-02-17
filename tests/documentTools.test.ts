import {
  getBodyText,
  getSelectedText,
  getParagraphs,
  searchText,
  highlightMatches,
  clearHighlights,
} from "../src/integrations/word/documentTools";

// ---------------------------------------------------------------------------
// Mock helpers – build a fake Word.run context
// ---------------------------------------------------------------------------

interface MockRange {
  text: string;
  font: { highlightColor: string | null };
  load: jest.Mock;
}

function createMockRange(text: string): MockRange {
  return { text, font: { highlightColor: null }, load: jest.fn() };
}

function createMockCollection(items: MockRange[]) {
  return { items, load: jest.fn() };
}

function createMockBody(opts: { text?: string; paragraphs?: MockRange[]; searchResults?: MockRange[] }) {
  const body = {
    text: opts.text ?? "",
    font: { highlightColor: null as string | null },
    load: jest.fn(),
    paragraphs: createMockCollection(opts.paragraphs ?? []),
    search: jest.fn(() => createMockCollection(opts.searchResults ?? [])),
  };
  return body;
}

type MockBody = ReturnType<typeof createMockBody>;

function createMockContext(body: MockBody) {
  return {
    document: {
      body,
      getSelection: jest.fn(() => {
        const range = createMockRange("");
        // Allow the test to set selection text via body — we stash it here
        range.text = (body as any).__selectionText ?? "";
        return range;
      }),
    },
    sync: jest.fn(),
  };
}

// Install global Word mock before each test
let mockBody: MockBody;

beforeEach(() => {
  mockBody = createMockBody({});

  (globalThis as any).Word = {
    run: jest.fn(async (callback: (ctx: any) => Promise<void>) => {
      const ctx = createMockContext(mockBody);
      await callback(ctx);
    }),
    InsertLocation: { start: "Start" },
  };
});

afterEach(() => {
  delete (globalThis as any).Word;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getBodyText", () => {
  it("returns the document body text", async () => {
    mockBody.text = "Hello world";
    const result = await getBodyText();
    expect(result).toBe("Hello world");
  });

  it("returns empty string for an empty document", async () => {
    mockBody.text = "";
    const result = await getBodyText();
    expect(result).toBe("");
  });
});

describe("getSelectedText", () => {
  it("returns the selected text", async () => {
    (mockBody as any).__selectionText = "selected words";
    const result = await getSelectedText();
    expect(result).toBe("selected words");
  });

  it("returns empty string when nothing is selected", async () => {
    (mockBody as any).__selectionText = "";
    const result = await getSelectedText();
    expect(result).toBe("");
  });
});

describe("getParagraphs", () => {
  it("returns all paragraphs as DocumentFragments", async () => {
    mockBody.paragraphs = createMockCollection([
      createMockRange("First paragraph"),
      createMockRange("Second paragraph"),
      createMockRange("Third paragraph"),
    ]);

    const result = await getParagraphs();

    expect(result).toEqual([
      { text: "First paragraph", paragraphIndex: 0 },
      { text: "Second paragraph", paragraphIndex: 1 },
      { text: "Third paragraph", paragraphIndex: 2 },
    ]);
  });

  it("returns empty array for a document with no paragraphs", async () => {
    mockBody.paragraphs = createMockCollection([]);
    const result = await getParagraphs();
    expect(result).toEqual([]);
  });
});

describe("searchText", () => {
  it("returns matching fragments", async () => {
    const matches = [createMockRange("foo"), createMockRange("foo")];
    mockBody.search.mockReturnValue(createMockCollection(matches));

    const result = await searchText("foo");

    expect(mockBody.search).toHaveBeenCalledWith("foo", { matchWholeWord: false, matchCase: false });
    expect(result).toEqual([
      { text: "foo", paragraphIndex: 0 },
      { text: "foo", paragraphIndex: 1 },
    ]);
  });

  it("returns empty array when there are no matches", async () => {
    mockBody.search.mockReturnValue(createMockCollection([]));
    const result = await searchText("nonexistent");
    expect(result).toEqual([]);
  });
});

describe("highlightMatches", () => {
  it("highlights all matches and returns the count", async () => {
    const matches = [createMockRange("bar"), createMockRange("bar")];
    mockBody.search.mockReturnValue(createMockCollection(matches));

    const count = await highlightMatches("bar");

    expect(count).toBe(2);
    expect(matches[0].font.highlightColor).toBe("Yellow");
    expect(matches[1].font.highlightColor).toBe("Yellow");
  });

  it("applies a custom highlight colour", async () => {
    const matches = [createMockRange("baz")];
    mockBody.search.mockReturnValue(createMockCollection(matches));

    await highlightMatches("baz", "Green");

    expect(matches[0].font.highlightColor).toBe("Green");
  });

  it("returns 0 when nothing matches", async () => {
    mockBody.search.mockReturnValue(createMockCollection([]));
    const count = await highlightMatches("nothing");
    expect(count).toBe(0);
  });
});

describe("clearHighlights", () => {
  it("sets body highlight to noHighlight", async () => {
    mockBody.font.highlightColor = "Yellow";
    await clearHighlights();
    expect(mockBody.font.highlightColor).toBeNull();
  });
});
