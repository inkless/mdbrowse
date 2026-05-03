import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.MDBROWSE_E2E_PORT ?? 6420);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node ../../dist/cli.js --no-browser --port ${PORT} README.md`,
    cwd: "./e2e/fixtures",
    url: `${BASE_URL}/README.md`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
