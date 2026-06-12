export const prerender = false;

import type { APIRoute } from 'astro';

// Shareable claim card - dynamic SVG generator.
// Used by social-share buttons and the embeddable image format.
//
// URL params:
//   ?label=<finding label>      e.g. "False Dichotomy"
//   &quote=<verbatim quote>     e.g. "convenience over human life"
//   &severity=high|medium|low
//   &source=<scorecard or audit URL>
//
// Returns an SVG at 1200×675 (standard OG / Twitter card dimensions).
// Cached aggressively (immutable for 1 year on canonical URLs).

const WIDTH  = 1200;
const HEIGHT = 675;

const SEVERITY_COLOURS: Record<string, { bg: string; bgPale: string; text: string; pill: string }> = {
  high:   { bg: '#dc2626', bgPale: '#fef2f2', text: '#991b1b', pill: '#fecaca' },
  medium: { bg: '#f59e0b', bgPale: '#fffbeb', text: '#92400e', pill: '#fde68a' },
  low:    { bg: '#6b7280', bgPale: '#f9fafb', text: '#374151', pill: '#e5e7eb' },
};

// ---------------------------------------------------------------------------
// SVG-safe text escape - < > & " ' protection only.
// ---------------------------------------------------------------------------
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Word-wrap helper for SVG text - splits a long quote into multiple <tspan>
// lines fitting within `maxCharsPerLine`.
// ---------------------------------------------------------------------------
function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxCharsPerLine) {
      lines.push(current.trim());
      current = w;
      if (lines.length >= maxLines - 1) {
        lines.push((current + ' ' + words.slice(words.indexOf(w) + 1).join(' ')).trim().slice(0, maxCharsPerLine - 1) + '…');
        return lines;
      }
    } else {
      current += ' ' + w;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

// ---------------------------------------------------------------------------
// GET - render the card
// ---------------------------------------------------------------------------
export const GET: APIRoute = async ({ url }) => {
  const label    = url.searchParams.get('label')    ?? 'Logic Finding';
  const quote    = url.searchParams.get('quote')    ?? '';
  const severity = (url.searchParams.get('severity') ?? 'medium').toLowerCase();
  const source   = url.searchParams.get('source')   ?? '';

  const colour = SEVERITY_COLOURS[severity] ?? SEVERITY_COLOURS.medium!;

  const quoteLines = quote ? wrapText(esc(quote), 38, 5) : [];
  const escLabel   = esc(label);
  const escSource  = esc(source).slice(0, 80);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Iowan Old Style, Apple Garamond, Baskerville, 'Times New Roman', Times, serif">

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${colour.bgPale}"/>

  <!-- Severity bar (left) -->
  <rect x="0" y="0" width="12" height="${HEIGHT}" fill="${colour.bg}"/>

  <!-- Top metadata strip -->
  <text x="64" y="80" font-size="24" font-weight="700" fill="#1f2937" letter-spacing="3" font-family="ui-sans-serif, system-ui, sans-serif">THE WHETSTONE</text>
  <text x="64" y="108" font-size="16" fill="#6b7280" font-family="ui-sans-serif, system-ui, sans-serif">Structural logic finding</text>

  <!-- Severity pill -->
  <rect x="64" y="160" width="${escLabel.length * 14 + 80}" height="48" rx="24" fill="${colour.pill}"/>
  <text x="${64 + 24}" y="192" font-size="20" font-weight="700" fill="${colour.text}" font-family="ui-sans-serif, system-ui, sans-serif" letter-spacing="1">
    ${severity.toUpperCase()} · ${escLabel.toUpperCase()}
  </text>

  <!-- Quote -->
  ${quoteLines.length > 0 ? `
  <text x="64" y="290" font-size="20" fill="#9ca3af" font-family="ui-sans-serif, system-ui, sans-serif">VERBATIM QUOTE</text>
  ${quoteLines.map((line, i) => `
    <text x="64" y="${340 + i * 52}" font-size="${quoteLines.length <= 2 ? 44 : quoteLines.length <= 3 ? 38 : 32}" font-style="italic" fill="#111827">"${line}"</text>
  `).join('')}
  ` : ''}

  <!-- Source -->
  ${escSource ? `
  <text x="64" y="${HEIGHT - 80}" font-size="16" fill="#6b7280" font-family="ui-sans-serif, system-ui, sans-serif">${escSource}</text>
  ` : ''}

  <!-- Footer mark -->
  <text x="64" y="${HEIGHT - 40}" font-size="14" fill="#9ca3af" font-family="ui-sans-serif, system-ui, sans-serif" letter-spacing="2">
    AUDITED BY THE WHETSTONE · WHETSTONE.SO
  </text>

  <!-- Decorative whetstone mark (top right) -->
  <g transform="translate(${WIDTH - 140}, 60) scale(1.2)">
    <path d="M2 32 L78 22 L78 14 L2 4 Z" fill="${colour.bg}" opacity="0.2"/>
  </g>

</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type':  'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
};
