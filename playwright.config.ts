import { defineConfig } from '@playwright/test';

const port = 5174;

export default defineConfig({
  testDir: 'tests',
  reporter: 'list',
  webServer: { command: `vite --port ${port} --strictPort`, port },
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    // Chromium without JPEG XL support: pages go through the WASM decoder.
    { name: 'wasm-jxl', use: { browserName: 'chromium' } },
    // Chromium with its JPEG XL decoder enabled: pages are shown as they are.
    {
      name: 'native-jxl',
      use: { browserName: 'chromium', launchOptions: { args: ['--enable-features=JXLImageFormat'] } },
    },
  ],
});
