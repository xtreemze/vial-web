import {
  assertAcknowledged,
  assertByte,
  decodeUint16,
  encodeUint16,
  frame,
  readByte,
} from "./protocol-core.ts";

const COMMAND = 0xf0;
const VERSION = 1;
const UNASSIGNED_MODE = 0xff;

const OP = {
  getCapabilities: 0x01,
  getProfile: 0x02,
  setProfile: 0x03,
  save: 0x04,
  preview: 0x05,
  getComboDuration: 0x06,
  setComboDuration: 0x07,
  cancelPreview: 0x08,
} as const;

type RgbProfileScope = 0 | 1 | 2 | 3;

interface RgbProfile {
  readonly mode: number;
  readonly hue: number;
  readonly saturation: number;
  readonly brightness: number;
  readonly speed: number;
}

interface RgbProfileCapabilities {
  readonly protocolVersion: number;
  readonly scopeFlags: number;
  readonly layerCount: number;
  readonly modifierCount: number;
  readonly comboCount: number;
  readonly maximumBrightness: number;
  readonly maximumMode: number;
  readonly fieldFlags: number;
  readonly precedenceVersion: number;
}

function encodeProfile(profile: RgbProfile): readonly number[] {
  return [
    assertByte("mode", profile.mode),
    assertByte("hue", profile.hue),
    assertByte("saturation", profile.saturation),
    assertByte("brightness", profile.brightness),
    assertByte("speed", profile.speed),
  ];
}

function getCapabilitiesRequest(): Uint8Array {
  return frame(COMMAND, OP.getCapabilities);
}

function decodeCapabilities(response: Uint8Array): RgbProfileCapabilities {
  assertAcknowledged(response, COMMAND, OP.getCapabilities, 11);
  return {
    protocolVersion: readByte(response, 2, "protocol version"),
    scopeFlags: readByte(response, 3, "scope flags"),
    layerCount: readByte(response, 4, "layer count"),
    modifierCount: readByte(response, 5, "modifier count"),
    comboCount: readByte(response, 6, "combo count"),
    maximumBrightness: readByte(response, 7, "maximum brightness"),
    maximumMode: readByte(response, 8, "maximum mode"),
    fieldFlags: readByte(response, 9, "field flags"),
    precedenceVersion: readByte(response, 10, "precedence version"),
  };
}

function getProfileRequest(scope: RgbProfileScope, index: number): Uint8Array {
  return frame(COMMAND, OP.getProfile, [scope, assertByte("index", index)]);
}

function decodeProfile(response: Uint8Array): RgbProfile {
  assertAcknowledged(response, COMMAND, OP.getProfile, 9);
  return {
    mode: readByte(response, 4, "mode"),
    hue: readByte(response, 5, "hue"),
    saturation: readByte(response, 6, "saturation"),
    brightness: readByte(response, 7, "brightness"),
    speed: readByte(response, 8, "speed"),
  };
}

function setProfileRequest(
  scope: RgbProfileScope,
  index: number,
  profile: RgbProfile,
): Uint8Array {
  return frame(COMMAND, OP.setProfile, [
    scope,
    assertByte("index", index),
    ...encodeProfile(profile),
  ]);
}

function saveRequest(): Uint8Array {
  return frame(COMMAND, OP.save);
}

function previewRequest(profile: RgbProfile): Uint8Array {
  return frame(COMMAND, OP.preview, encodeProfile(profile));
}

function getComboDurationRequest(): Uint8Array {
  return frame(COMMAND, OP.getComboDuration);
}

function decodeComboDuration(response: Uint8Array): number {
  assertAcknowledged(response, COMMAND, OP.getComboDuration, 4);
  return decodeUint16(response, 2);
}

function setComboDurationRequest(durationMs: number): Uint8Array {
  return frame(COMMAND, OP.setComboDuration, encodeUint16(durationMs));
}

function cancelPreviewRequest(): Uint8Array {
  return frame(COMMAND, OP.cancelPreview);
}

export {
  cancelPreviewRequest,
  COMMAND as RGB_PROFILE_COMMAND,
  decodeCapabilities as decodeRgbProfileCapabilities,
  decodeComboDuration as decodeRgbComboDuration,
  decodeProfile as decodeRgbProfile,
  getCapabilitiesRequest as getRgbProfileCapabilitiesRequest,
  getComboDurationRequest as getRgbComboDurationRequest,
  getProfileRequest as getRgbProfileRequest,
  OP as RGB_PROFILE_OPERATIONS,
  previewRequest as previewRgbProfileRequest,
  saveRequest as saveRgbProfilesRequest,
  setComboDurationRequest as setRgbComboDurationRequest,
  setProfileRequest as setRgbProfileRequest,
  UNASSIGNED_MODE as RGB_PROFILE_UNASSIGNED_MODE,
  VERSION as RGB_PROFILE_PROTOCOL_VERSION,
};
export type { RgbProfile, RgbProfileCapabilities, RgbProfileScope };
