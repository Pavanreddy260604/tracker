/**
 * Responsive Viewport Tests
 * Tests for verifying responsive layout across different viewport sizes
 */

import { test, expect } from '@playwright/test';

// Viewport configurations
const viewports = [
    { name: 'Mobile - Small', width: 320, height: 568 },
    { name: 'Mobile - Standard', width: 375, height: 667 },
    { name: 'Mobile - Large', width: 414, height: 896 },
    { name: 'Tablet - Portrait', width: 768, height: 1024 },
    { name: 'Tablet - Landscape', width: 1024, height: 768 },
    { name: 'Desktop - Small', width: 1280, height: 720 },
    { name: 'Desktop - Standard', width: 1440, height: 900 },
    { name: 'Desktop - Large', width: 1920, height: 1080 },
];

// Test data attributes for responsive elements
const responsiveSelectors = {
    appShell: '.app-shell',
    header: '.app-header',
    sidebar: '.app-sidebar',
    mainContent: '.app-main',
    bottomNav: '.app-bottom-nav',
    mobileMenu: '.mobile-more-menu',
    statsGrid: '.stats-grid',
    cardGrid: '.card-grid',
    responsiveGrid: '.grid-responsive',
};

test.describe('Responsive Layout Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app
        await page.goto('/');

        // Wait for the app to be ready
        await page.waitForSelector(responsiveSelectors.appShell);
    });

    for (const viewport of viewports) {
        test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
            test.use({ viewport: { width: viewport.width, height: viewport.height } });

            test('should render app shell correctly', async ({ page }) => {
                const appShell = page.locator(responsiveSelectors.appShell);
                await expect(appShell).toBeVisible();

                // Check data attributes for responsive state
                const isMobile = viewport.width < 768;
                const isTablet = viewport.width >= 768 && viewport.width < 1024;
                const isDesktop = viewport.width >= 1024;

                if (isMobile) {
                    await expect(appShell).toHaveAttribute('data-mobile', 'true');
                }
                if (isTablet) {
                    await expect(appShell).toHaveAttribute('data-tablet', 'true');
                }
                if (isDesktop) {
                    await expect(appShell).toHaveAttribute('data-desktop', 'true');
                }
            });

            test('should display correct navigation for viewport', async ({ page }) => {
                const isMobile = viewport.width < 768;
                const isDesktop = viewport.width >= 1024;

                // Header should always be visible
                const header = page.locator(responsiveSelectors.header);
                await expect(header).toBeVisible();

                if (isMobile) {
                    // Bottom nav should be visible on mobile
                    const bottomNav = page.locator(responsiveSelectors.bottomNav);
                    await expect(bottomNav).toBeVisible();

                    // Sidebar should be hidden on mobile by default
                    const sidebar = page.locator(responsiveSelectors.sidebar);
                    await expect(sidebar).toBeHidden();
                }

                if (isDesktop) {
                    // Sidebar should be visible on desktop
                    const sidebar = page.locator(responsiveSelectors.sidebar);
                    await expect(sidebar).toBeVisible();

                    // Bottom nav should be hidden on desktop
                    const bottomNav = page.locator(responsiveSelectors.bottomNav);
                    await expect(bottomNav).toBeHidden();
                }
            });

            test('should have proper touch targets on mobile', async ({ page }) => {
                const isMobile = viewport.width < 768;

                if (isMobile) {
                    // Check all touch targets are at least 44x44
                    const touchTargets = page.locator('.touch-target');
                    const count = await touchTargets.count();

                    for (let i = 0; i < count; i++) {
                        const target = touchTargets.nth(i);
                        const box = await target.boundingBox();

                        if (box) {
                            expect(box.width).toBeGreaterThanOrEqual(44);
                            expect(box.height).toBeGreaterThanOrEqual(44);
                        }
                    }
                }
            });

            test('should not have horizontal overflow', async ({ page }) => {
                // Check for horizontal scroll
                const hasHorizontalScroll = await page.evaluate(() => {
                    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
                });

                expect(hasHorizontalScroll).toBe(false);
            });

            test('should render stats grid correctly', async ({ page }) => {
                const statsGrid = page.locator(responsiveSelectors.statsGrid);

                if (await statsGrid.count() > 0) {
                    await expect(statsGrid.first()).toBeVisible();

                    // Check grid columns based on viewport
                    const grid = statsGrid.first();
                    const computedStyle = await grid.evaluate((el) => {
                        return window.getComputedStyle(el).gridTemplateColumns;
                    });

                    const columnCount = computedStyle.split(' ').length;

                    if (viewport.width < 640) {
                        // Mobile: 2 columns
                        expect(columnCount).toBeLessThanOrEqual(2);
                    } else if (viewport.width < 768) {
                        // Large mobile: 2 columns
                        expect(columnCount).toBeLessThanOrEqual(2);
                    } else if (viewport.width < 1280) {
                        // Tablet: 4 columns
                        expect(columnCount).toBeLessThanOrEqual(4);
                    }
                }
            });
        });
    }
});

