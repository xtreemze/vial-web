import { describe, expect, it } from "vitest";
import type {
  KeyboardIdentity,
  KeyboardTransport,
  KeyboardTransportSupport,
} from "../transport.ts";
import { UnsupportedFeatureError } from "./device-service-errors.ts";
import { HalcyonDeviceService } from "./halcyon-device-service.ts";

const IDENTITY: KeyboardIdentity = {
  vendorId: 0x46_53,
  productId: 0x00_01,
  productName: "Halcyon Ferris",
};

type Responder = (request: Uint8Array) => Uint8Array;

interface FakeTransportHarness {
  readonly transport: KeyboardTransport;
  readonly requests: Uint8Array[];
  readonly openCalls: KeyboardIdentity[];
  readonly closeCalls: () => number;
  readonly disconnect: () => void;
}

interface FakeTransportOptions {
  readonly requestDeviceResults?: readonly (KeyboardIdentity | null)[];
  readonly failOpenOnCall?: number;
  readonly disconnectOnCommand?: number;
}

function createFakeTransport(
  responder: Responder,
  options: FakeTransportOptions = {},
): FakeTransportHarness {
  let identity: KeyboardIdentity | null = null;
  let requestDeviceCalls = 0;
  const requests: Uint8Array[] = [];
  const openCalls: KeyboardIdentity[] = [];
  let closeCalls = 0;
  const listeners = new Set<(identity: KeyboardIdentity | null) => void>();
  const support: KeyboardTransportSupport = { status: "supported" };

  const transport: KeyboardTransport = {
    get identity(): KeyboardIdentity | null {
      return identity;
    },
    support,
    requestDevice: (): Promise<KeyboardIdentity | null> => {
      const result =
        options.requestDeviceResults?.[requestDeviceCalls] ?? IDENTITY;
      requestDeviceCalls += 1;
      return Promise.resolve(result);
    },
    open: (target?: KeyboardIdentity): Promise<void> => {
      const nextIdentity = target ?? IDENTITY;
      openCalls.push(nextIdentity);
      if (options.failOpenOnCall === openCalls.length) {
        return Promise.reject(new Error("Open failed"));
      }
      identity = nextIdentity;
      return Promise.resolve();
    },
    close: (): Promise<void> => {
      closeCalls += 1;
      identity = null;
      return Promise.resolve();
    },
    transact: (request: Uint8Array): Promise<Uint8Array> => {
      requests.push(Uint8Array.from(request));
      if (options.disconnectOnCommand === request[0]) {
        const previous = identity;
        identity = null;
        for (const listener of listeners) {
          listener(previous);
        }
        return Promise.reject(new Error("Device disconnected"));
      }
      return Promise.resolve(responder(request));
    },
    subscribeDisconnect: (
      listener: (identity: KeyboardIdentity | null) => void,
    ): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };

  return {
    transport,
    requests,
    openCalls,
    closeCalls: () => closeCalls,
    disconnect: (): void => {
      const previous = identity;
      identity = null;
      for (const listener of listeners) {
        listener(previous);
      }
    },
  };
}

function capabilityResponder(request: Uint8Array): Uint8Array {
  const command = request[0];
  const operation = request[1];

  if (command === 0xf0 && operation === 0x01) {
    return Uint8Array.of(0xf0, 0x01, 1, 0x0f, 13, 4, 32, 180, 63, 0x1f, 1);
  }
  if (command === 0xf1 && operation === 0x01) {
    return Uint8Array.of(0xf1, 0x01, 1, 0x1f, 13, 10, 1, 5, 100, 100, 1, 1);
  }
  if (command === 0xf2 && operation === 0x01) {
    return Uint8Array.of(0xf2, 0x01, 1, 0x0f, 13, 10, 4, 8, 4, 2, 16, 8, 8, 1);
  }

  return Uint8Array.from(request);
}

