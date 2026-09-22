export type HidMessage = Uint8Array;

export type KeyboardTransportSupport =
  | { readonly status: "supported" }
  | {
      readonly status: "unsupported";
      readonly reason: "insecure-context" | "webhid-unavailable-or-blocked";
    };

export interface KeyboardIdentity {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName?: string;
  readonly serialNumber?: string;
}

export interface KeyboardTransport {
  readonly identity: KeyboardIdentity | null;
  readonly support: KeyboardTransportSupport;

  readonly requestDevice: () => Promise<KeyboardIdentity | null>;
  readonly open: (identity?: KeyboardIdentity) => Promise<void>;
  readonly close: () => Promise<void>;

  /**
   * Send one protocol request and resolve with the matching response.
   * Protocol framing and command semantics belong above this layer.
   */
  readonly transact: (request: HidMessage) => Promise<HidMessage>;

  readonly subscribeDisconnect: (
    listener: (identity: KeyboardIdentity | null) => void,
  ) => () => void;
}
