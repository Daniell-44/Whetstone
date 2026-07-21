// Parses a briefing markdown file → BriefingArticle. See
// Briefing_Authoring_Format_v1.md. Flat front-matter (no nested YAML, so no
// dependency needed), a `::sources` pipe-table, and `::` block markers in the
// body. Plain paragraphs between markers become `prose` blocks.

import type { BriefingArticle, BriefingBlock, BriefingSource, BriefingPositionSource, BriefingEvidenceSource, PositionAudit } from './types';

// Tolerant number parse — a stray or non-numeric `leaning`/`colour` becomes 0
// (spectrum centre) rather than NaN, which would break the spectrum maths.
function toNum(s: string | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseFrontMatter(fm: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^([A-Za-z][\w]*):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// key=value and key="quoted value"
function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w-]+)=(?:"([^"]*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out[m[1]] = m[2] ?? m[3] ?? '';
  return out;
}

// id | label | publication | url | leaning | side | [assessed]
function parseSources(text: string): BriefingSource[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const p = line.split('|').map((x) => x.trim());
      const flag = (p[6] ?? '').toLowerCase();
      return {
        id:          p[0] ?? '',
        label:       p[1] ?? '',
        publication: p[2] || undefined,
        url:         p[3] ?? '',
        leaning:     toNum(p[4]),
        side:        ((p[5] as BriefingSource['side']) || 'mid'),
        assessed:    flag === 'assessed' || flag === 'true',
      };
    });
}

// v2 (D2 Option A): id | label | publication | url | stance(-2..+2) | confidence(low/med/high)
function parsePositions(text: string): BriefingPositionSource[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const p = line.split('|').map((x) => x.trim());
      const stance = Math.max(-2, Math.min(2, Math.round(toNum(p[4])))) as BriefingPositionSource['stance'];
      const conf = (p[5] ?? '').toLowerCase();
      return {
        id:          p[0] ?? '',
        label:       p[1] ?? '',
        publication: p[2] || undefined,
        url:         p[3] ?? '',
        stance,
        confidence:  (conf === 'low' || conf === 'high' ? conf : 'med') as BriefingPositionSource['confidence'],
      };
    });
}

// v2 (D2 Option A): id | label | publication | url | note
function parseEvidence(text: string): BriefingEvidenceSource[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const p = line.split('|').map((x) => x.trim());
      return {
        id:          p[0] ?? '',
        label:       p[1] ?? '',
        publication: p[2] || undefined,
        url:         p[3] ?? '',
        note:        p[4] ?? '',
      };
    });
}

export function parseBriefingFile(raw: string, slug: string): BriefingArticle {
  const norm = raw.replace(/\r\n/g, '\n');
  const fmMatch = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = parseFrontMatter(fmMatch ? fmMatch[1] : '');
  const body = fmMatch ? fmMatch[2] : norm;

  const lines = body.split('\n');
  let i = 0;
  const blocks: BriefingBlock[] = [];
  let sources: BriefingSource[] = [];
  let positionSources: BriefingPositionSource[] = [];
  let evidenceSources: BriefingEvidenceSource[] = [];
  let proseBuf: string[] = [];

  const flushProse = () => {
    const t = proseBuf.join('\n').trim();
    proseBuf = [];
    for (const para of t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) {
      blocks.push({ type: 'prose', text: para });
    }
  };
  const readUntilMarker = (): string => {
    const buf: string[] = [];
    while (i < lines.length && !/^::/.test(lines[i])) { buf.push(lines[i]); i += 1; }
    return buf.join('\n').trim();
  };
  // Like readUntilMarker but also stops at the first blank line, so a single-
  // paragraph block (landscape, a position paragraph, an audit note) never
  // swallows the connective prose paragraph that follows it.
  const readParagraph = (): string => {
    const buf: string[] = [];
    while (i < lines.length && !/^::/.test(lines[i]) && lines[i].trim() !== '') { buf.push(lines[i]); i += 1; }
    return buf.join('\n').trim();
  };
  const skipBlank = () => { while (i < lines.length && lines[i].trim() === '') i += 1; };

  while (i < lines.length) {
    const line = lines[i];
    const mk = line.match(/^::([\w-]+)\s*(.*)$/);
    if (!mk) { proseBuf.push(line); i += 1; continue; }
    flushProse();
    const name = mk[1];
    const attrs = parseAttrs(mk[2] ?? '');
    i += 1;

    if (name === 'sources') {
      sources = parseSources(readUntilMarker());
    } else if (name === 'positions') {
      positionSources = parsePositions(readUntilMarker());
    } else if (name === 'evidence') {
      evidenceSources = parseEvidence(readUntilMarker());
    } else if (name === 'landscape') {
      blocks.push({ type: 'landscape', text: readParagraph() });
    } else if (name === 'shared') {
      blocks.push({ type: 'shared', text: readParagraph() });
    } else if (name === 'position') {
      const paragraph = readParagraph();
      let audit: PositionAudit = { name: '', kind: 'structural', explanation: '' };
      skipBlank(); // tolerate a blank line between the paragraph and its ::audit
      const am = i < lines.length ? lines[i].match(/^::audit\s*(.*)$/) : null;
      if (am) {
        const a = parseAttrs(am[1] ?? '');
        i += 1;
        audit = { name: a.name ?? '', kind: (a.kind as PositionAudit['kind']) || 'structural', explanation: readParagraph() };
      }
      blocks.push({
        type: 'position',
        colourIndex: toNum(attrs.colour),
        label:       attrs.label ?? '',
        sourceId:    attrs.source ?? '',
        quote:       attrs.quote ?? '',
        paragraph,
        audit,
      });
    } else if (name === 'editor') {
      const text = readParagraph();
      skipBlank();
      let whyWrong: string | undefined;
      if (i < lines.length && /^::why-wrong/.test(lines[i])) { i += 1; whyWrong = readParagraph(); }
      blocks.push({ type: 'editorView', text, ...(whyWrong ? { whyWrong } : {}) });
    } else if (name === 'takes') {
      // source | url | quote | audit   (one curated external take per line)
      const items = readUntilMarker()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const p = line.split('|').map((x) => x.trim());
          return { source: p[0] ?? '', url: p[1] || undefined, quote: p[2] ?? '', audit: p[3] ?? '' };
        });
      if (items.length) blocks.push({ type: 'takes', items });
    } else {
      // unknown marker — skip its body
      readUntilMarker();
    }
  }
  flushProse();

  return {
    slug,
    ...(fm.type === 'explainer' ? { kind: 'explainer' as const } : {}),
    question:      fm.question ?? slug,
    ...(fm.hook ? { hook: fm.hook } : {}),
    ...(fm.category ? { category: fm.category } : {}),
    ...(fm.image ? { image: fm.image } : {}),
    publishedDate: fm.publishedDate ?? new Date().toISOString().slice(0, 10),
    spectrumAxis:  { left: fm.axisLeft ?? '', right: fm.axisRight ?? '' },
    sources,
    ...(positionSources.length ? { positionSources } : {}),
    ...(evidenceSources.length ? { evidenceSources } : {}),
    ...(fm.otherTakes === 'none' ? { otherTakes: 'none' as const } : {}),
    ...(fm.archived === 'true' ? { archived: true as const } : {}),
    blocks,
  };
}