describe("HalcyonDeviceService", () => {
  it("connects once and probes all three extension namespaces", async () => {
    const harness = createFakeTransport(capabilityResponder);
    const service = new HalcyonDeviceService(harness.transport);

    const identity = await service.connect();

    expect(identity).toEqual(IDENTITY);
    expect(harness.openCalls).toEqual([IDENTITY]);
    expect(harness.requests.map((request) => Array.from(request))).toEqual([
      [0xf0, 0x01],
      [0xf1, 0x01],
      [0xf2, 0x01],
    ]);
    expect(service.extensions.rgbProfiles?.capabilities.layerCount).toBe(13);
    expect(service.extensions.settings?.capabilities.modifierCount).toBe(10);
    expect(service.extensions.display?.capabilities.layerLabelMaximum).toBe(8);
  });

  it("closes the device and clears clients when capability probing fails", async () => {
    const harness = createFakeTransport((request: Uint8Array): Uint8Array => {
      if (request[0] === 0xf1 && request[1] === 0x01) {
        return Uint8Array.of(0xf1, 0x01, 1);
      }
      return capabilityResponder(request);
    });
    const service = new HalcyonDeviceService(harness.transport);

    await expect(service.connect()).rejects.toThrow();

    expect(harness.closeCalls()).toBe(1);
    expect(service.identity).toBeNull();
    expect(service.extensions).toEqual({
      rgbProfiles: null,
      settings: null,
      display: null,
    });
    expect(service.getSnapshot()).toMatchObject({
      state: {
        status: "error",
        operation: "open",
        identity: IDENTITY,
      },
      extensionAvailability: {
        rgbProfiles: false,
        settings: false,
        display: false,
      },
    });
  });

  it("reconnects through the same atomic open-and-probe path", async () => {
    const harness = createFakeTransport(capabilityResponder);
    const service = new HalcyonDeviceService(harness.transport);
    await service.connect();
    await service.disconnect();

    await service.reconnect(IDENTITY);

    expect(harness.openCalls).toEqual([IDENTITY, IDENTITY]);
    expect(service.getSnapshot().state.status).toBe("connected");
    expect(service.extensions.display).not.toBeNull();
  });

  it("treats an unacknowledged namespace as unavailable without hiding malformed active responses", async () => {
    const harness = createFakeTransport((request: Uint8Array): Uint8Array => {
      if (request[0] === 0xf2) {
        return Uint8Array.of(0xff, 0x01);
      }
      return capabilityResponder(request);
    });
    const service = new HalcyonDeviceService(harness.transport);

    await service.connect();

    expect(service.extensions.rgbProfiles).not.toBeNull();
    expect(service.extensions.settings).not.toBeNull();
    expect(service.extensions.display).toBeNull();
  });

  it("invalidates extension clients immediately on physical disconnect", async () => {
    const harness = createFakeTransport(capabilityResponder);
    const service = new HalcyonDeviceService(harness.transport);
    await service.connect();

    harness.disconnect();

    expect(service.identity).toBeNull();
    expect(service.extensions).toEqual({
      rgbProfiles: null,
      settings: null,
      display: null,
    });
  });

  it("publishes connected and disconnected session snapshots to subscribers", async () => {
    const harness = createFakeTransport(capabilityResponder);
    const service = new HalcyonDeviceService(harness.transport);
    const statuses: string[] = [];
    const unsubscribe = service.subscribe((): void => {
      statuses.push(service.getSnapshot().state.status);
    });

    expect(service.getSnapshot().state.status).toBe("disconnected");

    await service.connect();

    expect(service.getSnapshot()).toMatchObject({
      state: {
        status: "connected",
        identity: IDENTITY,
      },
      extensionAvailability: {
        rgbProfiles: true,
        settings: true,
        display: true,
      },
    });

    harness.disconnect();

    expect(service.getSnapshot()).toMatchObject({
      state: {
        status: "disconnected",
      },
      extensionAvailability: {
        rgbProfiles: false,
        settings: false,
        display: false,
      },
    });
    expect(statuses).toEqual([
      "requesting-permission",
      "opening",
      "connected",
      "disconnected",
    ]);

    unsubscribe();
  });


  it("publishes permission cancellation as controller-owned error state", async () => {
    const harness = createFakeTransport(capabilityResponder, {
      requestDeviceResults: [null],
    });
    const service = new HalcyonDeviceService(harness.transport);

    await expect(service.connect()).rejects.toThrow("No keyboard was selected");

    expect(harness.openCalls).toHaveLength(0);
    expect(service.getSnapshot().state).toMatchObject({
      status: "error",
      operation: "permission",
    });
  });

  it("publishes open failures without leaving stale transport state", async () => {
    const harness = createFakeTransport(capabilityResponder, {
      failOpenOnCall: 1,
    });
    const service = new HalcyonDeviceService(harness.transport);

    await expect(service.connect()).rejects.toThrow("Open failed");

    expect(harness.closeCalls()).toBe(1);
    expect(service.identity).toBeNull();
    expect(service.getSnapshot().state).toMatchObject({
      status: "error",
      operation: "open",
      identity: IDENTITY,
    });
  });

  it("lands in disconnected state when the device disappears during probing", async () => {
    const harness = createFakeTransport(capabilityResponder, {
      disconnectOnCommand: 0xf1,
    });
    const service = new HalcyonDeviceService(harness.transport);

    await expect(service.connect()).rejects.toThrow("Device disconnected");

    expect(service.identity).toBeNull();
    expect(service.extensions).toEqual({
      rgbProfiles: null,
      settings: null,
      display: null,
    });
    expect(service.getSnapshot().state.status).toBe("disconnected");
  });

  it("labels reconnect failures separately and permits a later fresh connect", async () => {
    const harness = createFakeTransport(capabilityResponder, {
      requestDeviceResults: [IDENTITY, IDENTITY],
      failOpenOnCall: 2,
    });
    const service = new HalcyonDeviceService(harness.transport);
    await service.connect();
    await service.disconnect();

    await expect(service.reconnect(IDENTITY)).rejects.toThrow("Open failed");
    expect(service.getSnapshot().state).toMatchObject({
      status: "error",
      operation: "reconnect",
      identity: IDENTITY,
    });

    await expect(service.connect()).resolves.toEqual(IDENTITY);
    expect(service.getSnapshot().state.status).toBe("connected");
  });

  it("delegates RGB writes to codecs and keeps save explicit", async () => {
    const harness = createFakeTransport(capabilityResponder);
    const service = new HalcyonDeviceService(harness.transport);
    await service.connect();
    harness.requests.length = 0;

    await service.extensions.rgbProfiles?.setProfile(1, 2, {
      mode: 7,
      hue: 8,
      saturation: 9,
      brightness: 10,
      speed: 11,
    });
    await service.extensions.rgbProfiles?.save();

    expect(harness.requests.map((request) => Array.from(request))).toEqual([
      [0xf0, 0x03, 1, 2, 7, 8, 9, 10, 11],
      [0xf0, 0x04],
    ]);
  });

  it("delegates settings telemetry reads through the typed decoder", async () => {
    const harness = createFakeTransport((request: Uint8Array): Uint8Array => {
      if (request[0] === 0xf1 && request[1] === 0x0a) {
        return Uint8Array.of(0xf1, 0x0a, 2, 3, 4, 5, 1, 1, 1);
      }
      return capabilityResponder(request);
    });
    const service = new HalcyonDeviceService(harness.transport);
    await service.connect();

    await expect(service.extensions.settings?.getTelemetry()).resolves.toEqual({
      os: 2,
      shortcutFamily: 3,
      source: 4,
      event: 5,
      isMaster: true,
      tftPresent: true,
      transportConnected: true,
    });
  });

  it("encodes TFT labels and patterns without exposing raw packets to callers", async () => {
    const harness = createFakeTransport(capabilityResponder);
    const service = new HalcyonDeviceService(harness.transport);
    await service.connect();
    harness.requests.length = 0;

    await service.extensions.display?.setLayer(3, {
      label: "NAV",
      pattern: {
        motif: 2,
        tileWidth: 8,
        tileHeight: 6,
        motionAmplitude: 3,
        pulseAmplitude: 4,
      },
    });

    expect(Array.from(harness.requests[0] ?? [])).toEqual([
      0xf2, 0x03, 3,
      78, 65, 86, 0, 0, 0, 0, 0, 0,
      2, 8, 6, 3, 4,
    ]);
  });

  it("gates settings features before issuing unsupported transactions", async () => {
    const harness = createFakeTransport((request: Uint8Array): Uint8Array => {
      if (request[0] === 0xf1 && request[1] === 0x01) {
        return Uint8Array.of(0xf1, 0x01, 1, 0x00, 13, 10, 1, 5, 100, 100, 1, 1);
      }
      return capabilityResponder(request);
    });
    const service = new HalcyonDeviceService(harness.transport);
    await service.connect();
    harness.requests.length = 0;

    await expect(service.extensions.settings?.getTelemetry()).rejects.toBeInstanceOf(
      UnsupportedFeatureError,
    );
    expect(harness.requests).toHaveLength(0);
  });
});
