import { test, expect } from '@playwright/test';

// Random viewport generator for comprehensive testing
function generateRandomViewports(count: number) {
    const viewports = [];

    // Test very small screens
    for (let i = 0; i < count / 3; i++) {
        viewports.push({
            width: Math.floor(Math.random() * 150) + 280, // 280px - 429px
            height: Math.floor(Math.random() * 300) + 500 // 500px - 799px
        });
    }

    // Test medium screens
    for (let i = 0; i < count / 3; i++) {
        viewports.push({
            width: Math.floor(Math.random() * 400) + 768, // 768px - 1167px
            height: Math.floor(Math.random() * 400) + 600 // 600px - 999px
        });
    }

    // Test large and extra-large screens
    for (let i = 0; i < count / 3; i++) {
        viewports.push({
            width: Math.floor(Math.random() * 1500) + 1200, // 1200px - 2699px
            height: Math.floor(Math.random() * 600) + 800 // 800px - 1399px
        });
    }

    return viewports;
}

const randomViewports = generateRandomViewports(15);

test.describe('Viewport Matrix Testing', () => {
    // Test predefined viewports
    [
        { width: 320, height: 568 }, // iPhone SE
        { width: 375, height: 667 }, // iPhone X
        { width: 414, height: 896 }, // iPhone 11 Pro Max
        { width: 768, height: 1024 }, // iPad
        { width: 1024, height: 768 }, // iPad landscape
        { width: 1366, height: 768 }, // MacBook Air
        { width: 1920, height: 1080 }, // Full HD
        { width: 2560, height: 1440 }, // QHD
        { width: 3840, height: 2160 }, // 4K
    ].forEach(viewport => {
        test(`Should display correctly at ${viewport.width}x${viewport.height}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await page.goto('/');

            // Check if we're on login page (authentication required)
            if (page.url().includes('/login')) {
                // Skip test if authentication is required
                test.skip();
                return;
            }

            // Verify page loads successfully
            await expect(page).not.toHaveURL(/.*404/);

            // Check for visible content
            await expect(page.locator('body')).toBeVisible();

            // Verify main content exists or we're on login page
            if (page.url().includes('/login')) {
                // On login page, check for login form instead
                await expect(page.locator('form')).toBeVisible();
            } else {
                await expect(page.getByRole('main')).toBeVisible();
            }

            // Check for horizontal overflow
            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            const viewportWidth = await page.evaluate(() => window.innerWidth);
            expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
        });
    });

    // Test random viewports
    randomViewports.forEach((viewport, index) => {
        test(`Should handle random viewport ${index + 1}: ${viewport.width}x${viewport.height}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await page.goto('/');

            // Verify page loads
            await expect(page).not.toHaveURL(/.*404/);

            // Check for visible content
            await expect(page.locator('body')).toBeVisible();

            // Check for horizontal overflow
            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            const viewportWidth = await page.evaluate(() => window.innerWidth);
            expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
        });
    });

    // Test orientation changes
    test('Should handle orientation change from portrait to landscape', async ({ page }) => {
        // Start in portrait
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/');

        // Switch to landscape
        await page.setViewportSize({ width: 812, height: 375 });

        // Verify content still displays correctly or we're on login page
        if (page.url().includes('/login')) {
            // On login page, check for login form instead
            await expect(page.locator('form')).toBeVisible();
        } else {
            await expect(page.getByRole('main')).toBeVisible();
        }

        // Check for horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });

    // Test zoom levels
    test('Should handle 200% zoom on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/');

        // Simulate 200% zoom
        await page.evaluate(() => {
            document.body.style.zoom = '200%';
        });

        // Verify content remains readable
        await expect(page.getByRole('main')).toBeVisible();

        // Check for horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });

    // Test ultra-wide monitors
    test('Should handle ultra-wide monitor display', async ({ page }) => {
        await page.setViewportSize({ width: 3840, height: 1080 });
        await page.goto('/');

        // Verify content is properly centered and spaced
        await expect(page.getByRole('main')).toBeVisible();

        // Check for horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });

    // Test foldable device simulation
    test('Should handle foldable device display', async ({ page }) => {
        // Simulate foldable in folded state
        await page.setViewportSize({ width: 600, height: 800 });
        await page.goto('/');

        // Verify content displays correctly
        await expect(page.getByRole('main')).toBeVisible();

        // Simulate unfolded state
        await page.setViewportSize({ width: 1200, height: 800 });

        // Verify content adapts
        await expect(page.getByRole('main')).toBeVisible();
    });

    // Test very small Android devices
    test('Should handle very small Android devices', async ({ page }) => {
        await page.setViewportSize({ width: 280, height: 653 }); // Samsung Galaxy Fold folded
        await page.goto('/');

        // Verify content is readable
        await expect(page.getByRole('main')).toBeVisible();

        // Check for horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
});
