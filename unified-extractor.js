// unified-extractor.js
const { connect } = require("puppeteer-real-browser");
const logger = require("./logger");

async function extractGledajCrtace(movieUrl) {
    let browser, page;
    let foundM3u8 = null;

    try {
        logger.info(`[GledajCrtace] Starting for: ${movieUrl}`);

        const { browser: br, page: pg } = await connect({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        browser = br;
        page = pg;

        await page.setRequestInterception(true);

        page.on('request', (req) => {
            const url = req.url();
            if (url.includes('.m3u8') && !foundM3u8) {
                logger.info(`[GledajCrtace] ✅ FOUND m3u8: ${url}`);
                foundM3u8 = url;
            }
            req.continue().catch(() => {});
        });

        await page.goto(movieUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        logger.info(`[GledajCrtace] Page loaded, waiting for m3u8...`);

        await new Promise(r => setTimeout(r, 10000)); // 10 seconds should be enough if it loads immediately

        if (foundM3u8) {
            return [{
                url: foundM3u8,
                title: "HLS Stream",
                behaviorHints: { notWebReady: false }
            }];
        }

        logger.warn(`[GledajCrtace] No m3u8 found`);
        return [];
    } catch (err) {
        logger.error(`[GledajCrtace] Error: ${err.message}`);
        return [];
    } finally {
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

async function runExtractor(source, type, id) {
    if (source === 'crtace') return extractGledajCrtace(id);
    throw new Error(`Unknown source`);
}

module.exports = runExtractor;