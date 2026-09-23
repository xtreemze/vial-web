import type {
  KeyboardIdentity,
  KeyboardTransport,
  KeyboardTransportSupport,
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
import {
  DeviceRgbProfileEditorController,
  type RgbProfileEditorController,
} from "./rgb-profile-editor-controller.ts";

interface HalcyonExtensions {
  readonly rgbProfiles: RgbProfileClient | null;
  readonly settings: HalcyonSettingsClient | null;
  readonly display: HalcyonDisplayClient | null;
}

interface HalcyonExtensionAvailability {
  readonly rgbProfiles: boolean;
  readonly settings: boolean;
  readonly display: boolean;
}

interface HalcyonDeviceSessionSnapshot {
  readonly status: "disconnected" | "connected";
  readonly identity: KeyboardIdentity | null;
  readonly extensionAvailability: HalcyonExtensionAvailability;
}

interface HalcyonDeviceController {
  readonly support: KeyboardTransportSupport;
  readonly connect: () => Promise<KeyboardIdentity>;
  readonly reconnect: (identity: KeyboardIdentity) => Promise<void>;
  readonly disconnect: () => Promise<void>;
  readonly getRgbProfileEditor: () => RgbProfileEditorController | null;
  readonly getSnapshot: () => HalcyonDeviceSessionSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
}

const EMPTY_EXTENSIONS: HalcyonExtensions = {
  rgbProfiles: null,
  settings: null,
  display: null,
};

const EMPTY_AVAILABILITY: HalcyonExtensionAvailability = {
  rgbProfiles: false,
  settings: false,
  display: false,
};

function availabilityFromExtensions(
  extensions: HalcyonExtensions,
): HalcyonExtensionAvailability {
  return {
    rgbProfiles: extensions.rgbProfiles !== null,
    settings: extensions.settings !== null,
    display: extensions.display !== null,
  };
}

class HalcyonDeviceService implements HalcyonDeviceController {
  readonly #transport: KeyboardTransport;
  readonly #unsubscribeDisconnect: () => void;
  readonly #listeners = new Set<() => void>();
  #extensions: HalcyonExtensions = EMPTY_EXTENSIONS;
  #rgbProfileEditor: RgbProfileEditorController | null = null;
  #snapshot: HalcyonDeviceSessionSnapshot = {
    status: "disconnected",
    identity: null,
    extensionAvailability: EMPTY_AVAILABILITY,
  };

  constructor(transport: KeyboardTransport) {
    this.#transport = transport;
    this.#unsubscribeDisconnect = transport.subscribeDisconnect(
      (_identity: KeyboardIdentity | null): void => {
        this.#clearExtensions();
        this.#publishSession();
      },
    );
  }

  get identity(): KeyboardIdentity | null {
    return this.#transport.identity;
  }

  get support(): KeyboardTransportSupport {
    return this.#transport.support;
  }

  get extensions(): HalcyonExtensions {
    return this.#extensions;
  }

  readonly getRgbProfileEditor = (): RgbProfileEditorController | null =>
    this.#rgbProfileEditor;

  readonly getSnapshot = (): HalcyonDeviceSessionSnapshot => this.#snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return (): void => {
      this.#listeners.delete(listener);
    };
  };

  readonly connect = async (): Promise<KeyboardIdentity> => {
    if (this.#transport.support.status !== "supported") {
      throw new DeviceSelectionError(
        `Keyboard transport is unavailable: ${this.#transport.support.reason}`,
      );
    }

    const identity = await this.#transport.requestDevice();
    if (identity === null) {
      throw new DeviceSelectionError("No keyboard was selected");
    }

    await this.#openAndProbe(identity);
    return identity;
  };

  readonly reconnect = async (identity: KeyboardIdentity): Promise<void> => {
    await this.#openAndProbe(identity);
  };

  readonly disconnect = async (): Promise<void> => {
    this.#clearExtensions();
    try {
      await this.#transport.close();
    } finally {
      this.#publishSession();
    }
  };

  async #openAndProbe(identity: KeyboardIdentity): Promise<void> {
    this.#clearExtensions();
    try {
      await this.#transport.open(identity);
      await this.probeExtensions();
    } catch (error: unknown) {
      this.#clearExtensions();
      await Promise.allSettled([this.#transport.close()]);
      this.#publishSession();
      throw error;
    }
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

    const rgbProfiles =
      rgbCapabilities === null
        ? null
        : new RgbProfileClient(this.#transport, rgbCapabilities);

    this.#extensions = {
      rgbProfiles,
      settings:
        settingsCapabilities === null
          ? null
          : new HalcyonSettingsClient(this.#transport, settingsCapabilities),
      display:
        displayCapabilities === null
          ? null
          : new HalcyonDisplayClient(this.#transport, displayCapabilities),
    };
    this.#rgbProfileEditor =
      rgbProfiles === null ? null : new DeviceRgbProfileEditorController(rgbProfiles);
    this.#publishSession();
    return this.#extensions;
  }

  dispose(): void {
    this.#unsubscribeDisconnect();
    this.#clearExtensions();
    this.#listeners.clear();
  }

  #clearExtensions(): void {
    this.#extensions = EMPTY_EXTENSIONS;
    this.#rgbProfileEditor = null;
  }

  #publishSession(): void {
    const identity = this.#transport.identity;
    let status: HalcyonDeviceSessionSnapshot["status"] = "disconnected";
    if (identity !== null) {
      status = "connected";
    }

    this.#snapshot = {
      status,
      identity,
      extensionAvailability: availabilityFromExtensions(this.#extensions),
    };

    for (const listener of this.#listeners) {
      listener();
    }
  }
}

export { HalcyonDeviceService };
export type {
  HalcyonDeviceController,
  HalcyonDeviceSessionSnapshot,
  HalcyonExtensionAvailability,
  HalcyonExtensions,
};
