/* global document, Office */

import { wireTaskpaneUi } from "../ui/taskpaneUi";

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    document.getElementById("sideload-msg").style.display = "none";
    document.getElementById("app-body").style.display = "flex";
    wireTaskpaneUi();
  }
});
