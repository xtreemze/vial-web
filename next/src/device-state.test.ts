import { describe, expect, it } from "vitest";
import type { DeviceState } from "./device-state.ts";

describe("DeviceState", () => {
  it("represents a disconnected client without fabricating an identity", () => {
    const state: DeviceState = { status: "disconnected" };

    expect(state.status).toBe("disconnected");
  });

  it("requires operation context for failures", () => {
    const state: DeviceState = {
      status: "error",
      operation: "permission",
      message: "Permission was denied",
    };

    expect(state.operation).toBe("permission");
  });
});
