# Severity icon scratch

Image-model experiments for replacing the placeholder Severity emoji. These are
design references, separate from the app's shipped assets.

- [Friendly version](severity-friendly.png): soft expressions and a rounded blob character.
- [Dark version](severity-dark.png): exaggerated exhaustion, a Sofa-Kobold, and a
  little departing ghost for Totalausfall.

Both originals are transparent RGBA PNG sheets, 1536 × 1024 pixels, arranged in a
3-column × 2-row grid. Each square cell is 512 × 512 pixels. Read left to right:

| Position | Severity | App label |
| --- | --- | --- |
| Top left | 0 | Fast gesund |
| Top middle | 1 | Naja |
| Top right | 2 | Angeschlagen |
| Bottom left | 3 | Richtig krank |
| Bottom middle | 4 | Sofa-Kobold |
| Bottom right | 5 | Totalausfall |

The palette follows the app's lime-to-plum Severity colors. Severity 0 is still
Sick; the separate Healthy status is not included in these sheets.

Before using a version in the app, extract the six square assets, check consistent
padding and legibility at 24–32 CSS pixels on both themes, and export the chosen
assets under `public/icons/severity/`.
