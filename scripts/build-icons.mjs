#!/usr/bin/env node
/**
 * @file scripts/build-icons.mjs
 * @version 2.0.0
 * Generates Web (public/favicon.svg), Google Play 512x512 icon (public/playstore-icon-512.png),
 * Android (mipmap-*), and Tauri Desktop (src-tauri/icons/*) icons from shr-logo.svg.
 * Bakes in the calibrated optical defaults (zoom=1.06, dx=-3.5, dy=-1 on anchor 138.5, 148.0).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const __version__ = '2.0.0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const CANDIDATE_LOGO_PATHS = [
    path.join(ROOT_DIR, 'src', 'assets', 'shr-logo.svg'),
    path.join(ROOT_DIR, 'shr-logo.svg'),
    path.join(ROOT_DIR, 'public', 'shr-logo.svg'),
];

const MIPMAP_TARGETS = [
    { folder: 'mipmap-mdpi', legacySize: 48, adaptiveSize: 108 },
    { folder: 'mipmap-hdpi', legacySize: 72, adaptiveSize: 162 },
    { folder: 'mipmap-xhdpi', legacySize: 96, adaptiveSize: 216 },
    { folder: 'mipmap-xxhdpi', legacySize: 144, adaptiveSize: 324 },
    { folder: 'mipmap-xxxhdpi', legacySize: 192, adaptiveSize: 432 },
];

// Calibrated optical defaults (--zoom=1.06 --dx=-3.5 --dy=-1)
const DEFAULT_ANCHOR_X = 138.5;
const DEFAULT_ANCHOR_Y = 148.0;
const DEFAULT_ZOOM_MULTIPLIER = 1.06;
const DEFAULT_EXTRA_DX = -3.5;
const DEFAULT_EXTRA_DY = -1.0;

function findSourceSvg() {
    const argPath = process.argv.slice(2).find((a) => !a.startsWith('-'));
    if (argPath) {
        const resolved = path.resolve(ROOT_DIR, argPath);
        if (fs.existsSync(resolved)) return resolved;
    }
    for (const p of CANDIDATE_LOGO_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(
        `Could not find 'shr-logo.svg'. Place it in src/assets/shr-logo.svg or repo root.`
    );
}

function buildPaddedSvg(
    rawSvg,
    {
        scaleRatio = 0.86,
        circleClip = false,
        anchorX = DEFAULT_ANCHOR_X,
        anchorY = DEFAULT_ANCHOR_Y,
        extraDx = DEFAULT_EXTRA_DX,
        extraDy = DEFAULT_EXTRA_DY,
    } = {}
) {
    const viewBoxMatch = rawSvg.match(
        /viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i
    );
    const widthMatch = rawSvg.match(/\bwidth=["']([\d.]+)/i);
    const heightMatch = rawSvg.match(/\bheight=["']([\d.]+)/i);

    const vbW = viewBoxMatch
        ? parseFloat(viewBoxMatch[3])
        : widthMatch
          ? parseFloat(widthMatch[1])
          : 300;
    const vbH = viewBoxMatch
        ? parseFloat(viewBoxMatch[4])
        : heightMatch
          ? parseFloat(heightMatch[1])
          : 300;

    let inner = rawSvg
        .replace(/<\?xml[^>]*\?>/gi, '')
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/^[\s\S]*?<svg[^>]*>/i, '')
        .replace(/<\/svg>[\s\S]*$/i, '')
        .replace(/<sodipodi:[^>]*\/>/gi, '')
        .replace(/<sodipodi:[\s\S]*?<\/sodipodi:[^>]+>/gi, '')
        .replace(/<inkscape:[^>]*\/>/gi, '')
        .replace(/<inkscape:[\s\S]*?<\/inkscape:[^>]+>/gi, '')
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
        .replace(/<defs[\s\S]*?<\/defs>/gi, '')
        .replace(/<flowRoot[\s\S]*?<\/flowRoot>/gi, '')
        .replace(/<rect[^>]*id=["']rect3875["'][^>]*\/>/gi, '')
        .replace(/fill:#000000/gi, 'fill:#ffffff')
        .replace(/filter:url\([^)]+\);?/gi, '')
        .replace(/\s+(?:sodipodi|inkscape):[a-zA-Z0-9_-]+="[^"]*"/gi, '');

    const offsetX = vbW / 2 - anchorX * scaleRatio + extraDx;
    const offsetY = vbH / 2 - anchorY * scaleRatio + extraDy;

    const clipDef = circleClip
        ? `<defs><clipPath id="roundClip"><circle cx="${vbW / 2}" cy="${vbH / 2}" r="${Math.min(vbW, vbH) / 2}" /></clipPath></defs>`
        : '';
    const clipAttr = circleClip ? ' clip-path="url(#roundClip)"' : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  ${clipDef}
  <g${clipAttr}>
    <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#000000" />
    <g transform="translate(${offsetX.toFixed(3)}, ${offsetY.toFixed(3)}) scale(${scaleRatio.toFixed(4)})" fill="#ffffff">
      ${inner}
    </g>
  </g>
</svg>`;
}

function hasCommand(cmd) {
    const res = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    return !res.error && res.status === 0;
}

async function renderSvgToPng(svgString, outPngPath, sizePx) {
    fs.mkdirSync(path.dirname(outPngPath), { recursive: true });
    const tmpSvg = path.join(os.tmpdir(), `shr-icon-${process.pid}.svg`);
    fs.writeFileSync(tmpSvg, svgString, 'utf8');

    try {
        if (hasCommand('rsvg-convert')) {
            const res = spawnSync(
                'rsvg-convert',
                ['-w', String(sizePx), '-h', String(sizePx), tmpSvg, '-o', outPngPath],
                { stdio: 'inherit' }
            );
            if (res.status === 0) return;
        }
        if (hasCommand('inkscape')) {
            const res = spawnSync(
                'inkscape',
                [
                    tmpSvg,
                    `--export-width=${sizePx}`,
                    `--export-height=${sizePx}`,
                    `--export-filename=${outPngPath}`,
                ],
                { stdio: 'ignore' }
            );
            if (res.status === 0) return;
        }
        for (const magickCmd of ['magick', 'convert']) {
            if (hasCommand(magickCmd)) {
                const res = spawnSync(
                    magickCmd,
                    [
                        '-background',
                        'none',
                        '-resize',
                        `${sizePx}x${sizePx}`,
                        tmpSvg,
                        outPngPath,
                    ],
                    { stdio: 'inherit' }
                );
                if (res.status === 0) return;
            }
        }
        throw new Error(
            `No SVG->PNG rasterizer succeeded. Ensure librsvg2-bin (rsvg-convert) is installed.`
        );
    } finally {
        if (fs.existsSync(tmpSvg)) {
            fs.unlinkSync(tmpSvg);
        }
    }
}

async function main() {
    const srcSvgPath = findSourceSvg();
    const rawSvg = fs.readFileSync(srcSvgPath, 'utf8');

    const zoomArg = process.argv.find((a) => a.startsWith('--zoom='));
    const dxArg = process.argv.find((a) => a.startsWith('--dx='));
    const dyArg = process.argv.find((a) => a.startsWith('--dy='));
    const zoomMult = zoomArg
        ? parseFloat(zoomArg.slice(7))
        : DEFAULT_ZOOM_MULTIPLIER;
    const extraDx = dxArg ? parseFloat(dxArg.slice(5)) : DEFAULT_EXTRA_DX;
    const extraDy = dyArg ? parseFloat(dyArg.slice(5)) : DEFAULT_EXTRA_DY;

    const shiftRightPx = 150 - DEFAULT_ANCHOR_X + extraDx;
    const shiftDownPx = 150 - DEFAULT_ANCHOR_Y + extraDy;

    console.log(
        `🎨 Using source logo: ${srcSvgPath}\n` +
            `   Visual anchor in 300x300 source: (${DEFAULT_ANCHOR_X}, ${DEFAULT_ANCHOR_Y})\n` +
            `   Extra offset:                    dx=${extraDx}px, dy=${extraDy}px, zoom=${zoomMult}x\n` +
            `   Net shift (at 1.0x):             +${shiftRightPx.toFixed(1)}px right, +${shiftDownPx.toFixed(1)}px down\n` +
            `   Scales: Web=${(0.90 * zoomMult).toFixed(3)}, LegacySquare=${(0.86 * zoomMult).toFixed(3)}, AdaptiveForeground=${(0.63 * zoomMult).toFixed(3)}`
    );

    // 1. Write web favicon.svg
    const webFaviconSvg = buildPaddedSvg(rawSvg, {
        scaleRatio: 0.9 * zoomMult,
        circleClip: false,
        extraDx,
        extraDy,
    });
    const publicFaviconPath = path.join(ROOT_DIR, 'public', 'favicon.svg');
    fs.writeFileSync(publicFaviconPath, webFaviconSvg, 'utf8');
    console.log(`✅ Updated centered web favicon: public/favicon.svg`);

    // 1b. Write 512x512 Google Play Store Icon (public/playstore-icon-512.png)
    const playStoreSvg = buildPaddedSvg(rawSvg, {
        scaleRatio: 0.86 * zoomMult,
        circleClip: false,
        extraDx,
        extraDy,
    });
    const playStoreIconPath = path.join(ROOT_DIR, 'public', 'playstore-icon-512.png');
    await renderSvgToPng(playStoreSvg, playStoreIconPath, 512);
    console.log(`✅ Generated Google Play Store 512x512 icon: public/playstore-icon-512.png`);

    // 2. Prepare Android SVG variants
    const legacySquareSvg = playStoreSvg;
    const legacyRoundSvg = buildPaddedSvg(rawSvg, {
        scaleRatio: 0.82 * zoomMult,
        circleClip: true,
        extraDx,
        extraDy,
    });
    const adaptiveForegroundSvg = buildPaddedSvg(rawSvg, {
        scaleRatio: 0.63 * zoomMult,
        circleClip: false,
        extraDx,
        extraDy,
    });

    const androidResDir = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');
    if (fs.existsSync(androidResDir)) {
        const bgXmlPath = path.join(androidResDir, 'values', 'ic_launcher_background.xml');
        fs.mkdirSync(path.dirname(bgXmlPath), { recursive: true });
        fs.writeFileSync(
            bgXmlPath,
            `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n`,
            'utf8'
        );

        const anyDpiDir = path.join(androidResDir, 'mipmap-anydpi-v26');
        fs.mkdirSync(anyDpiDir, { recursive: true });
        const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
        fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
        fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

        for (const target of MIPMAP_TARGETS) {
            const mipmapDir = path.join(androidResDir, target.folder);
            fs.mkdirSync(mipmapDir, { recursive: true });

            await renderSvgToPng(
                legacySquareSvg,
                path.join(mipmapDir, 'ic_launcher.png'),
                target.legacySize
            );
            await renderSvgToPng(
                legacyRoundSvg,
                path.join(mipmapDir, 'ic_launcher_round.png'),
                target.legacySize
            );
            await renderSvgToPng(
                adaptiveForegroundSvg,
                path.join(mipmapDir, 'ic_launcher_foreground.png'),
                target.adaptiveSize
            );
            console.log(
                `✅ Generated ${target.folder} (legacy: ${target.legacySize}px, adaptive foreground: ${target.adaptiveSize}px)`
            );
        }
    }

    // 3. If src-tauri/ exists, generate desktop .ico / .icns / .png icons in src-tauri/icons/
    const tauriDir = path.join(ROOT_DIR, 'src-tauri');
    if (fs.existsSync(tauriDir)) {
        const masterPng = path.join(os.tmpdir(), `shr-master-1024-${process.pid}.png`);
        await renderSvgToPng(legacySquareSvg, masterPng, 1024);
        const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const res = spawnSync(npxCmd, ['tauri', 'icon', masterPng], {
            cwd: ROOT_DIR,
            stdio: 'inherit',
        });
        if (fs.existsSync(masterPng)) {
            fs.unlinkSync(masterPng);
        }
        if (res.status === 0) {
            console.log(`✅ Generated Tauri desktop icons (.ico, .icns, .png) in src-tauri/icons/`);
        }
    }

    console.log(`🎉 All Android, Web, Play Store & Desktop icons centered & scaled!`);
}

main().catch((err) => {
    console.error('❌ Icon build failed:', err.message || err);
    process.exit(1);
});
