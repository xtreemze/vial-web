export type HidMessage = Uint8Array;

export interface KeyboardIdentity {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName?: string;
  readonly serialNumber?: string;
}

export interface KeyboardTransport {
  readonly identity: KeyboardIdentity | null;

  requestDevice(): Promise<KeyboardIdentity | null>;
  open(identity?: KeyboardIdentity): Promise<void>;
  close(): Promise<void>;

  /**
   * Send one protocol request and resolve with the matching response.
   * Protocol framing and command semantics belong above this layer.
   */
  transact(request: HidMessage): Promise<HidMessage>;

  subscribeDisconnect(listener: (identity: KeyboardIdentity | null) => void): () => void;
}
