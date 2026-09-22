class UnsupportedFeatureError extends Error {
  constructor(feature: string) {
    super(`${feature} is not supported by the connected keyboard`);
    this.name = "UnsupportedFeatureError";
  }
}

class DeviceServiceTransportError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = "DeviceServiceTransportError";
  }
}

class DeviceSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceSelectionError";
  }
}

export {
  DeviceSelectionError,
  DeviceServiceTransportError,
  UnsupportedFeatureError,
};
