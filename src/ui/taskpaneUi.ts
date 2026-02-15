import { sayHello } from "../app/sayHello";

export function wireTaskpaneUi(): void {
  const btn = document.getElementById("say-hello");

  if (!btn) {
    // Fail loudly during dev; silent failures are painful.
    throw new Error("Button with id='say-hello' not found in taskpane.html");
  }

  btn.addEventListener("click", async () => {
    btn.setAttribute("disabled", "true");
    try {
      await sayHello();
    } finally {
      btn.removeAttribute("disabled");
    }
  });
}
