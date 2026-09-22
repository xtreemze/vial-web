import {
  assertAcknowledged,
  assertByte,
  frame,
  ProtocolCodecError,
  readByte,
} from "./protocol-core.ts";

const COMMAND = 0xf2;
const VERSION = 1;

const OP = {
  getCapabilities: 0x01,
  getLayer: 0x02,
  setLayer: 0x03,
  getModifierLabel: 0x04,
  setModifierLabel: 0x05,
  save: 0x06,
  reset: 0x07,
} as const;

interface DisplayPattern {
  readonly motif: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly motionAmplitude: number;
  readonly pulseAmplitude: number;
}

interface DisplayLayer {
  readonly label: string;
  readonly pattern: DisplayPattern;
}

interface HalcyonDisplayCapabilities {
  readonly protocolVersion: number;
  readonly flags: number;
  readonly layerCount: number;
  readonly modifierCount: number;
  readonly motifCount: number;
  readonly layerLabelMaximum: number;
  readonly modifierLabelMaximum: number;
  readonly tileMinimum: number;
  readonly tileMaximum: number;
  readonly motionMaximum: number;
  readonly pulseMaximum: number;
  readonly storeVersion: number;
}

function encodeLabel(value: string, maximum: number, packetSize: number): readonly number[] {
  if (value.length === 0) {
    throw new RangeError("label cannot be empty");
  }
  if (value.length > maximum) {
    throw new RangeError(`label cannot exceed ${maximum} characters`);
  }

  const encoded = Array.from(value, (character): number => character.charCodeAt(0));
  if (encoded.some((byte): boolean => byte < 0x20 || byte > 0x7e)) {
    throw new RangeError("label must contain printable ASCII characters");
  }
  if (encoded.length > packetSize) {
    throw new RangeError(`label cannot exceed packet size ${packetSize}`);
  }

  return [...encoded, ...new Array<number>(packetSize - encoded.length).fill(0)];
}

function decodeLabel(data: Uint8Array, offset: number, packetSize: number, maximum: number): string {
  const bytes: number[] = [];
  for (let index = 0; index < packetSize && bytes.length < maximum; index += 1) {
    const byte = readByte(data, offset + index, "label");
    if (byte === 0) {
      break;
    }
    if (byte < 0x20 || byte > 0x7e) {
      throw new ProtocolCodecError("label response contains non-printable ASCII");
    }
    bytes.push(byte);
  }
  return String.fromCharCode(...bytes);
}

function encodePattern(pattern: DisplayPattern): readonly number[] {
  return [
    assertByte("motif", pattern.motif),
    assertByte("tile width", pattern.tileWidth),
    assertByte("tile height", pattern.tileHeight),
    assertByte("motion amplitude", pattern.motionAmplitude),
    assertByte("pulse amplitude", pattern.pulseAmplitude),
  ];
}

function getCapabilitiesRequest(): Uint8Array {
  return frame(COMMAND, OP.getCapabilities);
}

function decodeCapabilities(response: Uint8Array): HalcyonDisplayCapabilities {
  assertAcknowledged(response, COMMAND, OP.getCapabilities, 14);
  return {
    protocolVersion: readByte(response, 2, "protocol version"),
    flags: readByte(response, 3, "capability flags"),
    layerCount: readByte(response, 4, "layer count"),
    modifierCount: readByte(response, 5, "modifier count"),
    motifCount: readByte(response, 6, "motif count"),
    layerLabelMaximum: readByte(response, 7, "layer label maximum"),
    modifierLabelMaximum: readByte(response, 8, "modifier label maximum"),
    tileMinimum: readByte(response, 9, "tile minimum"),
    tileMaximum: readByte(response, 10, "tile maximum"),
    motionMaximum: readByte(response, 11, "motion maximum"),
    pulseMaximum: readByte(response, 12, "pulse maximum"),
    storeVersion: readByte(response, 13, "store version"),
  };
}

function getLayerRequest(index: number): Uint8Array {
  return frame(COMMAND, OP.getLayer, [assertByte("layer", index)]);
}

function decodeLayer(response: Uint8Array, labelMaximum: number): DisplayLayer {
  assertAcknowledged(response, COMMAND, OP.getLayer, 17);
  return {
    label: decodeLabel(response, 3, 9, labelMaximum),
    pattern: {
      motif: readByte(response, 12, "motif"),
      tileWidth: readByte(response, 13, "tile width"),
      tileHeight: readByte(response, 14, "tile height"),
      motionAmplitude: readByte(response, 15, "motion amplitude"),
      pulseAmplitude: readByte(response, 16, "pulse amplitude"),
    },
  };
}

function setLayerRequest(
  index: number,
  layer: DisplayLayer,
  labelMaximum: number,
): Uint8Array {
  return frame(COMMAND, OP.setLayer, [
    assertByte("layer", index),
    ...encodeLabel(layer.label, labelMaximum, 9),
    ...encodePattern(layer.pattern),
  ]);
}

function getModifierLabelRequest(index: number): Uint8Array {
  return frame(COMMAND, OP.getModifierLabel, [assertByte("modifier", index)]);
}

function decodeModifierLabel(response: Uint8Array, labelMaximum: number): string {
  assertAcknowledged(response, COMMAND, OP.getModifierLabel, 8);
  return decodeLabel(response, 3, 5, labelMaximum);
}

function setModifierLabelRequest(
  index: number,
  label: string,
  labelMaximum: number,
): Uint8Array {
  return frame(COMMAND, OP.setModifierLabel, [
    assertByte("modifier", index),
    ...encodeLabel(label, labelMaximum, 5),
  ]);
}

function saveRequest(): Uint8Array {
  return frame(COMMAND, OP.save);
}

function resetRequest(): Uint8Array {
  return frame(COMMAND, OP.reset);
}

export {
  decodeCapabilities as decodeHalcyonDisplayCapabilities,
  decodeLayer as decodeHalcyonDisplayLayer,
  decodeModifierLabel as decodeHalcyonModifierLabel,
  getCapabilitiesRequest as getHalcyonDisplayCapabilitiesRequest,
  getLayerRequest as getHalcyonDisplayLayerRequest,
  getModifierLabelRequest as getHalcyonModifierLabelRequest,
  COMMAND as HALCYON_DISPLAY_COMMAND,
  OP as HALCYON_DISPLAY_OPERATIONS,
  VERSION as HALCYON_DISPLAY_PROTOCOL_VERSION,
  resetRequest as resetHalcyonDisplayRequest,
  saveRequest as saveHalcyonDisplayRequest,
  setLayerRequest as setHalcyonDisplayLayerRequest,
  setModifierLabelRequest as setHalcyonModifierLabelRequest,
};
export type {
  DisplayLayer,
  DisplayPattern,
  HalcyonDisplayCapabilities,
};
