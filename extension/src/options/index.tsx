import React from "react";
import { createRoot } from "react-dom/client";
import { OptionsApp } from "./OptionsApp.tsx";
import "./options.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>
  );
}
