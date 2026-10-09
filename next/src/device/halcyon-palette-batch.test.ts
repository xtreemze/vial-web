import { describe, expect, it, vi } from "vitest";
import { applyPalettePlan, makePalettePlan, type RgbPort } from "./halcyon-palette-batch.ts";
import type { RgbProfile, RgbProfileCapabilities } from "../protocol/rgb-profile-codec.ts";

const caps: RgbProfileCapabilities = {
  protocolVersion: 1, scopeFlags: 15, layerCount: 3, modifierCount: 2,
  comboCount: 1, maximumBrightness: 200, maximumMode: 12,
  fieldFlags: 255, precedenceVersion: 1,
};
const base: RgbProfile = { mode: 1, hue: 0, saturation: 0, brightness: 40, speed: 80 };

describe("Halcyon batch palette", () => {
  it("generates stable, capability-bounded scopes and matching TFT hue families", () => {
    const tft = {
      protocolVersion: 1, flags: 3, layerCount: 3, modifierCount: 2,
      storeVersion: 1, patternMinimumMs: 10, patternMaximumMs: 500,
      modifierRecentMaximumMs: 5000, tftPresent: true, deterministicRepeat: true,
    };
    const plan = makePalettePlan(caps, tft, base);
    expect(plan.rgb).toHaveLength(7);
    expect(plan.tftLayers).toHaveLength(3);
    expect(plan.tftModifiers).toHaveLength(2);
    expect(plan.tftLayers[2]?.style.foreground.hue).toBe(plan.rgb.find(x => x.scope === 1 && x.index === 2)?.rgb.hue);
    expect(plan.rgb.every(x => x.rgb.brightness <= 200)).toBe(true);
    expect(makePalettePlan(caps, tft, base)).toEqual(plan);
  });
  it("does not invent TFT writes when it is absent", () => {
    const plan = makePalettePlan({ ...caps, scopeFlags: 2 }, null, base);
    expect(plan.rgb).toHaveLength(3);
    expect(plan.tftLayers).toHaveLength(0);
    expect(plan.tftModifiers).toHaveLength(0);
  });
  it("rolls back applied live changes when later write fails without saving", async () => {
    const records = new Map<string, RgbProfile>();
    const key = (scope: number, index: number) => `${scope}:${index}`;
    const port: RgbPort = {
      capabilities: caps,
      getProfile: async (scope, index) => records.get(key(scope, index)) ?? base,
      setProfile: vi.fn(async (scope, index, value) => {
        if (scope === 1 && index === 1) throw new Error("Disconnected");
        records.set(key(scope, index), value);
      }),
      save: vi.fn(),
    };
    const plan = makePalettePlan(caps, null, base);
    await expect(applyPalettePlan(plan, port, null)).rejects.toThrow("Disconnected");
    expect(records.get("0:0")).toEqual(base);
    expect(records.get("1:0")).toEqual(base);
    expect(port.save).not.toHaveBeenCalled();
  });
});
