import { expect, type Page, test } from "@playwright/test";
import { newFamilySignInLink } from "./helpers.ts";

async function addMember(page: Page, name: string, emoji: string, colour: string) {
  await page.getByRole("button", { name: "Mitglied hinzufügen" }).click();
  const form = page.getByRole("form", { name: "Neues Familienmitglied" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: emoji }).click();
  await form.getByRole("button", { name: colour }).click();
  await form.getByRole("button", { name: "Speichern" }).click();
  await expect(form).toHaveCount(0);
}

test("manages the Family's Members: add, edit, reorder, archive", async ({ page }) => {
  await page.goto(await newFamilySignInLink("Familie Kühne", "André"));
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Einstellungen" }).click();
  await expect(page.getByText("Noch niemand da")).toBeVisible();

  await addMember(page, "Luna", "🦊", "Koralle");
  await addMember(page, "Max", "🐻", "Blau");
  const activeNames = page.locator(".member-row:not(.archived) .member-name");
  await expect(activeNames).toHaveText(["Luna", "Max"]);

  // Edit: rename Max.
  await page.getByRole("button", { name: "Max bearbeiten" }).click();
  const form = page.getByRole("form", { name: "Max bearbeiten" });
  await form.getByLabel("Name").fill("Maxi");
  await form.getByRole("button", { name: "Speichern" }).click();
  await expect(activeNames).toHaveText(["Luna", "Maxi"]);

  // Reorder: Maxi first.
  await page.getByRole("button", { name: "Maxi nach oben" }).click();
  await expect(activeNames).toHaveText(["Maxi", "Luna"]);

  // Archive Luna: she moves to "Archiviert" and can come back.
  await page.getByRole("button", { name: "Luna archivieren" }).click();
  await expect(activeNames).toHaveText(["Maxi"]);
  await expect(page.getByRole("heading", { name: "Archiviert" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Luna zurückholen" })).toBeVisible();

  // Everything was saved, not just shown.
  await page.reload();
  await expect(activeNames).toHaveText(["Maxi"]);
  await page.getByRole("button", { name: "Luna zurückholen" }).click();
  await expect(activeNames).toHaveText(["Maxi", "Luna"]);
});
