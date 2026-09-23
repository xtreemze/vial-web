import type { KeyboardIdentity } from "./transport.ts";

export type DeviceOperation =
  | "permission"
  | "open"
  | "transact"
  | "reconnect"
  | "disconnect";

export type DeviceState =
  | { readonly status: "disconnected" }
  | { readonly status: "requesting-permission" }
  | { readonly status: "opening"; readonly identity: KeyboardIdentity }
  | { readonly status: "connected"; readonly identity: KeyboardIdentity }
  | { readonly status: "reconnecting"; readonly identity: KeyboardIdentity }
  | { readonly status: "disconnecting"; readonly identity: KeyboardIdentity }
  | {
      readonly status: "error";
      readonly identity?: KeyboardIdentity;
      readonly operation: DeviceOperation;
      readonly message: string;
    };
