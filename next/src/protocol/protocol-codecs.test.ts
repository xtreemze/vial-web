import { describe, expect, it } from "vitest";
import {
  ProtocolCodecError,
  UnsupportedProtocolVersionError,
} from "./protocol-core.ts";
import {
  decodeRgbComboDuration,
  decodeRgbProfile,
  decodeRgbProfileCapabilities,
  getRgbComboDurationRequest,
  getRgbProfileCapabilitiesRequest,
  getRgbProfileRequest,
  previewRgbProfileRequest,
  RGB_PROFILE_COMMAND,
  RGB_PROFILE_OPERATIONS,
  saveRgbProfilesRequest,
  setRgbComboDurationRequest,
  setRgbProfileRequest,
} from "./rgb-profile-codec.ts";
import {
  decodeHalcyonLayerStyle,
  decodeHalcyonSettingsCapabilities,
  decodeHalcyonTelemetry,
  decodeHalcyonTimings,
  getHalcyonLayerStyleRequest,
  getHalcyonSettingsCapabilitiesRequest,
  getHalcyonTelemetryRequest,
  HALCYON_SETTINGS_COMMAND,
  HALCYON_SETTINGS_OPERATIONS,
  resetHalcyonSettingsRequest,
  saveHalcyonSettingsRequest,
  setHalcyonLayerStyleRequest,
  setHalcyonTimingsRequest,
} from "./halcyon-settings-codec.ts";
import {
  decodeHalcyonDisplayCapabilities,
  decodeHalcyonDisplayLayer,
  decodeHalcyonModifierLabel,
  getHalcyonDisplayCapabilitiesRequest,
  getHalcyonDisplayLayerRequest,
  getHalcyonModifierLabelRequest,
  HALCYON_DISPLAY_COMMAND,
  HALCYON_DISPLAY_OPERATIONS,
  resetHalcyonDisplayRequest,
  saveHalcyonDisplayRequest,
  setHalcyonDisplayLayerRequest,
  setHalcyonModifierLabelRequest,
} from "./halcyon-display-codec.ts";

describe("RGB profile protocol v1", () => {
  it("matches the firmware command and operation vectors", () => {
    expect(RGB_PROFILE_COMMAND).toBe(0xf0);
    expect(RGB_PROFILE_OPERATIONS).toEqual({
      getCapabilities: 0x01,
      getProfile: 0x02,
      setProfile: 0x03,
      save: 0x04,
      preview: 0x05,
      getComboDuration: 0x06,
      setComboDuration: 0x07,
      cancelPreview: 0x08,
    });
    expect(Array.from(getRgbProfileCapabilitiesRequest())).toEqual([0xf0, 0x01]);
    expect(Array.from(getRgbProfileRequest(1, 12))).toEqual([0xf0, 0x02, 1, 12]);
    expect(Array.from(getRgbComboDurationRequest())).toEqual([0xf0, 0x06]);
    expect(Array.from(saveRgbProfilesRequest())).toEqual([0xf0, 0x04]);
  });

  it("encodes profile writes, previews, and big-endian durations", () => {
    const profile = {
      mode: 7,
      hue: 11,
      saturation: 22,
      brightness: 33,
      speed: 44,
    };
    expect(Array.from(setRgbProfileRequest(2, 3, profile))).toEqual([
      0xf0, 0x03, 2, 3, 7, 11, 22, 33, 44,
    ]);
    expect(Array.from(previewRgbProfileRequest(profile))).toEqual([
      0xf0, 0x05, 7, 11, 22, 33, 44,
    ]);
    expect(Array.from(setRgbComboDurationRequest(0x12_34))).toEqual([
      0xf0, 0x07, 0x12, 0x34,
    ]);
  });

  it("decodes capabilities, profiles, and durations from echoed responses", () => {
    expect(
      decodeRgbProfileCapabilities(
        Uint8Array.of(0xf0, 0x01, 1, 0x0f, 13, 4, 32, 180, 63, 0x1f, 1),
      ),
    ).toEqual({
      protocolVersion: 1,
      scopeFlags: 0x0f,
      layerCount: 13,
      modifierCount: 4,
      comboCount: 32,
      maximumBrightness: 180,
      maximumMode: 63,
      fieldFlags: 0x1f,
      precedenceVersion: 1,
    });
    expect(
      decodeRgbProfile(Uint8Array.of(0xf0, 0x02, 1, 2, 7, 8, 9, 10, 11)),
    ).toEqual({
      mode: 7,
      hue: 8,
      saturation: 9,
      brightness: 10,
      speed: 11,
    });
    expect(decodeRgbComboDuration(Uint8Array.of(0xf0, 0x06, 0x12, 0x34))).toBe(
      0x12_34,
    );
  });
});

