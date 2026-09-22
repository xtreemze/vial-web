import { describe, expect, it } from "vitest";
import type { KeyboardIdentity } from "../../transport.ts";
import {
  createBrowserWebHidTransport,
  createWebHidTransport,
  WebHidTransportError,
  type WebHidConnectionEventPort,
  type WebHidDevicePort,
  type WebHidDisconnectListener,
  type WebHidInputReportEventPort,
  type WebHidInputReportListener,
  type WebHidPort,
} from "./WebHidTransport.ts";

interface FakeDevice {
  readonly port: WebHidDevicePort;
  readonly requests: readonly Uint8Array[];
  readonly reportIds: readonly number[];
  readonly respond: (bytes: readonly number[]) => void;
}

function createFakeDevice(
  vendorId = 0x46_53,
  productId = 0x00_01,
  productName = "Halcyon Ferris",
): FakeDevice {
  let opened = false;
  let inputListener: WebHidInputReportListener | null = null;
  const requests: Uint8Array[] = [];
  const reportIds: number[] = [];

  const port: WebHidDevicePort = {
    vendorId,
    productId,
    productName,
    get opened() {
      return opened;
    },
    open: () => {
      opened = true;
      return Promise.resolve();
    },
    close: () => {
      opened = false;
      return Promise.resolve();
    },
    sendReport: (reportId, data) => {
      reportIds.push(reportId);
      requests.push(Uint8Array.from(data));
      return Promise.resolve();
    },
    addEventListener: (_type, listener) => {
      inputListener = listener;
    },
    removeEventListener: (_type, listener) => {
      if (inputListener === listener) {
        inputListener = null;
      }
    },
  };

  return {
    port,
    requests,
    reportIds,
    respond: (bytes) => {
      if (inputListener === null) {
        throw new Error("No WebHID input-report listener is registered.");
      }
      const payload = Uint8Array.from(bytes);
      const event: WebHidInputReportEventPort = {
        data: new DataView(payload.buffer),
        reportId: 0,
      };
      inputListener(event);
    },
  };
}

interface FakeHid {
  readonly port: WebHidPort;
  readonly filters: () => readonly { readonly usagePage: number; readonly usage: number }[];
  readonly disconnect: (device: WebHidDevicePort) => void;
}

function createFakeHid(
  selected: readonly WebHidDevicePort[],
  granted: readonly WebHidDevicePort[] = selected,
): FakeHid {
  let requestedFilters: readonly {
    readonly usagePage: number;
    readonly usage: number;
  }[] = [];
  const disconnectListeners = new Set<WebHidDisconnectListener>();

  const port: WebHidPort = {
    requestDevice: (options) => {
      requestedFilters = options.filters;
      return Promise.resolve(selected);
    },
    getDevices: () => Promise.resolve(granted),
    addEventListener: (_type, listener) => {
      disconnectListeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      disconnectListeners.delete(listener);
    },
  };

  return {
    port,
    filters: () => requestedFilters,
    disconnect: (device) => {
      const event: WebHidConnectionEventPort = { device };
      for (const listener of disconnectListeners) {
        listener(event);
      }
    },
  };
}

async function selectAndOpen(
  transport: ReturnType<typeof createWebHidTransport>,
): Promise<KeyboardIdentity> {
  const identity = await transport.requestDevice();
  if (identity === null) {
    throw new Error("Expected the fake WebHID picker to return a device.");
  }
  await transport.open(identity);
  return identity;
}

