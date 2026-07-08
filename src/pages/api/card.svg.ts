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

// Instrument brand palette (hardcoded hexes — standalone SVG, not Tailwind).
//   paper  #F3F4F1   cool grey page
//   surface#FBFBF9   card
//   ink    #121417   headings / strong text
//   muted  #5C6167   secondary text
//   hairline #D7D9D3 borders
//   redline #CE2B14  the accent (severity-high)
//   drafting-blue #345D7E  links / interaction / Pro

// Severity colours mapped to site tokens:
//   high   = the redline   #CE2B14
//   medium = oxide amber   #AD6203
//   low    = quiet grey    #6E7370
// `bg`   drives the left severity rail + the mark.
// `pill` / `text` drive the finding chip (squared, mono, bordered).
const SEVERITY_COLOURS: Record<string, { bg: string; bgPale: string; text: string; pill: string; pillBorder: string }> = {
  high:   { bg: '#CE2B14', bgPale: '#F3F4F1', text: '#CE2B14', pill: '#FBFBF9', pillBorder: '#CE2B14' },
  medium: { bg: '#AD6203', bgPale: '#F3F4F1', text: '#AD6203', pill: '#FBFBF9', pillBorder: '#AD6203' },
  low:    { bg: '#6E7370', bgPale: '#F3F4F1', text: '#6E7370', pill: '#FBFBF9', pillBorder: '#6E7370' },
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
  const label    = (url.searchParams.get('label')    ?? 'Logic Finding').slice(0, 80);
  const quote    = url.searchParams.get('quote')    ?? '';
  // Allowlist severity: it is interpolated into the SVG without esc(), so an
  // arbitrary value would be a reflected-XSS / SVG-injection vector (this file
  // is served as image/svg+xml, which executes script when opened directly).
  const severityRaw = (url.searchParams.get('severity') ?? 'medium').toLowerCase();
  const severity    = severityRaw === 'high' || severityRaw === 'low' ? severityRaw : 'medium';
  const source   = url.searchParams.get('source')   ?? '';

  const colour = SEVERITY_COLOURS[severity] ?? SEVERITY_COLOURS.medium!;

  const quoteLines = quote ? wrapText(esc(quote), 38, 5) : [];
  const escLabel   = esc(label);
  const escSource  = esc(source).slice(0, 80);

  // Serif display stack approximates Besley (the brand display face); a true
  // Besley webfont is NOT embedded — this SVG must stay self-contained, so it
  // falls back to system serifs. Apparatus (kickers, chip, footer) uses a
  // monospace system stack in lieu of the brand mono.
  const SERIF = "Besley, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', Times, serif";
  const MONO  = "ui-monospace, 'SFMono-Regular', 'Cascadia Code', Menlo, Consolas, monospace";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${SERIF}">

  <!-- Background (paper) -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${colour.bgPale}"/>

  <!-- Severity rail (left) -->
  <rect x="0" y="0" width="12" height="${HEIGHT}" fill="${colour.bg}"/>

  <!-- Top metadata strip -->
  <text x="64" y="80" font-size="24" font-weight="700" fill="#121417" letter-spacing="3" font-family="${MONO}">THE WHETSTONE</text>
  <text x="64" y="108" font-size="16" fill="#5C6167" font-family="${MONO}" letter-spacing="1">STRUCTURAL LOGIC FINDING</text>

  <!-- Finding chip (squared, mono, bordered) -->
  <rect x="64" y="160" width="${escLabel.length * 14 + 80}" height="48" rx="2" fill="${colour.pill}" stroke="${colour.pillBorder}" stroke-width="1.5"/>
  <text x="${64 + 24}" y="192" font-size="20" font-weight="700" fill="${colour.text}" font-family="${MONO}" letter-spacing="1">
    ${severity.toUpperCase()} · ${escLabel.toUpperCase()}
  </text>

  <!-- Quote -->
  ${quoteLines.length > 0 ? `
  <text x="64" y="290" font-size="18" fill="#5C6167" font-family="${MONO}" letter-spacing="2">VERBATIM QUOTE</text>
  ${quoteLines.map((line, i) => `
    <text x="64" y="${340 + i * 52}" font-size="${quoteLines.length <= 2 ? 44 : quoteLines.length <= 3 ? 38 : 32}" font-style="italic" fill="#121417">"${line}"</text>
  `).join('')}
  ` : ''}

  <!-- Source -->
  ${escSource ? `
  <text x="64" y="${HEIGHT - 80}" font-size="16" fill="#5C6167" font-family="${MONO}">${escSource}</text>
  ` : ''}

  <!-- Footer mark -->
  <text x="64" y="${HEIGHT - 40}" font-size="14" fill="#5C6167" font-family="${MONO}" letter-spacing="2">
    AUDITED BY THE WHETSTONE · thewhetstone.review
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
