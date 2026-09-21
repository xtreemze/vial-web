import type { DeviceState } from "../device-state";

const initialState: DeviceState = { status: "disconnected" };

export function App() {
  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-8 px-6 py-10">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-400">
            Vial next
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Keyboard configuration with an explicit device lifecycle.
          </h1>
          <p className="max-w-2xl text-pretty text-base leading-7 text-zinc-300">
            This shell establishes the browser-native client without replacing the existing
            Qt/WASM application. Device access remains isolated behind the transport boundary.
          </p>
        </header>

        <section
          aria-labelledby="device-status-heading"
          className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 id="device-status-heading" className="font-medium">
              Device
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Status: {initialState.status}</p>
          </div>

          <button
            type="button"
            disabled
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-500 outline-none"
          >
            Connect keyboard
          </button>
        </section>
      </section>
    </main>
  );
}
