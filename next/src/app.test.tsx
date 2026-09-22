import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./app";

describe("App", () => {
  it("renders an accessible disconnected shell without requiring hardware", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Vial configurator" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "No keyboard connected" }),
    ).toBeTruthy();

    const connectButton = screen.getByRole("button", {
      name: "Connect keyboard",
    });

    expect(connectButton).toHaveProperty("disabled", true);
    expect(screen.getByText(/0xF2/u)).toBeTruthy();
  });
});
