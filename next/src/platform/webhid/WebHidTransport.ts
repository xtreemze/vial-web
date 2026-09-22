import type {
  HidMessage,
  KeyboardIdentity,
  KeyboardTransport,
  KeyboardTransportSupport,
} from "../../transport.ts";

const VIAL_USAGE_PAGE = 0xff60;
const VIAL_USAGE = 0x61;
const REPORT_ID = 0;
const REPORT_LENGTH = 32;
const RESPONSE_TIMEOUT_MS = 500;

export type WebHidTransportErrorCode =
  | "permission-denied"
  | "device-not-found"
  | "ambiguous-device"
  | "open-failed"
  | "transport-closed"
  | "request-too-large"
  | "response-timeout"
  | "invalid-response"
  | "io-failed"
  | "unsupported";

export class WebHidTransportError extends Error {
  readonly code: WebHidTransportErrorCode;

  constructor(code: WebHidTransportErrorCode, message: string) {
    super(message);
    this.name = "WebHidTransportError";
    this.code = code;
  }
}

interface WebHidDeviceFilter {
  readonly usagePage: number;
  readonly usage: number;
}

interface WebHidRequestOptions {
  readonly filters: readonly WebHidDeviceFilter[];
}

export interface WebHidInputReportEventPort {
  readonly data: DataView;
  readonly reportId: number;
}

export type WebHidInputReportListener = (event: WebHidInputReportEventPort) => void;

export interface WebHidDevicePort {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly opened: boolean;

  readonly open: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly sendReport: (reportId: number, data: Uint8Array) => Promise<void>;
  readonly addEventListener: (
    type: "inputreport",
    listener: WebHidInputReportListener,
  ) => void;
  readonly removeEventListener: (
    type: "inputreport",
    listener: WebHidInputReportListener,
  ) => void;
}

export interface WebHidConnectionEventPort {
  readonly device: WebHidDevicePort;
}

export type WebHidDisconnectListener = (event: WebHidConnectionEventPort) => void;

export interface WebHidPort {
  readonly requestDevice: (
    options: WebHidRequestOptions,
  ) => Promise<readonly WebHidDevicePort[]>;
  readonly getDevices: () => Promise<readonly WebHidDevicePort[]>;
  readonly addEventListener: (
    type: "disconnect",
    listener: WebHidDisconnectListener,
  ) => void;
  readonly removeEventListener: (
    type: "disconnect",
    listener: WebHidDisconnectListener,
  ) => void;
}

const supported = { status: "supported" } satisfies KeyboardTransportSupport;

function identityFromDevice(device: WebHidDevicePort): KeyboardIdentity {
  if (device.productName.length === 0) {
    return {
      vendorId: device.vendorId,
      productId: device.productId,
    };
  }

  return {
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName,
  };
}

function deviceMatchesIdentity(
  device: WebHidDevicePort,
  identity: KeyboardIdentity,
): boolean {
  if (identity.serialNumber !== undefined) {
    return false;
  }

  return (
    device.vendorId === identity.vendorId &&
    device.productId === identity.productId &&
    (identity.productName === undefined || device.productName === identity.productName)
  );
}

function copyReport(data: DataView): Uint8Array {
  return Uint8Array.from(
    { length: data.byteLength },
    (_unused, index) => data.getUint8(index),
  );
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown WebHID failure";
}

function normalizePermissionFailure(error: unknown): WebHidTransportError {
  if (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  ) {
    return new WebHidTransportError(
      "permission-denied",
      "WebHID permission was denied or is blocked by browser policy.",
    );
  }

  return new WebHidTransportError(
    "io-failed",
    `WebHID device selection failed: ${describeFailure(error)}`,
  );
}

