import { expect, test } from "@playwright/test";
import { logDay, signedInWithMembers } from "./helpers.ts";

test("shows the Season's Awards, Stand heute, in the Saison tab and on a Member's Person screen", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);
  await logDay(page, "Luna", 0, { status: "sick", severity: 3, symptoms: ["cough"], medications: ["ibuprofen", "nasal-spray"] });
  await logDay(page, "Max", 0, { status: "healthy" });
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: /Saison/ }).click();

  // Per Award, who holds it.
  await expect(page.getByRole("heading", { name: "🌟 Auszeichnungen Stand heute" })).toBeVisible();
  const awards = page.getByRole("list", { name: "🌟 Auszeichnungen" });
  await expect(awards.getByRole("listitem").filter({ hasText: "Sofa-Profi" })).toContainText("Luna");
  await expect(awards.getByRole("listitem").filter({ hasText: "Eiserne Abwehr" })).toContainText("Max");
  // The Medication ones, after the others.
  await expect(awards.getByRole("listitem").filter({ hasText: "💊 Junkie" })).toHaveText(/Luna\s*an 1 Tag Medikamente/);
  await expect(awards.getByRole("listitem").filter({ hasText: "💦 Nasenspray-Junkie" })).toHaveText(/Luna\s*an 1 Tag Nasenspray/);
  await expect(awards.getByRole("listitem").filter({ hasText: "🍹 Cocktail-Mixer" })).toHaveText(/Luna\s*2 Medikamente an einem Tag/);
  await expect(awards.getByRole("listitem").last()).toContainText("Cocktail-Mixer");

  // Luna's own include them too.
  await page.getByRole("listitem", { name: "Luna" }).getByRole("link", { name: "Luna" }).click();
  await expect(page.getByRole("list", { name: "🌟 Auszeichnungen" })).toContainText("💊 Junkie");
  await page.goBack();

  // Max's own.
  await page.getByRole("listitem", { name: "Max" }).getByRole("link", { name: "Max" }).click();
  await expect(page.getByRole("heading", { name: "Max", level: 1 })).toBeVisible();
  await expect(page.getByRole("list", { name: "🌟 Auszeichnungen" }).getByRole("listitem")).toHaveText([
    /^🛡️ Eiserne Abwehr\s*1 Tag am Stück fit$/,
  ]);
});
