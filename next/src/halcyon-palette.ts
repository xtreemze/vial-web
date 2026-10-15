import type {
  RgbProfile,
  RgbProfileCapabilities,
  RgbProfileScope,
} from "./protocol/rgb-profile-codec.ts";
import type { Hsv, LayerStyle } from "./protocol/halcyon-settings-codec.ts";

export interface PaletteEntry {
  readonly scope: RgbProfileScope;
  readonly index: number;
  readonly rgb: RgbProfile;
}
export interface HalcyonPalettePlan {
  readonly version: 1;
  readonly rgb: readonly PaletteEntry[];
  readonly tftLayers: readonly { index: number; style: LayerStyle }[];
  readonly tftModifiers: readonly { index: number; color: Hsv }[];
}
export interface PaletteRgbPort {
  readonly capabilities: RgbProfileCapabilities;
  getProfile(scope: RgbProfileScope, index: number): Promise<RgbProfile>;
  setProfile(
    scope: RgbProfileScope,
    index: number,
    value: RgbProfile,
  ): Promise<void>;
  save(): Promise<void>;
}
export interface PaletteTftPort {
  readonly capabilities: {
    readonly flags: number;
    readonly layerCount: number;
    readonly modifierCount: number;
  };
  getLayerStyle(index: number): Promise<LayerStyle>;
  setLayerStyle(index: number, style: LayerStyle): Promise<void>;
  getModifierStyle(index: number): Promise<Hsv>;
  setModifierStyle(index: number, color: Hsv): Promise<void>;
  save(): Promise<void>;
}
export interface PaletteSnapshot {
  readonly rgb: readonly PaletteEntry[];
  readonly tftLayers: HalcyonPalettePlan["tftLayers"];
  readonly tftModifiers: HalcyonPalettePlan["tftModifiers"];
}
const modifierWinner = [0, 1, 2, 3, 0, 2, 1, 1, 0, 2] as const;
const hueFor = (index: number): number =>
  Math.round((((index * 137.507764 + 12) % 360) * 255) / 360) % 256;
const colorFor = (index: number): Hsv => ({
  hue: hueFor(index),
  saturation: 210,
  value: 220,
});

/** All counts and supported scopes come from the device, never keyboard names. */
export function generatePalette(
  rgb: RgbProfileCapabilities,
  tft?: PaletteTftPort["capabilities"],
): HalcyonPalettePlan {
  const entries: PaletteEntry[] = [];
  const counts = [
    1,
    rgb.layerCount,
    rgb.modifierCount,
    rgb.comboCount,
  ] as const;
  const scopes: readonly RgbProfileScope[] = [0, 1, 2, 3];
  for (const scope of scopes) {
    if ((rgb.scopeFlags & (1 << scope)) === 0) continue;
    for (let index = 0; index < counts[scope]; index++) {
      const color = colorFor(index + (scope === 1 ? 0 : scope * 29));
      entries.push({
        scope,
        index,
        rgb: {
          mode: Math.min(1, rgb.maximumMode),
          hue: color.hue,
          saturation: color.saturation,
          brightness: Math.min(color.value, rgb.maximumBrightness),
          speed: 128,
        },
      });
    }
  }
  // TFT styles retain firmware-owned backgrounds; accent changes are applied
  // by mergePaletteWithCurrent instead of overwriting unrelated display fields.
  const tftLayers =
    tft && tft.flags & 1
      ? Array.from({ length: tft.layerCount }, (_, index) => ({
          index,
          style: {
            foreground: colorFor(index),
            background: { hue: 0, saturation: 0, value: 12 },
          },
        }))
      : [];
  const tftModifiers =
    tft && tft.flags & 2
      ? Array.from({ length: tft.modifierCount }, (_, index) => ({
          index,
          color: colorFor((modifierWinner[index] ?? index) + 58),
        }))
      : [];
  return { version: 1, rgb: entries, tftLayers, tftModifiers };
}

/** Read before write; preserve original effects, backgrounds and manual speed. */
export async function snapshotPalette(
  rgb: PaletteRgbPort,
  tft: PaletteTftPort | undefined,
  plan: HalcyonPalettePlan,
  options?: Parameters<typeof applyPalette>[4],
): Promise<PaletteSnapshot> {
  const profiles: PaletteEntry[] = [];
  for (const item of plan.rgb)
    profiles.push({
      ...item,
      rgb: await rgb.getProfile(item.scope, item.index),
    });
  const layers: { index: number; style: LayerStyle }[] = [];
  const modifiers: { index: number; color: Hsv }[] = [];
  if (tft) {
    for (const item of plan.tftLayers)
      layers.push({
        index: item.index,
        style: await tft.getLayerStyle(item.index),
      });
    for (const item of plan.tftModifiers)
      modifiers.push({
        index: item.index,
        color: await tft.getModifierStyle(item.index),
      });
  }
  return { rgb: profiles, tftLayers: layers, tftModifiers: modifiers };
}

