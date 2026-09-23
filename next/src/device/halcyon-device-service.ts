import type { DeviceOperation, DeviceState } from "../device-state.ts";
import {
  decodeHalcyonDisplayCapabilities,
  getHalcyonDisplayCapabilitiesRequest,
  HALCYON_DISPLAY_COMMAND,
  HALCYON_DISPLAY_OPERATIONS,
} from "../protocol/halcyon-display-codec.ts";
import {
  decodeHalcyonSettingsCapabilities,
  getHalcyonSettingsCapabilitiesRequest,
  HALCYON_SETTINGS_COMMAND,
  HALCYON_SETTINGS_OPERATIONS,
} from "../protocol/halcyon-settings-codec.ts";
import {
  decodeRgbProfileCapabilities,
  getRgbProfileCapabilitiesRequest,
  RGB_PROFILE_COMMAND,
  RGB_PROFILE_OPERATIONS,
} from "../protocol/rgb-profile-codec.ts";
import type {
  KeyboardIdentity,
  KeyboardTransport,
  KeyboardTransportSupport,
} from "../transport.ts";
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
  readonly state: DeviceState;
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

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The keyboard operation failed.";
}

function errorState(
  operation: DeviceOperation,
  error: unknown,
  identity?: KeyboardIdentity,
): DeviceState {
  const message = describeError(error);
  if (identity === undefined) {
    return { status: "error", operation, message };
  }
  return { status: "error", operation, message, identity };
}

class HalcyonDeviceService implements HalcyonDeviceController {
  readonly #transport: KeyboardTransport;
  readonly #unsubscribeDisconnect: () => void;
  readonly #listeners = new Set<() => void>();
  #extensions: HalcyonExtensions = EMPTY_EXTENSIONS;
  #rgbProfileEditor: RgbProfileEditorController | null = null;
  #snapshot: HalcyonDeviceSessionSnapshot = {
    state: { status: "disconnected" },
    extensionAvailability: EMPTY_AVAILABILITY,
  };

  constructor(transport: KeyboardTransport) {
    this.#transport = transport;
    this.#unsubscribeDisconnect = transport.subscribeDisconnect(
      (_identity: KeyboardIdentity | null): void => {
        this.#clearExtensions();
        this.#publish({ status: "disconnected" });
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
      const error = new DeviceSelectionError(
        `Keyboard transport is unavailable: ${this.#transport.support.reason}`,
      );
      this.#publish(errorState("permission", error));
      throw error;
    }

    this.#publish({ status: "requesting-permission" });

    let identity: KeyboardIdentity | null;
    try {
      identity = await this.#transport.requestDevice();
    } catch (error: unknown) {
      this.#publish(errorState("permission", error));
      throw error;
    }

    if (identity === null) {
      const error = new DeviceSelectionError("No keyboard was selected");
      this.#publish(errorState("permission", error));
      throw error;
    }

    await this.#openAndProbe(identity, "open");
    return identity;
  };

  readonly reconnect = async (identity: KeyboardIdentity): Promise<void> => {
    await this.#openAndProbe(identity, "reconnect");
  };

  readonly disconnect = async (): Promise<void> => {
    const identity = this.#transport.identity;
    this.#clearExtensions();

    if (identity !== null) {
      this.#publish({ status: "disconnecting", identity });
    }

    try {
      await this.#transport.close();
    } finally {
      this.#publish({ status: "disconnected" });
    }
  };

  async #openAndProbe(
    identity: KeyboardIdentity,
    operation: "open" | "reconnect",
  ): Promise<void> {
    this.#clearExtensions();
    this.#publish({
      status: operation === "reconnect" ? "reconnecting" : "opening",
      identity,
    });

    try {
      await this.#transport.open(identity);
      await this.probeExtensions();
      this.#publish({ status: "connected", identity });
    } catch (error: unknown) {
      this.#clearExtensions();
      await Promise.allSettled([this.#transport.close()]);
      if (this.#transport.identity === null) {
        this.#publish({ status: "disconnected" });
      } else {
        this.#publish(errorState(operation, error, identity));
      }
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

  #publish(state: DeviceState): void {
    this.#snapshot = {
      state,
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
