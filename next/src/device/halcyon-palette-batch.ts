import type { RgbProfile, RgbProfileCapabilities, RgbProfileScope } from "../protocol/rgb-profile-codec.ts";
import type { Hsv, HalcyonSettingsCapabilities, LayerStyle } from "../protocol/halcyon-settings-codec.ts";

interface ProfileTarget {
  readonly scope: RgbProfileScope;
  readonly index: number;
  readonly rgb: RgbProfile;
}
interface PalettePlan {
  readonly version: 1;
  readonly rgb: readonly ProfileTarget[];
  readonly tftLayers: readonly { index: number; style: LayerStyle }[];
  readonly tftModifiers: readonly { index: number; color: Hsv }[];
}
interface RgbPort {
  readonly capabilities: RgbProfileCapabilities;
  getProfile(scope: RgbProfileScope, index: number): Promise<RgbProfile>;
  setProfile(scope: RgbProfileScope, index: number, profile: RgbProfile): Promise<void>;
  save(): Promise<void>;
}
interface TftPort {
  readonly capabilities: HalcyonSettingsCapabilities;
  getLayerStyle(index: number): Promise<LayerStyle>;
  setLayerStyle(index: number, style: LayerStyle): Promise<void>;
  getModifierStyle(index: number): Promise<Hsv>;
  setModifierStyle(index: number, color: Hsv): Promise<void>;
  save(): Promise<void>;
}
const COUNTS = (caps: RgbProfileCapabilities): readonly number[] => [
  1, caps.layerCount, caps.modifierCount, caps.comboCount,
];
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const hueFor = (scope: RgbProfileScope, index: number, count: number): number => {
  // A golden-angle distribution keeps neighboring layers and scopes visually distinct.
  if (scope === 0) return 148;
  if (scope === 1) return (18 + Math.round(index * 157.5)) % 256;
  if (scope === 2) return (160 + Math.round(index * 91)) % 256;
  return (24 + Math.round(index * 113)) % 256;
};
function generatedProfile(scope: RgbProfileScope, index: number, count: number,
  capabilities: RgbProfileCapabilities, base: RgbProfile): RgbProfile {
  void count;
  return {
    mode: Math.min(base.mode === 255 ? 0 : base.mode, capabilities.maximumMode),
    hue: hueFor(scope, index, count),
    saturation: scope === 1 ? 190 : 215,
    brightness: Math.min(210, capabilities.maximumBrightness),
    speed: base.speed,
  };
}
function layerStyle(hue: number): LayerStyle {
  // Bright foreground and dark background use one identifiable hue family.
  return {
    foreground: { hue, saturation: 160, value: 255 },
    background: { hue, saturation: 140, value: 18 },
  };
}
function makePalettePlan(
  rgb: RgbProfileCapabilities,
  tft: HalcyonSettingsCapabilities | null,
  base: RgbProfile,
): PalettePlan {
  const targets: ProfileTarget[] = [];
  for (const scope of [0, 1, 2, 3] as const) {
    if (!(rgb.scopeFlags & (1 << scope))) continue;
    const count = COUNTS(rgb)[scope] ?? 0;
    for (let index = 0; index < count; index++) {
      targets.push({ scope, index, rgb: generatedProfile(scope, index, count, rgb, base) });
    }
  }
  const tftLayers: { index: number; style: LayerStyle }[] = [];
  const tftModifiers: { index: number; color: Hsv }[] = [];
  if (tft?.tftPresent && (tft.flags & 1)) {
    for (let index = 0; index < Math.min(tft.layerCount, rgb.layerCount); index++) {
      tftLayers.push({ index, style: layerStyle(hueFor(1, index, rgb.layerCount)) });
    }
  }
  if (tft?.tftPresent && (tft.flags & 2)) {
    for (let index = 0; index < Math.min(tft.modifierCount, rgb.modifierCount); index++) {
      tftModifiers.push({ index, color: layerStyle(hueFor(2, index, rgb.modifierCount)).foreground });
    }
  }
  return { version: 1, rgb: targets, tftLayers, tftModifiers };
}
/**
 * Live-only transactional best-effort apply. Never persists automatically.
 * Restore snapshots on failure, and surface rollback failures to the caller.
 * Caller must serialize transactions and explicitly call save on both ports.
 */
async function applyPalettePlan(plan: PalettePlan, rgb: RgbPort, tft: TftPort | null): Promise<void> {
  const undo: Array<() => Promise<void>> = [];
  try {
    for (const target of plan.rgb) {
      const previous = await rgb.getProfile(target.scope, target.index);
      if (same(previous, target.rgb)) continue;
      await rgb.setProfile(target.scope, target.index, target.rgb);
      undo.push(() => rgb.setProfile(target.scope, target.index, previous));
      const actual = await rgb.getProfile(target.scope, target.index);
      if (!same(actual, target.rgb)) throw new Error("RGB profile readback mismatch");
    }
    if (!tft && (plan.tftLayers.length || plan.tftModifiers.length)) {
      throw new Error("TFT device unavailable");
    }
    if (tft) {
      for (const { index, style } of plan.tftLayers) {
        const previous = await tft.getLayerStyle(index);
        if (same(previous, style)) continue;
        await tft.setLayerStyle(index, style);
        undo.push(() => tft.setLayerStyle(index, previous));
        if (!same(await tft.getLayerStyle(index), style)) throw new Error("TFT layer readback mismatch");
      }
      for (const { index, color } of plan.tftModifiers) {
        const previous = await tft.getModifierStyle(index);
        if (same(previous, color)) continue;
        await tft.setModifierStyle(index, color);
        undo.push(() => tft.setModifierStyle(index, previous));
        if (!same(await tft.getModifierStyle(index), color)) throw new Error("TFT modifier readback mismatch");
      }
    }
  } catch (cause) {
    const failures: unknown[] = [];
    for (const restore of undo.reverse()) {
      try { await restore(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError([cause, ...failures], "Palette apply failed and rollback was incomplete");
    throw cause;
  }
}
export { makePalettePlan, applyPalettePlan };
export type { PalettePlan, ProfileTarget, RgbPort, TftPort };
