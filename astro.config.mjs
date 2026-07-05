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
  integrations: [sitemap(), preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
