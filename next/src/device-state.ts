export type DeviceState =
  | { readonly status: "disconnected" }
  | { readonly status: "requesting-permission" }
  | { readonly status: "opening"; readonly identity: DeviceIdentity }
  | { readonly status: "connected"; readonly identity: DeviceIdentity }
  | { readonly status: "reconnecting"; readonly identity: DeviceIdentity }
  | {
      readonly status: "error";
      readonly identity?: DeviceIdentity;
      readonly operation: "permission" | "open" | "transact" | "reconnect";
      readonly message: string;
    };

export interface DeviceIdentity {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName?: string;
  readonly serialNumber?: string;
}
