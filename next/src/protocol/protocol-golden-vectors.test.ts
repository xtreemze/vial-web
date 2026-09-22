import { describe, expect, it } from "vitest";
import fixture from "./fixtures/configurator-protocol-v1-vectors.json" with { type: "json" };
import {
  decodeRgbProfileCapabilities,
  getRgbProfileCapabilitiesRequest,
} from "./rgb-profile-codec.ts";
import {
  decodeHalcyonSettingsCapabilities,
  getHalcyonSettingsCapabilitiesRequest,
  setHalcyonTimingsRequest,
} from "./halcyon-settings-codec.ts";
import {
  decodeHalcyonDisplayCapabilities,
  getHalcyonDisplayCapabilitiesRequest,
  setHalcyonDisplayLayerRequest,
} from "./halcyon-display-codec.ts";

interface GoldenVector {
  readonly name: string;
  readonly request: readonly number[];
  readonly response: readonly number[];
}

function vector(name: string): GoldenVector {
  const match = fixture.vectors.find((candidate) => candidate.name === name);
  if (match === undefined) {
    throw new Error(`Missing canonical configurator vector: ${name}`);
  }
  return match;
}

describe("firmware-owned configurator golden vectors", () => {
  it("consumes the canonical RGB capability vector", () => {
    const golden = vector("rgb_profiles_get_capabilities");

    expect(Array.from(getRgbProfileCapabilitiesRequest())).toEqual(golden.request);
    expect(
      decodeRgbProfileCapabilities(Uint8Array.from(golden.response)),
    ).toMatchObject({
      protocolVersion: 1,
      layerCount: 13,
      modifierCount: 4,
      comboCount: 32,
    });
  });

  it("consumes both canonical Halcyon settings capability targets", () => {
    const display = vector("halcyon_settings_get_capabilities_display_target");
    const encoder = vector("halcyon_settings_get_capabilities_encoder_target");

    expect(Array.from(getHalcyonSettingsCapabilitiesRequest())).toEqual(
      display.request,
    );
    expect(
      decodeHalcyonSettingsCapabilities(Uint8Array.from(display.response))
        .tftPresent,
    ).toBe(true);
    expect(
      decodeHalcyonSettingsCapabilities(Uint8Array.from(encoder.response))
        .tftPresent,
    ).toBe(false);
  });

  it("consumes the canonical Halcyon display capability vector", () => {
    const golden = vector("halcyon_display_get_capabilities");

    expect(Array.from(getHalcyonDisplayCapabilitiesRequest())).toEqual(
      golden.request,
    );
    expect(
      decodeHalcyonDisplayCapabilities(Uint8Array.from(golden.response)),
    ).toMatchObject({
      protocolVersion: 1,
      layerCount: 13,
      modifierCount: 10,
    });
  });

  it("encodes the canonical QWERTY layer update exactly", () => {
    const golden = vector("halcyon_display_set_layer_qwerty");

    expect(
      Array.from(
        setHalcyonDisplayLayerRequest(
          1,
          {
            label: "QWERTY",
            pattern: {
              motif: 1,
              tileWidth: 24,
              tileHeight: 24,
              motionAmplitude: 1,
              pulseAmplitude: 1,
            },
          },
          8,
        ),
      ),
    ).toEqual(golden.request);
    expect(golden.response).toEqual(golden.request);
  });

  it("encodes the canonical big-endian timing vector exactly", () => {
    const golden = vector("halcyon_settings_set_timings");

    expect(Array.from(setHalcyonTimingsRequest(200, 2_200))).toEqual(
      golden.request,
    );
    expect(golden.response).toEqual(golden.request);
  });
});
