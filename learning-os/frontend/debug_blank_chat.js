import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    const logs = [];

    page.on('console', msg => {
        if (msg.type() === 'error') {
            logs.push(`PAGE ERROR: ${msg.text()}`);
        } else {
            logs.push(`PAGE LOG: ${msg.text()}`);
        }
    });

    page.on('pageerror', error => {
        logs.push(`PAGE EXCEPTION: ${error.message}`);
    });

    try {
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 10000 });
        logs.push('Login page loaded');

        // Register
        await page.evaluate(async () => {
            await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'AutomatedTester', email: 'tester@example.com', password: 'Password123!' })
            });
        });

        // Type login
        await page.fill('input[type="email"]', 'tester@example.com');
        await page.fill('input[type="password"]', 'Password123!');
        await page.click('button[type="submit"]');

        logs.push('Clicked login');

        await page.waitForTimeout(3000);

        const isDashboard = await page.url().includes('dashboard');
        logs.push(`Is dashboard: ${isDashboard}`);

        await page.goto('http://localhost:5173/chat', { waitUntil: 'networkidle', timeout: 10000 });
        logs.push('Chat page loaded');

        await page.waitForTimeout(2000);

        const chatShell = await page.$('.chat-shell');
        logs.push(`Chat shell found: ${!!chatShell}`);

        if (chatShell) {
            const box = await chatShell.boundingBox();
            logs.push(`Chat shell dimensions: ${JSON.stringify(box)}`);

            const chatHTML = await page.evaluate(() => document.querySelector('.chat-shell').outerHTML.substring(0, 1000));
            logs.push(`Chat shell HTML: ${chatHTML}`);
        } else {
            const rootHTML = await page.evaluate(() => document.getElementById('root').innerHTML.substring(0, 1000));
            logs.push(`Root HTML: ${rootHTML}`);
        }

    } catch (error) {
        logs.push(`Script error: ${error}`);
    }

    fs.writeFileSync('debug_out.txt', logs.join('\n'));
    await browser.close();
    console.log('done');
})();
