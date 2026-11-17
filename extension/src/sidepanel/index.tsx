import React from "react";
import { createRoot } from "react-dom/client";
import { SidePanelApp } from "./SidePanelApp.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import "./sidepanel.css";

function mountSidePanel(): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    console.error("[EpoClaim SidePanel] Fatal: Target container #root not found.");
    return;
  }

  try {
    const root = createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <SidePanelApp />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err) {
    console.error("[EpoClaim SidePanel] Fatal exception during application mount:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountSidePanel);
} else {
  mountSidePanel();
}
