import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { loadConfig } from "./lib/config";
import { isInstalled, listenForInstall } from "./lib/install";
import { migrateStorage } from "./lib/storage";
import { watchSystemTheme } from "./lib/theme";
import { watchForUpdates } from "./lib/updates";
import { queryClient, router } from "./router";
import "./index.css";

loadConfig();
migrateStorage();
watchSystemTheme();
listenForInstall();
watchForUpdates();

// iOS ignores touch-action for pinch zoom in some versions; block its gesture
// events too, but only in the installed app.
if (isInstalled()) {
  for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
