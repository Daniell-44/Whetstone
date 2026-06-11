import type { Scorecard, ScorecardSource } from './types';

// ---------------------------------------------------------------------------
// Citation export — BibTeX, RIS, and APA/MLA plain text
//
// Generates standard bibliographic formats from a scorecard's sources.
// Used by /scorecard/<slug>/citations.bib | .ris endpoints and the share UI.
// ---------------------------------------------------------------------------

function bibtexKey(source: ScorecardSource, index: number): string {
  const cleanTitle = source.title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const cleanPub   = source.publication.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `${cleanPub.toLowerCase()}_${cleanTitle.toLowerCase()}_${index + 1}`;
}

function escapeBibtex(s: string): string {
  return s.replace(/([{}\\&%$#_])/g, '\\$1');
}

// ---------------------------------------------------------------------------
// BibTeX — academic standard, used by LaTeX, Zotero, Mendeley
// ---------------------------------------------------------------------------

export function toBibtex(scorecard: Scorecard): string {
  const sources = collectSources(scorecard);
  const year    = scorecard.publishedDate.slice(0, 4);

  const entries: string[] = [];

  // Scorecard itself as a misc entry
  entries.push(`@misc{whetstone_${scorecard.slug.replace(/-/g, '_')},
  author       = {{The Whetstone}},
  title        = {${escapeBibtex(scorecard.question)}},
  howpublished = {Logic Scorecard, The Whetstone},
  year         = {${year}},
  month        = {${scorecard.publishedDate.slice(5, 7)}},
  url          = {https://thewhetstone.net/scorecard/${scorecard.slug}},
  note         = {${escapeBibtex(scorecard.dek)}}
}`);

  // Each cited source
  sources.forEach((source, i) => {
    const key = bibtexKey(source, i);
    entries.push(`@misc{${key},
  author       = {},
  title        = {${escapeBibtex(source.title)}},
  howpublished = {${escapeBibtex(source.publication)}},
  url          = {${source.url}},
  note         = {Cited in Whetstone scorecard "${escapeBibtex(scorecard.question)}"}
}`);
  });

  return entries.join('\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// RIS — used by EndNote, Mendeley, RefWorks
// ---------------------------------------------------------------------------

export function toRis(scorecard: Scorecard): string {
  const sources = collectSources(scorecard);
  const year    = scorecard.publishedDate.slice(0, 4);

  const entries: string[] = [];

  // Scorecard itself
  entries.push([
    'TY  - ELEC',
    `AU  - The Whetstone`,
    `TI  - ${scorecard.question}`,
    `PB  - The Whetstone (Logic Scorecard)`,
    `PY  - ${year}`,
    `UR  - https://thewhetstone.net/scorecard/${scorecard.slug}`,
    `N1  - ${scorecard.dek}`,
    'ER  - ',
  ].join('\n'));

  // Each cited source
  sources.forEach((source) => {
    entries.push([
      'TY  - ELEC',
      `TI  - ${source.title}`,
      `PB  - ${source.publication}`,
      `UR  - ${source.url}`,
      `N1  - Cited in Whetstone scorecard "${scorecard.question}"`,
      'ER  - ',
    ].join('\n'));
  });

  return entries.join('\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// APA-style plain text (7th edition approximation)
// ---------------------------------------------------------------------------

export function toApa(scorecard: Scorecard): string {
  const year   = scorecard.publishedDate.slice(0, 4);
  const lines: string[] = [];

  lines.push(
    `The Whetstone. (${year}). ${scorecard.question} [Logic Scorecard]. The Whetstone. https://thewhetstone.net/scorecard/${scorecard.slug}`,
  );
  lines.push('');
  lines.push('Cited sources:');
  collectSources(scorecard).forEach((source, i) => {
    lines.push(`${i + 1}. ${source.publication}. ${source.title}. ${source.url}`);
  });
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Collect unique sources across all positions of the scorecard
// ---------------------------------------------------------------------------

function collectSources(scorecard: Scorecard): ScorecardSource[] {
  const seen = new Set<string>();
  const result: ScorecardSource[] = [];
  for (const pos of scorecard.positions) {
    for (const src of pos.sources) {
      if (!seen.has(src.url)) {
        seen.add(src.url);
        result.push(src);
      }
    }
  }
  return result;
}
