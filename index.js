// index.js - v2.9.2: Interleaved preload (Filmovi ↔ Serije) + restored posters
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const logger = require('./logger');
const runExtractor = require('./unified-extractor');
const axios = require('axios');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 7000;

let allMovies = [];
let allSeries = [];
let lastUpdate = 0;
const REFRESH_MS = 3 * 24 * 60 * 60 * 1000;

const builder = new addonBuilder({
    id: 'org.stefma.gledajcrtace',
    version: '2.9.2',
    name: 'Gledaj Crtace',
    description: 'Sinhronizovani crtani filmovi i serije',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series'],
    catalogs: [{
        type: 'movie',
        id: 'main',
        name: 'Gledaj Crtace',
        extra: [
            { 
                name: 'genre', 
                isRequired: false, 
                options: ['Filmovi', 'Serije'],
                title: 'Kategorija'
            }
        ]
    }],
    idPrefixes: ['crtace']
});

async function loadData() {
    if (Date.now() - lastUpdate < REFRESH_MS && allMovies.length > 0) return;

    logger.info('[Catalog] Starting interleaved preload (Filmovi ↔ Serije)...');
    allMovies = [];
    allSeries = [];
    const seen = new Set();

    const maxPages = 35;

    for (let p = 1; p <= maxPages; p++) {
        // === Load one page of Movies ===
        {
            const url = p === 1 ? 'https://gledajcrtace.org/poslednje-dodato/' : `https://gledajcrtace.org/poslednje-dodato/page/${p}/`;
            try {
                const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
                const $ = cheerio.load(data);

                $('a').each((_, el) => {
                    const $a = $(el);
                    let title = $a.find('h3, h4, .title').first().text().trim() || $a.attr('title') || $a.text().trim();
                    let href = $a.attr('href');
                    let poster = $a.find('img').attr('src') || $a.find('img').attr('data-src') || '';

                    if (title && href && (href.includes('-hr') || href.includes('-sr') || href.includes('/film/') || href.includes('/crtani/'))) {
                        if (!href.startsWith('http')) href = 'https://gledajcrtace.org' + (href.startsWith('/') ? '' : '/') + href;
                        const slug = href.split('/').filter(Boolean).pop();
                        const id = `crtace:${slug}`;

                        if (!seen.has(id)) {
                            seen.add(id);
                            allMovies.push({
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

        // === Load one page of Series ===
        {
            const url = p === 1 ? 'https://gledajcrtace.org/series/' : `https://gledajcrtace.org/series/page/${p}/`;
            try {
                const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
                const $ = cheerio.load(data);

                $('a').each((_, el) => {
                    const $a = $(el);
                    let title = $a.find('h3, h4, .title').first().text().trim() || $a.attr('title') || $a.text().trim();
                    let href = $a.attr('href');
                    let poster = $a.find('img').attr('src') || $a.find('img').attr('data-src') || '';

                    if (title && href && href.includes('/series/')) {
                        if (!href.startsWith('http')) href = 'https://gledajcrtace.org' + (href.startsWith('/') ? '' : '/') + href;
                        const slug = href.split('/').filter(Boolean).pop();
                        const id = `crtace:${slug}`;

                        if (!seen.has(id)) {
                            seen.add(id);
                            allSeries.push({
                                id,
                                type: 'series',
                                name: title.replace(/\(.*?\)/g, '').trim(),
                                poster: poster || 'https://via.placeholder.com/300x450?text=Serija'
                            });
                        }
                    }
                });
            } catch (e) {}
        }

        logger.info(`[Preload] After round ${p}: ${allMovies.length} movies + ${allSeries.length} series`);
        await new Promise(r => setTimeout(r, 400));
    }

    lastUpdate = Date.now();
    logger.info(`[Catalog] Preload finished → ${allMovies.length} movies + ${allSeries.length} series`);
}

setInterval(() => loadData(true), REFRESH_MS);
loadData();

// Catalog Handler
builder.defineCatalogHandler(async (args) => {
    const skip = parseInt(args.extra?.skip) || 0;
    const genre = args.extra?.genre || 'Filmovi';

    const items = (genre === 'Serije') ? allSeries : allMovies;
    const batch = items.slice(skip, skip + 40);

    logger.info(`[Catalog] ${genre} | skip=${skip} → ${batch.length} items`);
    return { metas: batch };
});

// Meta Handler (kept simple for now)
builder.defineMetaHandler(async (args) => {
    const id = args.id;
    const isSeries = args.type === 'series';

    let url = id.startsWith('crtace:') ? `https://gledajcrtace.org/${id.replace('crtace:', '')}` : id;

    let name = id.replace('crtace:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let poster = '';

    try {
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
        const $ = cheerio.load(data);
        name = $('h1').first().text().trim() || name;

        $('.gallery_img a[href*="image.tmdb.org"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && !poster) poster = href.replace('/w500/', '/w780/');
        });
        if (!poster) poster = $('meta[property="og:image"]').attr('content') || '';
        if (!poster) poster = $('img[src*="poster"], img[src*="cover"]').first().attr('src') || '';

        if (poster && !poster.startsWith('http')) poster = 'https://gledajcrtace.org' + poster;
    } catch (e) {}

    if (!poster) {
        let fb = cleanTitleForPoster(name);
        if (name.toLowerCase().includes('zootopia')) fb = 'Zootopia 2';
        poster = `https://images.metahub.space/poster/medium/${encodeURIComponent(fb)}/img`;
    }

    return {
        meta: {
            id,
            type: isSeries ? 'series' : 'movie',
            name,
            poster: poster || 'https://via.placeholder.com/300x450?text=Crtani',
            background: poster,
            description: isSeries ? 'Sinhronizovana crtana serija.' : 'Sinhronizovani crtani film.',
            posterShape: 'poster'
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const id = args.id;
    try {
        let url = id.startsWith('crtace:') ? `https://gledajcrtace.org/${id.replace('crtace:', '')}` : id;
        const streams = await runExtractor('crtace', args.type || 'movie', url);
        return { streams: streams || [] };
    } catch (err) {
        logger.error(`[Stream] Error: ${err.message}`);
        return { streams: [] };
    }
});

serveHTTP(builder.getInterface(), { port: PORT, hostname: "0.0.0.0" });

logger.info(`✅ Gledaj Crtace Addon v2.9.2 started (Interleaved preload)`);
