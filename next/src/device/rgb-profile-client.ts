import type { KeyboardTransport } from "../transport.ts";
import {
  cancelPreviewRequest,
  decodeRgbComboDuration,
  decodeRgbProfile,
  type RgbProfile,
  type RgbProfileCapabilities,
  type RgbProfileScope,
  getRgbComboDurationRequest,
  getRgbProfileRequest,
  previewRgbProfileRequest,
  RGB_PROFILE_COMMAND,
  RGB_PROFILE_OPERATIONS,
  saveRgbProfilesRequest,
  setRgbComboDurationRequest,
  setRgbProfileRequest,
} from "../protocol/rgb-profile-codec.ts";
import { UnsupportedFeatureError } from "./device-service-errors.ts";
import {
  transactAcknowledged,
  transactDecoded,
} from "./device-service-transport.ts";

function scopeCount(capabilities: RgbProfileCapabilities, scope: RgbProfileScope): number {
  if (scope === 0) {
    return 1;
  }
  if (scope === 1) {
    return capabilities.layerCount;
  }
  if (scope === 2) {
    return capabilities.modifierCount;
  }
  return capabilities.comboCount;
}

class RgbProfileClient {
  readonly capabilities: RgbProfileCapabilities;
  readonly #transport: KeyboardTransport;

  constructor(transport: KeyboardTransport, capabilities: RgbProfileCapabilities) {
    this.#transport = transport;
    this.capabilities = capabilities;
  }

  #assertProfileTarget(scope: RgbProfileScope, index: number): void {
    const flag = 1 << scope;
    if ((this.capabilities.scopeFlags & flag) === 0) {
      throw new UnsupportedFeatureError(`RGB profile scope ${scope}`);
    }
    const count = scopeCount(this.capabilities, scope);
    if (!Number.isInteger(index) || index < 0 || index >= count) {
      throw new RangeError(`RGB profile index ${index} is outside scope ${scope}`);
    }
  }

  async getProfile(scope: RgbProfileScope, index: number): Promise<RgbProfile> {
    this.#assertProfileTarget(scope, index);
    return transactDecoded(
      this.#transport,
      getRgbProfileRequest(scope, index),
      decodeRgbProfile,
    );
  }

  async setProfile(
    scope: RgbProfileScope,
    index: number,
    profile: RgbProfile,
  ): Promise<void> {
    this.#assertProfileTarget(scope, index);
    await transactAcknowledged(
      this.#transport,
      setRgbProfileRequest(scope, index, profile),
      RGB_PROFILE_COMMAND,
      RGB_PROFILE_OPERATIONS.setProfile,
    );
  }

  async preview(profile: RgbProfile): Promise<void> {
    await transactAcknowledged(
      this.#transport,
      previewRgbProfileRequest(profile),
      RGB_PROFILE_COMMAND,
      RGB_PROFILE_OPERATIONS.preview,
    );
  }

  async cancelPreview(): Promise<void> {
    await transactAcknowledged(
      this.#transport,
      cancelPreviewRequest(),
      RGB_PROFILE_COMMAND,
      RGB_PROFILE_OPERATIONS.cancelPreview,
    );
  }

  async getComboDuration(): Promise<number> {
    return transactDecoded(
      this.#transport,
      getRgbComboDurationRequest(),
      decodeRgbComboDuration,
    );
  }

  async setComboDuration(durationMs: number): Promise<void> {
    await transactAcknowledged(
      this.#transport,
      setRgbComboDurationRequest(durationMs),
      RGB_PROFILE_COMMAND,
      RGB_PROFILE_OPERATIONS.setComboDuration,
    );
  }

  async save(): Promise<void> {
    await transactAcknowledged(
      this.#transport,
      saveRgbProfilesRequest(),
      RGB_PROFILE_COMMAND,
      RGB_PROFILE_OPERATIONS.save,
    );
  }
}

export { RgbProfileClient };
