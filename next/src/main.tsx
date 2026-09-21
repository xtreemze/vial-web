import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App.tsx";
import "./ui/styles.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Missing #root application mount point");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
