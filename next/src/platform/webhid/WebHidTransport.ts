import type {
  HidMessage,
  KeyboardIdentity,
  KeyboardTransport,
  KeyboardTransportSupport,
} from "../../transport.ts";
import {
  copyReport,
  describeFailure,
  deviceMatchesIdentity,
  identityFromDevice,
  isWebHidPort,
  normalizePermissionFailure,
  SUPPORTED_TRANSPORT,
  WebHidTransportError,
} from "./WebHidTypes.ts";
import type {
  WebHidDevicePort,
  WebHidDisconnectListener,
  WebHidInputReportListener,
  WebHidPort,
  WebHidTransportOptions,
} from "./WebHidTypes.ts";

const VIAL_USAGE_PAGE = 0xff_60;
const VIAL_USAGE = 0x61;
const REPORT_ID = 0;
const REPORT_LENGTH = 32;
const RESPONSE_TIMEOUT_MS = 500;

function unsupportedMessage(
  reason: "insecure-context" | "webhid-unavailable-or-blocked",
): string {
  if (reason === "insecure-context") {
    return "WebHID requires a secure HTTPS context.";
  }
  return "WebHID is unavailable or blocked by browser permissions policy.";
}

function createUnsupportedTransport(
  reason: "insecure-context" | "webhid-unavailable-or-blocked",
): KeyboardTransport {
  const support: KeyboardTransportSupport = { status: "unsupported", reason };
  const unsupported = (): WebHidTransportError =>
    new WebHidTransportError("unsupported", unsupportedMessage(reason));

  return {
    identity: null,
    support,
    requestDevice: (): Promise<KeyboardIdentity | null> =>
      Promise.reject(unsupported()),
    open: (): Promise<void> => Promise.reject(unsupported()),
    close: (): Promise<void> => Promise.resolve(),
    transact: (): Promise<HidMessage> => Promise.reject(unsupported()),
    subscribeDisconnect: (): (() => void) => (): void => undefined,
  };
}

function createBrowserWebHidTransport(): KeyboardTransport {
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

function createWebHidTransport(
  hid: WebHidPort,
  options: WebHidTransportOptions = {},
): KeyboardTransport {
  const responseTimeoutMs = options.responseTimeoutMs ?? RESPONSE_TIMEOUT_MS;
  let selectedDevice: WebHidDevicePort | null = null;
  let transactionTail: Promise<void> = Promise.resolve();
  let activeTransactionAbort: ((error: WebHidTransportError) => void) | null = null;
  const disconnectListeners: Set<
    (identity: KeyboardIdentity | null) => void
  > = new Set();

  const currentIdentity = (): KeyboardIdentity | null => {
    if (selectedDevice === null) {
      return null;
    }
    return identityFromDevice(selectedDevice);
  };

  const disconnectListener: WebHidDisconnectListener = (event): void => {
    if (event.device !== selectedDevice) {
      return;
    }

    const disconnectedIdentity = identityFromDevice(event.device);
    selectedDevice = null;

    if (activeTransactionAbort !== null) {
      activeTransactionAbort(
        new WebHidTransportError(
          "transport-closed",
          "The selected HID device disconnected during communication.",
        ),
      );
    }

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
    const matches = granted.filter(
      (device): boolean => deviceMatchesIdentity(device, identity),
    );

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

    const response = new Promise<HidMessage>((resolve, reject): void => {
      const abort = (error: WebHidTransportError): void => {
        reject(error);
      };
      activeTransactionAbort = abort;

      inputListener = (event): void => {
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
      timeoutId = globalThis.setTimeout((): void => {
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
      (): Promise<HidMessage> => transactOnce(request),
      (): Promise<HidMessage> => transactOnce(request),
    );
    transactionTail = execution.then(
      (): void => undefined,
      (): void => undefined,
    );
    return execution;
  };

  const subscribeDisconnect = (
    listener: (identity: KeyboardIdentity | null) => void,
  ): (() => void) => {
    disconnectListeners.add(listener);
    return (): void => {
      disconnectListeners.delete(listener);
    };
  };

  return {
    get identity(): KeyboardIdentity | null {
      return currentIdentity();
    },
    support: SUPPORTED_TRANSPORT,
    requestDevice,
    open,
    close,
    transact,
    subscribeDisconnect,
  };
}

export {
  createBrowserWebHidTransport,
  createWebHidTransport,
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
} from "./WebHidTypes.ts";
