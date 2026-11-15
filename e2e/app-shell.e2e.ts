import { expect, test } from "@playwright/test";

test("opens on Heute and navigates between the main screens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Sick-o-Scope").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Heute" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await nav.getByRole("link", { name: "Verlauf" }).click();
  await expect(page).toHaveURL(/\/verlauf$/);
  await expect(page.getByRole("heading", { name: "Verlauf" })).toBeVisible();
});

test("deep links load the app, and API paths never return it", async ({ page, request }) => {
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();

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
