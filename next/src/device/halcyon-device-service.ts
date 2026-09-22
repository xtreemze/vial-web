import type {
  KeyboardIdentity,
  KeyboardTransport,
} from "../transport.ts";
import {
  decodeRgbProfileCapabilities,
  getRgbProfileCapabilitiesRequest,
  RGB_PROFILE_COMMAND,
  RGB_PROFILE_OPERATIONS,
} from "../protocol/rgb-profile-codec.ts";
import {
  decodeHalcyonSettingsCapabilities,
  getHalcyonSettingsCapabilitiesRequest,
  HALCYON_SETTINGS_COMMAND,
  HALCYON_SETTINGS_OPERATIONS,
} from "../protocol/halcyon-settings-codec.ts";
import {
  decodeHalcyonDisplayCapabilities,
  getHalcyonDisplayCapabilitiesRequest,
  HALCYON_DISPLAY_COMMAND,
  HALCYON_DISPLAY_OPERATIONS,
} from "../protocol/halcyon-display-codec.ts";
import { DeviceSelectionError } from "./device-service-errors.ts";
import { probeNamespace } from "./device-service-transport.ts";
import { HalcyonDisplayClient } from "./halcyon-display-client.ts";
import { HalcyonSettingsClient } from "./halcyon-settings-client.ts";
import { RgbProfileClient } from "./rgb-profile-client.ts";

interface HalcyonExtensions {
  readonly rgbProfiles: RgbProfileClient | null;
  readonly settings: HalcyonSettingsClient | null;
  readonly display: HalcyonDisplayClient | null;
}

class HalcyonDeviceService {
  readonly #transport: KeyboardTransport;
  readonly #unsubscribeDisconnect: () => void;
  #extensions: HalcyonExtensions = {
    rgbProfiles: null,
    settings: null,
    display: null,
  };

  constructor(transport: KeyboardTransport) {
    this.#transport = transport;
    this.#unsubscribeDisconnect = transport.subscribeDisconnect(
      (_identity: KeyboardIdentity | null): void => {
        this.#clearExtensions();
      },
    );
  }

  get identity(): KeyboardIdentity | null {
    return this.#transport.identity;
  }

  get extensions(): HalcyonExtensions {
    return this.#extensions;
  }

  async connect(): Promise<KeyboardIdentity> {
    if (this.#transport.support.status !== "supported") {
      throw new DeviceSelectionError(
        `Keyboard transport is unavailable: ${this.#transport.support.reason}`,
      );
    }

    const identity = await this.#transport.requestDevice();
    if (identity === null) {
      throw new DeviceSelectionError("No keyboard was selected");
    }

    await this.#transport.open(identity);
    await this.probeExtensions();
    return identity;
  }

  async reconnect(identity: KeyboardIdentity): Promise<void> {
    await this.#transport.open(identity);
    await this.probeExtensions();
  }

  async disconnect(): Promise<void> {
    this.#clearExtensions();
    await this.#transport.close();
  }

  async probeExtensions(): Promise<HalcyonExtensions> {
    const rgbCapabilities = await probeNamespace(
      this.#transport,
      getRgbProfileCapabilitiesRequest(),
      RGB_PROFILE_COMMAND,
      RGB_PROFILE_OPERATIONS.getCapabilities,
      decodeRgbProfileCapabilities,
    );
    const settingsCapabilities = await probeNamespace(
      this.#transport,
      getHalcyonSettingsCapabilitiesRequest(),
      HALCYON_SETTINGS_COMMAND,
      HALCYON_SETTINGS_OPERATIONS.getCapabilities,
      decodeHalcyonSettingsCapabilities,
    );
    const displayCapabilities = await probeNamespace(
      this.#transport,
      getHalcyonDisplayCapabilitiesRequest(),
      HALCYON_DISPLAY_COMMAND,
      HALCYON_DISPLAY_OPERATIONS.getCapabilities,
      decodeHalcyonDisplayCapabilities,
    );

    this.#extensions = {
      rgbProfiles:
        rgbCapabilities === null
          ? null
          : new RgbProfileClient(this.#transport, rgbCapabilities),
      settings:
        settingsCapabilities === null
          ? null
          : new HalcyonSettingsClient(this.#transport, settingsCapabilities),
      display:
        displayCapabilities === null
          ? null
          : new HalcyonDisplayClient(this.#transport, displayCapabilities),
    };
    return this.#extensions;
  }

  dispose(): void {
    this.#unsubscribeDisconnect();
    this.#clearExtensions();
  }

  #clearExtensions(): void {
    this.#extensions = {
      rgbProfiles: null,
      settings: null,
      display: null,
    };
  }
}

export { HalcyonDeviceService };
export type { HalcyonExtensions };
