// Article-format Briefing — see Briefings_Article_Spec_v1.md.
// Distinct from the legacy structured `Scorecard`; briefings migrate to this as
// they're (re)authored with real quoted sources.

export interface BriefingSource {
  id:           string;
  label:        string;          // e.g. "Card & Krueger (1994)"
  publication?: string;
  url:          string;
  leaning:      number;          // -100..+100, placement on spectrumAxis
  side:         'left' | 'mid' | 'right';
  assessed:     boolean;         // quoted/assessed in the article → labelled marker + default bubble
}

// --- Source model v2 (D2 Option A, 2026-07-07) -----------------------------
// Positions HOLD a stance on the question: they are the only things plotted,
// and each carries an audit by definition. Evidence sources are cited as
// factual input: they render as a bibliography strip, never on the axis.
// Legacy `sources` (::sources) remains parseable during migration.

export interface BriefingPositionSource {
  id:           string;
  label:        string;
  publication?: string;
  url:          string;
  /** Signed 5-band stance toward the named poles: -2 strongly axisLeft … +2 strongly axisRight. */
  stance:       -2 | -1 | 0 | 1 | 2;
  /** Placement confidence (published rubric on /method): renders as marker width. */
  confidence:   'low' | 'med' | 'high';
}

export interface BriefingEvidenceSource {
  id:           string;
  label:        string;
  publication?: string;
  url:          string;
  /** One line on what this evidence is and how the argument uses it. */
  note:         string;
}

export interface PositionAudit {
  name:        string;           // e.g. "Begging the Question"
  kind:        'structural' | 'interpretive' | 'empirical';  // groundedness kind → chip
  explanation: string;
}

export type BriefingBlock =
  | { type: 'landscape';  text: string }                                   // editor's framing
  | { type: 'prose';      text: string }                                   // connective tissue
  | {
      type:        'position';
      colourIndex: number;       // index into the shared spectrum palette
      label:       string;       // short stance label, e.g. "Mass displacement" (feed card + legend)
      sourceId:    string;       // → a BriefingSource with assessed:true
      quote:       string;       // the verbatim extract (rendered inline, tinted)
      paragraph:   string;       // the whole indented paragraph (contains the quote)
      audit:       PositionAudit;
    }
  | { type: 'shared';     text: string }                                   // the shared assumption (bottom line)
  | { type: 'editorView'; text: string; whyWrong?: string }                // opinion, walled off
  | { type: 'takes';      items: { source: string; url?: string; quote: string; audit: string }[] }; // curated external takes, audited

export interface BriefingArticle {
  slug:          string;
  kind?:         'briefing' | 'explainer';   // explainer = essay, no spectrum/sources
  question:      string;         // canonical, evergreen — the SEO/URL anchor (or the explainer title)
  hook?:         string;         // optional timely "why now" headline (current-affairs overlay)
  category?:     string;
  publishedDate: string;         // YYYY-MM-DD
  image?:        string;         // optional hero/thumbnail URL (curated; lead + feature cards)
  spectrumAxis:  { left: string; right: string };
  sources:       BriefingSource[];          // legacy single-table model (::sources)
  positionSources?: BriefingPositionSource[]; // v2: ::positions (plotted, audited)
  evidenceSources?: BriefingEvidenceSource[]; // v2: ::evidence (bibliography, never plotted)
  /** Front-matter `otherTakes: none` — absence of ::takes is a stated choice, not an unfinished page. */
  otherTakes?:   'none';
  blocks:        BriefingBlock[];
}

// ---------------------------------------------------------------------------
// Every source a briefing cites, whichever table it came from.
//
// The v2 format split the single `::sources` table into `::positions` (plotted
// and audited) and `::evidence` (bibliography, never plotted). Consumers that
// still read the legacy `sources` array therefore see an empty list on every
// current briefing — which is why the feed cards advertised "0 sources" on
// pieces citing ten, and why the citation downloads came back empty.
// ---------------------------------------------------------------------------

export interface CitedSource {
  id:           string;
  label:        string;
  publication?: string;
  url:          string;
  /** Plotted-and-audited, or bibliography-only. */
  role:         'position' | 'evidence';
}

export function citedSources(b: BriefingArticle): CitedSource[] {
  const out: CitedSource[] = [];
  const seen = new Set<string>();
  const push = (s: CitedSource) => {
    // A url can legitimately appear in both tables; cite it once.
    const key = s.url || s.id;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  for (const s of b.positionSources ?? []) {
    push({ id: s.id, label: s.label, publication: s.publication, url: s.url, role: 'position' });
  }
  for (const s of b.evidenceSources ?? []) {
    push({ id: s.id, label: s.label, publication: s.publication, url: s.url, role: 'evidence' });
  }
  // Legacy briefings that still use the single table.
  for (const s of b.sources ?? []) {
    if (!s.url) continue;
    push({ id: s.id, label: s.label ?? s.id, publication: s.publication, url: s.url, role: 'position' });
  }
  return out;
}
