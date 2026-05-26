// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://devils-advocate-site.pages.dev',
  // 'static' output with per-page `export const prerender = false` for on-demand pages.
  // Marketing and static pages stay prerendered; scorecard routes opt out.
  adapter: cloudflare(),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
