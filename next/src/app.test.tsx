import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "./app.tsx";
import type {
  HalcyonDeviceController,
  HalcyonDeviceSessionSnapshot,
} from "./device/halcyon-device-service.ts";
import type {
  RgbProfileEditorController,
  RgbProfileValue,
} from "./device/rgb-profile-editor-controller.ts";
import type {
  KeyboardIdentity,
  KeyboardTransportSupport,
} from "./transport.ts";

afterEach(cleanup);

const IDENTITY: KeyboardIdentity = {
  vendorId: 0x46_53,
  productId: 0x00_01,
  productName: "Halcyon Ferris",
};

const DISCONNECTED: HalcyonDeviceSessionSnapshot = {
  state: { status: "disconnected" },
  extensionAvailability: {
    rgbProfiles: false,
    settings: false,
    display: false,
  },
};

const FAKE_RGB_PROFILE_EDITOR: RgbProfileEditorController = {
  capabilities: {
    maximumMode: 40,
    maximumBrightness: 180,
  },
  load: (): Promise<RgbProfileValue> =>
    Promise.resolve({
      mode: 4,
      hue: 24,
      saturation: 160,
      brightness: 90,
      speed: 32,
    }),
  preview: (_profile: RgbProfileValue): Promise<void> => Promise.resolve(),
  cancelPreview: (): Promise<void> => Promise.resolve(),
  apply: (_profile: RgbProfileValue): Promise<void> => Promise.resolve(),
  save: (_profile: RgbProfileValue): Promise<void> => Promise.resolve(),
};

class FakeController implements HalcyonDeviceController {
  readonly support: KeyboardTransportSupport = { status: "supported" };
  readonly #listeners = new Set<() => void>();
  #snapshot: HalcyonDeviceSessionSnapshot = DISCONNECTED;

  readonly getRgbProfileEditor = (): RgbProfileEditorController | null =>
    this.#snapshot.state.status === "connected" ? FAKE_RGB_PROFILE_EDITOR : null;

  readonly getSnapshot = (): HalcyonDeviceSessionSnapshot => this.#snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return (): void => {
      this.#listeners.delete(listener);
    };
  };

  readonly connect = async (): Promise<KeyboardIdentity> => {
    this.#snapshot = {
      state: {
        status: "connected",
        identity: IDENTITY,
      },
      extensionAvailability: {
        rgbProfiles: true,
        settings: true,
        display: true,
      },
    };
    this.#emit();
    return IDENTITY;
  };

  readonly reconnect = (_identity: KeyboardIdentity): Promise<void> => {
    this.#snapshot = {
      state: {
        status: "connected",
        identity: IDENTITY,
      },
      extensionAvailability: {
        rgbProfiles: true,
        settings: true,
        display: true,
      },
    };
    this.#emit();
    return Promise.resolve();
  };

  readonly disconnect = async (): Promise<void> => {
    this.#snapshot = DISCONNECTED;
    this.#emit();
  };

  simulatePhysicalDisconnect(): void {
    this.#snapshot = DISCONNECTED;
    this.#emit();
  }

  simulateError(message: string): void {
    this.#snapshot = {
      state: {
        status: "error",
        operation: "open",
        message,
      },
      extensionAvailability: DISCONNECTED.extensionAvailability,
    };
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

describe("App", () => {
  it("connects through the typed controller and renders probed capabilities", async () => {
    const controller = new FakeController();
    render(<App controller={controller} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "No keyboard connected" }),
    ).toBeTruthy();

    const connectButton = screen.getByRole("button", {
      name: "Connect keyboard",
    });
    expect(connectButton).toHaveProperty("disabled", false);

    fireEvent.click(connectButton);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Halcyon Ferris" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Available")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Disconnect keyboard" }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Lighting profile" }),
    ).toBeTruthy();
  });

  it("renders controller-owned lifecycle errors without local duplicate state", async () => {
    const controller = new FakeController();
    render(<App controller={controller} />);

    controller.simulateError("Capability probe failed");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Capability probe failed",
    );
    expect(
      screen.getByRole("button", { name: "Connect keyboard" }),
    ).toHaveProperty("disabled", false);
  });

  it("returns to disconnected UI when the service reports physical disconnect", async () => {
    const controller = new FakeController();
    render(<App controller={controller} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Connect keyboard",
      }),
    );
    await screen.findByRole("heading", { level: 2, name: "Halcyon Ferris" });

    controller.simulatePhysicalDisconnect();

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "No keyboard connected",
      }),
    ).toBeTruthy();
    expect(screen.getAllByText("Not probed")).toHaveLength(3);
    expect(
      screen.queryByRole("heading", { level: 2, name: "Lighting profile" }),
    ).toBeNull();
  });
});
