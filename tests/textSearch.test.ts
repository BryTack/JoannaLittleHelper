import { findMatches, countMatches, containsMatch } from "../src/domain/textSearch";

describe("findMatches", () => {
  it("finds all occurrences case-insensitively", () => {
    const result = findMatches("The cat sat on the Cat mat", "cat");
    expect(result).toEqual([
      { text: "cat", index: 4 },
      { text: "Cat", index: 19 },
    ]);
  });

  it("finds overlapping positions", () => {
    const result = findMatches("aaa", "aa");
    expect(result).toEqual([
      { text: "aa", index: 0 },
      { text: "aa", index: 1 },
    ]);
  });

  it("returns empty array when no matches", () => {
    expect(findMatches("hello world", "xyz")).toEqual([]);
  });

  it("returns empty array for empty query", () => {
    expect(findMatches("hello world", "")).toEqual([]);
  });

  it("returns empty array for empty text", () => {
    expect(findMatches("", "hello")).toEqual([]);
  });

  it("finds match at the start of text", () => {
    const result = findMatches("hello world", "hello");
    expect(result).toEqual([{ text: "hello", index: 0 }]);
  });

  it("finds match at the end of text", () => {
    const result = findMatches("hello world", "world");
    expect(result).toEqual([{ text: "world", index: 6 }]);
  });
});

describe("countMatches", () => {
  it("returns the number of matches", () => {
    expect(countMatches("one fish two fish red fish", "fish")).toBe(3);
  });

  it("returns 0 when no matches", () => {
    expect(countMatches("hello", "xyz")).toBe(0);
  });
});

describe("containsMatch", () => {
  it("returns true when query is found", () => {
    expect(containsMatch("hello world", "world")).toBe(true);
  });

  it("returns false when query is not found", () => {
    expect(containsMatch("hello world", "xyz")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(containsMatch("Hello World", "HELLO")).toBe(true);
  });
});
