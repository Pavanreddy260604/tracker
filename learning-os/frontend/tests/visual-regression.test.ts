import { test, expect } from '@playwright/test';

test.describe('Visual Regression Testing', () => {
    // Test dashboard page for visual consistency
    test('Dashboard should maintain visual consistency across viewports', async ({ page }) => {
        const viewports = [
            { width: 320, height: 568 }, // Mobile portrait
            { width: 768, height: 1024 }, // Tablet portrait
            { width: 1024, height: 768 }, // Tablet landscape
            { width: 1920, height: 1080 }, // Desktop
        ];

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            await page.goto('/');

            // Wait for page to load completely
            await page.waitForLoadState('networkidle');

            // Take screenshot of the entire page
            await expect(page).toHaveScreenshot(`dashboard-${viewport.width}x${viewport.height}.png`, {
                fullPage: true,
                maxDiffPixels: 100, // Allow for minor differences
            });
        }
    });

    // Test navigation component visual consistency
    test('Navigation should maintain visual consistency across viewports', async ({ page }) => {
        const viewports = [
            { width: 320, height: 568 }, // Mobile portrait
            { width: 768, height: 1024 }, // Tablet portrait
            { width: 1024, height: 768 }, // Tablet landscape
            { width: 1920, height: 1080 }, // Desktop
        ];

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            await page.goto('/');

            // Wait for navigation to be visible
            const navLocator = page.getByRole('navigation');
            await expect(navLocator).toBeVisible();

            // Take screenshot of the navigation component
            await expect(navLocator).toHaveScreenshot(`navigation-${viewport.width}x${viewport.height}.png`, {
                maxDiffPixels: 20,
            });
        }
    });

    // Test card components visual consistency
    test('Cards should maintain visual consistency across viewports', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/');

        // Find all card elements
        const cards = page.locator('[class*="card"]');

        // Verify cards exist and are visible
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);

        // Take screenshot of cards
        for (let i = 0; i < Math.min(count, 3); i++) {
            await expect(cards.nth(i)).toHaveScreenshot(`card-${i}-desktop.png`, {
                maxDiffPixels: 10,
            });
        }
    });

    // Test responsive table behavior
    test('Table should adapt to mobile viewport', async ({ page }) => {
        // Desktop view - should show table layout
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.goto('/dsa');

        // Look for tables (data grid views)
        const tables = page.locator('table');
        const tableCount = await tables.count();

        if (tableCount > 0) {
            await expect(tables.nth(0)).toBeVisible();

            // Mobile view - should show card layout or horizontal scroll
            await page.setViewportSize({ width: 375, height: 667 });

            // Check if table is still visible or if cards appear
            const cardsInMobile = page.locator('[class*="card"]');
            const cardCount = await cardsInMobile.count();
            expect(cardCount).toBeGreaterThan(0);
        }
    });

    // Test modal responsive behavior
    test('Modal should be responsive on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/');

        // Find and click a button that opens a modal
        const modalTriggers = page.getByRole('button', { name: /Add/i });

        if (await modalTriggers.count() > 0) {
            await modalTriggers.nth(0).click();

            const modal = page.locator('[role="dialog"]');
            await expect(modal).toBeVisible();

            // Verify modal has maximum width constraints
            const modalWidth = await modal.evaluate(el => el.clientWidth);
            expect(modalWidth).toBeLessThanOrEqual(800);

            // Check on mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            const mobileModalWidth = await modal.evaluate(el => el.clientWidth);
            const viewportWidth = await page.evaluate(() => window.innerWidth);

            // Modal should take full width on mobile
            expect(mobileModalWidth).toEqual(viewportWidth);
        }
    });

    // Test form responsive behavior
    test('Form should adapt to viewport widths', async ({ page }) => {
        await page.goto('/settings');

        const forms = page.getByRole('form');
        const formCount = await forms.count();

        if (formCount > 0) {
            const form = forms.nth(0);

            // Desktop view - should have multi-column layout
            await page.setViewportSize({ width: 1024, height: 768 });
            const formWidth = await form.evaluate(el => el.clientWidth);
            expect(formWidth).toBeGreaterThan(500);

            // Mobile view - should have single column layout
            await page.setViewportSize({ width: 375, height: 667 });
            const mobileFormWidth = await form.evaluate(el => el.clientWidth);
            const viewportWidth = await page.evaluate(() => window.innerWidth);
            expect(mobileFormWidth).toEqual(viewportWidth - 32); // Account for padding
        }
    });

    // Test media responsiveness
    test('Media content should maintain aspect ratio', async ({ page }) => {
        await page.goto('/dashboard');

        const images = page.locator('img');
        const imageCount = await images.count();

        if (imageCount > 0) {
            const originalAspectRatios = [];

            // Check on different viewports
            const viewports = [
                { width: 375, height: 667 },
                { width: 768, height: 1024 },
                { width: 1024, height: 768 },
                { width: 1920, height: 1080 },
            ];

            for (let i = 0; i < Math.min(imageCount, 3); i++) {
                for (const viewport of viewports) {
                    await page.setViewportSize(viewport);
                    const image = images.nth(i);

                    const rect = await image.boundingBox();
                    if (rect) {
                        const aspectRatio = rect.width / rect.height;
                        originalAspectRatios.push(aspectRatio);

                        // Check aspect ratio consistency across viewports
                        if (originalAspectRatios.length > 1) {
                            const ratioDiff = Math.abs(aspectRatio - originalAspectRatios[0]);
                            expect(ratioDiff).toBeLessThan(0.1); // Allow small variations
                        }
                    }
                }
            }
        }
    });
});
