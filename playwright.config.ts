// End-to-end tests: `npm run test:e2e` (builds the sample library first).
// Runs against the production build, served like the Docker image does.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "npm run build && node tests/e2e/serve.mjs",
    url: "http://localhost:4173/version.json",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
