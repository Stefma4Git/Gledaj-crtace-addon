// unified-extractor.js - Fixed for Render + puppeteer-real-browser
const realBrowser = require('puppeteer-real-browser');

async function extractGledajCrtace(url) {
    console.log(`[GledajCrtace] Starting extraction for: ${url}`);

    let browser;
    try {
        const { browser: b, page } = await realBrowser.connect({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ],
            customConfig: {
                // This helps on Render
                executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome'
            }
        });

        browser = b;

        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        console.log(`[GledajCrtace] Page loaded (domcontentloaded), waiting for m3u8...`);

        // Intercept network requests to catch m3u8
        let m3u8Found = null;

        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8')) {
                console.log(`[GledajCrtace] ✅ FOUND m3u8: ${url}`);
                m3u8Found = url;
            }
        });

        // Wait up to 15 seconds for m3u8
        const maxWait = 15000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            if (m3u8Found) {
                await browser.close();
                return [{ url: m3u8Found, title: 'HLS Stream', behaviorHints: { notWebReady: true } }];
            }
            await new Promise(r => setTimeout(r, 800));
        }

        console.log(`[GledajCrtace] Extraction finished. m3u8 found: false`);
        await browser.close();
        return [];

    } catch (err) {
        console.error(`[GledajCrtace] Error: ${err.message}`);
        if (browser) await browser.close().catch(() => {});
        return [];
    }
}

module.exports = extractGledajCrtace;
