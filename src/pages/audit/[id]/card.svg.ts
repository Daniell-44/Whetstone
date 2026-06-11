export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuditLink } from '../../../../functions/_lib/audit-links/storage';

const WIDTH  = 1200;
const HEIGHT = 675;

const SEVERITY = {
  high:   { bg: '#dc2626', bgPale: '#fef2f2', text: '#991b1b', pill: '#fecaca' },
  medium: { bg: '#f59e0b', bgPale: '#fffbeb', text: '#92400e', pill: '#fde68a' },
  low:    { bg: '#6b7280', bgPale: '#f9fafb', text: '#374151', pill: '#e5e7eb' },
} as const;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

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

export async function GET({ params }: APIContext) {
  const { id } = params;
  if (!id || !env.AUDIT_LINKS) return new Response('Not Found', { status: 404 });

  const stored = await getAuditLink(env.AUDIT_LINKS, id);
  if (!stored) return new Response('Not Found', { status: 404 });

  // Find the most prominent finding for the card
  const fallacies = stored.audit.namedFallacies;
  const loaded    = stored.audit.loadedLanguage;
  // All audit findings are structural (verifiable in quoted text). Sort by
  // severity only — no secondary confidence tiebreaker now that confidence
  // is no longer a user-facing signal.
  const allFindings = [
    ...fallacies.map(f => ({ label: f.name, quote: f.quote, severity: f.severity })),
    ...loaded.map(l => ({ label: l.technique, quote: l.phrase, severity: l.severity })),
  ];

  const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  allFindings.sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3));

  const top = allFindings[0];

  // Compose card
  const severity = top?.severity ?? 'low';
  const colour   = SEVERITY[severity] ?? SEVERITY.low;
  const label    = top ? esc(top.label) : esc(stored.draftTitle ?? 'Audit summary');
  const quoteLines = top ? wrapText(esc(top.quote), 38, 4) : wrapText(esc(stored.draftSnippet || stored.audit.centralClaim), 50, 4);
  const subline  = stored.draftTitle ? esc(stored.draftTitle) : `audited ${new Date(stored.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const findingCount =
    stored.audit.namedFallacies.length +
    stored.audit.loadedLanguage.length +
    stored.audit.toulmin.unstatedWarrants.length +
    stored.audit.keyTermScrutiny.length +
    stored.audit.referentChecks.length +
    stored.audit.falsifiabilityChecks.length +
    stored.audit.modalScopeChecks.length;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Iowan Old Style, Apple Garamond, Baskerville, 'Times New Roman', Times, serif">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${colour.bgPale}"/>
  <rect x="0" y="0" width="12" height="${HEIGHT}" fill="${colour.bg}"/>

  <text x="64" y="80" font-size="24" font-weight="700" fill="#1f2937" letter-spacing="3" font-family="ui-sans-serif, system-ui, sans-serif">THE WHETSTONE</text>
  <text x="64" y="108" font-size="16" fill="#6b7280" font-family="ui-sans-serif, system-ui, sans-serif">${top ? 'Top finding from a shared audit' : 'Shared audit'}</text>

  ${top ? `
  <rect x="64" y="160" width="${label.length * 14 + 80}" height="48" rx="24" fill="${colour.pill}"/>
  <text x="${64 + 24}" y="192" font-size="20" font-weight="700" fill="${colour.text}" font-family="ui-sans-serif, system-ui, sans-serif" letter-spacing="1">
    ${severity.toUpperCase()} · ${label.toUpperCase()}
  </text>
  ` : ''}

  ${quoteLines.length > 0 ? `
  <text x="64" y="280" font-size="20" fill="#9ca3af" font-family="ui-sans-serif, system-ui, sans-serif">${top ? 'VERBATIM QUOTE' : 'CENTRAL CLAIM'}</text>
  ${quoteLines.map((line, i) => `
    <text x="64" y="${330 + i * 56}" font-size="${quoteLines.length <= 2 ? 44 : quoteLines.length <= 3 ? 38 : 32}" font-style="italic" fill="#111827">"${line}"</text>
  `).join('')}
  ` : ''}

  <text x="64" y="${HEIGHT - 92}" font-size="16" fill="#6b7280" font-family="ui-sans-serif, system-ui, sans-serif">${subline}</text>
  <text x="64" y="${HEIGHT - 64}" font-size="14" fill="#9ca3af" font-family="ui-sans-serif, system-ui, sans-serif">${findingCount} total finding${findingCount !== 1 ? 's' : ''} in this audit</text>
  <text x="64" y="${HEIGHT - 32}" font-size="14" fill="#9ca3af" font-family="ui-sans-serif, system-ui, sans-serif" letter-spacing="2">VIEW: WHETSTONE.SO/AUDIT/${id.toUpperCase()}</text>

  <g transform="translate(${WIDTH - 140}, 60) scale(1.2)">
    <path d="M2 32 L78 22 L78 14 L2 4 Z" fill="${colour.bg}" opacity="0.2"/>
  </g>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type':  'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
