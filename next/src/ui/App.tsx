import type { DeviceState } from "../device-state.ts";

const initialState: DeviceState = { status: "disconnected" };

const copy = {
  eyebrow: "Vial next",
  title: "Keyboard configuration with an explicit device lifecycle.",
  description:
    "This shell establishes the browser-native client without replacing the existing Qt/WASM application. Device access remains isolated behind the transport boundary.",
  deviceHeading: "Device",
  statusLabel: "Status",
  connect: "Connect keyboard",
};

export function App() {
  const statusText = `${copy.statusLabel}: ${initialState.status}`;

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-8 px-6 py-10">
        <header className="space-y-3">
          <p className="font-medium text-sm text-zinc-400 uppercase tracking-widest">{copy.eyebrow}</p>
          <h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
            {copy.title}
          </h1>
          <p className="max-w-2xl text-pretty text-base text-zinc-300 leading-7">
            {copy.description}
          </p>
        </header>

        <section
          aria-labelledby="device-status-heading"
          className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 id="device-status-heading" className="font-medium">
              {copy.deviceHeading}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{statusText}</p>
          </div>

          <button
            type="button"
            disabled={true}
            className="rounded-xl border border-zinc-700 px-4 py-2 font-medium text-sm text-zinc-500 outline-none"
          >
            {copy.connect}
          </button>
        </section>
      </section>
    </main>
  );
}
