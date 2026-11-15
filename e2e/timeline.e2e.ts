import { expect, test } from "@playwright/test";
import { addDays, localToday } from "../src/shared/dates.ts";
import { seasonOf } from "../src/shared/history.ts";
import { logDay, signedInWithMembers } from "./helpers.ts";

test("edits a past day from the timeline, and the timeline shows the change", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);
  await logDay(page, "Luna", 3, { status: "healthy" });
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Verlauf" }).click();

  const seasons = page.getByRole("navigation", { name: "Saison" });
  await expect(seasons).toContainText(`Saison ${seasonOf(localToday()).label}`);
  // On 1–3 Sep, three days ago was last Season.
  const loggedSeason = seasonOf(addDays(localToday(), -3));
  if (loggedSeason.start !== seasonOf(localToday()).start) await seasons.getByRole("button", { name: "Vorherige Saison" }).click();
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  const luna = page.getByRole("group", { name: "Luna" });
  // Logged days and Gaps are told apart, never both "Fit".
  await expect(luna.getByRole("button", { name: /: Fit$/ })).toHaveCount(1);
  await expect(luna.getByRole("button", { name: /: Nicht eingetragen$/ }).first()).toBeVisible();

  await luna.getByRole("button", { name: /: Fit$/ }).click();
  const sheet = page.getByRole("dialog", { name: /Luna/ });
  await sheet.getByRole("button", { name: "Krank", exact: true }).click();
  await sheet.getByRole("button", { name: /Richtig krank/ }).click();
  await sheet.getByRole("button", { name: "Husten" }).click();
  await sheet.getByRole("button", { name: "Speichern" }).click();

  await expect(sheet).toBeHidden();
  await expect(luna.getByRole("button", { name: /: Richtig krank \(Husten\)$/ })).toBeVisible();
  await expect(luna.getByRole("button", { name: /: Fit$/ })).toHaveCount(0);

  // Zoomed out, the day is part of a coloured block, still not a Gap.
  await page.getByRole("button", { name: "Woche" }).click();
  await expect(luna.getByRole("button", { name: /: Richtig krank$/ })).toHaveCount(1);

  // Zoomed all the way out, a tap zooms in on that day rather than guessing under a fingertip.
  await page.getByRole("button", { name: "Monat" }).click();
  await luna.getByRole("button", { name: /: Richtig krank$/ }).click();
  await expect(page.getByRole("button", { name: "Tag", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(luna.getByRole("button", { name: /: Richtig krank \(Husten\)$/ })).toBeVisible();
  await expect(sheet).toBeHidden();
});
