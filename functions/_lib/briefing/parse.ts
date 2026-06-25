// Parses a briefing markdown file → BriefingArticle. See
// Briefing_Authoring_Format_v1.md. Flat front-matter (no nested YAML, so no
// dependency needed), a `::sources` pipe-table, and `::` block markers in the
// body. Plain paragraphs between markers become `prose` blocks.

import type { BriefingArticle, BriefingBlock, BriefingSource, PositionAudit } from './types';

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
        leaning:     Number(p[4] ?? 0),
        side:        ((p[5] as BriefingSource['side']) || 'mid'),
        assessed:    flag === 'assessed' || flag === 'true',
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
    } else if (name === 'landscape') {
      blocks.push({ type: 'landscape', text: readUntilMarker() });
    } else if (name === 'shared') {
      blocks.push({ type: 'shared', text: readUntilMarker() });
    } else if (name === 'position') {
      const paragraph = readUntilMarker();
      let audit: PositionAudit = { name: '', kind: 'structural', explanation: '' };
      const am = i < lines.length ? lines[i].match(/^::audit\s*(.*)$/) : null;
      if (am) {
        const a = parseAttrs(am[1] ?? '');
        i += 1;
        audit = { name: a.name ?? '', kind: (a.kind as PositionAudit['kind']) || 'structural', explanation: readUntilMarker() };
      }
      blocks.push({
        type: 'position',
        colourIndex: Number(attrs.colour ?? 0),
        label:       attrs.label ?? '',
        sourceId:    attrs.source ?? '',
        quote:       attrs.quote ?? '',
        paragraph,
        audit,
      });
    } else if (name === 'editor') {
      const text = readUntilMarker();
      let whyWrong: string | undefined;
      if (i < lines.length && /^::why-wrong/.test(lines[i])) { i += 1; whyWrong = readUntilMarker(); }
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
    blocks,
  };
}
