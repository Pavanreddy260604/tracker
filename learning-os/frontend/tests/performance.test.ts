import { test, expect } from '@playwright/test';

test.describe('Performance and Layout Stability Tests', () => {
    // Test for cumulative layout shift (CLS)
    test('Page should have minimal cumulative layout shift', async ({ page }) => {
        await page.goto('/');

        // Wait for page to load completely
        await page.waitForLoadState('networkidle');

        // Get CLS metric from Chrome Performance API
        const cls = await page.evaluate(async () => {
            // Wait for any pending rendering
            await new Promise(resolve => requestAnimationFrame(() =>
                requestAnimationFrame(resolve)
            ));

            // Access performance metrics
            const entries = performance.getEntriesByType('layout-shift');
            const totalCLS = entries.reduce((acc, entry: any) => {
                return acc + entry.value;
            }, 0);

            return totalCLS;
        });

        // CLS should be less than 0.1 (good user experience)
        expect(cls).toBeLessThan(0.1);
    });

    // Test for layout thrashing
    test('Page should not have excessive layout thrashing', async ({ page }) => {
        await page.goto('/');

        // Monitor layout thrashing
        const layoutCount = await page.evaluate(async () => {
            let count = 0;

            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntriesByType('layout-shift');
                count += entries.length;
            });

            observer.observe({ entryTypes: ['layout-shift'] });

            // Perform some typical interactions
            window.scrollBy(0, 100);
            await new Promise(resolve => setTimeout(resolve, 100));
            window.scrollBy(0, -100);
            await new Promise(resolve => setTimeout(resolve, 100));

            return count;
        });

        expect(layoutCount).toBeLessThan(10);
    });

    // Test for resize-triggered reflows
    test('Resize events should not cause excessive reflows', async ({ page }) => {
        // Initial viewport
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.goto('/');

        // Monitor reflows during resize
        const reflowCount = await page.evaluate(async () => {
            let count = 0;
            const startRects = new Map();

            // Record initial positions of elements
            const elements = document.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6');
            elements.forEach((el, index) => {
                const rect = el.getBoundingClientRect();
                startRects.set(index, {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                });
            });

            // Resize to different viewports
            window.resizeTo(375, 667);
            await new Promise(resolve => setTimeout(resolve, 100));

            window.resizeTo(1024, 768);
            await new Promise(resolve => setTimeout(resolve, 100));

            window.resizeTo(1920, 1080);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check for changes in element positions
            elements.forEach((el, index) => {
                const rect = el.getBoundingClientRect();
                const startRect = startRects.get(index);

                if (startRect) {
                    const leftChange = Math.abs(rect.left - startRect.left);
                    const topChange = Math.abs(rect.top - startRect.top);
                    const widthChange = Math.abs(rect.width - startRect.width);
                    const heightChange = Math.abs(rect.height - startRect.height);

                    if (leftChange > 1 || topChange > 1 || widthChange > 1 || heightChange > 1) {
                        count++;
                    }
                }
            });

            return count;
        });

        // Only a small percentage of elements should change position
        expect(reflowCount).toBeLessThan(20);
    });

    // Test responsive performance metrics
    test('Responsive behavior should maintain acceptable performance', async ({ page }) => {
        const viewports = [
            { width: 375, height: 667 },
            { width: 768, height: 1024 },
            { width: 1024, height: 768 },
            { width: 1920, height: 1080 },
        ];

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            const startTime = Date.now();
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const loadTime = Date.now() - startTime;

            // Page should load in under 3 seconds on all viewports
            expect(loadTime).toBeLessThan(3000);
        }
    });

    // Test scroll performance
    test('Scrolling should be smooth and efficient', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.goto('/');

        // Perform scroll operations
        const scrollTimes = [];

        for (let i = 0; i < 3; i++) {
            const scrollAmount = 200 * (i + 1);
            const startTime = Date.now();

            await page.evaluate(scrollY => {
                window.scrollTo(0, scrollY);
            }, scrollAmount);

            await page.waitForTimeout(100);
            const scrollTime = Date.now() - startTime;
            scrollTimes.push(scrollTime);
        }

        // Average scroll time should be under 300ms (more realistic for CI/CD environments)
        const averageScrollTime = scrollTimes.reduce((sum, time) => sum + time, 0) / scrollTimes.length;
        expect(averageScrollTime).toBeLessThan(300);
    });

    // Test interaction latency
    test('User interactions should respond quickly', async ({ page }) => {
        await page.goto('/');

        // Find interactive elements
        const interactiveElements = page.getByRole('button');
        const interactiveCount = await interactiveElements.count();

        if (interactiveCount > 0) {
            // Measure click response time
            const responseTimes = [];

            for (let i = 0; i < Math.min(3, interactiveCount); i++) {
                const startTime = Date.now();
                await interactiveElements.nth(i).click({ force: true });
                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);
            }

            // Average response time should be under 200ms
            const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            expect(averageResponseTime).toBeLessThan(200);
        }
    });
});
