/**
 * @file scripts/generate-og-pages.mjs
 * @version 1.0.0
 * Post-build script for GitHub Pages that reads public/songs.db and generates
 * static HTML entry points with Open Graph / Twitter Card meta tags for:
 *   - /song/<content_hash>/index.html
 *   - /metronome/index.html
 *   - /tuner/index.html
 *   - /settings/index.html
 * This ensures HTTP 200 OK responses and rich preview cards in Telegram & WhatsApp.
 */
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

export const __version__ = '1.0.0';

const SITE_ORIGIN = 'https://app.smallhotelroom.com';
const SITE_NAME = 'Small Hotel Room';
const DIST_DIR = path.resolve('dist');
const DB_PATH = path.resolve('public/songs.db');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function injectMetaTags(templateHtml, { title, description, url, imageUrl = null }) {
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeUrl = escapeHtml(url);

    const ogBlock = [
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
        `<meta property="og:title" content="${safeTitle}" />`,
        `<meta property="og:description" content="${safeDesc}" />`,
        `<meta property="og:url" content="${safeUrl}" />`,
        imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : null,
        `<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />`,
        `<meta name="twitter:title" content="${safeTitle}" />`,
        `<meta name="twitter:description" content="${safeDesc}" />`,
        imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : null,
    ]
        .filter(Boolean)
        .join('\n    ');

    let html = templateHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
    if (html.includes('</head>')) {
        html = html.replace('</head>', `    ${ogBlock}\n  </head>`);
    }
    return html;
}

function writePage(relativeDir, html) {
    const outDir = path.join(DIST_DIR, relativeDir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
}

function detectOgImageUrl() {
    const candidates = ['og-image.png', 'og-image.jpg', 'icon-512.png', 'favicon.png'];
    for (const file of candidates) {
        if (fs.existsSync(path.join(DIST_DIR, file))) {
            return `${SITE_ORIGIN}/${file}`;
        }
    }
    return null;
}

async function main() {
    if (!fs.existsSync(INDEX_HTML_PATH)) {
        throw new Error(`Missing ${INDEX_HTML_PATH}. Run "npm run build" first.`);
    }
    if (!fs.existsSync(DB_PATH)) {
        throw new Error(`Missing ${DB_PATH}. Run "npm run db:build" first.`);
    }

    const templateHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const ogImageUrl = detectOgImageUrl();

    // 1. Static tool routes
    const staticRoutes = [
        {
            dir: 'metronome',
            title: `Metronome - ${SITE_NAME}`,
            description: 'Interactive visual and audio metronome with subdivisions and tap tempo.',
            url: `${SITE_ORIGIN}/metronome`,
        },
        {
            dir: 'tuner',
            title: `Tuner - ${SITE_NAME}`,
            description: 'Chromatic instrument tuner right in your browser or app.',
            url: `${SITE_ORIGIN}/tuner`,
        },
        {
            dir: 'settings',
            title: `Settings - ${SITE_NAME}`,
            description: 'Configure themes, transposition, and songbook databases.',
            url: `${SITE_ORIGIN}/settings`,
        },
    ];

    for (const route of staticRoutes) {
        writePage(route.dir, injectMetaTags(templateHtml, { ...route, imageUrl: ogImageUrl }));
    }

    // 2. Per-song routes from public/songs.db
    const SQL = await initSqlJs();
    const dbBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(dbBuffer);

    let rows = [];
    try {
        // Prefer joining band name if the bands table/column exists
        const stmt = db.prepare(`
            SELECT s.content_hash, s.name, s.album, b.name AS band_name
            FROM songs s
            LEFT JOIN bands b ON b.id = s.band_id
            WHERE s.content_hash IS NOT NULL AND TRIM(s.content_hash) != ''
        `);
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
    } catch {
        // Fallback if schema differs
        const stmt = db.prepare(`
            SELECT content_hash, name, album
            FROM songs
            WHERE content_hash IS NOT NULL AND TRIM(content_hash) != ''
        `);
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
    } finally {
        db.close();
    }

    let songCount = 0;
    for (const row of rows) {
        const hash = String(row.content_hash).trim();
        if (!hash) continue;

        const songName = row.name ? String(row.name).trim() : 'Song';
        const bandName = row.band_name ? String(row.band_name).trim() : '';
        const title = bandName ? `${songName} - ${bandName}` : `${songName} - ${SITE_NAME}`;
        const description = bandName
            ? `Chords and lyrics for ${songName} by ${bandName} on ${SITE_NAME}.`
            : `Chords and lyrics for ${songName} on ${SITE_NAME}.`;

        const html = injectMetaTags(templateHtml, {
            title,
            description,
            url: `${SITE_ORIGIN}/song/${encodeURIComponent(hash)}`,
            imageUrl: ogImageUrl,
        });

        writePage(path.join('song', hash), html);
        songCount += 1;
    }

    console.log(
        `[generate-og-pages] Generated ${songCount} song pages and ${staticRoutes.length} static route pages.`
    );
}

main().catch((err) => {
    console.error('[generate-og-pages] Failed:', err);
    process.exit(1);
});
