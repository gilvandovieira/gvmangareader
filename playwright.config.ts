import { defineConfig } from '@playwright/test';

const port = 5174;

export default defineConfig({
  testDir: 'tests',
  reporter: 'list',
  webServer: { command: `vite --port ${port} --strictPort`, port },
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    // Pure functions, run in Node without a browser.
    { name: 'unit', testMatch: /spreads\.spec\.ts/ },
    // Chromium without JPEG XL support: pages go through the WASM decoder.
    { name: 'wasm-jxl', testIgnore: /spreads\.spec\.ts/, use: { browserName: 'chromium' } },
    // Chromium with its JPEG XL decoder enabled: pages are shown as they are.
    {
      name: 'native-jxl',
      testIgnore: /spreads\.spec\.ts/,
      use: { browserName: 'chromium', launchOptions: { args: ['--enable-features=JXLImageFormat'] } },
    },
  ],
});
