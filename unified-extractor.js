// unified-extractor.js - Faster version (reduced wait, better early detection)
const { connect } = require("puppeteer-real-browser");
const logger = require("./logger");

async function extractGledajCrtace(movieUrl) {
    let browser, page;
    let foundM3u8 = null;
    let startTime = Date.now();

    try {
        logger.info(`[GledajCrtace] Starting extraction for: ${movieUrl}`);

        const { browser: br, page: pg } = await connect({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ],
            // Optional: you can try connectOptions if needed for faster launch
        });

        browser = br;
        page = pg;

        await page.setRequestInterception(true);

        page.on('request', (req) => {
            const url = req.url();
            if (url.includes('.m3u8') && !foundM3u8) {
                logger.info(`[GledajCrtace] ✅ FOUND m3u8: ${url}`);
                foundM3u8 = url;
                // We can continue — no need to stop here
            }
            req.continue().catch(() => {});
        });

        // Faster navigation
        await page.goto(movieUrl, { 
            waitUntil: 'domcontentloaded',   // much faster than networkidle2
            timeout: 25000 
        });

        logger.info(`[GledajCrtace] Page loaded (domcontentloaded), waiting for m3u8...`);

        // Shorter + smarter waiting: stop early if m3u8 is found
        let waited = 0;
        const maxWait = 8000; // max 8 seconds instead of 10+

        while (!foundM3u8 && waited < maxWait) {
            await new Promise(r => setTimeout(r, 800)); // check every 800ms
            waited += 800;

            // Optional: click play button if it exists (some sites need it)
            try {
                await page.evaluate(() => {
                    const playBtn = document.querySelector('button.play, .play-button, #play, .vjs-play-control');
                    if (playBtn) playBtn.click();
                });
            } catch (e) {}
        }

        const totalTime = Date.now() - startTime;
        logger.info(`[GledajCrtace] Extraction finished in ${totalTime}ms. m3u8 found: ${!!foundM3u8}`);

        if (foundM3u8) {
            return [{
                url: foundM3u8,
                title: "HLS Stream (Gledaj Crtace)",
                behaviorHints: { 
                    notWebReady: false,
                    bingeGroup: "gledajcrtace"
                }
            }];
        }

        logger.warn(`[GledajCrtace] No m3u8 found after waiting`);
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
    throw new Error(`Unknown source: ${source}`);
}

module.exports = runExtractor;
