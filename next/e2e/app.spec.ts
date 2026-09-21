import { expect, test } from "@playwright/test";

test("renders an accessible disconnected shell", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("heading", { name: "Vial Next" })).toBeVisible();
  await expect(page.getByText("No keyboard connected.")).toBeVisible();

  await page.getByRole("button", { name: "Choose keyboard" }).click();

  await expect(page.getByText("WebHID is not enabled in this scaffold yet.")).toBeVisible();
});
