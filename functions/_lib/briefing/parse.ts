// Parses a briefing markdown file → BriefingArticle. See
// Briefing_Authoring_Format_v1.md. Flat front-matter (no nested YAML, so no
// dependency needed), a `::sources` pipe-table, and `::` block markers in the
// body. Plain paragraphs between markers become `prose` blocks.

import type { BriefingArticle, BriefingBlock, BriefingSource, BriefingPositionSource, BriefingEvidenceSource, BriefingPrincipal, PositionAudit, PositionStructure, StructureRow, DivergeArgument, DivergePin } from './types';

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
        // Optional 7th column: cui-bono interest note (commentary sources).
        ...(p[6] ? { interest: p[6] } : {}),
        // Optional 8/9/10: representative quote + one-line audit + kind
        // (merges the ::takes section into commentary — decided 2026-07-21).
        ...(p[7] ? { quote: p[7] } : {}),
        ...(p[8] ? { auditNote: p[8] } : {}),
        ...(p[9] && (p[9] === 'structural' || p[9] === 'interpretive' || p[9] === 'empirical') ? { auditKind: p[9] as BriefingPositionSource['auditKind'] } : {}),
        // Optional 11: bridge sentence rendered before this source's card.
        ...(p[10] ? { bridge: p[10] } : {}),
      };
    });
}

// id | name | finding | interest | reviewSlug — the primary sources under audit.
function parsePrincipals(text: string): BriefingPrincipal[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const p = line.split('|').map((x) => x.trim());
      return {
        id:          p[0] ?? '',
        name:        p[1] ?? '',
        finding:     p[2] ?? '',
        ...(p[3] ? { interest: p[3] } : {}),
        ...(p[4] ? { reviewSlug: p[4] } : {}),
      };
    });
}

