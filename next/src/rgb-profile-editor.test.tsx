import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  RgbProfileEditorController,
  RgbProfileValue,
} from "./device/rgb-profile-editor-controller.ts";
import { RgbProfileEditor } from "./rgb-profile-editor.tsx";

afterEach(cleanup);

const PROFILE: RgbProfileValue = {
  mode: 7,
  hue: 24,
  saturation: 180,
  brightness: 90,
  speed: 36,
};

class FakeRgbEditorController implements RgbProfileEditorController {
  readonly capabilities = {
    maximumMode: 42,
    maximumBrightness: 160,
  };
  readonly calls: string[] = [];

  async load(): Promise<RgbProfileValue> {
    this.calls.push("load");
    return PROFILE;
  }

  async preview(_profile: RgbProfileValue): Promise<void> {
    this.calls.push("preview");
  }

  async cancelPreview(): Promise<void> {
    this.calls.push("cancel-preview");
  }

  async apply(_profile: RgbProfileValue): Promise<void> {
    this.calls.push("apply");
  }

  async save(_profile: RgbProfileValue): Promise<void> {
    this.calls.push("save");
  }
}

describe("RgbProfileEditor", () => {
  it("loads values and applies capability-derived bounds", async () => {
    const controller = new FakeRgbEditorController();
    render(<RgbProfileEditor controller={controller} />);

    const brightness = await screen.findByRole("slider", {
      name: "Brightness 90",
    });
    const mode = screen.getByRole("slider", {
      name: "Effect mode 7",
    });

    expect(brightness).toHaveProperty("max", "160");
    expect(mode).toHaveProperty("max", "42");
    expect(controller.calls).toEqual(["load"]);
  });

  it("keeps preview and durable save as distinct actions", async () => {
    const controller = new FakeRgbEditorController();
    render(<RgbProfileEditor controller={controller} />);

    await screen.findByRole("slider", { name: "Brightness 90" });

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(
      await screen.findByText("Preview active temporarily."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save to keyboard" }));
    expect(await screen.findByText("Profile saved to keyboard.")).toBeTruthy();

    expect(controller.calls).toEqual(["load", "preview", "save"]);
  });

  it("updates slider values before applying live state", async () => {
    const controller = new FakeRgbEditorController();
    render(<RgbProfileEditor controller={controller} />);

    const hue = await screen.findByRole("slider", { name: "Hue 24" });
    fireEvent.change(hue, { target: { value: "96" } });

    expect(screen.getByRole("slider", { name: "Hue 96" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText("Profile applied to live keyboard state."),
    ).toBeTruthy();
    expect(controller.calls).toEqual(["load", "apply"]);
  });
});
