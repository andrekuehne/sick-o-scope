import { expect, test } from "@playwright/test";
import { signedInWithMembers } from "./helpers.ts";

test("sums up the Season per Member in the Saison tab, with the records below", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);

  // Today: Luna Sick, Max fit.
  await page.getByRole("button", { name: "Luna ist krank" }).click();
  const sheet = page.getByRole("dialog", { name: /Luna/ });
  await sheet.getByRole("button", { name: /Richtig krank/ }).click();
  await sheet.getByRole("button", { name: "Speichern" }).click();
  await page.getByRole("button", { name: "Max ist fit" }).click();
  await expect(page.getByText("2 / 2 eingetragen")).toBeVisible();

  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: /Saison/ }).click();
  await expect(page.getByRole("heading", { name: "Saison", level: 1 })).toBeVisible();

  /** One of a Member's numbers, found by its label. */
  const stat = (name: string, label: string) =>
    page
      .getByRole("listitem", { name })
      .locator("div")
      .filter({ has: page.getByRole("term").filter({ hasText: label }) })
      .getByRole("definition");
  await expect(stat("Luna", "Krankheitstage")).toHaveText("1 Tag");
  await expect(stat("Luna", "Infekte")).toHaveText("1");
  await expect(stat("Luna", "Schlimmster Tag")).toContainText("Richtig krank");
  await expect(stat("Max", "Krankheitstage")).toHaveText("0 Tage");
  await expect(stat("Max", "Längste Fit-Strähne")).toHaveText("1 Tag");

  await expect(page.getByRole("heading", { name: "Rekorde aller Zeiten" })).toBeVisible();
  await expect(page.getByText("📋 Lückenlos eingetragen")).toBeVisible();
  await expect(page.getByText(/Max: fit am Stück/)).toBeVisible();
});
