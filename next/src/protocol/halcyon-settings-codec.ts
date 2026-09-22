import {
  assertAcknowledged,
  assertByte,
  decodeUint16,
  encodeUint16,
  frame,
  readByte,
} from "./protocol-core.ts";

const COMMAND = 0xf1;
const VERSION = 1;

const OP = {
  getCapabilities: 0x01,
  getLayerStyle: 0x02,
  setLayerStyle: 0x03,
  getModifierStyle: 0x04,
  setModifierStyle: 0x05,
  getTimings: 0x06,
  setTimings: 0x07,
  getDimStyle: 0x08,
  setDimStyle: 0x09,
  getTelemetry: 0x0a,
  save: 0x0b,
  reset: 0x0c,
} as const;

interface Hsv {
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
}

interface LayerStyle {
  readonly foreground: Hsv;
  readonly background: Hsv;
}

interface HalcyonSettingsCapabilities {
  readonly protocolVersion: number;
  readonly flags: number;
  readonly layerCount: number;
  readonly modifierCount: number;
  readonly storeVersion: number;
  readonly patternMinimumMs: number;
  readonly patternMaximumMs: number;
  readonly modifierRecentMaximumMs: number;
  readonly tftPresent: boolean;
  readonly deterministicRepeat: boolean;
}

interface HalcyonTelemetry {
  readonly os: number;
  readonly shortcutFamily: number;
  readonly source: number;
  readonly event: number;
  readonly isMaster: boolean;
  readonly tftPresent: boolean;
  readonly transportConnected: boolean;
}

function encodeHsv(color: Hsv): readonly number[] {
  return [
    assertByte("hue", color.hue),
    assertByte("saturation", color.saturation),
    assertByte("value", color.value),
  ];
}

function decodeHsv(data: Uint8Array, offset: number): Hsv {
  return {
    hue: readByte(data, offset, "hue"),
    saturation: readByte(data, offset + 1, "saturation"),
    value: readByte(data, offset + 2, "value"),
  };
}

function getCapabilitiesRequest(): Uint8Array {
  return frame(COMMAND, OP.getCapabilities);
}

function decodeCapabilities(response: Uint8Array): HalcyonSettingsCapabilities {
  assertAcknowledged(response, COMMAND, OP.getCapabilities, 12);
  return {
    protocolVersion: readByte(response, 2, "protocol version"),
    flags: readByte(response, 3, "capability flags"),
    layerCount: readByte(response, 4, "layer count"),
    modifierCount: readByte(response, 5, "modifier count"),
    storeVersion: readByte(response, 6, "store version"),
    patternMinimumMs: readByte(response, 7, "pattern minimum") * 10,
    patternMaximumMs: readByte(response, 8, "pattern maximum") * 10,
    modifierRecentMaximumMs: readByte(response, 9, "modifier recent maximum") * 100,
    tftPresent: readByte(response, 10, "TFT presence") !== 0,
    deterministicRepeat: readByte(response, 11, "repeat policy") !== 0,
  };
}

function getLayerStyleRequest(index: number): Uint8Array {
  return frame(COMMAND, OP.getLayerStyle, [assertByte("layer", index)]);
}

function decodeLayerStyle(response: Uint8Array): LayerStyle {
  assertAcknowledged(response, COMMAND, OP.getLayerStyle, 9);
  return {
    foreground: decodeHsv(response, 3),
    background: decodeHsv(response, 6),
  };
}

function setLayerStyleRequest(index: number, style: LayerStyle): Uint8Array {
  return frame(COMMAND, OP.setLayerStyle, [
    assertByte("layer", index),
    ...encodeHsv(style.foreground),
    ...encodeHsv(style.background),
  ]);
}

function getModifierStyleRequest(index: number): Uint8Array {
  return frame(COMMAND, OP.getModifierStyle, [assertByte("modifier", index)]);
}

