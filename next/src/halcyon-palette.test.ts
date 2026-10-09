import { describe, expect, it, vi } from "vitest";
import { applyPalette, generatePalette, restorePalette, snapshotPalette } from "./halcyon-palette.ts";
import type { RgbProfileCapabilities } from "./protocol/rgb-profile-codec.ts";

const caps: RgbProfileCapabilities = {
  protocolVersion: 1, scopeFlags: 15, layerCount: 13, modifierCount: 10,
  comboCount: 4, maximumBrightness: 190, maximumMode: 10,
  fieldFlags: 0, precedenceVersion: 1,
};
const original = { mode: 3, hue: 3, saturation: 4, brightness: 5, speed: 6 };
const layerStyle = { foreground: { hue: 0, saturation: 0, value: 100 },
  background: { hue: 0, saturation: 0, value: 9 } };
describe("Halcyon batch palette", () => {
  it("generates all advertised scopes deterministically and caps LED brightness", () => {
    const a = generatePalette(caps, { flags: 3, layerCount: 13, modifierCount: 10 });
    expect(a).toEqual(generatePalette(caps, { flags: 3, layerCount: 13, modifierCount: 10 }));
    expect(a.rgb).toHaveLength(28);
    expect(a.tftLayers).toHaveLength(13);
    expect(a.tftModifiers).toHaveLength(10);
    expect(a.rgb.every(x => x.rgb.brightness <= caps.maximumBrightness)).toBe(true);
    for (const layer of a.tftLayers) {
      expect(layer.style.foreground.hue).toBe(a.rgb.find(x => x.scope === 1 && x.index === layer.index)?.rgb.hue);
    }
    for (const mod of a.tftModifiers) {
      expect(mod.color.hue).toBe(a.rgb.find(x => x.scope === 2 && x.index === mod.index)?.rgb.hue);
    }
  });
  it("does not manufacture unsupported RGB or TFT scopes", () => {
    expect(generatePalette({ ...caps, scopeFlags: 1, layerCount: 0 })).toMatchObject({
      rgb: [{ scope: 0, index: 0 }], tftLayers: [], tftModifiers: [],
    });
  });
  it("updates only colors, never persists previews, and restores the snapshot", async () => {
    const rgb = {
      capabilities: caps,
      getProfile: vi.fn(async () => original),
      setProfile: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
    };
    const tft = {
      capabilities: { flags: 3, layerCount: 1, modifierCount: 1 },
      getLayerStyle: vi.fn(async () => layerStyle),
      setLayerStyle: vi.fn(async () => undefined),
      getModifierStyle: vi.fn(async () => ({ hue: 0, saturation: 0, value: 100 })),
      setModifierStyle: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
    };
    const plan = generatePalette({ ...caps, scopeFlags: 2, layerCount: 1 }, tft.capabilities);
    const snapshot = await snapshotPalette(rgb, tft, plan);
    await applyPalette(rgb, tft, plan, snapshot);
    expect(rgb.setProfile).toHaveBeenCalledWith(1, 0,
      expect.objectContaining({ mode: 3, speed: 6 }));
    expect(tft.setLayerStyle).toHaveBeenCalledWith(0,
      expect.objectContaining({ background: layerStyle.background }));
    expect(rgb.save).not.toHaveBeenCalled();
    expect(tft.save).not.toHaveBeenCalled();
    await restorePalette(rgb, tft, snapshot);
    expect(rgb.setProfile).toHaveBeenLastCalledWith(1, 0, original);
    expect(tft.setLayerStyle).toHaveBeenLastCalledWith(0, layerStyle);
  });
});
