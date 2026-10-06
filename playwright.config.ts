import { defineConfig, devices } from "@playwright/test";

const PORT = 4310;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"], trace: "retain-on-failure" },
  webServer: {
    // The real production server (Render's start command) serving the built app.
    command: `npx tsx --tsconfig tsconfig.app.json server/index.ts`,
    env: { PORT: String(PORT), APP_ENV: "test" },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
