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
