import { expect, test } from "@playwright/test";
import { logDay, signedInWithMembers } from "./helpers.ts";

/** 13 days back: 6 fit (the best so far), 1 Sick, then 6 fit up to yesterday; today is still to log. */
async function sixFitDaysAfterAnEarlierStreak(page: import("@playwright/test").Page) {
  for (let daysAgo = 13; daysAgo >= 8; daysAgo--) await logDay(page, "Luna", daysAgo, { status: "healthy" });
  await logDay(page, "Luna", 7, { status: "sick", severity: 1 });
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) await logDay(page, "Luna", daysAgo, { status: "healthy" });
  await page.reload();
}

test("celebrates 7 days everyone Healthy and a new best once per Device, and shows Lückenlos", async ({ page }) => {
  await signedInWithMembers(page, ["Luna"]);
  await sixFitDaysAfterAnEarlierStreak(page);
  await expect(page.getByText("📋 Lückenlos seit 13 Tagen")).toBeVisible();
  // 6 days: no milestone yet, and only as long as the best, not longer.
  await expect(page.getByText(/Tage alle fit!/)).toHaveCount(0);
  await expect(page.getByText(/Neuer Rekord/)).toHaveCount(0);

  await page.getByRole("button", { name: "Luna ist fit" }).click();
  await expect(page.getByText("🎉 7 Tage alle fit! Weiter so!")).toBeVisible();
  await expect(page.getByText(/Neuer Rekord/)).toBeVisible();
  await expect(page.getByText("📋 Lückenlos seit 14 Tagen")).toBeVisible();

  // Once per Device: opening Heute again doesn't repeat it.
  await page.reload();
  await expect(page.getByText("📋 Lückenlos seit 14 Tagen")).toBeVisible();
  await expect(page.getByText("🎉 7 Tage alle fit! Weiter so!")).toHaveCount(0);
  await expect(page.getByText(/Neuer Rekord/)).toHaveCount(0);
});

test("still celebrates on a Device that can't store anything", async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.getItem = blocked;
    Storage.prototype.setItem = blocked;
  });
  await signedInWithMembers(page, ["Luna"]);
  await sixFitDaysAfterAnEarlierStreak(page);

  await page.getByRole("button", { name: "Luna ist fit" }).click();
  await expect(page.getByText("🎉 7 Tage alle fit! Weiter so!")).toBeVisible();
});
