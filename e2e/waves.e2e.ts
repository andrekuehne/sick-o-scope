import { expect, test } from "@playwright/test";
import { logDay, signedInWithMembers } from "./helpers.ts";

test("shows a Family wave in the Saison tab, and as a band on the timeline at every zoom step", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max", "Sam"]);
  // Max and Luna are Sick today: their Bugs overlap. Sam is fit.
  await logDay(page, "Max", 0, { status: "sick", severity: 2, symptoms: [] });
  await logDay(page, "Luna", 0, { status: "sick", severity: 3, symptoms: ["cough"] });
  await logDay(page, "Sam", 0, { status: "healthy" });
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });

  await nav.getByRole("link", { name: /Saison/ }).click();
  // Who was caught, in the order their Bugs started (the same day: the Members' order).
  await expect(page.getByRole("list", { name: "🌊 Wellen" }).getByRole("listitem")).toHaveText([/^Welle 1 · .+ · Luna, Max$/]);

  await nav.getByRole("link", { name: "Verlauf" }).click();
  for (const step of ["Tag", "Woche", "Monat"]) {
    await page.getByRole("button", { name: step, exact: true }).click();
    await expect(page.getByText("🌊 Welle 1")).toBeVisible();
  }
});
