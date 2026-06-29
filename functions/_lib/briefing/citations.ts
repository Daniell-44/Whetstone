import type { BriefingArticle, BriefingSource } from './types';

// Citation export for briefings — BibTeX + RIS, generated from the briefing's
// question, date, and sources. Mirrors the scorecard citation module; used by
// /briefing/<slug>/citations.bib | .ris and the briefing share rail.

function escapeBibtex(s: string): string {
  return s.replace(/([{}\\&%$#_])/g, '\\$1');
}

function bibKey(s: BriefingSource, i: number): string {
  const t = (s.label || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase();
  const p = (s.publication || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
  return `${p}_${t}_${i + 1}`;
}

function dek(b: BriefingArticle): string {
  const l = b.blocks.find((bl) => bl.type === 'landscape');
  return l && 'text' in l ? l.text : '';
}

export function toBibtex(b: BriefingArticle): string {
  const year  = b.publishedDate.slice(0, 4);
  const month = b.publishedDate.slice(5, 7);
  const entries: string[] = [];

  entries.push(`@misc{whetstone_${b.slug.replace(/-/g, '_')},
  author       = {{The Whetstone}},
  title        = {${escapeBibtex(b.question)}},
  howpublished = {Briefing, The Whetstone},
  year         = {${year}},
  month        = {${month}},
  url          = {https://thewhetstone.net/briefing/${b.slug}},
  note         = {${escapeBibtex(dek(b))}}
}`);

  b.sources.forEach((s, i) => {
    entries.push(`@misc{${bibKey(s, i)},
  author       = {},
  title        = {${escapeBibtex(s.label)}},
  howpublished = {${escapeBibtex(s.publication ?? '')}},
  url          = {${s.url}},
  note         = {Cited in Whetstone briefing "${escapeBibtex(b.question)}"}
}`);
  });

  return entries.join('\n\n') + '\n';
}

export function toRis(b: BriefingArticle): string {
  const year = b.publishedDate.slice(0, 4);
  const entries: string[] = [];

  entries.push([
    'TY  - ELEC',
    'AU  - The Whetstone',
    `TI  - ${b.question}`,
    'PB  - The Whetstone (Briefing)',
    `PY  - ${year}`,
    `UR  - https://thewhetstone.net/briefing/${b.slug}`,
    `N1  - ${dek(b)}`,
    'ER  - ',
  ].join('\n'));

  b.sources.forEach((s) => {
    entries.push([
      'TY  - ELEC',
      `TI  - ${s.label}`,
      `PB  - ${s.publication ?? ''}`,
      `UR  - ${s.url}`,
      `N1  - Cited in Whetstone briefing "${b.question}"`,
      'ER  - ',
    ].join('\n'));
  });

  return entries.join('\n\n') + '\n';
}
