import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "./app.tsx";
import type {
  HalcyonDeviceController,
  HalcyonDeviceSessionSnapshot,
} from "./device/halcyon-device-service.ts";
afterEach(cleanup);

import type {
  KeyboardIdentity,
  KeyboardTransportSupport,
} from "./transport.ts";

const IDENTITY: KeyboardIdentity = {
  vendorId: 0x46_53,
  productId: 0x00_01,
  productName: "Halcyon Ferris",
};

const DISCONNECTED: HalcyonDeviceSessionSnapshot = {
  status: "disconnected",
  identity: null,
  extensionAvailability: {
    rgbProfiles: false,
    settings: false,
    display: false,
  },
};

class FakeController implements HalcyonDeviceController {
  readonly support: KeyboardTransportSupport = { status: "supported" };
  readonly #listeners = new Set<() => void>();
  #snapshot: HalcyonDeviceSessionSnapshot = DISCONNECTED;

  readonly getSnapshot = (): HalcyonDeviceSessionSnapshot => this.#snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return (): void => {
      this.#listeners.delete(listener);
    };
  };

  readonly connect = async (): Promise<KeyboardIdentity> => {
    this.#snapshot = {
      status: "connected",
      identity: IDENTITY,
      extensionAvailability: {
        rgbProfiles: true,
        settings: true,
        display: true,
      },
    };
    this.#emit();
    return IDENTITY;
  };

  readonly disconnect = async (): Promise<void> => {
    this.#snapshot = DISCONNECTED;
    this.#emit();
  };

  simulatePhysicalDisconnect(): void {
    this.#snapshot = DISCONNECTED;
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
  });
});
