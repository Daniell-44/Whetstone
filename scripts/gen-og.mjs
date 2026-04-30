// Generates public/og-image.png (1200×630) for Open Graph / Twitter cards.
// Uses Sharp's SVG rasterisation — no design libraries.
// Run: node scripts/gen-og.mjs (from site root)

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dir, '..', 'public', 'og-image.png');

const W = 1200;
const H = 630;

// Colours (match site palette)
const BG       = '#f9fafb'; // near-white (gray-50)
const INDIGO   = '#4f46e5'; // indigo-600
const DARK     = '#111827'; // gray-900
const MUTED    = '#6b7280'; // gray-500

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}" />

  <!-- Indigo accent rule -->
  <rect x="80" y="248" width="72" height="4" rx="2" fill="${INDIGO}" />

  <!-- Wordmark — serif approximated via font-family fallback list -->
  <text
    x="80" y="340"
    font-family="'Iowan Old Style', 'Apple Garamond', Baskerville, 'Times New Roman', Georgia, serif"
    font-size="88"
    font-weight="400"
    fill="${DARK}"
    letter-spacing="-1"
  >The Whetstone.</text>

  <!-- Subline — sans -->
  <text
    x="83" y="400"
    font-family="'Segoe UI', system-ui, -apple-system, sans-serif"
    font-size="32"
    font-weight="400"
    fill="${MUTED}"
    letter-spacing="0.5"
  >Devil&#x2019;s Advocate · Chrome extension</text>

  <!-- Faint whetstone mark, bottom-right -->
  <path d="M1040 580 L1160 565 L1160 550 L1040 535 Z" fill="${INDIGO}" opacity="0.12" />
</svg>
`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(outPath);

console.log(`og-image.png written → ${outPath}`);
