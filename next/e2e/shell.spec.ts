import { expect, test } from "@playwright/test";

test("renders a keyboard-independent shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Keyboard configuration with an explicit device lifecycle."
    })
  ).toBeVisible();

  await expect(page.getByRole("button", { name: "Connect keyboard" })).toBeDisabled();
});
