import type {
  KeyboardIdentity,
  KeyboardTransportSupport,
} from "../../transport.ts";

type WebHidTransportErrorCode =
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

class WebHidTransportError extends Error {
  readonly code: WebHidTransportErrorCode;

  constructor(
    code: WebHidTransportErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
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

interface WebHidInputReportEventPort {
  readonly data: DataView;
  readonly reportId: number;
}

type WebHidInputReportListener = (event: WebHidInputReportEventPort) => void;

interface WebHidDevicePort {
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

interface WebHidConnectionEventPort {
  readonly device: WebHidDevicePort;
}

type WebHidDisconnectListener = (event: WebHidConnectionEventPort) => void;

interface WebHidPort {
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

interface WebHidTransportOptions {
  readonly responseTimeoutMs?: number;
}

const SUPPORTED_TRANSPORT: KeyboardTransportSupport = { status: "supported" };

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
    (_unused, index): number => data.getUint8(index),
  );
}

function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown WebHID failure";
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

export {
  copyReport,
  describeFailure,
  deviceMatchesIdentity,
  identityFromDevice,
  isWebHidPort,
  normalizePermissionFailure,
  SUPPORTED_TRANSPORT,
  WebHidTransportError,
};
export type {
  WebHidConnectionEventPort,
  WebHidDevicePort,
  WebHidDisconnectListener,
  WebHidInputReportEventPort,
  WebHidInputReportListener,
  WebHidPort,
  WebHidTransportErrorCode,
  WebHidTransportOptions,
};
