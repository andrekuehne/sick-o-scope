import { expect, type Locator, test } from "@playwright/test";
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
  await sheet.getByRole("button", { name: "Husten", exact: true }).click();
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

test("shows the Medications taken in a second row of Badges when zoomed in to single days", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);
  await logDay(page, "Luna", 0, { status: "sick", severity: 3, symptoms: ["cough"], medications: ["nasal-spray", "ibuprofen"] });
  await logDay(page, "Max", 0, { status: "sick", severity: 2, medications: ["antibiotics"] });
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Verlauf" }).click();
  await page.getByRole("button", { name: "Tag", exact: true }).click();

  // The label names them after the Symptoms; their Badges follow the Symptoms', in catalog order.
  const luna = page.getByRole("group", { name: "Luna" }).getByRole("button", { name: /^Luna, Heute, / });
  await expect(luna).toHaveAccessibleName(/: Richtig krank \(Husten\), mit Ibuprofen und Nasenspray$/);
  await expect(luna).toHaveText("😮‍💨💊💦");

  // More than fit: the last place says how many more.
  await logDay(page, "Luna", 0, { status: "sick", severity: 3, symptoms: ["cough"], medications: ["paracetamol", "ibuprofen", "nasal-spray", "antibiotics"] });
  await page.reload();
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  await expect(luna).toHaveText("😮‍💨🌡️💊+2");

  // Medications without Symptoms still show.
  const max = page.getByRole("group", { name: "Max" }).getByRole("button", { name: /^Max, Heute, / });
  await expect(max).toHaveAccessibleName(/: Angeschlagen, mit Antibiotika$/);
  await expect(max).toHaveText("🧫");

  // Zoomed out, days are colour only.
  await page.getByRole("button", { name: "Woche" }).click();
  await expect(page.getByRole("group", { name: "Luna" }).getByRole("button", { name: /: Richtig krank$/ })).toHaveText("");
});

test("lets the lanes fill the free height for a small Family, and stay level with the avatars", async ({ page }) => {
  const names = ["Luna", "Max", "Oma"];
  await signedInWithMembers(page, names);
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await nav.getByRole("link", { name: "Verlauf" }).click();
  const lanes = names.map((name) => page.getByRole("group", { name }));
  await expect(lanes[0]!).toBeVisible();

  // On a phone-sized screen (740px tall), three lanes are taller than the compact 44px but
  // not yet at the 120px maximum, all the same height…
  const heights = await Promise.all(lanes.map(async (lane) => (await box(lane)).height));
  const height = heights[0]!;
  expect(height).toBeGreaterThan(60);
  expect(height).toBeLessThan(120);
  for (const other of heights) expect(other).toBeCloseTo(height, 0);
  // …and fill the screen: the legend ends just above the navigation.
  const legend = await box(page.getByRole("list", { name: "Legende" }));
  expect((await box(nav)).y - (legend.y + legend.height)).toBeLessThan(40);

  // Each avatar stays level with its lane.
  for (const [i, name] of names.entries()) {
    const lane = await box(lanes[i]!);
    const avatar = await box(page.getByRole("link", { name: `Saison von ${name}` }));
    expect(avatar.y + avatar.height / 2).toBeCloseTo(lane.y + lane.height / 2, 0);
  }

  // A shorter window gets shorter lanes, never below the compact height.
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 500 });
  await expect.poll(async () => (await box(lanes[0]!)).height).toBeLessThan(height);
  expect((await box(lanes[0]!)).height).toBeGreaterThanOrEqual(44);

  // Zoomed in to single days, lanes are at least 56px for the Badges.
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  await expect.poll(async () => (await box(lanes[0]!)).height).toBeGreaterThanOrEqual(56);
});

test("keeps today's compact lanes for a big Family", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max", "Oma", "Opa", "Ben", "Mia", "Tom", "Lia", "Ida", "Jan", "Eva", "Kai"]);
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Verlauf" }).click();
  const luna = page.getByRole("group", { name: "Luna" });
  await expect(luna).toBeVisible();
  expect((await box(luna)).height).toBeCloseTo(44, 0);
});

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error("not on screen");
  return found;
}
