import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const databasePath = path.resolve('data/playwright.sqlite');
const apiOrigin = 'http://127.0.0.1:8090';
const uiOrigin = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: uiOrigin,
    testIdAttribute: 'data-test',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'yarn workspace server start',
      url: `${apiOrigin}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        APP_ENV: 'test',
        PORT: '8090',
        HOST: '127.0.0.1',
        DB_DIALECT: 'sqlite',
        DB_NAME: databasePath,
        NODE_ENV: 'development'
      }
    },
    {
      command: 'yarn workspace web dev:playwright',
      url: uiOrigin,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
