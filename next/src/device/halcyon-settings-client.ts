import type { KeyboardTransport } from "../transport.ts";
import {
  decodeHalcyonDimStyle,
  decodeHalcyonLayerStyle,
  decodeHalcyonModifierStyle,
  decodeHalcyonTelemetry,
  decodeHalcyonTimings,
  getHalcyonDimStyleRequest,
  getHalcyonLayerStyleRequest,
  getHalcyonModifierStyleRequest,
  getHalcyonTelemetryRequest,
  getHalcyonTimingsRequest,
  type HalcyonSettingsCapabilities,
  type HalcyonTelemetry,
  HALCYON_SETTINGS_COMMAND,
  HALCYON_SETTINGS_OPERATIONS,
  type Hsv,
  type LayerStyle,
  resetHalcyonSettingsRequest,
  saveHalcyonSettingsRequest,
  setHalcyonDimStyleRequest,
  setHalcyonLayerStyleRequest,
  setHalcyonModifierStyleRequest,
  setHalcyonTimingsRequest,
} from "../protocol/halcyon-settings-codec.ts";
import { UnsupportedFeatureError } from "./device-service-errors.ts";
import {
  transactAcknowledged,
  transactDecoded,
} from "./device-service-transport.ts";

const CAP_LAYER_COLORS = 1 << 0;
const CAP_MOD_COLORS = 1 << 1;
const CAP_TIMINGS = 1 << 2;
const CAP_TELEMETRY = 1 << 3;

class HalcyonSettingsClient {
  readonly capabilities: HalcyonSettingsCapabilities;
  readonly #transport: KeyboardTransport;

  constructor(
    transport: KeyboardTransport,
    capabilities: HalcyonSettingsCapabilities,
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

  async getLayerStyle(index: number): Promise<LayerStyle> {
    this.#requireFlag(CAP_LAYER_COLORS, "Halcyon layer colors");
    this.#requireIndex(index, this.capabilities.layerCount, "layer");
    return transactDecoded(
      this.#transport,
      getHalcyonLayerStyleRequest(index),
      decodeHalcyonLayerStyle,
    );
  }

  async setLayerStyle(index: number, style: LayerStyle): Promise<void> {
    this.#requireFlag(CAP_LAYER_COLORS, "Halcyon layer colors");
    this.#requireIndex(index, this.capabilities.layerCount, "layer");
    await transactAcknowledged(
      this.#transport,
      setHalcyonLayerStyleRequest(index, style),
      HALCYON_SETTINGS_COMMAND,
      HALCYON_SETTINGS_OPERATIONS.setLayerStyle,
    );
  }

  async getModifierStyle(index: number): Promise<Hsv> {
    this.#requireFlag(CAP_MOD_COLORS, "Halcyon modifier colors");
    this.#requireIndex(index, this.capabilities.modifierCount, "modifier");
    return transactDecoded(
      this.#transport,
      getHalcyonModifierStyleRequest(index),
      decodeHalcyonModifierStyle,
    );
  }

  async setModifierStyle(index: number, color: Hsv): Promise<void> {
    this.#requireFlag(CAP_MOD_COLORS, "Halcyon modifier colors");
    this.#requireIndex(index, this.capabilities.modifierCount, "modifier");
    await transactAcknowledged(
      this.#transport,
      setHalcyonModifierStyleRequest(index, color),
      HALCYON_SETTINGS_COMMAND,
      HALCYON_SETTINGS_OPERATIONS.setModifierStyle,
    );
  }

  async getDimStyle(): Promise<Hsv> {
    this.#requireFlag(CAP_MOD_COLORS, "Halcyon modifier colors");
    return transactDecoded(
      this.#transport,
      getHalcyonDimStyleRequest(),
      decodeHalcyonDimStyle,
    );
  }

  async setDimStyle(color: Hsv): Promise<void> {
    this.#requireFlag(CAP_MOD_COLORS, "Halcyon modifier colors");
    await transactAcknowledged(
      this.#transport,
      setHalcyonDimStyleRequest(color),
      HALCYON_SETTINGS_COMMAND,
      HALCYON_SETTINGS_OPERATIONS.setDimStyle,
    );
  }

  async getTimings(): Promise<readonly [number, number]> {
    this.#requireFlag(CAP_TIMINGS, "Halcyon display timings");
    return transactDecoded(
      this.#transport,
      getHalcyonTimingsRequest(),
      decodeHalcyonTimings,
    );
  }

  async setTimings(
    patternFrameMs: number,
    modifierRecentMs: number,
  ): Promise<void> {
    this.#requireFlag(CAP_TIMINGS, "Halcyon display timings");
    await transactAcknowledged(
      this.#transport,
      setHalcyonTimingsRequest(patternFrameMs, modifierRecentMs),
      HALCYON_SETTINGS_COMMAND,
      HALCYON_SETTINGS_OPERATIONS.setTimings,
    );
  }

  async getTelemetry(): Promise<HalcyonTelemetry> {
    this.#requireFlag(CAP_TELEMETRY, "Halcyon telemetry");
    return transactDecoded(
      this.#transport,
      getHalcyonTelemetryRequest(),
      decodeHalcyonTelemetry,
    );
  }

  async save(): Promise<void> {
    await transactAcknowledged(
      this.#transport,
      saveHalcyonSettingsRequest(),
      HALCYON_SETTINGS_COMMAND,
      HALCYON_SETTINGS_OPERATIONS.save,
    );
  }

  async reset(): Promise<void> {
    await transactAcknowledged(
      this.#transport,
      resetHalcyonSettingsRequest(),
      HALCYON_SETTINGS_COMMAND,
      HALCYON_SETTINGS_OPERATIONS.reset,
    );
  }
}

export { HalcyonSettingsClient };
