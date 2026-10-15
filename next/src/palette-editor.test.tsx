import { afterEach, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PaletteEditor } from "./palette-editor.tsx";
afterEach(cleanup);
it("preserves assigned overrides by default and separates preview, restore and save", async () => {
  const caps = {
    protocolVersion: 1,
    scopeFlags: 2,
    layerCount: 2,
    modifierCount: 0,
    comboCount: 0,
    maximumBrightness: 190,
    maximumMode: 10,
    fieldFlags: 31,
    precedenceVersion: 1,
  };
  const profiles = [
    { mode: 3, hue: 20, saturation: 40, brightness: 60, speed: 10 },
    { mode: 255, hue: 0, saturation: 0, brightness: 0, speed: 0 },
  ];
  let saves = 0;
  const ports = {
    rgb: {
      capabilities: caps,
      getProfile: async (_s: number, i: number) => profiles[i]!,
      setProfile: async (
        _s: number,
        i: number,
        p: (typeof profiles)[number],
      ) => {
        profiles[i] = p;
      },
      save: async () => {
        saves++;
      },
    },
  };
  render(<PaletteEditor ports={ports} onBusy={(): void => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Generate palette" }));
  await screen.findByText(/1 RGB profiles and 0 TFT accents selected/u);
  fireEvent.click(screen.getByRole("button", { name: "Preview on keyboard" }));
  await screen.findByText(/Preview applied and verified/u);
  expect(profiles[0]?.hue).toBe(20);
  expect(profiles[1]?.mode).toBe(1);
  expect(saves).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Restore previous" }));
  await screen.findByText("Previous runtime palette restored.");
  expect(profiles[1]?.mode).toBe(255);
  fireEvent.click(screen.getByRole("button", { name: "Preview on keyboard" }));
  await screen.findByText(/Preview applied and verified/u);
  fireEvent.click(screen.getByRole("button", { name: "Save permanently" }));
  await waitFor(() => expect(saves).toBe(1));
});
