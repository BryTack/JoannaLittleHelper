import { greet } from "../app/sayHello";
import { refreshPage1, countPage1Matches } from "../app/refreshPage1";

export function wireTaskpaneUi(): void {
  const btn = document.getElementById("greet");

  if (!btn) {
    throw new Error("Button with id='greet' not found in taskpane.html");
  }

  btn.addEventListener("click", async () => {
    btn.setAttribute("disabled", "true");
    try {
      await greet();
    } finally {
      btn.removeAttribute("disabled");
    }
  });

  const page1Display = document.getElementById("page1-display") as HTMLTextAreaElement | null;

  if (!page1Display) {
    throw new Error("Textarea with id='page1-display' not found in taskpane.html");
  }

  const medievalCount = document.getElementById("medieval-count");

  const updatePage1 = async () => {
    try {
      page1Display.value = await refreshPage1();
      if (medievalCount) {
        const count = await countPage1Matches("medieval");
        medievalCount.textContent = `'medieval' count: ${count}`;
      }
    } catch {
      // silently ignore — document may not be ready yet
    }
  };

  // Load Page1 immediately
  updatePage1();

  // Refresh on document selection changes (proxy for user editing/navigating)
  Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, updatePage1);
}