describe("createWebHidTransport", () => {
  it("requests the Vial raw-HID usage instead of a product-name filter", async () => {
    const device = createFakeDevice();
    const hid = createFakeHid([device.port]);
    const transport = createWebHidTransport(hid.port);

    const identity = await transport.requestDevice();

    expect(identity).toEqual({
      vendorId: 0x46_53,
      productId: 0x00_01,
      productName: "Halcyon Ferris",
    });
    expect(hid.filters()).toEqual([{ usagePage: 0xff_60, usage: 0x61 }]);
  });

  it("pads requests to the 32-byte Vial report and resolves the matching report", async () => {
    const device = createFakeDevice();
    const hid = createFakeHid([device.port]);
    const transport = createWebHidTransport(hid.port);
    await selectAndOpen(transport);

    const pending = transport.transact(Uint8Array.of(0xf2, 0x01));
    await Promise.resolve();

    expect(device.reportIds).toEqual([0]);
    expect(device.requests).toHaveLength(1);
    expect(device.requests[0]?.byteLength).toBe(32);
    expect(Array.from(device.requests[0]?.slice(0, 2) ?? [])).toEqual([0xf2, 0x01]);

    device.respond([0xf2, 0x01, ...new Array<number>(30).fill(0)]);
    const response = await pending;
    expect(Array.from(response.slice(0, 2))).toEqual([0xf2, 0x01]);
  });

  it("serializes transactions so responses cannot be consumed by the next request", async () => {
    const device = createFakeDevice();
    const hid = createFakeHid([device.port]);
    const transport = createWebHidTransport(hid.port);
    await selectAndOpen(transport);

    const first = transport.transact(Uint8Array.of(0xf0, 0x01));
    const second = transport.transact(Uint8Array.of(0xf1, 0x01));
    await Promise.resolve();

    expect(device.requests).toHaveLength(1);

    device.respond([0xf0, 0x01, ...new Array<number>(30).fill(0)]);
    await first;
    await Promise.resolve();
    await Promise.resolve();

    expect(device.requests).toHaveLength(2);

    device.respond([0xf1, 0x01, ...new Array<number>(30).fill(0)]);
    await second;
  });


  it("classifies permission denial distinctly from generic I/O failure", async () => {
    const hid: WebHidPort = {
      requestDevice: () =>
        Promise.reject(new DOMException("Denied by the user", "NotAllowedError")),
      getDevices: () => Promise.resolve([]),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const transport = createWebHidTransport(hid);

    await expect(transport.requestDevice()).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects requests larger than one Vial raw-HID report", async () => {
    const device = createFakeDevice();
    const hid = createFakeHid([device.port]);
    const transport = createWebHidTransport(hid.port);
    await selectAndOpen(transport);

    await expect(transport.transact(new Uint8Array(33))).rejects.toMatchObject({
      code: "request-too-large",
    });
    expect(device.requests).toHaveLength(0);
  });

  it("times out deterministically when no input report arrives", async () => {
    const device = createFakeDevice();
    const hid = createFakeHid([device.port]);
    const transport = createWebHidTransport(hid.port, { responseTimeoutMs: 1 });
    await selectAndOpen(transport);

    await expect(
      transport.transact(Uint8Array.of(0xf0, 0x01)),
    ).rejects.toMatchObject({
      code: "response-timeout",
    });
  });

  it("fails reconnect when multiple granted keyboards have the same WebHID identity", async () => {
    const first = createFakeDevice();
    const second = createFakeDevice();
    const hid = createFakeHid([], [first.port, second.port]);
    const transport = createWebHidTransport(hid.port);

    await expect(
      transport.open({
        vendorId: 0x46_53,
        productId: 0x00_01,
        productName: "Halcyon Ferris",
      }),
    ).rejects.toMatchObject({
      code: "ambiguous-device",
    });
  });

  it("clears selected identity and rejects an active transaction on disconnect", async () => {
    const device = createFakeDevice();
    const hid = createFakeHid([device.port]);
    const transport = createWebHidTransport(hid.port);
    const identity = await selectAndOpen(transport);
    const disconnected: (KeyboardIdentity | null)[] = [];
    transport.subscribeDisconnect((value) => {
      disconnected.push(value);
    });

    const pending = transport.transact(Uint8Array.of(0xf1, 0x0a));
    await Promise.resolve();
    hid.disconnect(device.port);

    await expect(pending).rejects.toBeInstanceOf(WebHidTransportError);
    expect(transport.identity).toBeNull();
    expect(disconnected).toEqual([identity]);
  });
});


describe("createBrowserWebHidTransport", () => {
  it("reports insecure contexts without dereferencing navigator", async () => {
    const originalSecureContext = Object.getOwnPropertyDescriptor(
      globalThis,
      "isSecureContext",
    );
    Object.defineProperty(globalThis, "isSecureContext", {
      configurable: true,
      value: false,
    });

    try {
      const transport = createBrowserWebHidTransport();
      expect(transport.support).toEqual({
        status: "unsupported",
        reason: "insecure-context",
      });
      await expect(transport.requestDevice()).rejects.toMatchObject({
        code: "unsupported",
      });
    } finally {
      if (originalSecureContext === undefined) {
        Reflect.deleteProperty(globalThis, "isSecureContext");
      } else {
        Object.defineProperty(globalThis, "isSecureContext", originalSecureContext);
      }
    }
  });

  it("reports missing WebHID separately from an insecure context", () => {
    const originalSecureContext = Object.getOwnPropertyDescriptor(
      globalThis,
      "isSecureContext",
    );
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

    Object.defineProperty(globalThis, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });

    try {
      expect(createBrowserWebHidTransport().support).toEqual({
        status: "unsupported",
        reason: "webhid-unavailable-or-blocked",
      });
    } finally {
      if (originalSecureContext === undefined) {
        Reflect.deleteProperty(globalThis, "isSecureContext");
      } else {
        Object.defineProperty(globalThis, "isSecureContext", originalSecureContext);
      }

      if (originalNavigator === undefined) {
        Reflect.deleteProperty(globalThis, "navigator");
      } else {
        Object.defineProperty(globalThis, "navigator", originalNavigator);
      }
    }
  });
});
