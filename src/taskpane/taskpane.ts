/* global document, Office */

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../ui/App";

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    document.getElementById("sideload-msg").style.display = "none";
    const rootEl = document.getElementById("root");
    createRoot(rootEl).render(React.createElement(App));
  }
});