/** Runtime apply only. Caller must separately request durable save after readback. */
export async function applyPalette(
  rgb: PaletteRgbPort,
  tft: PaletteTftPort | undefined,
  plan: HalcyonPalettePlan,
  previous: PaletteSnapshot,
  options?: {
    readonly cancelled: () => boolean;
    readonly progress: (done: number, total: number) => void;
  },
): Promise<void> {
  let done = 0;
  const total =
    plan.rgb.length + plan.tftLayers.length + plan.tftModifiers.length;
  const check = (): void => {
    if (options?.cancelled()) throw new Error("Palette cancelled");
    options?.progress(done++, total);
  };
  const originalRgb = new Map(
    previous.rgb.map((item) => [`${item.scope}:${item.index}`, item.rgb]),
  );
  const originalLayers = new Map(
    previous.tftLayers.map((item) => [item.index, item.style]),
  );
  for (const item of plan.rgb) {
    const original = originalRgb.get(`${item.scope}:${item.index}`);
    if (!original) throw new Error("Missing RGB snapshot");
    check();
    await rgb.setProfile(item.scope, item.index, {
      ...original,
      mode: original.mode === 255 ? item.rgb.mode : original.mode,
      hue: item.rgb.hue,
      saturation: item.rgb.saturation,
      brightness: item.rgb.brightness,
    });
  }
  if (tft) {
    for (const item of plan.tftLayers) {
      const original = originalLayers.get(item.index);
      if (!original) throw new Error("Missing TFT snapshot");
      check();
      await tft.setLayerStyle(item.index, {
        ...original,
        foreground: item.style.foreground,
      });
    }
    for (const item of plan.tftModifiers) {
      check();
      await tft.setModifierStyle(item.index, item.color);
    }
  }
}

export async function restorePalette(
  rgb: PaletteRgbPort,
  tft: PaletteTftPort | undefined,
  snapshot: PaletteSnapshot,
): Promise<void> {
  const errors: unknown[] = [];
  const attempt = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      errors.push(error);
    }
  };
  for (const item of snapshot.rgb)
    await attempt(async () => {
      await rgb.setProfile(item.scope, item.index, item.rgb);
      if (
        JSON.stringify(await rgb.getProfile(item.scope, item.index)) !==
        JSON.stringify(item.rgb)
      )
        throw new Error("RGB rollback readback mismatch");
    });
  if (tft) {
    for (const item of snapshot.tftLayers)
      await attempt(async () => {
        await tft.setLayerStyle(item.index, item.style);
        if (
          JSON.stringify(await tft.getLayerStyle(item.index)) !==
          JSON.stringify(item.style)
        )
          throw new Error("TFT rollback readback mismatch");
      });
    for (const item of snapshot.tftModifiers)
      await attempt(async () => {
        await tft.setModifierStyle(item.index, item.color);
        if (
          JSON.stringify(await tft.getModifierStyle(item.index)) !==
          JSON.stringify(item.color)
        )
          throw new Error("TFT rollback readback mismatch");
      });
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      "Palette rollback incomplete; reconnect and restore previous values",
    );
}

/** Compare all protocol-owned values before allowing persistence. */
export async function verifyPalette(
  rgb: PaletteRgbPort,
  tft: PaletteTftPort | undefined,
  plan: HalcyonPalettePlan,
  previous: PaletteSnapshot,
): Promise<void> {
  const originalRgb = new Map(
    previous.rgb.map((item) => [`${item.scope}:${item.index}`, item.rgb]),
  );
  const originalLayers = new Map(
    previous.tftLayers.map((item) => [item.index, item.style]),
  );
  for (const item of plan.rgb) {
    const original = originalRgb.get(`${item.scope}:${item.index}`);
    if (!original) throw new Error("Missing RGB snapshot");
    const actual = await rgb.getProfile(item.scope, item.index);
    const expected = {
      ...original,
      mode: original.mode === 255 ? item.rgb.mode : original.mode,
      hue: item.rgb.hue,
      saturation: item.rgb.saturation,
      brightness: item.rgb.brightness,
    };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `RGB readback mismatch at scope ${item.scope}, index ${item.index}`,
      );
    }
  }
  if (tft) {
    for (const item of plan.tftLayers) {
      const original = originalLayers.get(item.index);
      if (!original) throw new Error("Missing TFT snapshot");
      const actual = await tft.getLayerStyle(item.index);
      if (
        JSON.stringify(actual) !==
        JSON.stringify({ ...original, foreground: item.style.foreground })
      ) {
        throw new Error(`TFT layer readback mismatch at index ${item.index}`);
      }
    }
    for (const item of plan.tftModifiers) {
      const actual = await tft.getModifierStyle(item.index);
      if (JSON.stringify(actual) !== JSON.stringify(item.color)) {
        throw new Error(
          `TFT modifier readback mismatch at index ${item.index}`,
        );
      }
    }
  }
}

