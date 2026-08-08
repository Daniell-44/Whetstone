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
  /** Optional cui-bono disclosure — a short, checkable interest note (who
     funds/commissions/benefits). "Where it's coming from" as INTEREST, never
     ideology. Decided 2026-07-21: interest, not a political compass. */
  interest?:    string;
  /** Optional representative quote from this source (verbatim, must be at
     `url` — gates through verify:quotes). Merges the former ::takes section
     into commentary: each source's stance is followed by its actual voice
     with a one-line audit. Decided 2026-07-21. */
  quote?:       string;
  auditNote?:   string;
  auditKind?:   'structural' | 'interpretive' | 'empirical';
  /** Optional 11th column: an authored bridge sentence rendered before this
     source's commentary card — connective tissue between voices so the tier
     reads as one conversation (Daniel, 2026-08-06). */
  bridge?:      string;
  /** Optional 12th column (Decision 26-B, 2026-08-09): the CAMP this field
     voice belongs to — the landscape key, authored per briefing. On an
     economics fight the key is the kind of move ("Fighting inside the
     models"); on an ethics fight it can be the framework ("Outcome-first
     arguments"). Field cards group under camp kickers in authored order;
     absent camps = the flat run. */
  camp?:        string;
}

// Principals: the primary sources UNDER audit (the reports/models the piece is
// about), distinct from commentary reacting to them (the stratification decided
// 2026-07-21). Each links to its own full review; it is NOT audited inline on
// the parent — its audit IS the review.
export interface BriefingPrincipal {
  id:          string;
  name:        string;
  finding:     string;    // one line: what this source concludes
  interest?:   string;    // cui-bono disclosure
  reviewSlug?: string;    // → the standalone review (sub-article)
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
  /** Optional 4th pipe column: the crux this premise answers. In a ::diverge
     pair, rows align by index and the crux renders as a spanning micro-label —
     the layout echoes a table without being one (Daniel, 2026-08-05). */
  crux?:      string;
}
export interface PositionStructure {
  rows:      StructureRow[];
  need?:     string;   // "what the step needs": one checkable sentence, IPCC-gated (omit if no named reason)
  supports?: string;   // the overclaim gap — what the premises actually support…
  asserts?:  string;   // …vs what the position asserts
}

// The divergence section as two parallel standard-form arguments (Decision 3,
// options A+C combined, 2026-08-05). Each column is one principal's argument;
// pins cross-reference commentary sources onto the premise they contest; the
// prose register (the ::line run) rides along as the "As written" pane of a
// CSS-only toggle — both registers ship, premises are the default.
export interface DivergeArgument {
  label:     string;         // column head, e.g. "From Frontier Economics"
  interest?: string;         // cui-bono line under the head
  rows:      StructureRow[]; // premises + exactly one conclusion (id "C")
}
export interface DivergePin {
  sourceId: string;          // → a ::positions id; card content derives from that source's quote/audit
  at:       string;          // display target, e.g. "Frontier P3" / "the shared premise"
  note?:    string;          // optional override for the one-line audit note
}

export type BriefingBlock =
  | { type: 'landscape';  text: string }                                   // editor's framing
  | { type: 'prose';      text: string }                                   // connective tissue
  | { type: 'line';       name: string }                                   // named section marker in the opening run (breaks the wall; de-numbered 2026-07-21)
  | {
      type:       'diverge';         // parallel standard form + prose toggle (Decision 3, A+C)
      label:      string;            // section heading, e.g. "Where they diverge"
      house?:     string;            // neutral house line under the heading
      a:          DivergeArgument;
      b:          DivergeArgument;
      sharedNeed?: string;           // "Both arguments need:" spanning row (supplied ★)
      pins:       DivergePin[];
      prose:      BriefingBlock[];   // the "As written" pane: line + prose blocks only
    }
  | { type: 'context';    label: string; lead?: string; items: string[] }  // "context and common ground" box — short lead para + agreement bullets, top of page
  | { type: 'cruxes';     label: string; items: string[] }                 // the disagreement shown as a named set at once (crux display A)
  | { type: 'matrix';     caption: string; actors: string[]; rows: { crux: string; cells: string[] }[] } // who-disagrees-on-what grid (crux display C, optional)
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
  | { type: 'skeleton';   rows: StructureRow[] }                           // essay-level standard form → the E-3 margin column on opinion pages
  | {
      type: 'public';               // "The public" section (Decisions 8, 18-B/C, 19-B): polls + your turn
      label: string;                // section heading, default "The public"
      stripCaption?: string;        // one line over the tick strip saying what a tick is
      stripNote?: string;           // one line under it; {spread} interpolates max-min
      ticks: { value: number; label: string }[];        // verified support numbers, one per poll
      // A bar's side maps its answer onto the briefing's axis (18-C): 'left'
      // reads for axisLeft, 'right' for axisRight, absent = neither (grey).
      // Authored with </> markers in the md — the engine never guesses.
      questions: { question: string; source: string; bars: { label: string; value: number; side?: 'left' | 'right' }[]; note?: string }[];
      gapNote?: string;             // the honest-gap line at the section foot
      dialQuestion?: string;        // Your-turn prompt; dial renders when present
      prompts?: { label: string; prefill?: string }[];  // premise-contest links; prefill carries a scaffold into /audit?text=
    }
  | { type: 'editorView'; text: string; whyWrong?: string }                // opinion, walled off
  | { type: 'takes';      items: { source: string; url?: string; quote: string; audit: string }[] }; // curated external takes, audited

export interface BriefingArticle {
  slug:          string;
  /** The register (decided 2026-07-21). briefing = the map (parent); review =
     a deep audit of one source; explainer = a concept essay; opinion = the
     author's argument, clearly labelled, still self-auditing. Each renders a
     distinct kicker so the reader always knows the register. */
  kind?:         'briefing' | 'explainer' | 'review' | 'opinion';
  question:      string;         // canonical, evergreen — the SEO/URL anchor (or the explainer title)
  hook?:         string;         // optional timely "why now" headline (current-affairs overlay)
  category?:     string;
  publishedDate: string;         // YYYY-MM-DD
  image?:        string;         // optional hero/thumbnail URL (curated; lead + feature cards)
  spectrumAxis:  { left: string; right: string };
  sources:       BriefingSource[];          // legacy single-table model (::sources)
  positionSources?: BriefingPositionSource[]; // v2: ::positions (plotted commentary)
  evidenceSources?: BriefingEvidenceSource[]; // v2: ::evidence (bibliography, never plotted)
  principals?:      BriefingPrincipal[];      // the primary sources under audit (::principals), each → a review
  /** Front-matter `otherTakes: none` — absence of ::takes is a stated choice, not an unfinished page. */
  otherTakes?:   'none';
  /** Front-matter `archived: true` — kept out of the feed/related/next surfaces
     but the page stays live (links, SEO, citations all keep working). The
     2026-07-21 clean-slate: the ported corpus archived so only hand-authored
     work shows on the front door. */
  archived?:     true;
  /** Front-matter `draft: true` — page renders at its URL for preview but is
     excluded from the feed, related rails, and next links. No archive banner.
     For work-in-progress essays (Daniel, 2026-08-06). */
  draft?:        true;
  blocks:        BriefingBlock[];
}
