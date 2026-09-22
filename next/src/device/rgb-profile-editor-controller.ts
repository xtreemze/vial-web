import type {
  RgbProfileCapabilities,
  RgbProfileScope,
} from "../protocol/rgb-profile-codec.ts";

interface RgbProfileValue {
  readonly mode: number;
  readonly hue: number;
  readonly saturation: number;
  readonly brightness: number;
  readonly speed: number;
}

interface RgbProfilePort {
  readonly capabilities: RgbProfileCapabilities;
  getProfile(scope: RgbProfileScope, index: number): Promise<RgbProfileValue>;
  setProfile(
    scope: RgbProfileScope,
    index: number,
    profile: RgbProfileValue,
  ): Promise<void>;
  preview(profile: RgbProfileValue): Promise<void>;
  cancelPreview(): Promise<void>;
  save(): Promise<void>;
}

interface RgbProfileEditorCapabilities {
  readonly maximumMode: number;
  readonly maximumBrightness: number;
}

interface RgbProfileEditorController {
  readonly capabilities: RgbProfileEditorCapabilities;
  load(): Promise<RgbProfileValue>;
  preview(profile: RgbProfileValue): Promise<void>;
  cancelPreview(): Promise<void>;
  apply(profile: RgbProfileValue): Promise<void>;
  save(profile: RgbProfileValue): Promise<void>;
}

const GLOBAL_SCOPE: RgbProfileScope = 0;
const GLOBAL_INDEX = 0;

class DeviceRgbProfileEditorController implements RgbProfileEditorController {
  readonly capabilities: RgbProfileEditorCapabilities;
  readonly #client: RgbProfilePort;

  constructor(client: RgbProfilePort) {
    this.#client = client;
    this.capabilities = {
      maximumMode: client.capabilities.maximumMode,
      maximumBrightness: client.capabilities.maximumBrightness,
    };
  }

  async load(): Promise<RgbProfileValue> {
    return this.#client.getProfile(GLOBAL_SCOPE, GLOBAL_INDEX);
  }

  async preview(profile: RgbProfileValue): Promise<void> {
    await this.#client.preview(profile);
  }

  async cancelPreview(): Promise<void> {
    await this.#client.cancelPreview();
  }

  async apply(profile: RgbProfileValue): Promise<void> {
    await this.#client.setProfile(GLOBAL_SCOPE, GLOBAL_INDEX, profile);
  }

  async save(profile: RgbProfileValue): Promise<void> {
    await this.#client.setProfile(GLOBAL_SCOPE, GLOBAL_INDEX, profile);
    await this.#client.save();
  }
}

export { DeviceRgbProfileEditorController };
export type {
  RgbProfileEditorCapabilities,
  RgbProfileEditorController,
  RgbProfilePort,
  RgbProfileValue,
};