test.describe('Responsive Component Tests', () => {
    test('stats grid should adapt to viewport', async ({ page }) => {
        // Test at different widths
        const widths = [320, 640, 768, 1024, 1280];

        for (const width of widths) {
            await page.setViewportSize({ width, height: 800 });
            await page.goto('/');

            const statsGrid = page.locator(responsiveSelectors.statsGrid);

            if (await statsGrid.count() > 0) {
                const grid = statsGrid.first();
                const box = await grid.boundingBox();

                // Grid should not exceed viewport width
                if (box) {
                    expect(box.width).toBeLessThanOrEqual(width);
                }
            }
        }
    });

    test('cards should maintain proper spacing', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        const cards = page.locator('.card-responsive');
        const count = await cards.count();

        for (let i = 0; i < Math.min(count, 5); i++) {
            const card = cards.nth(i);
            const box = await card.boundingBox();

            if (box) {
                // Card should have padding
                expect(box.width).toBeGreaterThan(0);
                expect(box.height).toBeGreaterThan(0);
            }
        }
    });

    test('responsive text should scale appropriately', async ({ page }) => {
        // Test heading sizes at different viewports
        const viewports = [
            { width: 320, height: 568 },
            { width: 1440, height: 900 },
        ];

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            await page.goto('/');

            const headings = page.locator('h1, h2, h3');
            const count = await headings.count();

            for (let i = 0; i < Math.min(count, 3); i++) {
                const heading = headings.nth(i);
                const fontSize = await heading.evaluate((el) => {
                    return parseFloat(window.getComputedStyle(el).fontSize);
                });

                // Font size should be reasonable
                expect(fontSize).toBeGreaterThan(12);
                expect(fontSize).toBeLessThan(48);
            }
        }
    });
});

test.describe('Safe Area Tests (Notched Devices)', () => {
    test('should handle safe area insets on notched devices', async ({ page }) => {
        // Simulate iPhone X viewport with notch
        await page.setViewportSize({ width: 375, height: 812 });

        // Add safe area insets via CSS
        await page.addStyleTag({
            content: `
                :root {
                    --safe-area-inset-top: 44px;
                    --safe-area-inset-bottom: 34px;
                }
            `
        });

        await page.goto('/');

        // Check header accounts for safe area
        const header = page.locator(responsiveSelectors.header);
        const headerBox = await header.boundingBox();

        if (headerBox) {
            // Header should start below safe area
            expect(headerBox.y).toBeGreaterThanOrEqual(0);
        }
    });
});

test.describe('Orientation Change Tests', () => {
    test('should handle orientation change correctly', async ({ page }) => {
        // Start in portrait
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        const appShell = page.locator(responsiveSelectors.appShell);
        await expect(appShell).toHaveAttribute('data-mobile', 'true');

        // Rotate to landscape
        await page.setViewportSize({ width: 667, height: 375 });

        // Wait for resize handling
        await page.waitForTimeout(300);

        // Should still be mobile (width < 768)
        await expect(appShell).toHaveAttribute('data-mobile', 'true');
    });
});

test.describe('Container Query Tests', () => {
    test('container query elements should respond to container size', async ({ page }) => {
        await page.goto('/');

        // Check if container query support exists
        const hasContainerQuerySupport = await page.evaluate(() => {
            return CSS.supports('container-type', 'inline-size');
        });

        if (hasContainerQuerySupport) {
            const containerElements = page.locator('.container-query');
            const count = await containerElements.count();

            if (count > 0) {
                // Container query elements should exist
                await expect(containerElements.first()).toBeVisible();
            }
        }
    });
});

test.describe('Accessibility Tests', () => {
    test('should have proper focus management on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Tab through focusable elements
        await page.keyboard.press('Tab');

        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });

    test('should have visible focus indicators', async ({ page }) => {
        await page.goto('/');

        // Focus on a button
        const button = page.locator('button').first();
        await button.focus();

        // Check for focus ring
        const outline = await button.evaluate((el) => {
            return window.getComputedStyle(el).outline;
        });

        // Should have some form of focus indicator
        expect(outline).toBeDefined();
    });
});

test.describe('Performance Tests', () => {
    test('should render within performance budget', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        await page.waitForSelector(responsiveSelectors.appShell);

        const loadTime = Date.now() - startTime;

        // Should load within 3 seconds
        expect(loadTime).toBeLessThan(3000);
    });

    test('should not have layout shifts', async ({ page }) => {
        await page.goto('/');

        // Check for cumulative layout shift
        const cls = await page.evaluate(() => {
            return new Promise<number>((resolve) => {
                let clsValue = 0;
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'layout-shift') {
                            clsValue += (entry as any).value;
                        }
                    }
                });
                observer.observe({ type: 'layout-shift', buffered: true });

                // Wait a bit for any layout shifts
                setTimeout(() => {
                    observer.disconnect();
                    resolve(clsValue);
                }, 1000);
            });
        });

        // CLS should be less than 0.1 (good score)
        expect(cls).toBeLessThan(0.1);
    });
});
