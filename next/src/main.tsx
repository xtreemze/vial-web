import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.tsx";
import { HalcyonDeviceService } from "./device/halcyon-device-service.ts";
import { createBrowserWebHidTransport } from "./platform/webhid/WebHidTransport.ts";
import "./styles.css";

const rootElement = document.querySelector<HTMLElement>("#root");

if (rootElement === null) {
  throw new Error("Missing #root application mount point.");
}

const transport = createBrowserWebHidTransport();
const controller = new HalcyonDeviceService(transport);

createRoot(rootElement).render(
  <StrictMode>
    <App controller={controller} />
  </StrictMode>,
);
