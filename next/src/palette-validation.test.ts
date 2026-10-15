import { expect, it } from "vitest";
import {
  generatePalette,
  validatePalette,
  applyPalette,
} from "./halcyon-palette.ts";
const caps = {
  protocolVersion: 1,
  scopeFlags: 15,
  layerCount: 13,
  modifierCount: 4,
  comboCount: 32,
  maximumBrightness: 190,
  maximumMode: 10,
  fieldFlags: 31,
  precedenceVersion: 1,
};
it("maps combined TFT indicators to the firmware winning modifier", () => {
  const plan = generatePalette(caps, {
    flags: 3,
    layerCount: 13,
    modifierCount: 10,
  });
  expect(plan.tftModifiers.map((x) => x.color.hue)).toEqual(
    [0, 1, 2, 3, 0, 2, 1, 1, 0, 2].map(
      (i) => plan.rgb.find((x) => x.scope === 2 && x.index === i)?.rgb.hue,
    ),
  );
});
it("rejects unsupported and duplicate targets before any writes", () => {
  const plan = generatePalette(caps);
  expect(() =>
    validatePalette({ ...plan, rgb: [...plan.rgb, plan.rgb[0]!] }, caps),
  ).toThrow();
  expect(() => validatePalette(plan, { ...caps, fieldFlags: 0 })).toThrow();
  expect(() => validatePalette(plan, { ...caps, comboCount: 0 })).toThrow();
});
it("initializes unassigned profiles while retaining assigned effects", async () => {
  let mode = 255;
  const port = {
    capabilities: caps,
    getProfile: async () => ({
      mode,
      hue: 0,
      saturation: 0,
      brightness: 0,
      speed: 10,
    }),
    setProfile: async (_s: number, _i: number, p: { mode: number }) => {
      mode = p.mode;
    },
    save: async () => {},
  };
  const plan = generatePalette({ ...caps, scopeFlags: 2, layerCount: 1 });
  await applyPalette(port, undefined, plan, {
    rgb: [{ scope: 1, index: 0, rgb: await port.getProfile() }],
    tftLayers: [],
    tftModifiers: [],
  });
  expect(mode).toBe(1);
});
it("fits TFT text contrast while preserving hue", async () => {
  const { readableAccent, contrast } = await import("./palette-color.ts");
  const background = { hue: 120, saturation: 40, value: 82 };
  const color = readableAccent(
    { hue: 170, saturation: 210, value: 190 },
    background,
  );
  expect(color.hue).toBe(170);
  expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5);
});
it("retains the portable generator golden document shared with Vial GUI", async () => {
  const golden = await import("../fixtures/palette-v1.json");
  expect(
    generatePalette(caps, { flags: 3, layerCount: 13, modifierCount: 10 }),
  ).toEqual(golden.default);
});
