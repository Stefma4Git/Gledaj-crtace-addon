// index.js - Clean metadata fix
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const logger = require('./logger');
const runExtractor = require('./unified-extractor');
const axios = require('axios');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 7000;

const builder = new addonBuilder({
    id: 'org.stefma.gledajcrtace',
    version: '1.0.9',
    name: 'Gledaj Crtace',
    description: 'Sinhronizovani crtani filmovi',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    catalogs: [{ type: 'movie', id: 'latest', name: 'Poslednje Dodato' }],
    idPrefixes: ['crtace']
});

// Catalog (10 pages)
builder.defineCatalogHandler(async () => {
    logger.info('[Catalog] Fetching 10 pages of Poslednje Dodato...');
    const metas = [];
    const seen = new Set();

    for (let page = 1; page <= 10; page++) {
        const url = page === 1 
            ? 'https://gledajcrtace.org/poslednje-dodato/' 
            : `https://gledajcrtace.org/poslednje-dodato/page/${page}/`;

        try {
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });

            const $ = cheerio.load(data);

            $('a').each((_, el) => {
                const $a = $(el);
                let title = $a.find('h3, h4, .title').first().text().trim() || $a.attr('title') || $a.text().trim();
                let href = $a.attr('href');
                let poster = $a.find('img').attr('src') || $a.find('img').attr('data-src') || '';

                if (title && href && (href.includes('-hr') || href.includes('-sr') || href.includes('/film/'))) {
                    if (!href.startsWith('http')) href = 'https://gledajcrtace.org' + (href.startsWith('/') ? '' : '/') + href;

                    const slug = href.split('/').filter(Boolean).pop();
                    const id = `crtace:${slug}`;

                    if (!seen.has(id)) {
                        seen.add(id);
                        metas.push({
                            id,
                            type: 'movie',
                            name: title.replace(/\(.*?\)/g, '').trim(),
                            poster: poster || 'https://via.placeholder.com/300x450?text=Crtani'
                        });
                    }
                }
            });
        } catch (e) {}
    }

    const uniqueMetas = metas.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    logger.info(`[Catalog] Total unique movies: ${uniqueMetas.length}`);
    return { metas: uniqueMetas };
});

// Stream Handler - Proper metadata structure
builder.defineStreamHandler(async (args) => {
    const id = args.id;
    logger.info(`Stream request for ID: ${id}`);

    try {
        let movieUrl = id;

        if (id.includes('gledajcrtace.org')) {
            movieUrl = id;
        } else if (id.startsWith('crtace:')) {
            const slug = id.replace('crtace:', '');
            movieUrl = `https://gledajcrtace.org/${slug}`;
        }

        logger.info(`Using URL: ${movieUrl}`);

        const streams = await runExtractor('crtace', 'movie', movieUrl);

        // Clean title for display
        const displayTitle = id.replace('crtace:', '')
                             .replace(/-/g, ' ')
                             .replace(/\//g, ' ')
                             .trim()
                             .replace(/\b\w/g, c => c.toUpperCase());

        return {
            streams: streams || [],
            // This is the correct way to return metadata
            meta: {
                id: id,
                type: 'movie',
                name: displayTitle || "Crtani Film",
                poster: ''   // leave empty for now - Stremio will use catalog poster
            }
        };
    } catch (err) {
        logger.error(`Stream error: ${err.message}`);
        return { streams: [] };
    }
});

serveHTTP(builder.getInterface(), { port: PORT, hostname: "0.0.0.0" });

logger.info(`✅ Gledaj Crtace Addon v1.0.9 (fixed metadata) running`);