describe("Halcyon settings protocol v1", () => {
  it("matches settings request vectors", () => {
    expect(HALCYON_SETTINGS_COMMAND).toBe(0xf1);
    expect(HALCYON_SETTINGS_OPERATIONS.getTelemetry).toBe(0x0a);
    expect(Array.from(getHalcyonSettingsCapabilitiesRequest())).toEqual([
      0xf1, 0x01,
    ]);
    expect(Array.from(getHalcyonLayerStyleRequest(4))).toEqual([0xf1, 0x02, 4]);
    expect(Array.from(getHalcyonTelemetryRequest())).toEqual([0xf1, 0x0a]);
    expect(Array.from(saveHalcyonSettingsRequest())).toEqual([0xf1, 0x0b]);
    expect(Array.from(resetHalcyonSettingsRequest())).toEqual([0xf1, 0x0c]);
  });

  it("encodes style and timing writes", () => {
    expect(
      Array.from(
        setHalcyonLayerStyleRequest(2, {
          foreground: { hue: 1, saturation: 2, value: 3 },
          background: { hue: 4, saturation: 5, value: 6 },
        }),
      ),
    ).toEqual([0xf1, 0x03, 2, 1, 2, 3, 4, 5, 6]);
    expect(Array.from(setHalcyonTimingsRequest(0x01_2c, 0x08_98))).toEqual([
      0xf1, 0x07, 0x01, 0x2c, 0x08, 0x98,
    ]);
  });

  it("decodes settings capabilities, styles, timings, and telemetry", () => {
    expect(
      decodeHalcyonSettingsCapabilities(
        Uint8Array.of(0xf1, 0x01, 1, 0x1f, 13, 10, 1, 5, 100, 100, 1, 1),
      ),
    ).toEqual({
      protocolVersion: 1,
      flags: 0x1f,
      layerCount: 13,
      modifierCount: 10,
      storeVersion: 1,
      patternMinimumMs: 50,
      patternMaximumMs: 1_000,
      modifierRecentMaximumMs: 10_000,
      tftPresent: true,
      deterministicRepeat: true,
    });
    expect(
      decodeHalcyonLayerStyle(
        Uint8Array.of(0xf1, 0x02, 2, 1, 2, 3, 4, 5, 6),
      ),
    ).toEqual({
      foreground: { hue: 1, saturation: 2, value: 3 },
      background: { hue: 4, saturation: 5, value: 6 },
    });
    expect(
      decodeHalcyonTimings(Uint8Array.of(0xf1, 0x06, 0x01, 0x2c, 0x08, 0x98)),
    ).toEqual([300, 2_200]);
    expect(
      decodeHalcyonTelemetry(
        Uint8Array.of(0xf1, 0x0a, 2, 3, 4, 5, 1, 1, 1),
      ),
    ).toEqual({
      os: 2,
      shortcutFamily: 3,
      source: 4,
      event: 5,
      isMaster: true,
      tftPresent: true,
      transportConnected: true,
    });
  });
});

