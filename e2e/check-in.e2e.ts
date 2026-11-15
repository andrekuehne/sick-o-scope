import { expect, test } from "@playwright/test";
import { signedInWithMembers } from "./helpers.ts";

test("logs the whole Family healthy with one tap on a fresh day, and single Members too", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max", "Oma"]);
  const card = (name: string) => page.getByRole("listitem", { name });

  // A fresh day: nobody logged yet, and that's not "Healthy".
  await expect(page.getByText("0 / 3 eingetragen")).toBeVisible();
  for (const name of ["Luna", "Max", "Oma"]) await expect(card(name)).toContainText("Noch nichts eingetragen");

  await page.getByRole("button", { name: "Alle fit heute" }).click();
  await expect(page.getByText("3 / 3 eingetragen")).toBeVisible();
  for (const name of ["Luna", "Max", "Oma"]) await expect(card(name)).toContainText("🙂 Fit");
  await expect(page.getByRole("button", { name: "Alle fit heute" })).toBeDisabled();

  // Saved, not just shown; a wrong entry goes back to a Gap, and one Member can be logged alone.
  await page.reload();
  await expect(page.getByText("3 / 3 eingetragen")).toBeVisible();
  await page.getByRole("button", { name: "Eintrag von Max bearbeiten" }).click();
  await page.getByRole("button", { name: "Eintrag löschen" }).click();
  await expect(card("Max")).toContainText("Noch nichts eingetragen");
  await expect(page.getByText("2 / 3 eingetragen")).toBeVisible();
  await page.getByRole("button", { name: "Max ist fit" }).click();
  await expect(card("Max")).toContainText("🙂 Fit");
  await expect(page.getByText("3 / 3 eingetragen")).toBeVisible();
});

test("moves between days, but never into the future", async ({ page }) => {
  await signedInWithMembers(page, ["Luna"]);
  const bar = page.getByRole("navigation", { name: "Datum" });

  await expect(bar).toContainText("Heute");
  await expect(bar.getByRole("button", { name: "Nächster Tag" })).toBeDisabled();

  await bar.getByRole("button", { name: "Vorheriger Tag" }).click();
  await expect(bar).toContainText("Gestern");
  await expect(page.getByRole("button", { name: /Alle fit am/ })).toBeVisible();
  await page.getByRole("button", { name: "Luna ist fit" }).click();
  await expect(page.getByText("1 / 1 eingetragen")).toBeVisible();

  // Today is still a Gap: yesterday's Check-in belongs to yesterday only.
  await bar.getByRole("button", { name: "Nächster Tag" }).click();
  await expect(bar).toContainText("Heute");
  await expect(page.getByText("0 / 1 eingetragen")).toBeVisible();
});

test("logs a Sick day with Symptoms and a Severity, and switches between Sick and Healthy", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);
  const luna = page.getByRole("listitem", { name: "Luna" });
  const sheet = page.getByRole("dialog", { name: /Luna/ });

  await page.getByRole("button", { name: "Luna ist krank" }).click();
  await sheet.getByRole("button", { name: "Husten" }).click();
  await sheet.getByRole("button", { name: "Fieber" }).click();
  await sheet.getByRole("button", { name: /Richtig krank/ }).click();
  await sheet.getByLabel("Notiz").fill("Fieber nachts 39,2");
  await sheet.getByRole("button", { name: "Speichern" }).click();

  await expect(sheet).toBeHidden();
  await expect(luna).toContainText("Richtig krank");
  await expect(luna.getByRole("img", { name: "Husten" })).toBeVisible();
  await expect(luna.getByRole("img", { name: "Fieber" })).toBeVisible();
  await expect(page.getByText("1 / 2 eingetragen")).toBeVisible();

  // Saved, not just shown: the sheet reopens with the whole day, and Sick turns Healthy…
  await page.reload();
  await page.getByRole("button", { name: "Eintrag von Luna bearbeiten" }).click();
  await expect(sheet.getByRole("button", { name: "Husten" })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: /Richtig krank/ })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByLabel("Notiz")).toHaveValue("Fieber nachts 39,2");
  await sheet.getByRole("button", { name: "Fit", exact: true }).click();
  await sheet.getByRole("button", { name: "Speichern" }).click();
  await expect(luna).toContainText("🙂 Fit");
  await expect(luna.getByRole("img")).toHaveCount(0);

  // …and back again.
  await page.getByRole("button", { name: "Eintrag von Luna bearbeiten" }).click();
  await sheet.getByRole("button", { name: "Krank", exact: true }).click();
  await sheet.getByRole("button", { name: /Sofa-Kobold/ }).click();
  await sheet.getByRole("button", { name: "Speichern" }).click();
  await expect(luna).toContainText("Sofa-Kobold");
});

test("follows an illness day by day: Besser lowers the Severity and keeps the Symptoms", async ({ page }) => {
  await signedInWithMembers(page, ["Luna"]);
  const luna = page.getByRole("listitem", { name: "Luna" });
  const bar = page.getByRole("navigation", { name: "Datum" });

  // Yesterday: Sick with two Symptoms.
  await bar.getByRole("button", { name: "Vorheriger Tag" }).click();
  await expect(luna.getByRole("button", { name: "Luna: Besser" })).toHaveCount(0); // nothing to follow yet
  await page.getByRole("button", { name: "Luna ist krank" }).click();
  const sheet = page.getByRole("dialog", { name: /Luna/ });
  await sheet.getByRole("button", { name: "Husten" }).click();
  await sheet.getByRole("button", { name: "Fieber" }).click();
  await sheet.getByRole("button", { name: /Richtig krank/ }).click();
  await sheet.getByRole("button", { name: "Speichern" }).click();
  await expect(luna).toContainText("Tag 1");

  // Today: one tap.
  await bar.getByRole("button", { name: "Nächster Tag" }).click();
  await expect(luna).toContainText("Gestern: 🤒 Richtig krank");
  await page.getByRole("button", { name: "Luna: Besser" }).click();
  await expect(luna).toContainText("Angeschlagen");
  await expect(luna).toContainText("Tag 2");
  await expect(luna.getByRole("img", { name: "Husten" })).toBeVisible();
  await expect(luna.getByRole("img", { name: "Fieber" })).toBeVisible();
  await expect(luna.getByRole("button", { name: "Luna: Besser" })).toHaveCount(0); // today is logged now
});