// Surface authoring mistakes as readable warnings (logged at build time by the
// loader). Never throws — a flawed briefing still renders, it just tells you
// what's off so a typo doesn't silently ship a broken page.
export function validateBriefing(b: BriefingArticle): string[] {
  const issues: string[] = [];
  if (!b.question.trim()) issues.push('missing `question` (front-matter)');

  const pos = b.positionSources ?? [];
  const evi = b.evidenceSources ?? [];
  const v2 = pos.length > 0 || evi.length > 0;

  if (b.kind !== 'explainer') {
    if (!b.spectrumAxis.left || !b.spectrumAxis.right) issues.push('missing `axisLeft` / `axisRight`');
    if (b.sources.length === 0 && pos.length === 0) issues.push('no `::positions` (or legacy `::sources`) — the spectrum will be empty');
    // Other-takes policy (D2): absence must be a stated choice.
    const hasTakes = b.blocks.some((bl) => bl.type === 'takes');
    if (!hasTakes && b.otherTakes !== 'none') issues.push('no `::takes` and no `otherTakes: none` front-matter — mark the absence deliberately');
  }

  if (v2 && b.sources.length > 0) issues.push('both `::positions` and legacy `::sources` present — finish the migration (legacy table is ignored by the v2 renderers)');

  const ids = new Set(b.sources.map((s) => s.id));
  for (const s of b.sources) {
    if (!s.id) issues.push('a `::sources` row has no id (first column)');
    if (!['left', 'mid', 'right'].includes(s.side)) issues.push(`source "${s.id}" has side "${s.side}" — use left / mid / right`);
  }

  const posIds = new Set(pos.map((s) => s.id));
  const eviIds = new Set(evi.map((s) => s.id));
  for (const s of pos) {
    if (!s.id) issues.push('a `::positions` row has no id (first column)');
  }
  for (const s of evi) {
    if (!s.id) issues.push('an `::evidence` row has no id (first column)');
    if (!s.note.trim()) issues.push(`evidence "${s.id}" has no note (fifth column) — say how the argument uses it`);
    if (posIds.has(s.id)) issues.push(`id "${s.id}" appears in both ::positions and ::evidence — a source holds one role`);
  }

  // Every plotted position is audited BY DEFINITION under v2: it must be the
  // subject of a ::position block (audit card) or a ::takes item.
  const auditedIds = new Set(
    b.blocks.flatMap((bl) => (bl.type === 'position' && bl.audit.name ? [bl.sourceId] : [])),
  );
  if (v2) {
    for (const s of pos) {
      if (!auditedIds.has(s.id)) issues.push(`plotted position "${s.id}" has no ::position audit card — under the v2 model every plotted point is audited (move it to ::evidence or audit it)`);
    }
  }

  for (const bl of b.blocks) {
    if (bl.type !== 'position') continue;
    const who = bl.label || bl.sourceId || 'unnamed';
    const known = ids.has(bl.sourceId) || posIds.has(bl.sourceId) || eviIds.has(bl.sourceId);
    if (bl.sourceId && !known) issues.push(`position "${who}" → source=${bl.sourceId} matches no ::positions / ::evidence / ::sources id`);
    if (bl.sourceId && eviIds.has(bl.sourceId)) issues.push(`position "${who}" quotes evidence-source "${bl.sourceId}" — if it argues a stance it belongs in ::positions`);
    if (!bl.audit.name.trim()) issues.push(`position "${who}" has no ::audit beneath it`);
  }
  return issues;
}
