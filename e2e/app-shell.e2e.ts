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

test("is installable: manifest with icons, and an active service worker", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Sick-o-Scope", display: "standalone", start_url: "/" });
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  await page.goto("/");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
});
