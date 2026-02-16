import { greet } from "../app/sayHello";

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
}
