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
      sourceId:    string;       // → a BriefingSource with assessed:true
      quote:       string;       // the verbatim extract (rendered inline, tinted)
      paragraph:   string;       // the whole indented paragraph (contains the quote)
      audit:       PositionAudit;
    }
  | { type: 'shared';     text: string }                                   // the shared assumption (bottom line)
  | { type: 'editorView'; text: string; whyWrong?: string };               // opinion, walled off

export interface BriefingArticle {
  slug:          string;
  question:      string;
  category?:     string;
  publishedDate: string;         // YYYY-MM-DD
  spectrumAxis:  { left: string; right: string };
  sources:       BriefingSource[];
  blocks:        BriefingBlock[];
}
