// unified-extractor.js - Working version for Render (auto Chrome)
const puppeteer = require('puppeteer-core');

async function extractGledajCrtace(url) {
    console.log(`[GledajCrtace] Starting extraction for: ${url}`);

    let browser;
    try {
        // Get Chrome path installed by postinstall
        const executablePath = puppeteer.executablePath();

        if (!executablePath) {
            throw new Error('Chrome executablePath not found');
        }

        console.log(`[GledajCrtace] Using Chrome at: ${executablePath}`);

        browser = await puppeteer.launch({
            executablePath: executablePath,
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