// Standard-form rows: `id | provenance | text`, id "C" → the conclusion.
// Shared by ::structure (inside a position) and ::argument (inside ::diverge).
function parseStructureRows(text: string): StructureRow[] {
  return text
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const p = l.split('|').map((x) => x.trim());
      const id = p[0] ?? '';
      const rawProv = (p[1] ?? '').toLowerCase();
      const provenance: StructureRow['provenance'] =
        /^c$/i.test(id) ? 'conclusion'
        : rawProv === 'stated' ? 'stated'
        : rawProv === 'supplied' ? 'supplied'
        : 'quoted';
      return { id, provenance, text: p[2] ?? '', ...(p[3] ? { crux: p[3] } : {}) };
    })
    .filter((r) => r.text);
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
  let principals: BriefingPrincipal[] = [];
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
    } else if (name === 'line') {
      // A numbered section marker in the opening run. Auto-numbered at render;
      // the marker just carries the name (`::line name="What to measure"`).
      // Body-less: any following prose stays its own block.
      blocks.push({ type: 'line', name: attrs.name ?? '' });
    } else if (name === 'context') {
      // "Context and common ground" box (restructured 2026-08-06): plain lines
      // form a short lead paragraph, dashed lines ("- ") are the agreement
      // bullets. Legacy bodies with no dashes still work: their lines all
      // land in the paragraph unless they carry dashes.
      const rawLines = readUntilMarker().split('\n').map((l) => l.trim()).filter(Boolean);
      const items = rawLines.filter((l) => /^[-*]\s/.test(l)).map((l) => l.replace(/^[-*]\s*/, ''));
      const lead = rawLines.filter((l) => !/^[-*]\s/.test(l)).join(' ');
      blocks.push({ type: 'context', label: attrs.label ?? 'Context and common ground', ...(lead ? { lead } : {}), items });
    } else if (name === 'principals') {
      // The primary sources under audit (the reports/models), each → a review.
      principals = parsePrincipals(readUntilMarker());
    } else if (name === 'cruxes') {
      // The disagreement shown as a named set at once (crux display A).
      const items = readUntilMarker().split('\n').map((l) => l.trim().replace(/^[-*]\s*/, '')).filter(Boolean);
      blocks.push({ type: 'cruxes', label: attrs.label ?? 'They diverge on:', items });
    } else if (name === 'matrix') {
      // Who-disagrees-on-what grid (crux display C). First row = actor headers
      // (leading empty cell), each later row = crux | cell | cell | …
      const rowsRaw = readUntilMarker().split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split('|').map((x) => x.trim()));
      const actors = (rowsRaw[0] ?? []).slice(1);
      const rows = rowsRaw.slice(1).map((r) => ({ crux: r[0] ?? '', cells: r.slice(1) }));
      if (rows.length) blocks.push({ type: 'matrix', caption: attrs.caption ?? '', actors, rows });
    } else if (name === 'diverge') {
      // Decision 3 (A+C, 2026-08-05): the divergence section as two parallel
      // standard-form arguments with commentary pinned to premises, plus the
      // prose register (the ::line run) as the "As written" toggle pane.
      // Everything until ::enddiverge belongs to this block.
      const args: DivergeArgument[] = [];
      const pins: DivergePin[] = [];
      let sharedNeed: string | undefined;
      const proseBlocks: BriefingBlock[] = [];
      let dBuf: string[] = [];
      const flushDProse = () => {
        const t = dBuf.join('\n').trim();
        dBuf = [];
        for (const para of t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) {
          proseBlocks.push({ type: 'prose', text: para });
        }
      };
      while (i < lines.length && !/^::enddiverge\b/.test(lines[i])) {
        const dl = lines[i];
        const dm = dl.match(/^::([\w-]+)\s*(.*)$/);
        if (!dm) { dBuf.push(dl); i += 1; continue; }
        flushDProse();
        const dn = dm[1];
        const da = parseAttrs(dm[2] ?? '');
        i += 1;
        if (dn === 'argument') {
          args.push({ label: da.label ?? '', ...(da.interest ? { interest: da.interest } : {}), rows: parseStructureRows(readUntilMarker()) });
        } else if (dn === 'sharedneed') {
          sharedNeed = readParagraph();
        } else if (dn === 'pin') {
          const note = readParagraph(); // optional one-liner overriding the source's auditNote
          pins.push({ sourceId: da.source ?? '', at: da.at ?? '', ...(note ? { note } : {}) });
        } else if (dn === 'line') {
          proseBlocks.push({ type: 'line', name: da.name ?? '' });
        } else {
          readUntilMarker(); // unknown marker inside diverge — skip its body
        }
      }
      if (i < lines.length) i += 1; // consume ::enddiverge
      flushDProse();
      if (args.length >= 1) {
        // One column is malformed but still pushed (empty second column) so the
        // validator can report it; zero columns degrades to plain prose.
        blocks.push({
          type: 'diverge',
          label: attrs.label ?? 'Where they diverge',
          ...(attrs.house ? { house: attrs.house } : {}),
          a: args[0],
          b: args[1] ?? { label: '', rows: [] },
          ...(sharedNeed ? { sharedNeed } : {}),
          pins,
          prose: proseBlocks,
        });
      } else {
        blocks.push(...proseBlocks);
      }
    } else if (name === 'skeleton') {
      // Essay-level standard form (E-3, 2026-08-06): the argument, numbered,
      // rendered as the margin column on opinion pages. Same row grammar as
      // ::structure; `supplied` rows read as the author's thesis.
      const rows = parseStructureRows(readUntilMarker());
      if (rows.length) blocks.push({ type: 'skeleton', rows });
    } else if (name === 'public') {
      // "The public" section (Decision 8 C-1 + 9 P-A2, 2026-08-06). Typed
      // pipe rows: `tick | <number> | <pollster, date>` builds the range
      // strip; `q | <question> | <source, date> | <label n, label n, …> |
      // [note]` builds a question row with proportional bars; `prompt | <text>`
      // adds a storey-3 conversation prompt. Only verified figures may be
      // authored here — the quote gate's discipline applies to numbers too.
      const ticks: { value: number; label: string }[] = [];
      const questions: { question: string; source: string; bars: { label: string; value: number }[]; note?: string }[] = [];
      const prompts: string[] = [];
      for (const rline of readUntilMarker().split('\n').map((l) => l.trim()).filter(Boolean)) {
        const p = rline.split('|').map((x) => x.trim());
        if (p[0] === 'tick') {
          const v = toNum(p[1]);
          if (v > 0 && p[2]) ticks.push({ value: v, label: p[2] });
        } else if (p[0] === 'q') {
          const bars = (p[3] ?? '').split(',').map((b) => b.trim()).map((b) => {
            const m = b.match(/^(.*?)\s+(\d+)$/);
            return m ? { label: m[1], value: Number(m[2]) } : null;
          }).filter((b): b is { label: string; value: number } => b !== null);
          if (p[1] && bars.length) questions.push({ question: p[1], source: p[2] ?? '', bars, ...(p[4] ? { note: p[4] } : {}) });
        } else if (p[0] === 'prompt' && p[1]) {
          prompts.push(p[1]);
        }
      }
      blocks.push({
        type: 'public',
        label: attrs.label ?? 'The public',
        ...(attrs.stripcaption ? { stripCaption: attrs.stripcaption } : {}),
        ...(attrs.stripnote ? { stripNote: attrs.stripnote } : {}),
        ticks, questions,
        ...(attrs.gapnote ? { gapNote: attrs.gapnote } : {}),
        ...(attrs.dialquestion ? { dialQuestion: attrs.dialquestion } : {}),
        ...(prompts.length ? { prompts } : {}),
      });
    } else if (name === 'position') {
      const paragraph = readParagraph();
      // Optional `::structure` between the paragraph and the audit: the argument
      // in standard form. Pipe rows `id | provenance | text` until the next
      // marker, then an optional `::need` paragraph (the "what the step needs"
      // sentence). supports/asserts ride on the ::structure attrs line.
      let structure: PositionStructure | undefined;
      skipBlank();
      const stm = i < lines.length ? lines[i].match(/^::structure\s*(.*)$/) : null;
      if (stm) {
        const sa = parseAttrs(stm[1] ?? '');
        i += 1;
        const rows: StructureRow[] = parseStructureRows(readUntilMarker());
        let need: string | undefined;
        skipBlank();
        const nm = i < lines.length ? lines[i].match(/^::need\b/) : null;
        if (nm) { i += 1; need = readParagraph(); }
        if (rows.length) {
          structure = {
            rows,
            ...(need ? { need } : {}),
            ...(sa.supports ? { supports: sa.supports } : {}),
            ...(sa.asserts ? { asserts: sa.asserts } : {}),
          };
        }
      }
      let audit: PositionAudit = { name: '', kind: 'structural', explanation: '' };
      skipBlank(); // tolerate a blank line between the paragraph/structure and its ::audit
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
        ...(structure ? { structure } : {}),
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
    ...(fm.type === 'explainer' ? { kind: 'explainer' as const }
      : fm.type === 'opinion' ? { kind: 'opinion' as const }
      : fm.type === 'review' ? { kind: 'review' as const }
      : {}),
    question:      fm.question ?? slug,
    ...(fm.hook ? { hook: fm.hook } : {}),
    ...(fm.category ? { category: fm.category } : {}),
    ...(fm.image ? { image: fm.image } : {}),
    publishedDate: fm.publishedDate ?? new Date().toISOString().slice(0, 10),
    spectrumAxis:  { left: fm.axisLeft ?? '', right: fm.axisRight ?? '' },
    sources,
    ...(positionSources.length ? { positionSources } : {}),
    ...(evidenceSources.length ? { evidenceSources } : {}),
    ...(principals.length ? { principals } : {}),
    ...(fm.otherTakes === 'none' ? { otherTakes: 'none' as const } : {}),
    ...(fm.archived === 'true' ? { archived: true as const } : {}),
    ...(fm.draft === 'true' ? { draft: true as const } : {}),
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

  // Devil's-advocate policy (Daniel, 2026-08-04): the editor's opinion argues
  // against itself. An ::editor without ::why-wrong is flagged everywhere; an
  // opinion-kind piece must carry the pair (the whole piece IS the view).
  const editor = b.blocks.find((bl) => bl.type === 'editorView');
  if (editor && editor.type === 'editorView' && !editor.whyWrong?.trim()) {
    issues.push("`::editor` has no `::why-wrong` — the editor's view must carry its devil's advocate");
  }
  if (b.kind === 'opinion' && !editor) {
    issues.push('opinion piece has no `::editor` block — an opinion needs the view + its devil\'s advocate (`::why-wrong`)');
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

  // Every plotted position is audited BY DEFINITION under v2. Since the
  // 2026-07-21 takes-merge, a source can carry its audit in EITHER a full
  // ::position block OR inline via `quote + auditNote` on the source row.
  const auditedIds = new Set([
    ...b.blocks.flatMap((bl) => (bl.type === 'position' && bl.audit.name ? [bl.sourceId] : [])),
    ...pos.filter((s) => s.quote && s.auditNote).map((s) => s.id),
  ]);
  if (v2) {
    for (const s of pos) {
      if (!auditedIds.has(s.id)) issues.push(`plotted position "${s.id}" has no audit — either add a ::position block or fill quote+auditNote columns on the ::positions row`);
    }
  }

  for (const bl of b.blocks) {
    if (bl.type !== 'position') continue;
    const who = bl.label || bl.sourceId || 'unnamed';
    const known = ids.has(bl.sourceId) || posIds.has(bl.sourceId) || eviIds.has(bl.sourceId);
    if (bl.sourceId && !known) issues.push(`position "${who}" → source=${bl.sourceId} matches no ::positions / ::evidence / ::sources id`);
    if (bl.sourceId && eviIds.has(bl.sourceId)) issues.push(`position "${who}" quotes evidence-source "${bl.sourceId}" — if it argues a stance it belongs in ::positions`);
    if (!bl.audit.name.trim()) issues.push(`position "${who}" has no ::audit beneath it`);

    // ::structure integrity (decided 2026-07-21). The block is optional, but if
    // present it must be well-formed: capped, exactly one conclusion, and the
    // overclaim gap comes as a pair or not at all.
    if (bl.structure) {
      const s = bl.structure;
      const concl = s.rows.filter((r) => r.provenance === 'conclusion');
      if (concl.length !== 1) issues.push(`position "${who}" ::structure needs exactly one conclusion row (id "C"), found ${concl.length}`);
      const premises = s.rows.length - concl.length;
      if (premises < 1) issues.push(`position "${who}" ::structure has no premises`);
      if (s.rows.length > 5) issues.push(`position "${who}" ::structure has ${s.rows.length} rows — cap at 5 (split the position if the argument needs more)`);
      if ((s.supports && !s.asserts) || (!s.supports && s.asserts)) issues.push(`position "${who}" ::structure overclaim gap needs BOTH supports= and asserts= or neither`);
      if (!s.need && !s.supports) issues.push(`position "${who}" ::structure has no ::need sentence and no overclaim gap — it must say what the step needs (omit the whole block otherwise: absence is informative)`);
    }
  }

  // ::diverge integrity (Decision 3, A+C, 2026-08-05). Two columns, each a
  // well-formed standard-form argument; pins must reference audited commentary
  // sources; the prose pane must exist — the toggle's "As written" register is
  // part of the contract, not an optional extra.
  for (const bl of b.blocks) {
    if (bl.type !== 'diverge') continue;
    const cols = [bl.a, bl.b];
    if (!bl.b.rows.length && !bl.b.label) issues.push('`::diverge` needs exactly two `::argument` columns');
    for (const col of cols) {
      if (!col.rows.length) continue; // covered by the two-column issue above
      const who = col.label || 'unnamed argument';
      const concl = col.rows.filter((r) => r.provenance === 'conclusion');
      if (concl.length !== 1) issues.push(`diverge argument "${who}" needs exactly one conclusion row (id "C"), found ${concl.length}`);
      if (col.rows.length - concl.length < 1) issues.push(`diverge argument "${who}" has no premises`);
      if (col.rows.length > 6) issues.push(`diverge argument "${who}" has ${col.rows.length} rows — cap at 6 (the parallel form is a scan device, not a proof transcript)`);
    }
    const audited = new Set([
      ...b.blocks.flatMap((x) => (x.type === 'position' && x.audit.name ? [x.sourceId] : [])),
      ...pos.filter((s) => s.quote && s.auditNote).map((s) => s.id),
    ]);
    for (const pin of bl.pins) {
      if (!pin.sourceId || !posIds.has(pin.sourceId)) issues.push(`diverge pin → source=${pin.sourceId || '(missing)'} matches no ::positions id`);
      else if (!audited.has(pin.sourceId)) issues.push(`diverge pin "${pin.sourceId}" references an unaudited source — a pin is a cross-reference to an audit, not new commentary`);
      if (!pin.at.trim()) issues.push(`diverge pin "${pin.sourceId}" has no at= target — say which premise it contests`);
    }
    if (!bl.prose.some((p) => p.type === 'prose')) issues.push('`::diverge` has no prose inside it — the "As written" pane is empty (move the ::line run inside ::diverge…::enddiverge)');
  }

  // Density advisory (not an error): the opening run before the first position
  // is where the wall-of-text lives. Flag a long unbroken run so the author
  // reaches for a ::line marker. ~250 words ≈ a minute with no scan anchor.
  const firstPos = b.blocks.findIndex((bl) => bl.type === 'position');
  const opening = (firstPos === -1 ? b.blocks : b.blocks.slice(0, firstPos));
  let run = 0;
  for (const bl of opening) {
    if (bl.type === 'prose' || bl.type === 'landscape') run += (bl.text || '').trim().split(/\s+/).filter(Boolean).length;
    else if (bl.type === 'line') run = 0;   // a line marker is a scan anchor
  }
  if (run > 250) issues.push(`opening run is ~${run} words with no ::line marker — break it into labelled lines (readability, the wall-of-text fix)`);

  return issues;
}
