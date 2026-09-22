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
  readonly disconnect: () => void;
}

function createFakeTransport(responder: Responder): FakeTransportHarness {
  let identity: KeyboardIdentity | null = null;
  const requests: Uint8Array[] = [];
  const openCalls: KeyboardIdentity[] = [];
  const listeners = new Set<(identity: KeyboardIdentity | null) => void>();
  const support: KeyboardTransportSupport = { status: "supported" };

  const transport: KeyboardTransport = {
    get identity(): KeyboardIdentity | null {
      return identity;
    },
    support,
    requestDevice: (): Promise<KeyboardIdentity | null> =>
      Promise.resolve(IDENTITY),
    open: (target?: KeyboardIdentity): Promise<void> => {
      identity = target ?? IDENTITY;
      openCalls.push(identity);
      return Promise.resolve();
    },
    close: (): Promise<void> => {
      identity = null;
      return Promise.resolve();
    },
    transact: (request: Uint8Array): Promise<Uint8Array> => {
      requests.push(Uint8Array.from(request));
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
      statuses.push(service.getSnapshot().status);
    });

    expect(service.getSnapshot().status).toBe("disconnected");

    await service.connect();

    expect(service.getSnapshot()).toMatchObject({
      status: "connected",
      identity: IDENTITY,
      extensionAvailability: {
        rgbProfiles: true,
        settings: true,
        display: true,
      },
    });

    harness.disconnect();

    expect(service.getSnapshot()).toMatchObject({
      status: "disconnected",
      identity: null,
      extensionAvailability: {
        rgbProfiles: false,
        settings: false,
        display: false,
      },
    });
    expect(statuses).toEqual(["connected", "disconnected"]);

    unsubscribe();
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
