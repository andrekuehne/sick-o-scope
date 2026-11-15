import { expect, test } from "@playwright/test";
import { newFamilySignInLink } from "./helpers.ts";

test("signs in with a Sign-in link, gets greeted, and can sign out again", async ({ page }) => {
  const link = await newFamilySignInLink("Familie Kühne", "André");

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Willkommen bei Sick-o-Scope 👋" })).toBeVisible();
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(page.getByRole("heading", { name: "Hallo André 👋" })).toBeVisible();
  await expect(page.getByText("Familie Kühne")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  // Still signed in after a reload (the session cookie works).
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hallo André 👋" })).toBeVisible();

  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Einstellungen" }).click();
  await page.getByRole("button", { name: "Dieses Gerät abmelden" }).click();
  await expect(page.getByRole("heading", { name: "Du bist nicht angemeldet" })).toBeVisible();
});

test("a Sign-in link that was already used explains what to do", async ({ page, browser }) => {
  const link = await newFamilySignInLink("Familie Kühne", "André");
  await page.goto(link);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Hallo André 👋" })).toBeVisible();

  // Someone else opens the same link on another phone.
  const otherPhone = await browser.newPage();
  await otherPhone.goto(link);
  await otherPhone.getByRole("button", { name: "Anmelden" }).click();
  await expect(otherPhone.getByText("Dieser Link wurde schon benutzt.")).toBeVisible();
  await expect(otherPhone.getByText("neuen Anmelde-Link")).toBeVisible();
  await otherPhone.close();
});
