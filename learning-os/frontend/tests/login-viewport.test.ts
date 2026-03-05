import { test, expect } from '@playwright/test';

test.describe('Login Page Viewport Testing', () => {
    // Test login page on various viewports
    [
        { width: 320, height: 568 }, // iPhone SE
        { width: 375, height: 667 }, // iPhone X
        { width: 414, height: 896 }, // iPhone 11 Pro Max
        { width: 768, height: 1024 }, // iPad
        { width: 1024, height: 768 }, // iPad landscape
        { width: 1366, height: 768 }, // MacBook Air
        { width: 1920, height: 1080 }, // Full HD
    ].forEach(viewport => {
        test(`Login page should display correctly at ${viewport.width}x${viewport.height}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await page.goto('/login');

            // Verify login page loads successfully
            await expect(page).not.toHaveURL(/.*404/);

            // Check for visible content
            await expect(page.locator('body')).toBeVisible();

            // Verify login form exists
            const loginForm = page.locator('form');
            await expect(loginForm).toBeVisible();

            // Check for essential form elements
            await expect(page.getByLabel(/Email|Username/i)).toBeVisible();
            await expect(page.getByLabel(/Password/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /Login|Sign In/i })).toBeVisible();

            // Check for horizontal overflow
            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            const viewportWidth = await page.evaluate(() => window.innerWidth);
            expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);

            // Check for vertical overflow (page should be scrollable if content exceeds viewport)
            const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
            const viewportHeight = await page.evaluate(() => window.innerHeight);
            expect(bodyHeight).toBeGreaterThanOrEqual(viewportHeight);
        });
    });

    // Test input field responsiveness
    test('Input fields should resize properly', async ({ page }) => {
        await page.goto('/login');

        const emailInput = page.getByLabel(/Email|Username/i);
        const passwordInput = page.getByLabel(/Password/i);
        const loginButton = page.getByRole('button', { name: /Login|Sign In/i });

        // Check initial sizes
        const initialEmailWidth = await emailInput.evaluate(el => el.clientWidth);
        const initialPasswordWidth = await passwordInput.evaluate(el => el.clientWidth);
        const initialButtonWidth = await loginButton.evaluate(el => el.clientWidth);

        // Resize to different viewports
        await page.setViewportSize({ width: 320, height: 568 });
        const mobileEmailWidth = await emailInput.evaluate(el => el.clientWidth);
        const mobilePasswordWidth = await passwordInput.evaluate(el => el.clientWidth);
        const mobileButtonWidth = await loginButton.evaluate(el => el.clientWidth);

        await page.setViewportSize({ width: 1024, height: 768 });
        const tabletEmailWidth = await emailInput.evaluate(el => el.clientWidth);
        const tabletPasswordWidth = await passwordInput.evaluate(el => el.clientWidth);
        const tabletButtonWidth = await loginButton.evaluate(el => el.clientWidth);

        // Verify inputs grow with viewport
        expect(mobileEmailWidth).toBeLessThan(tabletEmailWidth);
        expect(mobilePasswordWidth).toBeLessThan(tabletPasswordWidth);
        expect(mobileButtonWidth).toBeLessThan(tabletButtonWidth);
    });

    // Test touch targets
    test('Interactive elements should have sufficient touch targets', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/login');

        const interactiveElements = page.getByRole('button');
        const inputElements = page.getByRole('textbox');

        // Check button touch targets
        for (let i = 0; i < await interactiveElements.count(); i++) {
            const element = interactiveElements.nth(i);
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
                expect(boundingBox.width).toBeGreaterThanOrEqual(44);
                expect(boundingBox.height).toBeGreaterThanOrEqual(44);
            }
        }

        // Check input touch targets
        for (let i = 0; i < await inputElements.count(); i++) {
            const element = inputElements.nth(i);
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
                expect(boundingBox.height).toBeGreaterThanOrEqual(44);
            }
        }
    });

    // Test orientation change
    test('Login page should adapt to orientation changes', async ({ page }) => {
        // Portrait orientation
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/login');

        const portraitFormHeight = await page.locator('form').evaluate(el => el.clientHeight);

        // Landscape orientation
        await page.setViewportSize({ width: 812, height: 375 });

        const landscapeFormHeight = await page.locator('form').evaluate(el => el.clientHeight);

        // Form should be shorter in landscape
        expect(landscapeFormHeight).toBeLessThan(portraitFormHeight);

        // Verify all elements are still visible
        await expect(page.getByLabel(/Email|Username/i)).toBeVisible();
        await expect(page.getByLabel(/Password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /Login|Sign In/i })).toBeVisible();
    });

    // Test zoom on mobile
    test('Login page should handle zoom correctly', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/login');

        // Check initial layout
        await expect(page.locator('form')).toBeVisible();

        // Zoom in to 200%
        await page.evaluate(() => {
            document.body.style.zoom = '200%';
        });

        // Verify form is still accessible
        await expect(page.locator('form')).toBeVisible();

        // Check for horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
});
