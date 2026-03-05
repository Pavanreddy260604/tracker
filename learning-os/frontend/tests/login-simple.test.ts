import { test, expect } from '@playwright/test';

test.describe('Simple Login Page Tests', () => {
    test('Login page should be accessible', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Verify page loads without 404
        await expect(page).not.toHaveURL(/.*404/);

        // Check for basic content with more reliable selectors
        await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#password')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });

        console.log('✅ Login page is accessible');
    });

    test('Login page should respond to different viewport sizes', async ({ page }) => {
        // Test on small mobile viewport
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Check form is visible and responsive with IDs
        await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#password')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });

        // Test on tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#password')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });

        // Test on desktop viewport
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#password')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });

        console.log('✅ Login page responds to different viewport sizes');
    });

    test('Input fields should be focusable', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Test email input
        await page.focus('#email');
        const emailFocused = await page.evaluate(() => {
            return document.activeElement === document.querySelector('#email');
        });
        expect(emailFocused).toBe(true);

        // Test password input
        await page.focus('#password');
        const passwordFocused = await page.evaluate(() => {
            return document.activeElement === document.querySelector('#password');
        });
        expect(passwordFocused).toBe(true);

        console.log('✅ Input fields are focusable');
    });

    test('Submit button should be clickable', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Check button is enabled
        await expect(page.locator('button[type="submit"]')).not.toBeDisabled({ timeout: 10000 });

        // Test button click (will fail login, but should be clickable)
        await page.click('button[type="submit"]');

        // Check if we stay on login page (form submission failed)
        await expect(page.url()).toContain('/login');

        console.log('✅ Submit button is clickable');
    });
});
