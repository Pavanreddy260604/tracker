import { test, expect } from '@playwright/test';

test.describe('Interaction and Accessibility Tests', () => {
    // Test keyboard navigation
    test('Should be navigable with keyboard', async ({ page }) => {
        await page.goto('/');

        // Check if we're on login page (which might not have navigation)
        if (page.url().includes('/login')) {
            test.skip('Navigation test skipped because we\'re on login page');
            return;
        }

        // Check focus visibility
        await page.keyboard.press('Tab');
        const activeElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());

        // Should focus on a focusable element (skip if it's body)
        if (activeElement && activeElement !== 'body') {
            expect(['a', 'button', 'input', 'select', 'textarea']).toContain(activeElement);
        }

        // Navigate through several focusable elements
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
            const focused = await page.evaluate(() => document.activeElement);
            expect(focused).not.toBeNull();
        }

        // Check shift+tab to navigate back
        await page.keyboard.down('Shift');
        await page.keyboard.press('Tab');
        await page.keyboard.up('Shift');

        const previousFocus = await page.evaluate(() => document.activeElement);
        expect(previousFocus).not.toBeNull();
    });

    // Test focus traps in modals
    test('Modal should not have focus traps', async ({ page }) => {
        await page.goto('/');

        // Find and click a button that opens a modal
        const modalTriggers = page.getByRole('button', { name: /Add/i });

        if (await modalTriggers.count() > 0) {
            await modalTriggers.nth(0).click();

            const modal = page.locator('[role="dialog"]');
            await expect(modal).toBeVisible();

            // Try to tab through modal content
            for (let i = 0; i < 10; i++) {
                await page.keyboard.press('Tab');
                const focusedElement = await page.evaluate(() => document.activeElement);
                expect(focusedElement).not.toBeNull();
            }

            // Check that we can close modal with Escape
            await page.keyboard.press('Escape');
            await expect(modal).not.toBeVisible();
        }
    });

    // Test mobile menu interactions
    test('Mobile menu should toggle open/closed', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        const menuButton = page.getByRole('button', { name: /Menu|Menu toggle/i });

        if (await menuButton.count() > 0) {
            // Open menu
            await menuButton.click();

            // Check if menu is visible
            const menu = page.locator('[class*="nav-menu"]');
            await expect(menu).toBeVisible();

            // Close menu
            await menuButton.click();
            await expect(menu).not.toBeVisible();
        }
    });

    // Test button click interactions
    test('All interactive elements should be clickable and accessible', async ({ page }) => {
        await page.goto('/');

        // Find all clickable elements
        const clickableElements = page.locator('a, button, [role="button"]');
        const clickableCount = await clickableElements.count();

        // Check first few elements
        for (let i = 0; i < Math.min(5, clickableCount); i++) {
            const element = clickableElements.nth(i);

            // Verify element is visible and enabled
            await expect(element).toBeVisible();
            await expect(element).toBeEnabled();

            // Verify minimum touch target size
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
                expect(boundingBox.width).toBeGreaterThanOrEqual(44);
                expect(boundingBox.height).toBeGreaterThanOrEqual(44);
            }
        }
    });

    // Test hover and touch behavior
    test('Buttons should have hover and touch effects', async ({ page }) => {
        await page.goto('/');

        const buttons = page.getByRole('button');
        const buttonCount = await buttons.count();

        if (buttonCount > 0) {
            // Test hover effects
            const firstButton = buttons.nth(0);
            const initialStyle = await firstButton.evaluate(el => el.style.cssText);

            await firstButton.hover();

            // Check if button style changed on hover
            const hoverStyle = await firstButton.evaluate(el => el.style.cssText);
            expect(hoverStyle).not.toEqual(initialStyle);
        }
    });

    // Test focus visibility
    test('Focus should be visible for all focusable elements', async ({ page }) => {
        await page.goto('/');

        const focusableElements = page.locator('a, button, input, select, textarea');
        const focusableCount = await focusableElements.count();

        for (let i = 0; i < Math.min(3, focusableCount); i++) {
            const element = focusableElements.nth(i);

            await element.focus();

            // Check if element has visible focus state
            const hasFocusVisible = await page.evaluate((selector) => {
                const el = document.querySelector(selector);
                if (!el) return false;

                const style = window.getComputedStyle(el);
                const outlineWidth = parseInt(style.outlineWidth);
                const boxShadow = style.boxShadow;
                const hasOutline = outlineWidth > 0 && style.outlineColor !== 'transparent';
                const hasBoxShadow = boxShadow && boxShadow !== 'none';

                return hasOutline || hasBoxShadow;
            }, await element.evaluate(el => el.tagName.toLowerCase() + (el.className ? `.${el.className.split(' ').join('.')}` : '')));

            expect(hasFocusVisible).toBe(true);
        }
    });

    // Test animations don't block interaction
    test('Animations should not block user interaction', async ({ page }) => {
        await page.goto('/');

        // Find an element that might trigger an animation
        const interactiveElements = page.getByRole('button');

        if (await interactiveElements.count() > 0) {
            // Click an element to trigger possible animation
            await Promise.all([
                interactiveElements.nth(0).click(),
                page.waitForLoadState('networkidle')
            ]);

            // Verify we can still interact with elements after animation
            await expect(interactiveElements.nth(0)).toBeVisible();
            await expect(interactiveElements.nth(0)).toBeEnabled();
        }
    });

    // Test accessibility labels
    test('All interactive elements should have accessibility labels', async ({ page }) => {
        await page.goto('/');

        const interactiveElements = page.locator('a, button, [role="button"], input, select, textarea');
        const elementCount = await interactiveElements.count();

        for (let i = 0; i < Math.min(10, elementCount); i++) {
            const element = interactiveElements.nth(i);

            // Check if element has accessible name
            const hasAccessibleName = await page.evaluate((selector) => {
                const el = document.querySelector(selector);
                if (!el) return true;

                // Check for explicit labels or accessible name
                const label = el.getAttribute('aria-label') ||
                    el.getAttribute('title') ||
                    el.textContent ||
                    '';
                return label.trim().length > 0;
            }, await element.evaluate(el => el.tagName.toLowerCase() + (el.className ? `.${el.className.split(' ').join('.')}` : '')));

            expect(hasAccessibleName).toBe(true);
        }
    });

    // Test color contrast ratios
    test('Text should have sufficient color contrast', async ({ page }) => {
        await page.goto('/');

        const textElements = page.locator('h1, h2, h3, h4, h5, h6, p, span');
        const textCount = await textElements.count();

        for (let i = 0; i < Math.min(10, textCount); i++) {
            const textElement = textElements.nth(i);

            const hasSufficientContrast = await page.evaluate((selector) => {
                const el = document.querySelector(selector);
                if (!el) return true;

                const style = window.getComputedStyle(el);
                const textColor = style.color;
                const backgroundColor = style.backgroundColor;

                // Skip if we can't determine colors
                if (!textColor || !backgroundColor) return true;

                // Simple contrast check (very basic approximation)
                // In real application, use a proper color contrast calculator
                const textBrightness = parseInt(textColor.replace(/[^0-9,]/g, '').split(',')[0]);
                const bgBrightness = parseInt(backgroundColor.replace(/[^0-9,]/g, '').split(',')[0]);

                return Math.abs(textBrightness - bgBrightness) > 50;
            }, await textElement.evaluate(el => el.tagName.toLowerCase() + (el.className ? `.${el.className.split(' ').join('.')}` : '')));

            expect(hasSufficientContrast).toBe(true);
        }
    });
});
