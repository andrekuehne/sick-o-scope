import { expect, test } from "@playwright/test";
import { addDays, daysBetweenInclusive, localToday } from "../src/shared/dates.ts";
import { seasonOf } from "../src/shared/history.ts";
import { logDay, signedInWithMembers } from "./helpers.ts";

test("opens a Member's Person screen from Heute, Verlauf and Saison, and Back returns there", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);
  // Luna's Bug on the last day of last Season, with a cough.
  const today = localToday();
  const lastSeasonEnd = addDays(seasonOf(today).start, -1);
  const lastSeason = seasonOf(lastSeasonEnd);
  await logDay(page, "Luna", daysBetweenInclusive(lastSeasonEnd, today) - 1, {
    status: "sick",
    severity: 3,
    symptoms: ["cough"],
  });
  await page.getByRole("button", { name: "Luna ist fit" }).click();
  await expect(page.getByText("1 / 2 eingetragen")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  const seasons = page.getByRole("navigation", { name: "Saison" });

  // From Heute: the current Season, compared with the last one.
  await page.getByRole("link", { name: "Saison von Luna" }).click();
  await expect(page.getByRole("heading", { name: "Luna", level: 1 })).toBeVisible();
  await expect(seasons).toContainText(`Saison ${seasonOf(today).label}`);
  await expect(page.getByRole("heading", { name: `Im Vergleich zur Saison ${lastSeason.label}` })).toBeVisible();
  await expect(page.getByText("vorher 1 Tag · 1 weniger 🎉")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Hallo André 👋" })).toBeVisible();

  // From Verlauf, on last Season: Max hasn't logged anything, and Back keeps the Season.
  await nav.getByRole("link", { name: "Verlauf" }).click();
  await seasons.getByRole("button", { name: "Vorherige Saison" }).click();
  await page.getByRole("link", { name: "Saison von Max" }).click();
  await expect(page.getByRole("heading", { name: "Max", level: 1 })).toBeVisible();
  await expect(seasons).toContainText(`Saison ${lastSeason.label}`);
  await expect(page.getByText("In dieser Saison gibt es von Max keine Einträge.")).toBeVisible();
  await page.getByRole("button", { name: /Zurück/ }).click();
  await expect(page.getByRole("heading", { name: "Verlauf", level: 1 })).toBeVisible();
  await expect(seasons).toContainText(`Saison ${lastSeason.label}`);

  // From Saison, on last Season: the Person screen opens on it, and Back keeps it picked.
  await nav.getByRole("link", { name: /Saison/ }).click();
  await seasons.getByRole("button", { name: "Vorherige Saison" }).click();
  await expect(seasons).toContainText(`Saison ${lastSeason.label}`);
  await page.getByRole("listitem", { name: "Luna" }).getByRole("link", { name: "Luna" }).click();
  await expect(page.getByRole("heading", { name: "Luna", level: 1 })).toBeVisible();
  await expect(seasons).toContainText(`Saison ${lastSeason.label}`);
  await expect(page.getByRole("list", { name: "Infekte" })).toContainText("Infekt #1");
  await expect(page.getByText("Husten")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Saison", level: 1 })).toBeVisible();
  await expect(seasons).toContainText(`Saison ${lastSeason.label}`);
});

test("shows the Medications taken on the Heute card and on the Person screen", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);
  await logDay(page, "Luna", 0, { status: "sick", severity: 2, symptoms: ["cough"], medications: ["nasal-spray", "ibuprofen"] });
  await logDay(page, "Max", 0, { status: "sick", severity: 1, symptoms: ["runny-nose"] });
  await page.reload();

  // Heute: the Medication Badges come after the Symptom Badges, in catalog order.
  const luna = page.getByRole("listitem", { name: "Luna" });
  await expect(luna.getByRole("img", { name: "Ibuprofen" })).toBeVisible();
  const badges = await luna.getByRole("img").evaluateAll((images) => images.map((image) => image.getAttribute("aria-label")));
  expect(badges).toEqual(["Husten", "Ibuprofen", "Nasenspray"]);

  // Luna's Person screen lists them with their days…
  await page.getByRole("link", { name: "Saison von Luna" }).click();
  const medications = page.getByRole("list", { name: "Medikamente" });
  await expect(medications.getByRole("listitem")).toHaveText([/Ibuprofen\s*1 Tag/, /Nasenspray\s*1 Tag/]);

  // …and Max's leaves them out, as Max took none.
  await page.goBack();
  await page.getByRole("link", { name: "Saison von Max" }).click();
  await expect(page.getByRole("heading", { name: "Max", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Medikamente" })).toHaveCount(0);
});
