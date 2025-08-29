// Playwright configuration
module.exports = {
  testDir: './tests',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  use: {
    baseURL: 'http://localhost:5173',
    headless: process.env.CI ? true : false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...require('playwright').devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...require('playwright').devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...require('playwright').devices['Desktop Safari'] },
    },
  ],

  webServer: [
    {
      command: 'cd ../backend && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd ../frontend && npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
};