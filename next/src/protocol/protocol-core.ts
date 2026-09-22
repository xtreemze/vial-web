type ByteArray = readonly number[];

class ProtocolCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolCodecError";
  }
}

function assertByte(label: string, value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${label} must be an unsigned byte`);
  }
  return value;
}

function assertUint16(label: string, value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${label} must be an unsigned 16-bit integer`);
  }
  return value;
}

function encodeUint16(value: number): readonly [number, number] {
  const checked = assertUint16("value", value);
  return [(checked >> 8) & 0xff, checked & 0xff];
}

function decodeUint16(data: Uint8Array, offset: number): number {
  requireLength(data, offset + 2, "16-bit integer");
  const high = data[offset];
  const low = data[offset + 1];
  if (high === undefined || low === undefined) {
    throw new ProtocolCodecError("16-bit integer bytes are unavailable");
  }
  return (high << 8) | low;
}

function frame(command: number, operation: number, payload: ByteArray = []): Uint8Array {
  return Uint8Array.from([
    assertByte("command", command),
    assertByte("operation", operation),
    ...payload.map((value, index): number => assertByte(`payload[${index}]`, value)),
  ]);
}

function requireLength(data: Uint8Array, minimum: number, label: string): void {
  if (data.byteLength < minimum) {
    throw new ProtocolCodecError(
      `${label} response is too short: expected at least ${minimum} bytes, received ${data.byteLength}`,
    );
  }
}

function assertAcknowledged(
  data: Uint8Array,
  command: number,
  operation: number,
  minimumLength = 2,
): void {
  requireLength(data, minimumLength, "protocol");
  if (data[0] !== command || data[1] !== operation) {
    throw new ProtocolCodecError(
      `protocol response did not acknowledge command 0x${command.toString(16)} operation 0x${operation.toString(16)}`,
    );
  }
}

function readByte(data: Uint8Array, offset: number, label: string): number {
  requireLength(data, offset + 1, label);
  const value = data[offset];
  if (value === undefined) {
    throw new ProtocolCodecError(`${label} byte is unavailable`);
  }
  return value;
}

export {
  assertAcknowledged,
  assertByte,
  assertUint16,
  decodeUint16,
  encodeUint16,
  frame,
  ProtocolCodecError,
  readByte,
  requireLength,
};
export type { ByteArray };