function createUnsupportedTransport(
  reason: "insecure-context" | "webhid-unavailable-or-blocked",
): KeyboardTransport {
  const support = { status: "unsupported", reason } satisfies KeyboardTransportSupport;

  const unsupported = () =>
    new WebHidTransportError(
      "unsupported",
      reason === "insecure-context"
        ? "WebHID requires a secure HTTPS context."
        : "WebHID is unavailable or blocked by browser permissions policy.",
    );

  return {
    identity: null,
    support,
    requestDevice: () => Promise.reject(unsupported()),
    open: () => Promise.reject(unsupported()),
    close: () => Promise.resolve(),
    transact: () => Promise.reject(unsupported()),
    subscribeDisconnect: () => () => undefined,
  };
}

function isWebHidPort(value: unknown): value is WebHidPort {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    typeof Reflect.get(value, "requestDevice") === "function" &&
    typeof Reflect.get(value, "getDevices") === "function" &&
    typeof Reflect.get(value, "addEventListener") === "function" &&
    typeof Reflect.get(value, "removeEventListener") === "function"
  );
}

export function createBrowserWebHidTransport(): KeyboardTransport {
  if (!globalThis.isSecureContext) {
    return createUnsupportedTransport("insecure-context");
  }

  const navigatorCandidate: unknown = Reflect.get(globalThis, "navigator");
  if (typeof navigatorCandidate !== "object" || navigatorCandidate === null) {
    return createUnsupportedTransport("webhid-unavailable-or-blocked");
  }

  const candidate: unknown = Reflect.get(navigatorCandidate, "hid");
  if (!isWebHidPort(candidate)) {
    return createUnsupportedTransport("webhid-unavailable-or-blocked");
  }

  return createWebHidTransport(candidate);
}

interface WebHidTransportOptions {
  readonly responseTimeoutMs?: number;
}

