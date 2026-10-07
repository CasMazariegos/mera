import { defineConfig, devices } from "@playwright/test";

const PORT = 4310;
// E2E_BASE_URL=https://… runs the same suite against a live deployment (Render, Cloudflare) instead of a local server.
const remote = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: remote ?? `http://localhost:${PORT}`, ...devices["Pixel 7"], trace: "retain-on-failure" },
  webServer: remote
    ? undefined
    : {
        // The real production server (Render's start command) serving the built app.
        command: `npx tsx --tsconfig tsconfig.app.json server/index.ts`,
        env: { PORT: String(PORT), APP_ENV: "test" },
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
