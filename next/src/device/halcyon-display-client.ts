import type { KeyboardTransport } from "../transport.ts";
import {
  decodeHalcyonDisplayLayer,
  decodeHalcyonModifierLabel,
  type DisplayLayer,
  getHalcyonDisplayLayerRequest,
  getHalcyonModifierLabelRequest,
  type HalcyonDisplayCapabilities,
  HALCYON_DISPLAY_COMMAND,
  HALCYON_DISPLAY_OPERATIONS,
  resetHalcyonDisplayRequest,
  saveHalcyonDisplayRequest,
  setHalcyonDisplayLayerRequest,
  setHalcyonModifierLabelRequest,
} from "../protocol/halcyon-display-codec.ts";
import { UnsupportedFeatureError } from "./device-service-errors.ts";
import {
  transactAcknowledged,
  transactDecoded,
} from "./device-service-transport.ts";

const CAP_LAYER_LABELS = 1 << 0;
const CAP_MODIFIER_LABELS = 1 << 1;
const CAP_PATTERNS = 1 << 2;

class HalcyonDisplayClient {
  readonly capabilities: HalcyonDisplayCapabilities;
  readonly #transport: KeyboardTransport;

  constructor(
    transport: KeyboardTransport,
    capabilities: HalcyonDisplayCapabilities,
  ) {
    this.#transport = transport;
    this.capabilities = capabilities;
  }

  #requireFlag(flag: number, feature: string): void {
    if ((this.capabilities.flags & flag) === 0) {
      throw new UnsupportedFeatureError(feature);
    }
  }

  #requireIndex(index: number, count: number, label: string): void {
    if (!Number.isInteger(index) || index < 0 || index >= count) {
      throw new RangeError(`${label} index ${index} is out of range`);
    }
  }

  async getLayer(index: number): Promise<DisplayLayer> {
    this.#requireFlag(CAP_LAYER_LABELS, "Halcyon layer labels");
    this.#requireFlag(CAP_PATTERNS, "Halcyon display patterns");
    this.#requireIndex(index, this.capabilities.layerCount, "layer");
    return transactDecoded(
      this.#transport,
      getHalcyonDisplayLayerRequest(index),
      (response: Uint8Array): DisplayLayer =>
        decodeHalcyonDisplayLayer(response, this.capabilities.layerLabelMaximum),
    );
  }

  async setLayer(index: number, layer: DisplayLayer): Promise<void> {
    this.#requireFlag(CAP_LAYER_LABELS, "Halcyon layer labels");
    this.#requireFlag(CAP_PATTERNS, "Halcyon display patterns");
    this.#requireIndex(index, this.capabilities.layerCount, "layer");
    await transactAcknowledged(
      this.#transport,
      setHalcyonDisplayLayerRequest(
        index,
        layer,
        this.capabilities.layerLabelMaximum,
      ),
      HALCYON_DISPLAY_COMMAND,
      HALCYON_DISPLAY_OPERATIONS.setLayer,
    );
  }

  async getModifierLabel(index: number): Promise<string> {
    this.#requireFlag(CAP_MODIFIER_LABELS, "Halcyon modifier labels");
    this.#requireIndex(index, this.capabilities.modifierCount, "modifier");
    return transactDecoded(
      this.#transport,
      getHalcyonModifierLabelRequest(index),
      (response: Uint8Array): string =>
        decodeHalcyonModifierLabel(
          response,
          this.capabilities.modifierLabelMaximum,
        ),
    );
  }

  async setModifierLabel(index: number, label: string): Promise<void> {
    this.#requireFlag(CAP_MODIFIER_LABELS, "Halcyon modifier labels");
    this.#requireIndex(index, this.capabilities.modifierCount, "modifier");
    await transactAcknowledged(
      this.#transport,
      setHalcyonModifierLabelRequest(
        index,
        label,
        this.capabilities.modifierLabelMaximum,
      ),
      HALCYON_DISPLAY_COMMAND,
      HALCYON_DISPLAY_OPERATIONS.setModifierLabel,
    );
  }

  async save(): Promise<void> {
    await transactAcknowledged(
      this.#transport,
      saveHalcyonDisplayRequest(),
      HALCYON_DISPLAY_COMMAND,
      HALCYON_DISPLAY_OPERATIONS.save,
    );
  }

  async reset(): Promise<void> {
    await transactAcknowledged(
      this.#transport,
      resetHalcyonDisplayRequest(),
      HALCYON_DISPLAY_COMMAND,
      HALCYON_DISPLAY_OPERATIONS.reset,
    );
  }
}

export { HalcyonDisplayClient };
