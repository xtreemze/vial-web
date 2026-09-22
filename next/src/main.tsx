import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.tsx";
import "./styles.css";

const rootElement = document.querySelector<HTMLElement>("#root");

if (rootElement === null) {
  throw new Error("Missing #root application mount point.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
