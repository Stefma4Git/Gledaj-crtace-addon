// index.js - v3.4.2 - Optimized for Render
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const logger = require('./logger');
const runExtractor = require('./unified-extractor');
const axios = require('axios');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 7000;

let allMovies = [];
let allSeries = [];
let lastUpdate = 0;
const REFRESH_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const builder = new addonBuilder({
    id: 'org.stefma.gledajcrtace',
    version: '3.4.2',
    name: 'Gledaj Crtace',
    description: 'Sinhronizovani crtani filmovi i serije',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series'],
    catalogs: [{
        type: 'movie',
        id: 'main',
        name: 'Gledaj Crtace',
        extra: [
            { name: 'genre', isRequired: false, options: ['Filmovi', 'Serije'], title: 'Kategorija' }
        ]
    }],
    idPrefixes: ['crtace']
});

// ====================== CATALOG & DATA LOADING ======================
async function loadData() {
    if (Date.now() - lastUpdate < REFRESH_MS && allMovies.length > 0) return;

    logger.info('[Catalog] Starting interleaved preload...');
    allMovies = [];
    allSeries = [];
    const seen = new Set();

    const maxPages = 35;

    for (let p = 1; p <= maxPages; p++) {
        // Movies
        try {
            const url = p === 1 ? 'https://gledajcrtace.org/poslednje-dodato/' : `https://gledajcrtace.org/poslednje-dodato/page/${p}/`;
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
            const $ = cheerio.load(data);

            $('a').each((_, el) => {
                const $a = $(el);
                let title = $a.find('h3, h4, .title').first().text().trim() || $a.attr('title') || $a.text().trim();
                let href = $a.attr('href');
                let poster = $a.find('img').attr('src') || '';

                if (title && href && (href.includes('-hr') || href.includes('-sr') || href.includes('/film/') || href.includes('/crtani/'))) {
                    if (!href.startsWith('http')) href = 'https://gledajcrtace.org' + (href.startsWith('/') ? '' : '/') + href;
                    const slug = href.split('/').filter(Boolean).pop();
                    const id = `crtace:${slug}`;
                    if (!seen.has(id)) {
                        seen.add(id);
                        allMovies.push({ id, type: 'movie', name: title.replace(/\(.*?\)/g, '').trim(), poster });
                    }
                }
            });
        } catch (e) {}

        // Series
        try {
            const url = p === 1 ? 'https://gledajcrtace.org/series/' : `https://gledajcrtace.org/series/page/${p}/`;
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
            const $ = cheerio.load(data);

            $('a').each((_, el) => {
                const $a = $(el);
                let title = $a.find('h3, h4, .title').first().text().trim() || $a.attr('title') || $a.text().trim();
                let href = $a.attr('href');
                let poster = $a.find('img').attr('src') || '';

                if (title && href && href.includes('/series/')) {
                    if (!href.startsWith('http')) href = 'https://gledajcrtace.org' + (href.startsWith('/') ? '' : '/') + href;
                    const slug = href.split('/').filter(Boolean).pop();
                    const id = `crtace:${slug}`;
                    if (!seen.has(id)) {
                        seen.add(id);
                        allSeries.push({ id, type: 'series', name: title.replace(/\(.*?\)/g, '').trim(), poster });
                    }
                }
            });
        } catch (e) {}

        await new Promise(r => setTimeout(r, 350));
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

// Meta + Stream Handlers (same as before)
builder.defineMetaHandler(async (args) => {
    const id = args.id;
    const isSeries = args.type === 'series';

    if (!isSeries) {
        // Simple movie handling
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

        if (!poster) poster = `https://images.metahub.space/poster/medium/${encodeURIComponent(cleanTitleForPoster(name))}/img`;

        return { meta: { id, type: 'movie', name, poster, background: poster, description: 'Sinhronizovani crtani film.', posterShape: 'poster' }};
    }

    // Series - uses exact watch URLs
    let seriesUrl = id.startsWith('crtace:') ? `https://gledajcrtace.org/${id.replace('crtace:', '')}` : id;
    let name = id.replace('crtace:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let poster = '';
    let episodes = [];

    try {
        const { data } = await axios.get(seriesUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000 });
        const $ = cheerio.load(data);

        name = $('h1').first().text().trim() || name;

        $('.gallery_img a[href*="image.tmdb.org"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && !poster) poster = href.replace('/w500/', '/w780/');
        });
        if (!poster) poster = $('meta[property="og:image"]').attr('content') || '';
        if (!poster) poster = $('img[src*="poster"], img[src*="cover"]').first().attr('src') || '';
        if (poster && !poster.startsWith('http')) poster = 'https://gledajcrtace.org' + poster;

        $('.ts-chl-collapsible').each((sIdx, seasonEl) => {
            const seasonText = $(seasonEl).text().trim();
            const seasonNum = parseInt(seasonText.replace(/[^\d]/g, '')) || (sIdx + 1);

            const content = $(seasonEl).next('.ts-chl-collapsible-content');
            if (!content.length) return;

            content.find('li a').each((eIdx, link) => {
                const watchUrl = $(link).attr('href');
                if (watchUrl && watchUrl.includes('/watch/')) {
                    const eplText = $(link).find('.epl-num').text().trim();
                    const epMatch = eplText.match(/Epizoda\s*(\d+)/i);
                    const episodeNum = epMatch ? parseInt(epMatch[1]) : (eIdx + 1);

                    episodes.push({
                        id: `crtace:${watchUrl.replace('https://gledajcrtace.org/', '')}`,
                        title: `S${seasonNum.toString().padStart(2,'0')}E${episodeNum.toString().padStart(2,'0')}`,
                        released: new Date().toISOString()
                    });
                }
            });
        });
    } catch (err) {
        logger.error(`[Meta] Series error: ${err.message}`);
    }

    if (episodes.length === 0) {
        episodes.push({ id: `${id}-s01e01`, title: 'S01E01', released: new Date().toISOString() });
    }

    return {
        meta: {
            id,
            type: 'series',
            name,
            poster: poster || 'https://via.placeholder.com/300x450?text=Serija',
            background: poster,
            description: 'Sinhronizovana crtana serija.',
            episodes: episodes
        }
    };
});

builder.defineStreamHandler(async (args) => {
    const id = args.id;
    logger.info(`[Stream] Episode request: ${id}`);

    // Fix: Make sure we always pass a full URL
    let watchUrl = id;
    if (id.startsWith('crtace:')) {
        watchUrl = `https://gledajcrtace.org/${id.replace('crtace:', '')}`;
    }

    logger.info(`[Stream] Using watch URL: ${watchUrl}`);

    try {
        // Correct call - pass only the type and url
        const streams = await runExtractor(watchUrl);
        return { streams: streams || [] };
    } catch (err) {
        logger.error(`[Stream] Error: ${err.message}`);
        return { streams: [] };
    }
});

function cleanTitleForPoster(rawName) {
    return rawName
        .replace(/\(.*?\)/g, '')
        .replace(/\b(HR|SR|HRV|SRB|sinhronizovano|sa prevodom)\b/gi, '')
        .replace(/[^\w\s]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

// Start server
serveHTTP(builder.getInterface(), { 
    port: PORT, 
    hostname: "0.0.0.0" 
});

logger.info(`✅ Gledaj Crtace Addon v3.4.2 started on Render`);
