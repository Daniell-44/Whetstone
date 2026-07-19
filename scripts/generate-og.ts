/**
 * Per-briefing OG share cards — build-time PNG generation.
 *
 * Reads every briefing .md, renders a 1200x630 Instrument-style card (paper
 * background, mono kicker, graphite instrument rule, Besley serif headline =
 * the briefing question) with satori, rasterises it with resvg, and writes
 * public/og/<slug>.png. Chained into `pnpm build` so the PNGs always exist
 * before `astro build` copies public/ — nothing runs in the Worker.
 *
 * Usage:
 *   pnpm run generate:og            # all briefings
 *   pnpm tsx scripts/generate-og.ts <slug>   # one briefing
 *
 * Brand constraint: NO redline (#CE2B14) on these cards — the redline is
 * reserved for detected findings, and a share card is not a finding.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { parseBriefingFile } from '../functions/_lib/briefing/parse';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BRIEFINGS_DIR = path.join(ROOT, 'src', 'content', 'briefings');
const OUT_DIR = path.join(ROOT, 'public', 'og');

const WIDTH = 1200;
const HEIGHT = 630;

// Instrument palette (hardcoded hexes — standalone render, not Tailwind).
const PAPER = '#F3F4F1';
const INK_STRONG = '#121417';
const MUTED = '#5C6167';

// Satori needs static TTF/OTF/WOFF (the site's variable Besley is woff2-only,
// which satori cannot parse) — hence the static @fontsource packages.
function loadFont(pkgRelPath: string): Buffer {
  const p = path.join(ROOT, 'node_modules', pkgRelPath);
  if (!fs.existsSync(p)) {
    throw new Error(`Font file missing: ${p} — run pnpm install (needs @fontsource/besley + @fontsource/roboto-mono).`);
  }
  return fs.readFileSync(p);
}
const BESLEY_600 = loadFont('@fontsource/besley/files/besley-latin-600-normal.woff');
const MONO_400 = loadFont('@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff');

// Satori's React-less element form: plain { type, props } trees.
type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };
function el(type: string, style: Record<string, unknown>, children?: unknown): Node {
  return { type, props: { style, children } };
}

// Headline size steps down with question length so long questions still sit
// comfortably inside the fixed canvas.
function headlineSize(q: string): number {
  if (q.length <= 55) return 68;
  if (q.length <= 90) return 58;
  if (q.length <= 130) return 48;
  return 42;
}

function card(question: string, kind: 'briefing' | 'explainer', category?: string): Node {
  const kicker = `THE WHETSTONE · ${kind === 'explainer' ? 'EXPLAINER' : 'BRIEFING'}`;

  // The instrument rule: a graphite bar with perpendicular end ticks
  // (the site's .instrument-rule motif), built as a flex row.
  const tick = () => el('div', { width: 4, height: 16, backgroundColor: INK_STRONG, display: 'flex' });
  const rule = el(
    'div',
    { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
    [tick(), el('div', { flexGrow: 1, height: 4, backgroundColor: INK_STRONG, display: 'flex' }), tick()],
  );

  const footerRight = category ? category.toUpperCase() : 'ARGUMENTS, EXAMINED';

  return el(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: PAPER,
      padding: '64px 72px',
      fontFamily: 'Roboto Mono',
    },
    [
      // Kicker + instrument rule
      el('div', { display: 'flex', flexDirection: 'column', width: '100%' }, [
        el('div', { fontSize: 26, letterSpacing: 5, color: MUTED, marginBottom: 26, display: 'flex' }, kicker),
        rule,
      ]),
      // Headline: the briefing question, in the brand display serif
      el(
        'div',
        {
          fontFamily: 'Besley',
          fontWeight: 600,
          fontSize: headlineSize(question),
          lineHeight: 1.18,
          color: INK_STRONG,
          display: 'flex',
          // Belt and braces: never overflow the canvas on an unusually long question.
          lineClamp: 5,
        },
        question,
      ),
      // Footer apparatus line
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '100%',
          fontSize: 22,
          letterSpacing: 3,
          color: MUTED,
        },
        [el('div', { display: 'flex' }, 'thewhetstone.review'), el('div', { display: 'flex' }, footerRight)],
      ),
    ],
  );
}

async function renderCard(question: string, kind: 'briefing' | 'explainer', category?: string): Promise<Buffer> {
  const svg = await satori(card(question, kind, category) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Besley', data: BESLEY_600, weight: 600, style: 'normal' },
      { name: 'Roboto Mono', data: MONO_400, weight: 400, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  return Buffer.from(png);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const files = fs
    .readdirSync(BRIEFINGS_DIR)
    .filter((f) => f.endsWith('.md') && (!arg || f === `${arg}.md`));

  if (files.length === 0) {
    console.error(arg ? `No briefing found for slug "${arg}".` : 'No briefing .md files found.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let failures = 0;
  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(BRIEFINGS_DIR, file), 'utf8');

    // Mirror the site loader (src/lib/briefings.ts): a briefing that does not
    // parse is skipped there too, so it gets no page and needs no card.
    let briefing;
    try {
      briefing = parseBriefingFile(raw, slug);
    } catch (err) {
      console.warn(`og: skipped ${slug} (does not parse; the site loader skips it too):`, err instanceof Error ? err.message : err);
      continue;
    }

    // A render failure is a toolchain problem (font, satori, resvg) and should
    // fail the chained build rather than ship pages pointing at missing PNGs.
    try {
      const png = await renderCard(briefing.question, briefing.kind ?? 'briefing', briefing.category);
      fs.writeFileSync(path.join(OUT_DIR, `${slug}.png`), png);
      console.log(`og: ${slug}.png (${(png.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      failures++;
      console.error(`og: FAILED ${slug} —`, err instanceof Error ? err.message : err);
    }
  }

  if (failures > 0) {
    console.error(`og: ${failures} card(s) failed to render.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
