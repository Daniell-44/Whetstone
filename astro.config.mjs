// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://thewhetstone.review',
  // 'static' output with per-page `export const prerender = false` for on-demand pages.
  // Marketing and static pages stay prerendered; scorecard routes opt out.
  adapter: cloudflare(),
  // The Chrome extension was shelved on 2026-08-25 before it ever reached the
  // Web Store. Its two pages are gone; these keep old inbound links working
  // rather than turning months of homepage and audit-result links into 404s.
  redirects: {
    '/extension':         { status: 301, destination: '/audit' },
    '/extension-privacy': { status: 301, destination: '/privacy' },
    // The two satellite rooms folded into /audit on 2026-08-25. Cross-document
    // became an entrance inside Ask (both it and a question produce a
    // briefing); the transcript room was replaced by segment-then-audit in
    // Read, because auditing all twelve segments plus a Pro synthesis cost ten
    // to twenty times an ordinary audit for one click.
    '/creator/studio/cross-document': { status: 301, destination: '/audit?mode=question&ask=documents' },
    '/creator/studio/transcript':     { status: 301, destination: '/audit' },
  },
  integrations: [sitemap(), preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
