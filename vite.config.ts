import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { t } from "./src/client/strings.ts";

export default defineConfig({
  plugins: [
    react(),
    // Runs the Worker (src/worker) in the real Workers runtime during dev and preview,
    // and builds it next to the client bundle (ADR 0001).
    // SOS_STATE_DIR moves the local database elsewhere (the end-to-end tests use their own).
    cloudflare({ persistState: process.env.SOS_STATE_DIR ? { path: process.env.SOS_STATE_DIR } : true }),
    VitePWA({
      // A new version takes over as soon as it is installed, and open pages reload, without asking.
      registerType: "autoUpdate",
      // Registered by hand in src/client/main.tsx, only in production builds.
      injectRegister: false,
      includeAssets: ["icons/*.png"],
      manifest: {
        name: t.appName,
        short_name: t.appName,
        description: t.appDescription,
        lang: "de",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fff8f0",
        theme_color: "#ff7a59",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Caches the app shell and static assets; data always comes from the API.
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        // API responses must never be answered with the cached app page.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
