import { onlineManager, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App.tsx";
import { KEEP_OFFLINE_MS, offlineDataOptions } from "./offline-data.ts";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

// TanStack Query assumes it's online until told otherwise; an app opened offline starts offline.
onlineManager.setOnline(navigator.onLine);

const queryClient = new QueryClient({
  defaultOptions: {
    // Data is refetched when the app opens, comes back into focus or back online (the defaults).
    queries: { retry: 1, gcTime: KEEP_OFFLINE_MS },
    // A write fails right away when it can't reach the server, rather than waiting to be sent
    // later: nothing may look saved, or get saved behind the User's back, when it wasn't.
    mutations: { networkMode: "always" },
  },
});

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={offlineDataOptions}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);

// The service worker only exists in production builds, so dev never serves stale files.
if (import.meta.env.PROD) registerSW({ immediate: true });
