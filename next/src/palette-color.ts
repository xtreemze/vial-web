import type { Hsv } from "./protocol/halcyon-settings-codec.ts";

export function channels(c: Hsv): number[] {
  const h = (c.hue * 6) / 255;
  const s = c.saturation / 255;
  const v = c.value / 255;
  return [5, 3, 1].map(
    (n) =>
      v * (1 - s * Math.max(0, Math.min((n + h) % 6, 4 - ((n + h) % 6), 1))),
  );
}
const luminance = (c: Hsv): number =>
  channels(c).reduce(
    (sum, v, i) =>
      sum +
      (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) *
        ([0.2126, 0.7152, 0.0722][i] ?? 0),
    0,
  );
export const contrast = (a: Hsv, b: Hsv): number =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);

/** sRGB estimate, not a physical LED/display calibration. Retain semantic hue. */
export function readableAccent(color: Hsv, background: Hsv): Hsv {
  for (let saturation = color.saturation; saturation >= 0; saturation--) {
    const candidate = { hue: color.hue, saturation, value: 255 };
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return { hue: color.hue, saturation: 0, value: 0 };
}
