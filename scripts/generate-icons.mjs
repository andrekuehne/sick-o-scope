// Renders the placeholder app icons (an emoji on the accent colour) into public/icons.
// Run with `npm run icons` after changing the emoji or colours; the PNGs are committed.
// Real artwork will replace these later.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const EMOJI = "🤒";
const BACKGROUND = "#ff7a59";
const OUT = path.join(import.meta.dirname, "..", "public", "icons");

/** `scale` is the emoji's size relative to the icon; maskable icons need a safe-zone margin. */
const ICONS = [
  { file: "icon-192.png", size: 192, scale: 0.66, rounded: true },
  { file: "icon-512.png", size: 512, scale: 0.66, rounded: true },
  { file: "icon-maskable-512.png", size: 512, scale: 0.5, rounded: false },
  { file: "apple-touch-icon.png", size: 180, scale: 0.62, rounded: false },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    const radius = icon.rounded ? icon.size * 0.22 : 0;
    await page.setContent(`
      <html><body style="margin:0;background:transparent">
        <div style="width:${icon.size}px;height:${icon.size}px;border-radius:${radius}px;
                    background:${BACKGROUND};display:flex;align-items:center;justify-content:center;
                    font-size:${icon.size * icon.scale}px;line-height:1">${EMOJI}</div>
      </body></html>`);
    await page.screenshot({ path: path.join(OUT, icon.file), omitBackground: true });
    await page.close();
    console.log(`wrote public/icons/${icon.file}`);
  }
} finally {
  await browser.close();
}