export function createWebHidTransport(
  hid: WebHidPort,
  options: WebHidTransportOptions = {},
): KeyboardTransport {
  const responseTimeoutMs = options.responseTimeoutMs ?? RESPONSE_TIMEOUT_MS;
  let selectedDevice: WebHidDevicePort | null = null;
  let transactionTail: Promise<void> = Promise.resolve();
  let activeTransactionAbort: ((error: WebHidTransportError) => void) | null = null;
  const disconnectListeners = new Set<(identity: KeyboardIdentity | null) => void>();

  const currentIdentity = (): KeyboardIdentity | null =>
    selectedDevice === null ? null : identityFromDevice(selectedDevice);

  const disconnectListener: WebHidDisconnectListener = (event) => {
    if (event.device !== selectedDevice) {
      return;
    }

    const disconnectedIdentity = identityFromDevice(event.device);
    selectedDevice = null;

    activeTransactionAbort?.(
      new WebHidTransportError(
        "transport-closed",
        "The selected HID device disconnected during communication.",
      ),
    );

    for (const listener of disconnectListeners) {
      listener(disconnectedIdentity);
    }
  };

  hid.addEventListener("disconnect", disconnectListener);

  const requestDevice = async (): Promise<KeyboardIdentity | null> => {
    let devices: readonly WebHidDevicePort[];
    try {
      devices = await hid.requestDevice({
        filters: [{ usagePage: VIAL_USAGE_PAGE, usage: VIAL_USAGE }],
      });
    } catch (error: unknown) {
      throw normalizePermissionFailure(error);
    }

    if (devices.length === 0) {
      return null;
    }
    if (devices.length !== 1) {
      throw new WebHidTransportError(
        "ambiguous-device",
        "Select exactly one compatible Vial HID interface.",
      );
    }

    const [device] = devices;
    if (device === undefined) {
      throw new WebHidTransportError(
        "device-not-found",
        "The selected WebHID device was not returned by the browser.",
      );
    }

    selectedDevice = device;
    return identityFromDevice(device);
  };

  const resolveGrantedDevice = async (
    identity: KeyboardIdentity,
  ): Promise<WebHidDevicePort> => {
    if (selectedDevice !== null && deviceMatchesIdentity(selectedDevice, identity)) {
      return selectedDevice;
    }

    const granted = await hid.getDevices();
    const matches = granted.filter((device) => deviceMatchesIdentity(device, identity));

    if (matches.length === 0) {
      throw new WebHidTransportError(
        "device-not-found",
        "The previously selected keyboard is not available to this origin.",
      );
    }

    if (matches.length !== 1) {
      throw new WebHidTransportError(
        "ambiguous-device",
        "Multiple granted keyboards match the prior identity; explicit selection is required.",
      );
    }

    const [device] = matches;
    if (device === undefined) {
      throw new WebHidTransportError(
        "device-not-found",
        "The granted WebHID device disappeared during selection.",
      );
    }

    return device;
  };

  const open = async (identity?: KeyboardIdentity): Promise<void> => {
    let device = selectedDevice;

    if (identity !== undefined) {
      device = await resolveGrantedDevice(identity);
    }

    if (device === null) {
      throw new WebHidTransportError(
        "device-not-found",
        "Select a keyboard before opening the WebHID transport.",
      );
    }

    if (!device.opened) {
      try {
        await device.open();
      } catch (error: unknown) {
        throw new WebHidTransportError(
          "open-failed",
          `Opening the selected WebHID device failed: ${describeFailure(error)}`,
        );
      }
    }

    selectedDevice = device;
  };

  const close = async (): Promise<void> => {
    const device = selectedDevice;
    selectedDevice = null;

    if (device === null || !device.opened) {
      return;
    }

    try {
      await device.close();
    } catch (error: unknown) {
      throw new WebHidTransportError(
        "io-failed",
        `Closing the selected WebHID device failed: ${describeFailure(error)}`,
      );
    }
  };

  const transactOnce = async (request: HidMessage): Promise<HidMessage> => {
    if (request.byteLength > REPORT_LENGTH) {
      throw new WebHidTransportError(
        "request-too-large",
        `Vial HID requests cannot exceed ${REPORT_LENGTH} bytes.`,
      );
    }

    const device = selectedDevice;
    if (device === null || !device.opened) {
      throw new WebHidTransportError(
        "transport-closed",
        "The selected WebHID transport is not open.",
      );
    }

    const report = new Uint8Array(REPORT_LENGTH);
    report.set(request);

    let timeoutId: number | null = null;
    let inputListener: WebHidInputReportListener | null = null;

    const response = new Promise<HidMessage>((resolve, reject) => {
      const abort = (error: WebHidTransportError) => {
        reject(error);
      };
      activeTransactionAbort = abort;

      inputListener = (event) => {
        if (event.reportId !== REPORT_ID) {
          return;
        }

        const message = copyReport(event.data);
        if (message.byteLength !== REPORT_LENGTH) {
          reject(
            new WebHidTransportError(
              "invalid-response",
              `Expected a ${REPORT_LENGTH}-byte Vial HID response, received ${message.byteLength}.`,
            ),
          );
          return;
        }

        resolve(message);
      };

      device.addEventListener("inputreport", inputListener);
      timeoutId = globalThis.setTimeout(() => {
        reject(
          new WebHidTransportError(
            "response-timeout",
            "Timed out waiting for the Vial HID response.",
          ),
        );
      }, responseTimeoutMs);
    });

    try {
      await device.sendReport(REPORT_ID, report);
      return await response;
    } catch (error: unknown) {
      if (error instanceof WebHidTransportError) {
        throw error;
      }
      throw new WebHidTransportError(
        "io-failed",
        `WebHID transaction failed: ${describeFailure(error)}`,
      );
    } finally {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
      if (inputListener !== null) {
        device.removeEventListener("inputreport", inputListener);
      }
      activeTransactionAbort = null;
    }
  };

  const transact = (request: HidMessage): Promise<HidMessage> => {
    const execution = transactionTail.then(
      () => transactOnce(request),
      () => transactOnce(request),
    );
    transactionTail = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  };

  return {
    get identity() {
      return currentIdentity();
    },
    support: supported,
    requestDevice,
    open,
    close,
    transact,
    subscribeDisconnect: (listener) => {
      disconnectListeners.add(listener);
      return () => {
        disconnectListeners.delete(listener);
      };
    },
  };
}
