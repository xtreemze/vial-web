import {
  type ReactNode,
  useId,
  useState,
  useSyncExternalStore,
} from "react";

import type { HalcyonDeviceController } from "./device/halcyon-device-service.ts";
import { RgbProfileEditor } from "./rgb-profile-editor.tsx";

interface AppProps {
  readonly controller: HalcyonDeviceController;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The keyboard operation failed.";
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
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connected = snapshot.status === "connected";
  const unsupportedMessage = supportMessage(controller);
  const rgbProfileEditor = connected ? controller.getRgbProfileEditor() : null;

  let heading = "No keyboard connected";
  if (snapshot.identity?.productName !== undefined) {
    heading = snapshot.identity.productName;
  } else if (connected) {
    heading = "Keyboard connected";
  }

  let detail = "Choose a compatible Vial keyboard to begin.";
  if (connected) {
    detail = "Custom protocol capabilities were probed from the connected keyboard.";
  } else if (unsupportedMessage !== null) {
    detail = unsupportedMessage;
  }

  let actionLabel = "Connect keyboard";
  if (connected) {
    actionLabel = "Disconnect keyboard";
  }
  if (busy) {
    actionLabel = connected ? "Disconnecting…" : "Connecting…";
  }

  async function handleConnectionAction(_formData: FormData): Promise<void> {
    setBusy(true);
    setErrorMessage(null);
    try {
      if (connected) {
        await controller.disconnect();
      } else {
        await controller.connect();
      }
    } catch (error: unknown) {
      setErrorMessage(describeError(error));
    } finally {
      setBusy(false);
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
            <p className="muted" aria-live="polite">
              {detail}
            </p>
            {errorMessage === null ? null : (
              <p className="error-message" role="alert">
                {errorMessage}
              </p>
            )}
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
