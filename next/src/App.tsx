import { useState } from "react";
import { Button } from "react-aria-components";

export function App() {
  const [noticeVisible, setNoticeVisible] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section
        className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-10"
        aria-labelledby="app-title"
      >
        <div className="flex flex-col gap-8">
          <header className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Web-native migration
            </p>
            <h1 id="app-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Vial Next
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--muted)]">
              A transport-independent configurator shell. Device access remains intentionally
              disabled until the WebHID adapter in issue #13 is implemented and tested.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-3" aria-label="Migration status">
            <StatusCard title="UI" value="React 19.3" />
            <StatusCard title="Protocol" value="Typed boundary" />
            <StatusCard title="Transport" value="Not connected" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="cursor-pointer rounded-xl bg-[var(--text)] px-4 py-2.5 font-medium text-[var(--surface)] outline-none transition data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--focus)] data-[pressed]:translate-y-px"
              onPress={() => setNoticeVisible(true)}
            >
              Choose keyboard
            </Button>
            <p className="text-sm text-[var(--muted)]" aria-live="polite">
              {noticeVisible
                ? "WebHID is not enabled in this scaffold yet."
                : "No keyboard connected."}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

interface StatusCardProps {
  readonly title: string;
  readonly value: string;
}

function StatusCard({ title, value }: StatusCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <dt className="text-sm text-[var(--muted)]">{title}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
