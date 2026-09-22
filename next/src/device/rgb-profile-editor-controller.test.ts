import { describe, expect, it } from "vitest";

import type {
  RgbProfileCapabilities,
  RgbProfileScope,
} from "../protocol/rgb-profile-codec.ts";
import {
  DeviceRgbProfileEditorController,
  type RgbProfilePort,
  type RgbProfileValue,
} from "./rgb-profile-editor-controller.ts";

const PROFILE: RgbProfileValue = {
  mode: 4,
  hue: 32,
  saturation: 128,
  brightness: 96,
  speed: 42,
};

class FakeRgbProfilePort implements RgbProfilePort {
  readonly capabilities: RgbProfileCapabilities = {
    protocolVersion: 1,
    scopeFlags: 0x0f,
    layerCount: 13,
    modifierCount: 4,
    comboCount: 32,
    maximumBrightness: 180,
    maximumMode: 41,
    fieldFlags: 0x1f,
    precedenceVersion: 1,
  };
  readonly calls: string[] = [];

  async getProfile(
    scope: RgbProfileScope,
    index: number,
  ): Promise<RgbProfileValue> {
    this.calls.push(`get:${scope}:${index}`);
    return PROFILE;
  }

  async setProfile(
    scope: RgbProfileScope,
    index: number,
    _profile: RgbProfileValue,
  ): Promise<void> {
    this.calls.push(`set:${scope}:${index}`);
  }

  async preview(_profile: RgbProfileValue): Promise<void> {
    this.calls.push("preview");
  }

  async cancelPreview(): Promise<void> {
    this.calls.push("cancel-preview");
  }

  async save(): Promise<void> {
    this.calls.push("save");
  }
}

describe("DeviceRgbProfileEditorController", () => {
  it("maps the editor onto the global RGB profile target", async () => {
    const port = new FakeRgbProfilePort();
    const controller = new DeviceRgbProfileEditorController(port);

    await expect(controller.load()).resolves.toEqual(PROFILE);
    await controller.apply(PROFILE);

    expect(port.calls).toEqual(["get:0:0", "set:0:0"]);
    expect(controller.capabilities).toEqual({
      maximumMode: 41,
      maximumBrightness: 180,
    });
  });

  it("keeps preview separate from durable persistence", async () => {
    const port = new FakeRgbProfilePort();
    const controller = new DeviceRgbProfileEditorController(port);

    await controller.preview(PROFILE);
    await controller.cancelPreview();

    expect(port.calls).toEqual(["preview", "cancel-preview"]);
  });

  it("sets the current value before saving it durably", async () => {
    const port = new FakeRgbProfilePort();
    const controller = new DeviceRgbProfileEditorController(port);

    await controller.save(PROFILE);

    expect(port.calls).toEqual(["set:0:0", "save"]);
  });
});
