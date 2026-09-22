import { useId, type ReactNode } from "react";

const capabilities = [
  "Standard Vial protocol",
  "xtreemze RGB profiles · 0xF0",
  "Halcyon settings and telemetry · 0xF1",
  "Halcyon TFT configuration · 0xF2",
] as const;

export function App(): ReactNode {
  const appTitleId = useId();
  const connectionTitleId = useId();
  const capabilityTitleId = useId();

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby={appTitleId}>
        <p className="eyebrow">Browser-native migration</p>
        <h1 id={appTitleId}>Vial configurator</h1>
        <p className="lede">
          The next client keeps rendering, device lifecycle, protocol codecs,
          and HID transport separate so web and desktop can share one domain
          implementation.
        </p>

        <section
          className="connection-card"
          aria-labelledby={connectionTitleId}
        >
          <div>
            <p className="label">Device</p>
            <h2 id={connectionTitleId}>No keyboard connected</h2>
            <p className="muted">
              WebHID permission and transport wiring land in the next slice.
            </p>
          </div>
          <button className="connect-button" type="button" disabled={true}>
            Connect keyboard
          </button>
        </section>

        <section aria-labelledby={capabilityTitleId}>
          <p className="label" id={capabilityTitleId}>
            Protocol boundary
          </p>
          <ul className="capability-list">
            {capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}
