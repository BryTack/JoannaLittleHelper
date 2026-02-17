import * as fs from "fs";
import * as path from "path";
import * as mammoth from "mammoth";

const DOCUMENTS_DIR = path.join(__dirname, "documents");

/** Returns the list of .docx filenames in the test documents folder that contain the given keyword. */
async function findDocumentsContaining(keyword: string): Promise<string[]> {
  const files = fs
    .readdirSync(DOCUMENTS_DIR)
    .filter((f) => f.endsWith(".docx") && !f.startsWith("~$"));

  const matches: string[] = [];
  const lowerKeyword = keyword.toLowerCase();

  for (const file of files) {
    const result = await mammoth.extractRawText({ path: path.join(DOCUMENTS_DIR, file) });
    if (result.value.toLowerCase().includes(lowerKeyword)) {
      matches.push(file);
    }
  }

  return matches;
}

describe("document keyword search", () => {
  it("exactly 2 documents contain the word 'medieval'", async () => {
    const matches = await findDocumentsContaining("medieval");
    expect(matches.length).toBe(2);
  });

  it("exactly 1 document contains the word 'farming'", async () => {
    const matches = await findDocumentsContaining("farming");
    expect(matches.length).toBe(1);
  });
});
