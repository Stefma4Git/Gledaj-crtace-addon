// unified-extractor.js - Using Chromium for Render
const realBrowser = require('puppeteer-real-browser');

async function extractGledajCrtace(url) {
    console.log(`[GledajCrtace] Starting extraction for: ${url}`);

    let browser;
    try {
        const connectOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-web-security'
            ]
        };

        // Try Chromium path first
        if (process.env.CHROME_PATH) {
            connectOptions.customConfig = {
                executablePath: process.env.CHROME_PATH
            };
            console.log(`[GledajCrtace] Using CHROME_PATH: ${process.env.CHROME_PATH}`);
        } else {
            console.log(`[GledajCrtace] No CHROME_PATH set, using default`);
        }

        const { browser: b, page } = await realBrowser.connect(connectOptions);
        browser = b;

        console.log(`[GledajCrtace] Browser launched successfully`);

        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        console.log(`[GledajCrtace] Page loaded, waiting for m3u8...`);

        let m3u8Found = null;

        page.on('request', (request) => {
            const reqUrl = request.url();
            if (reqUrl.includes('.m3u8')) {
                console.log(`[GledajCrtace] ✅ FOUND m3u8: ${reqUrl}`);
                m3u8Found = reqUrl;
            }
        });

        // Wait for m3u8
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
