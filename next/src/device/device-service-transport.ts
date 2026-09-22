import type { KeyboardTransport } from "../transport.ts";
import {
  assertAcknowledged,
  ProtocolCodecError,
  requireLength,
} from "../protocol/protocol-core.ts";
import { DeviceServiceTransportError } from "./device-service-errors.ts";

type Decoder<T> = (response: Uint8Array) => T;

async function transact(
  transport: KeyboardTransport,
  request: Uint8Array,
): Promise<Uint8Array> {
  try {
    return await transport.transact(request);
  } catch (error: unknown) {
    if (error instanceof ProtocolCodecError) {
      throw error;
    }
    throw new DeviceServiceTransportError("Keyboard transport transaction failed", error);
  }
}

async function probeNamespace<T>(
  transport: KeyboardTransport,
  request: Uint8Array,
  command: number,
  operation: number,
  decode: Decoder<T>,
): Promise<T | null> {
  const response = await transact(transport, request);
  requireLength(response, 2, "capability probe");
  if (response[0] !== command || response[1] !== operation) {
    return null;
  }
  return decode(response);
}

async function transactDecoded<T>(
  transport: KeyboardTransport,
  request: Uint8Array,
  decode: Decoder<T>,
): Promise<T> {
  return decode(await transact(transport, request));
}

async function transactAcknowledged(
  transport: KeyboardTransport,
  request: Uint8Array,
  command: number,
  operation: number,
): Promise<void> {
  const response = await transact(transport, request);
  assertAcknowledged(response, command, operation);
}

export {
  probeNamespace,
  transactAcknowledged,
  transactDecoded,
};
