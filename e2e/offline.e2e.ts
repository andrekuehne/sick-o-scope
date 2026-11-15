import { expect, test } from "@playwright/test";
import { signedInWithMembers } from "./helpers.ts";

test("offline, saving is disabled and a banner says so; back online, saving works again", async ({ page, context }) => {
  await signedInWithMembers(page, ["Luna", "Max"]);
  const banner = page.getByRole("status").filter({ hasText: "Offline" });
  await expect(page.getByText("0 / 2 eingetragen")).toBeVisible();
  await expect(banner).toHaveCount(0);

  await context.setOffline(true);
  await expect(banner).toBeVisible();
  // The last loaded day stays on screen, but nothing can be saved.
  await expect(page.getByText("0 / 2 eingetragen")).toBeVisible();
  for (const name of ["Alle fit heute", "Luna ist fit", "Luna ist krank"]) {
    await expect(page.getByRole("button", { name })).toBeDisabled();
  }

  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
  await page.getByRole("button", { name: "Luna ist fit" }).click();
  await expect(page.getByRole("listitem", { name: "Luna" })).toContainText("🙂 Fit");
});

test("opens offline from the cache, with the last loaded data", async ({ page, context }) => {
  await signedInWithMembers(page, ["Luna"]);
  await page.getByRole("button", { name: "Luna ist fit" }).click();
  await expect(page.getByText("1 / 1 eingetragen")).toBeVisible();
  // The service worker has the app cached once it controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });

  // The loaded data is kept in this browser for offline use, written at most once a second.
  await page.waitForTimeout(1_100);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Offline" })).toBeVisible();
  await expect(page.getByText("1 / 1 eingetragen")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Luna" })).toContainText("🙂 Fit");

  // Signed out, nothing of the Family's data is left for offline use.
  await context.setOffline(false);
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Einstellungen" }).click();
  await page.getByRole("button", { name: "Dieses Gerät abmelden" }).click();
  await expect(page.getByRole("heading", { name: "Du bist nicht angemeldet" })).toBeVisible();
  await context.setOffline(true);
  await page.goto("/");
  // Signed out, or nothing to load at all: either way, none of the Family's data.
  await expect(page.getByText(/nicht angemeldet|lässt sich gerade nichts laden/)).toBeVisible();
  await expect(page.getByText("Luna")).toHaveCount(0);
});

test("a save that fails on the way shows an error, and nothing looks saved", async ({ page }) => {
  await signedInWithMembers(page, ["Luna"]);
  await page.route("**/api/families/*/check-ins/*/*", (route) => route.abort("internetdisconnected"));

  await page.getByRole("button", { name: "Luna ist fit" }).click();
  await expect(page.getByText("Das hat nicht geklappt")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Luna" })).toContainText("Noch nichts eingetragen");
  await expect(page.getByText("0 / 1 eingetragen")).toBeVisible();
});