describe("Halcyon display protocol v1", () => {
  it("matches display request vectors", () => {
    expect(HALCYON_DISPLAY_COMMAND).toBe(0xf2);
    expect(HALCYON_DISPLAY_OPERATIONS.setModifierLabel).toBe(0x05);
    expect(Array.from(getHalcyonDisplayCapabilitiesRequest())).toEqual([
      0xf2, 0x01,
    ]);
    expect(Array.from(getHalcyonDisplayLayerRequest(3))).toEqual([0xf2, 0x02, 3]);
    expect(Array.from(getHalcyonModifierLabelRequest(2))).toEqual([
      0xf2, 0x04, 2,
    ]);
    expect(Array.from(saveHalcyonDisplayRequest())).toEqual([0xf2, 0x06]);
    expect(Array.from(resetHalcyonDisplayRequest())).toEqual([0xf2, 0x07]);
  });

  it("encodes fixed-width printable labels and procedural pattern fields", () => {
    expect(
      Array.from(
        setHalcyonDisplayLayerRequest(
          3,
          {
            label: "NAV",
            pattern: {
              motif: 2,
              tileWidth: 8,
              tileHeight: 6,
              motionAmplitude: 3,
              pulseAmplitude: 4,
            },
          },
          8,
        ),
      ),
    ).toEqual([
      0xf2, 0x03, 3,
      78, 65, 86, 0, 0, 0, 0, 0, 0,
      2, 8, 6, 3, 4,
    ]);
    expect(Array.from(setHalcyonModifierLabelRequest(1, "GUI", 4))).toEqual([
      0xf2, 0x05, 1, 71, 85, 73, 0, 0,
    ]);
  });

  it("decodes capabilities, layer records, and modifier labels", () => {
    expect(
      decodeHalcyonDisplayCapabilities(
        Uint8Array.of(0xf2, 0x01, 1, 0x0f, 13, 10, 4, 8, 4, 2, 16, 8, 8, 1),
      ),
    ).toEqual({
      protocolVersion: 1,
      flags: 0x0f,
      layerCount: 13,
      modifierCount: 10,
      motifCount: 4,
      layerLabelMaximum: 8,
      modifierLabelMaximum: 4,
      tileMinimum: 2,
      tileMaximum: 16,
      motionMaximum: 8,
      pulseMaximum: 8,
      storeVersion: 1,
    });
    expect(
      decodeHalcyonDisplayLayer(
        Uint8Array.of(
          0xf2, 0x02, 3,
          78, 65, 86, 0, 0, 0, 0, 0, 0,
          2, 8, 6, 3, 4,
        ),
        8,
      ),
    ).toEqual({
      label: "NAV",
      pattern: {
        motif: 2,
        tileWidth: 8,
        tileHeight: 6,
        motionAmplitude: 3,
        pulseAmplitude: 4,
      },
    });
    expect(
      decodeHalcyonModifierLabel(
        Uint8Array.of(0xf2, 0x04, 1, 71, 85, 73, 0, 0),
        4,
      ),
    ).toBe("GUI");
  });
});

describe("protocol validation", () => {
  it("rejects short and non-acknowledging responses", () => {
    expect(() =>
      decodeHalcyonDisplayCapabilities(Uint8Array.of(0xf2, 0x01, 1)),
    ).toThrow(ProtocolCodecError);
    expect(() =>
      decodeRgbProfile(Uint8Array.of(0xf1, 0x02, 1, 2, 3, 4, 5, 6, 7)),
    ).toThrow(ProtocolCodecError);
  });

  it("rejects unsupported protocol versions explicitly", () => {
    expect(() =>
      decodeRgbProfileCapabilities(
        Uint8Array.of(0xf0, 0x01, 2, 0x0f, 13, 4, 32, 180, 63, 0x1f, 1),
      ),
    ).toThrow(UnsupportedProtocolVersionError);
    expect(() =>
      decodeHalcyonSettingsCapabilities(
        Uint8Array.of(0xf1, 0x01, 2, 0x1f, 13, 10, 1, 5, 100, 100, 1, 1),
      ),
    ).toThrow(UnsupportedProtocolVersionError);
    expect(() =>
      decodeHalcyonDisplayCapabilities(
        Uint8Array.of(0xf2, 0x01, 2, 0x0f, 13, 10, 4, 8, 4, 2, 16, 8, 8, 1),
      ),
    ).toThrow(UnsupportedProtocolVersionError);
  });

  it("rejects out-of-range integers and non-printable labels", () => {
    expect(() => setRgbComboDurationRequest(0x1_0000)).toThrow(RangeError);
    expect(() =>
      setHalcyonDisplayLayerRequest(
        0,
        {
          label: "BAD\n",
          pattern: {
            motif: 0,
            tileWidth: 2,
            tileHeight: 2,
            motionAmplitude: 0,
            pulseAmplitude: 0,
          },
        },
        8,
      ),
    ).toThrow(RangeError);
  });
});