function decodeModifierStyle(response: Uint8Array): Hsv {
  assertAcknowledged(response, COMMAND, OP.getModifierStyle, 6);
  return decodeHsv(response, 3);
}

function setModifierStyleRequest(index: number, color: Hsv): Uint8Array {
  return frame(COMMAND, OP.setModifierStyle, [
    assertByte("modifier", index),
    ...encodeHsv(color),
  ]);
}

function getTimingsRequest(): Uint8Array {
  return frame(COMMAND, OP.getTimings);
}

function decodeTimings(response: Uint8Array): readonly [number, number] {
  assertAcknowledged(response, COMMAND, OP.getTimings, 6);
  return [decodeUint16(response, 2), decodeUint16(response, 4)];
}

function setTimingsRequest(patternFrameMs: number, modifierRecentMs: number): Uint8Array {
  return frame(COMMAND, OP.setTimings, [
    ...encodeUint16(patternFrameMs),
    ...encodeUint16(modifierRecentMs),
  ]);
}

function getDimStyleRequest(): Uint8Array {
  return frame(COMMAND, OP.getDimStyle);
}

function decodeDimStyle(response: Uint8Array): Hsv {
  assertAcknowledged(response, COMMAND, OP.getDimStyle, 5);
  return decodeHsv(response, 2);
}

function setDimStyleRequest(color: Hsv): Uint8Array {
  return frame(COMMAND, OP.setDimStyle, encodeHsv(color));
}

function getTelemetryRequest(): Uint8Array {
  return frame(COMMAND, OP.getTelemetry);
}

function decodeTelemetry(response: Uint8Array): HalcyonTelemetry {
  assertAcknowledged(response, COMMAND, OP.getTelemetry, 9);
  return {
    os: readByte(response, 2, "OS"),
    shortcutFamily: readByte(response, 3, "shortcut family"),
    source: readByte(response, 4, "source"),
    event: readByte(response, 5, "event"),
    isMaster: readByte(response, 6, "master state") !== 0,
    tftPresent: readByte(response, 7, "TFT presence") !== 0,
    transportConnected: readByte(response, 8, "transport state") !== 0,
  };
}

function saveRequest(): Uint8Array {
  return frame(COMMAND, OP.save);
}

function resetRequest(): Uint8Array {
  return frame(COMMAND, OP.reset);
}

export {
  COMMAND as HALCYON_SETTINGS_COMMAND,
  decodeCapabilities as decodeHalcyonSettingsCapabilities,
  decodeDimStyle as decodeHalcyonDimStyle,
  decodeLayerStyle as decodeHalcyonLayerStyle,
  decodeModifierStyle as decodeHalcyonModifierStyle,
  decodeTelemetry as decodeHalcyonTelemetry,
  decodeTimings as decodeHalcyonTimings,
  getCapabilitiesRequest as getHalcyonSettingsCapabilitiesRequest,
  getDimStyleRequest as getHalcyonDimStyleRequest,
  getLayerStyleRequest as getHalcyonLayerStyleRequest,
  getModifierStyleRequest as getHalcyonModifierStyleRequest,
  getTelemetryRequest as getHalcyonTelemetryRequest,
  getTimingsRequest as getHalcyonTimingsRequest,
  OP as HALCYON_SETTINGS_OPERATIONS,
  resetRequest as resetHalcyonSettingsRequest,
  saveRequest as saveHalcyonSettingsRequest,
  setDimStyleRequest as setHalcyonDimStyleRequest,
  setLayerStyleRequest as setHalcyonLayerStyleRequest,
  setModifierStyleRequest as setHalcyonModifierStyleRequest,
  setTimingsRequest as setHalcyonTimingsRequest,
  VERSION as HALCYON_SETTINGS_PROTOCOL_VERSION,
};
export type {
  HalcyonSettingsCapabilities,
  HalcyonTelemetry,
  Hsv,
  LayerStyle,
};
