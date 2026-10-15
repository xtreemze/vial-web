import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  applyVerifiedPalette,
  generatePalette,
  importPalette,
  restorePalette,
  saveVerifiedPalette,
  snapshotPalette,
} from "./halcyon-palette.ts";
import type {
  HalcyonPalettePlan,
  PaletteRgbPort,
  PaletteTftPort,
  PaletteSnapshot,
} from "./halcyon-palette.ts";
import { channels, readableAccent } from "./palette-color.ts";

export interface PalettePorts {
  readonly rgb: PaletteRgbPort;
  readonly tft?: PaletteTftPort;
}
export function PaletteEditor({
  ports,
  onBusy,
}: {
  readonly ports: PalettePorts;
  readonly onBusy: (busy: boolean) => void;
}): ReactNode {
  const documentId = useId();
  const [plan, setPlan] = useState<HalcyonPalettePlan | null>(null);
  const [previous, setPrevious] = useState<PaletteSnapshot | null>(null);
  const [replace, setReplace] = useState(false);
  const [document, setDocument] = useState("");
  const [canCancel, setCanCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Generate a palette to review changes. Existing assigned profiles are preserved by default.",
  );
  useEffect((): void => {
    onBusy(busy || previous !== null);
  }, [busy, previous, onBusy]);
  useEffect((): (() => void) => (): void => onBusy(false), [onBusy]);
  const running = useRef(false);
  const cancelled = useRef(false);
  async function run(action: () => Promise<void>): Promise<void> {
    if (running.current) return;
    running.current = true;
    cancelled.current = false;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Palette operation failed",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function generate(): Promise<void> {
    const generated = generatePalette(
      ports.rgb.capabilities,
      ports.tft?.capabilities,
    );
    const current = await snapshotPalette(ports.rgb, ports.tft, generated);
    const rgb = generated.rgb.filter(
      (item) =>
        replace ||
        current.rgb.find(
          (x) => x.scope === item.scope && x.index === item.index,
        )?.rgb.mode === 255,
    );
    const selected = new Set(rgb.map((x) => `${x.scope}:${x.index}`));
    const tftLayers = generated.tftLayers
      .filter((x) => selected.has(`1:${x.index}`))
      .map((x): HalcyonPalettePlan["tftLayers"][number] => {
        const background =
          current.tftLayers.find((y) => y.index === x.index)?.style
            .background ?? x.style.background;
        return {
          ...x,
          style: {
            background,
            foreground: readableAccent(x.style.foreground, background),
          },
        };
      });
    const winners = [0, 1, 2, 3, 0, 2, 1, 1, 0, 2];
    const tftModifiers = generated.tftModifiers.filter((x) =>
      selected.has(`2:${winners[x.index] ?? x.index}`),
    );
    const next = { ...generated, rgb, tftLayers, tftModifiers };
    setPlan(next);
    setDocument(JSON.stringify(next, null, 2));
    setMessage(
      `${rgb.length} RGB profiles and ${tftLayers.length + tftModifiers.length} TFT accents selected. Layer text adjusted to estimated 4.5:1 contrast. Modifier and physical display contrast need visual review.`,
    );
  }
  return (
    <section className="editor-card palette-card" aria-label="Unified palette">
      <h2>RGB and screen palette</h2>
      <p>
        Preview changes on the keyboard, then save explicitly. Saving RGB and
        TFT is sequential; a failed save can leave only one store saved.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <fieldset
        className="palette-controls"
        disabled={busy || previous !== null}
      >
        <legend>Generate or import</legend>
        <label>
          <input
            name="replace"
            type="checkbox"
            checked={replace}
            onChange={(e: ChangeEvent<HTMLInputElement>): void =>
              setReplace(e.target.checked)
            }
          />{" "}
          Replace existing assigned profiles
        </label>
        <button
          type="button"
          onClick={(): void => {
            void run(generate);
          }}
        >
          Generate palette
        </button>
        <label htmlFor={documentId}>
          Portable palette JSON (copy to export; remove entries to preserve
          exceptions)
        </label>
        <textarea
          id={documentId}
          name="palette"
          rows={6}
          value={document}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>): void => {
            setDocument(e.target.value);
            setPlan(null);
          }}
        />
        <button
          type="button"
          onClick={(): void => {
            void run(async (): Promise<void> => {
              setPlan(
                importPalette(
                  document,
                  ports.rgb.capabilities,
                  ports.tft?.capabilities,
                ),
              );
              setMessage(
                "Imported palette validated for this keyboard. Review before applying.",
              );
            });
          }}
        >
          Validate import
        </button>
      </fieldset>
      {plan && (
        <details>
          <summary>
            Review {plan.rgb.length} RGB changes and matching screen accents
          </summary>
          <ul>
            {plan.rgb.map((x) => (
              <li key={`${x.scope}:${x.index}`}>
                <svg
                  className="palette-swatch"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <rect
                    width="24"
                    height="24"
                    fill={`rgb(${channels({
                      hue: x.rgb.hue,
                      saturation: x.rgb.saturation,
                      value: x.rgb.brightness,
                    })
                      .map((v) => Math.round(v * 255))
                      .join(" ")})`}
                  />
                </svg>
                {["Global", "Layer", "Modifier", "Combo"][x.scope]} {x.index}:
                HSV {x.rgb.hue}, {x.rgb.saturation}, {x.rgb.brightness}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="palette-actions">
        <button
          type="button"
          disabled={busy || !plan || previous !== null}
          onClick={(): void => {
            void run(async (): Promise<void> => {
              if (!plan) return;
              setMessage("Applying runtime colors and verifying readback…");
              const old = await snapshotPalette(ports.rgb, ports.tft, plan);
              setCanCancel(true);
              try {
                await applyVerifiedPalette(ports.rgb, ports.tft, plan, {
                  cancelled: (): boolean => cancelled.current,
                  progress: (done: number, total: number): void =>
                    setMessage(`Applying ${done + 1} of ${total} colors…`),
                });
                setPrevious(old);
                setMessage(
                  "Preview applied and verified. Save permanently or restore previous colors.",
                );
              } catch (error) {
                setPrevious(old);
                throw error;
              } finally {
                setCanCancel(false);
              }
            });
          }}
        >
          Preview on keyboard
        </button>
        <button
          type="button"
          disabled={!canCancel}
          onClick={(): void => {
            cancelled.current = true;
          }}
        >
          Cancel pending writes
        </button>
        <button
          type="button"
          disabled={busy || !previous}
          onClick={(): void => {
            void run(async (): Promise<void> => {
              if (!previous) return;
              await restorePalette(ports.rgb, ports.tft, previous);
              setPrevious(null);
              setMessage("Previous runtime palette restored.");
            });
          }}
        >
          Restore previous
        </button>
        <button
          type="button"
          disabled={busy || !previous}
          onClick={(): void => {
            void run(async (): Promise<void> => {
              if (!plan || !previous) return;
              await saveVerifiedPalette(ports.rgb, ports.tft, plan, previous);
              setPrevious(null);
              setMessage(
                "Save acknowledged by both available stores. Verify persistence after power cycle on each master half.",
              );
            });
          }}
        >
          Save permanently
        </button>
      </div>
    </section>
  );
}
