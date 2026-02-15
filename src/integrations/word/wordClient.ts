export async function insertParagraphAtStart(text: string): Promise<void> {
  await Word.run(async (context) => {
    context.document.body.insertParagraph(text, Word.InsertLocation.start);
    await context.sync();
  });
}
