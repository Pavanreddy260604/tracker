import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
    },

    projects: [
        // Desktop browsers
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },

        // Mobile browsers
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 7'] },
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 14'] },
        },

        // Tablet browsers
        {
            name: 'Tablet Chrome',
            use: { ...devices['Pixel Tablet'] },
        },
        {
            name: 'Tablet Safari',
            use: { ...devices['iPad Pro 11'] },
        },

        // Custom viewports for extensive testing
        {
            name: 'Small Screen',
            use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 } },
        },
        {
            name: 'Medium Screen',
            use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
        },
        {
            name: 'Large Screen',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
        },
        {
            name: 'Ultra Wide',
            use: { ...devices['Desktop Chrome'], viewport: { width: 3840, height: 1080 } },
        },
    ],

    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
    },
});
