import { describe, expect, it } from "vitest";
import type { DeviceState } from "./device-state";

describe("DeviceState", () => {
  it("represents disconnected state without device identity", () => {
    const state: DeviceState = { status: "disconnected" };
    expect(state.status).toBe("disconnected");
  });

  it("requires identity while reconnecting", () => {
    const state: DeviceState = {
      status: "reconnecting",
      identity: {
        vendorId: 0x4653,
        productId: 0x0001,
        productName: "Halcyon Ferris",
      },
    };

    expect(state.identity.productName).toBe("Halcyon Ferris");
  });
});
