// Rasterise the Whetstone mark (light rounded square + warm-dark mark) into
// every PNG size the site + extension need. Run: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here    = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(here, '..');
const extIcons = path.resolve(siteDir, '..', 'extension', 'public', 'icons');
const sitePub  = path.resolve(siteDir, 'public');

// Self-contained icon: light paper square + warm-dark mark. Visible on light
// AND dark toolbars (the light square reads on dark, the dark mark on light).
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#F2EFE8"/>
  <path d="M16 59A34 34 0 0 1 84 59L60 59A10 10 0 0 0 40 59Z" fill="#26241F"/>
  <rect x="14" y="65" width="72" height="10" fill="#26241F"/>
</svg>`;

async function png(size, outFile) {
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(outFile);
  console.log(`  ${size}x${size} -> ${path.relative(path.resolve(siteDir, '..'), outFile)}`);
}

await mkdir(extIcons, { recursive: true });

console.log('Extension toolbar/store icons:');
for (const s of [16, 32, 48, 128]) await png(s, path.join(extIcons, `icon${s}.png`));

console.log('Site icons:');
await png(180, path.join(sitePub, 'apple-touch-icon.png'));
await png(192, path.join(sitePub, 'icon-192.png'));
await png(512, path.join(sitePub, 'icon-512.png'));
await png(32,  path.join(sitePub, 'favicon-32.png'));

console.log('Done.');
