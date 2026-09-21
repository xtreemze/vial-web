import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("keeps device access explicitly disabled until the WebHID adapter exists", () => {
    render(<App />);

    expect(screen.getByText("No keyboard connected.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Choose keyboard" }));

    expect(screen.getByText("WebHID is not enabled in this scaffold yet.")).toBeTruthy();
  });
});
