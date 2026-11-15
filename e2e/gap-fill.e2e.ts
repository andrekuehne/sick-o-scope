import { expect, type Page, test } from "@playwright/test";
import { signedInWithMembers } from "./helpers.ts";

/** Saves a Check-in `daysAgo` days before the phone's today, as another Device would. */
async function logDay(page: Page, memberName: string, daysAgo: number, state: object) {
  await page.evaluate(
    async ({ memberName, daysAgo, state }) => {
      const me = (await (await fetch("/api/me")).json()) as {
        family: { id: string };
        members: { id: string; name: string }[];
      };
      const member = me.members.find((m) => m.name === memberName);
      const day = new Date();
      day.setDate(day.getDate() - daysAgo);
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/families/${me.family.id}/check-ins/${date}/${member?.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error(`logging ${memberName} failed: ${res.status}`);
    },
    { memberName, daysAgo, state },
  );
}

test("fills missed days with Alle fit, never over a day someone logged in the meantime", async ({ page }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);
  for (const name of ["Luna", "Max"]) await logDay(page, name, 4, { status: "healthy" });
  await page.reload();

  const card = page.getByRole("region", { name: /^Luna und Max: 3 Tage fehlen/ });
  await expect(card).toBeVisible();

  // Meanwhile, someone else logs Max as Sick yesterday; the card doesn't know yet.
  await logDay(page, "Max", 1, { status: "sick", severity: 4 });
  await card.getByRole("button", { name: "Alle fit" }).click();

  await expect(page.getByRole("status")).toHaveText("✅ 5 Einträge gespeichert. 1 Eintrag gab es schon, der blieb unverändert.");
  await expect(card).toHaveCount(0);
  const previousDay = page.getByRole("navigation", { name: "Datum" }).getByRole("button", { name: "Vorheriger Tag" });
  await previousDay.click();
  await expect(page.getByRole("listitem", { name: "Luna" })).toContainText("🙂 Fit");
  await expect(page.getByRole("listitem", { name: "Max" })).toContainText("Sofa-Kobold");
  for (const daysAgo of [2, 3]) {
    await previousDay.click();
    await expect(page.locator(".day-card[data-status=healthy]"), `${daysAgo} days ago`).toHaveCount(2);
  }
});

test("walks through missed days one by one, and a dismissed card writes nothing", async ({ page }) => {
  await signedInWithMembers(page, ["Luna"]);
  await logDay(page, "Luna", 3, { status: "sick", severity: 2 });
  await page.reload();

  await page.getByRole("region", { name: /^Luna: 2 Tage fehlen/ }).getByRole("button", { name: "Einzeln eintragen" }).click();
  const sheet = page.getByRole("dialog", { name: /Luna/ });
  await expect(sheet).toHaveAccessibleName(/1 von 2$/);
  await sheet.getByRole("button", { name: "Speichern" }).click(); // starts as Fit
  await expect(sheet).toHaveAccessibleName(/2 von 2$/);
  await sheet.getByRole("button", { name: "Überspringen" }).click();
  await expect(sheet).toBeHidden();

  // The skipped day stays a Gap, and the card says so, until it's dismissed.
  const card = page.getByRole("region", { name: /^Luna: 1 Tag fehlt/ });
  await card.getByRole("button", { name: "Ausblenden" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hallo André 👋" })).toBeVisible();
  await expect(page.getByText("0 / 1 eingetragen")).toBeVisible();
  await expect(page.getByRole("region", { name: /fehlt/ })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Datum" }).getByRole("button", { name: "Vorheriger Tag" }).click();
  await expect(page.getByRole("listitem", { name: "Luna" })).toContainText("Noch nichts eingetragen");
});