/**
 * Runtime-only apply is reversible before SAVE. On failure attempt to restore
 * both namespaces; never claim an atomic durable transaction across namespaces.
 */
export async function applyVerifiedPalette(
  rgb: PaletteRgbPort,
  tft: PaletteTftPort | undefined,
  plan: HalcyonPalettePlan,
  options?: Parameters<typeof applyPalette>[4],
): Promise<PaletteSnapshot> {
  validatePalette(plan, rgb.capabilities, tft?.capabilities);
  const snapshot = await snapshotPalette(rgb, tft, plan);
  try {
    await applyPalette(rgb, tft, plan, snapshot, options);
    await verifyPalette(rgb, tft, plan, snapshot);
    return snapshot;
  } catch (error) {
    try {
      await restorePalette(rgb, tft, snapshot);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Palette apply failed and rollback was incomplete",
      );
    }
    throw error;
  }
}

/** Persist only after runtime readback succeeds. SAVE operations are not atomic. */
export async function saveVerifiedPalette(
  rgb: PaletteRgbPort,
  tft: PaletteTftPort | undefined,
  plan: HalcyonPalettePlan,
  snapshot: PaletteSnapshot,
): Promise<void> {
  await verifyPalette(rgb, tft, plan, snapshot);
  await rgb.save();
  if (tft && (plan.tftLayers.length > 0 || plan.tftModifiers.length > 0)) {
    await tft.save();
  }
}

/** Reject a complete document before any HID transaction. */
export function validatePalette(
  plan: HalcyonPalettePlan,
  caps: RgbProfileCapabilities,
  tft?: PaletteTftPort["capabilities"],
): void {
  if (
    plan.version !== 1 ||
    caps.protocolVersion !== 1 ||
    caps.precedenceVersion !== 1 ||
    (caps.fieldFlags & 14) !== 14
  )
    throw new Error("Unsupported palette capabilities");
  const byte = (n: number): boolean =>
    Number.isInteger(n) && n >= 0 && n <= 255;
  const hsv = (c: Hsv): boolean =>
    c !== null &&
    typeof c === "object" &&
    byte(c.hue) &&
    byte(c.saturation) &&
    byte(c.value);
  const seen = new Set<string>();
  for (const item of plan.rgb) {
    const count = [1, caps.layerCount, caps.modifierCount, caps.comboCount][
      item.scope
    ];
    const key = `${item.scope}:${item.index}`;
    if (
      count === undefined ||
      !(caps.scopeFlags & (1 << item.scope)) ||
      !Number.isInteger(item.index) ||
      item.index < 0 ||
      item.index >= count ||
      seen.has(key) ||
      ![
        item.rgb.mode,
        item.rgb.hue,
        item.rgb.saturation,
        item.rgb.brightness,
        item.rgb.speed,
      ].every(byte) ||
      item.rgb.mode > caps.maximumMode ||
      item.rgb.brightness > caps.maximumBrightness
    )
      throw new Error("Invalid RGB palette target or value");
    seen.add(key);
  }
  for (const [items, flag, count, kind] of [
    [plan.tftLayers, 1, tft?.layerCount ?? 0, "layer"],
    [plan.tftModifiers, 2, tft?.modifierCount ?? 0, "modifier"],
  ] as const) {
    for (const item of items) {
      const key = `${kind}:${item.index}`;
      if (
        !tft ||
        !(tft.flags & flag) ||
        !Number.isInteger(item.index) ||
        item.index < 0 ||
        item.index >= count ||
        seen.has(key)
      )
        throw new Error("Invalid TFT palette target");
      seen.add(key);
      if (
        "style" in item
          ? !hsv(item.style.foreground) || !hsv(item.style.background)
          : !hsv(item.color)
      ) {
        throw new Error("Invalid TFT color");
      }
    }
  }
}

export function importPalette(
  text: string,
  caps: RgbProfileCapabilities,
  tft?: PaletteTftPort["capabilities"],
): HalcyonPalettePlan {
  if (text.length > 100000) throw new Error("Palette document is too large");
  const plan: HalcyonPalettePlan = JSON.parse(text);
  validatePalette(plan, caps, tft);
  return plan;
}
