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

// The argument in standard form, nested in a ::position (decided 2026-07-21).
// Author-asserted, static, NO strength score of any kind — the "step" is a
// checkable sentence saying what the inference NEEDS, not a rating. Provenance
// separates what the source actually said (quoted / stated) from what the audit
// supplies (supplied ★): a confidently numbered premise attributed to a named
// author who never said it is a worse error than a wrong fallacy label.
export interface StructureRow {
  id:         string;                                    // "1".."n" for premises, "C" for the conclusion
  provenance: 'quoted' | 'stated' | 'supplied' | 'conclusion';
  text:       string;
}
export interface PositionStructure {
  rows:      StructureRow[];
  need?:     string;   // "what the step needs": one checkable sentence, IPCC-gated (omit if no named reason)
  supports?: string;   // the overclaim gap — what the premises actually support…
  asserts?:  string;   // …vs what the position asserts
}

export type BriefingBlock =
  | { type: 'landscape';  text: string }                                   // editor's framing
  | { type: 'prose';      text: string }                                   // connective tissue
  | { type: 'line';       name: string }                                   // numbered section marker in the opening run (breaks the wall)
  | {
      type:        'position';
      colourIndex: number;       // index into the shared spectrum palette
      label:       string;       // short stance label, e.g. "Mass displacement" (feed card + legend)
      sourceId:    string;       // → a BriefingSource with assessed:true
      quote:       string;       // the verbatim extract (rendered inline, tinted)
      paragraph:   string;       // the whole indented paragraph (contains the quote)
      audit:       PositionAudit;
      structure?:  PositionStructure;   // optional "the argument, numbered" disclosure
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
  /** Front-matter `archived: true` — kept out of the feed/related/next surfaces
     but the page stays live (links, SEO, citations all keep working). The
     2026-07-21 clean-slate: the ported corpus archived so only hand-authored
     work shows on the front door. */
  archived?:     true;
  blocks:        BriefingBlock[];
}
