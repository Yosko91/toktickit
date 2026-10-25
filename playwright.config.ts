import { defineConfig, devices } from "@playwright/test";

// Lab 4: the client URL can be changed with E2E_CLIENT_URL when port 5173 is
// already taken by another application on the machine. The API is told to
// accept that origin (CORS, see server/src/app.ts).
const CLIENT_URL = process.env.E2E_CLIENT_URL ?? "http://localhost:5173";
const CLIENT_PORT = new URL(CLIENT_URL).port;

// Lab 2 E2E + visual/responsive suite (docs/lab-02/tests.md sections E2E-*/VIS-*).
// Starts both dev servers automatically; reuses them if already running.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: CLIENT_URL,
    // Lab 4: fixed language and time zone, so dates in the screenshots are the
    // same on every machine (English, Bangkok time like the lab machines).
    locale: "en-US",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev",
      cwd: "server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
      timeout: 30_000,
      env: { CLIENT_ORIGIN: CLIENT_URL },
    },
    {
      command: `npx vite --port ${CLIENT_PORT} --strictPort`,
      cwd: "client",
      url: CLIENT_URL,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
