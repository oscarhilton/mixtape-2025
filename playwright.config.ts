import { defineConfig, devices } from "@playwright/test";

// Base URL for your frontend application
const baseURL = "http://localhost:3000"; // Assuming apps/web runs on 3000

export default defineConfig({
  testDir: "./e2e-tests", // Directory for E2E tests, can be created at root
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // Fail build on CI if accidentally left test.only
  retries: process.env.CI ? 2 : 0, // Retry on CI only
  workers: process.env.CI ? 1 : undefined, // Opt out of parallel tests on CI by default
  reporter: "html", // Generates a nice HTML report
  use: {
    baseURL: baseURL,
    trace: "on-first-retry", // Collect trace when retrying the failed test
    // headless: false, // Uncomment to run tests with browser UI for debugging
    // launchOptions: {
    //   slowMo: 250, // Slows down Playwright operations (in ms) if needed for debugging
    // },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Uncomment if you want to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  // Command to start your development servers before tests run
  // This is crucial for E2E tests.
  webServer: [
    {
      command: "yarn workspace api dev", // Command to start your backend API
      url: "http://localhost:3001/auth/me", // URL to poll to ensure backend is up (use an endpoint that indicates readiness)
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI, // Reuse server if already running locally
      env: {
        NODE_ENV: "development", // Or 'test' if your API behaves differently
        // Ensure API .env variables are accessible or set here if needed
      },
      // cwd: './packages/api', // Specify working directory if needed, yarn workspace should handle it
    },
    {
      command: "yarn workspace web dev", // Command to start your Next.js frontend
      url: baseURL, // URL to poll to ensure frontend is up
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      env: {
        // NEXT_PUBLIC_API_URL: 'http://localhost:3001', // Ensure frontend knows API URL
      },
      // cwd: './apps/web', // Specify working directory if needed
    },
  ],
});
