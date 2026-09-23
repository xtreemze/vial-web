import { type ReactNode, useId, useSyncExternalStore } from "react";

import type { HalcyonDeviceController } from "./device/halcyon-device-service.ts";
import { RgbProfileEditor } from "./rgb-profile-editor.tsx";

interface AppProps {
  readonly controller: HalcyonDeviceController;
}

function availabilityLabel(available: boolean, connected: boolean): string {
  if (!connected) {
    return "Not probed";
  }
  if (available) {
    return "Available";
  }
  return "Unavailable";
}

function supportMessage(controller: HalcyonDeviceController): string | null {
  if (controller.support.status === "supported") {
    return null;
  }
  if (controller.support.reason === "insecure-context") {
    return "WebHID requires HTTPS or another secure browser context.";
  }
  return "WebHID is unavailable or blocked in this browser.";
}

export function App({ controller }: AppProps): ReactNode {
  const appTitleId = useId();
  const connectionTitleId = useId();
  const capabilityTitleId = useId();
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const state = snapshot.state;
  const connected = state.status === "connected";
  const busy =
    state.status === "requesting-permission" ||
    state.status === "opening" ||
    state.status === "reconnecting" ||
    state.status === "disconnecting";
  const unsupportedMessage = supportMessage(controller);
  const rgbProfileEditor = connected ? controller.getRgbProfileEditor() : null;
  const identity = "identity" in state ? state.identity : undefined;

  let heading = "No keyboard connected";
  if (identity?.productName !== undefined) {
    heading = identity.productName;
  } else if (connected) {
    heading = "Keyboard connected";
  }

  let detail = "Choose a compatible Vial keyboard to begin.";
  if (state.status === "requesting-permission") {
    detail = "Choose a compatible keyboard in the browser permission prompt.";
  } else if (state.status === "opening") {
    detail = "Opening the keyboard and probing protocol capabilities.";
  } else if (state.status === "reconnecting") {
    detail = "Reopening the previously granted keyboard.";
  } else if (state.status === "disconnecting") {
    detail = "Closing the keyboard connection.";
  } else if (connected) {
    detail = "Custom protocol capabilities were probed from the connected keyboard.";
  } else if (state.status === "error") {
    detail = state.message;
  } else if (unsupportedMessage !== null) {
    detail = unsupportedMessage;
  }

  let actionLabel = "Connect keyboard";
  if (connected) {
    actionLabel = "Disconnect keyboard";
  } else if (state.status === "requesting-permission") {
    actionLabel = "Requesting permission…";
  } else if (state.status === "opening") {
    actionLabel = "Connecting…";
  } else if (state.status === "reconnecting") {
    actionLabel = "Reconnecting…";
  } else if (state.status === "disconnecting") {
    actionLabel = "Disconnecting…";
  }

  async function handleConnectionAction(_formData: FormData): Promise<void> {
    try {
      if (connected) {
        await controller.disconnect();
      } else {
        await controller.connect();
      }
    } catch {
      return;
    }
  }

  const actionDisabled = busy || unsupportedMessage !== null;

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby={appTitleId}>
        <p className="eyebrow">Browser-native configurator</p>
        <h1 id={appTitleId}>Vial configurator</h1>
        <p className="lede">
          Rendering, device lifecycle, protocol codecs, and HID transport remain
          separate so web and desktop can share one typed domain model.
        </p>

        <form
          className="connection-card"
          aria-labelledby={connectionTitleId}
          action={handleConnectionAction}
        >
          <div>
            <p className="label">Device</p>
            <h2 id={connectionTitleId}>{heading}</h2>
            <p
              className={state.status === "error" ? "error-message" : "muted"}
              aria-live="polite"
              role={state.status === "error" ? "alert" : undefined}
            >
              {detail}
            </p>
          </div>
          <button
            className="connect-button"
            type="submit"
            disabled={actionDisabled}
          >
            {actionLabel}
          </button>
        </form>

        <section aria-labelledby={capabilityTitleId}>
          <p className="label" id={capabilityTitleId}>
            Detected protocol capabilities
          </p>
          <ul className="capability-list">
            <li>
              <span>xtreemze RGB profiles · 0xF0</span>
              <strong>
                {availabilityLabel(
                  snapshot.extensionAvailability.rgbProfiles,
                  connected,
                )}
              </strong>
            </li>
            <li>
              <span>Halcyon settings and telemetry · 0xF1</span>
              <strong>
                {availabilityLabel(
                  snapshot.extensionAvailability.settings,
                  connected,
                )}
              </strong>
            </li>
            <li>
              <span>Halcyon TFT configuration · 0xF2</span>
              <strong>
                {availabilityLabel(
                  snapshot.extensionAvailability.display,
                  connected,
                )}
              </strong>
            </li>
          </ul>
        </section>

        {rgbProfileEditor === null ? null : (
          <RgbProfileEditor controller={rgbProfileEditor} />
        )}
      </section>
    </main>
  );
}
