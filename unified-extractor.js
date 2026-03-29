// unified-extractor.js - Using puppeteer-core + system Chromium (better for Render)
const puppeteer = require('puppeteer-core');

async function extractGledajCrtace(url) {
    console.log(`[GledajCrtace] Starting extraction for: ${url}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium-browser',
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();

        // Intercept requests to catch m3u8
        let m3u8Found = null;
        page.on('request', (request) => {
            const reqUrl = request.url();
            if (reqUrl.includes('.m3u8')) {
                console.log(`[GledajCrtace] ✅ FOUND m3u8: ${reqUrl}`);
                m3u8Found = reqUrl;
            }
        });

        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        console.log(`[GledajCrtace] Page loaded, waiting for m3u8...`);

        // Wait up to 15 seconds for m3u8
        const maxWait = 15000;
        const start = Date.now();

        while (Date.now() - start < maxWait) {
            if (m3u8Found) {
                await browser.close();
                return [{ url: m3u8Found }];
            }
            await new Promise(r => setTimeout(r, 800));
        }

        console.log(`[GledajCrtace] No m3u8 found after waiting`);
        await browser.close();
        return [];

    } catch (err) {
        console.error(`[GledajCrtace] Error: ${err.message}`);
        if (browser) await browser.close().catch(() => {});
        return [];
    }
}

module.exports = extractGledajCrtace;
