import { expect, test } from "@playwright/test";
import { newFamilySignInLink } from "./helpers.ts";

test("navigates between the main screens, also by deep link", async ({ page }) => {
  await page.goto(await newFamilySignInLink("Familie Kühne", "André"));
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Hallo André 👋" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await nav.getByRole("link", { name: "Verlauf" }).click();
  await expect(page).toHaveURL(/\/verlauf$/);
  await expect(page.getByRole("heading", { name: "Verlauf" })).toBeVisible();

  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
});

// Regression: on the phone (Pixel 8 Pro), switching screens took ~450 ms to show: it waited
// for the finger to lift, and each new history entry made Chrome do ~400 ms of extra work
// before the next frame. Like a native tab bar, it now switches on touch, without history.
test("switches screens as soon as the bottom bar is touched, without adding history entries", async ({ page }) => {
  await page.goto(await newFamilySignInLink("Familie Kühne", "André"));
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Hallo André 👋" })).toBeVisible();
  const entries = await page.evaluate(() => history.length);
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });

  await nav.getByRole("link", { name: "Verlauf" }).hover();
  await page.mouse.down();
  await expect(page.getByRole("heading", { name: "Verlauf" })).toBeVisible();
  await page.mouse.up();
  await expect(page).toHaveURL(/\/verlauf$/);
  await nav.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
  await nav.getByRole("link", { name: "Einstellungen" }).click();

  // Like an app: tabs aren't steps back.
  expect(await page.evaluate(() => history.length)).toBe(entries);
});

test("without signing in, the app asks for a Sign-in link", async ({ page }) => {
  await page.goto("/verlauf");
  await expect(page.getByRole("heading", { name: "Du bist nicht angemeldet" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toHaveCount(0);
});

test("API paths never return the app", async ({ request }) => {
  const api = await request.get("/api/does-not-exist");
  expect(api.status()).toBe(404);
  expect(api.headers()["content-type"]).toContain("application/json");
});

// Regression: after a deploy, an installed app kept showing the old version, even after
// reloading, because the new service worker waited for every tab to close.
test("a new version takes over on its own, without waiting for the app to be closed", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);

  const tookOver = await page.evaluate(async () => {
    const controllerChanged = new Promise<boolean>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 5000);
    });
    // A deploy, as the browser sees it: a changed service worker script. (A new script URL
    // counts as a change; Playwright can't intercept the browser's own sw.js fetch.)
    await navigator.serviceWorker.register("/sw.js?next-version");
    return controllerChanged;
  });
  expect(tookOver).toBe(true);
});

test("is installable: manifest with icons, and an active service worker", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Sick-o-Scope", display: "standalone", start_url: "/" });
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  await page.goto("/");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
});
