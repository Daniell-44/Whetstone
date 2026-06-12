// ---------------------------------------------------------------------------
// Topic-page data shape. A curated set of 2-5 sources on one debatable
// question, plus the cross-document synthesis and per-side steelmen.
//
// `leaning` is a number from -100 (left) to +100 (right); 0 = centre. This
// single number drives both the overview-spectrum dot position and the
// per-card indicator, so desktop and mobile stay in sync from one field.
// ---------------------------------------------------------------------------

export type ArticleType = 'news' | 'opinion' | 'analysis';

export interface TopicSource {
  id:         string;
  outlet:     string;
  writer:     string | null;
  date:       string;        // ISO or display string
  type:       ArticleType;
  leaning:    number;        // -100..+100
  title:      string;
  url:        string;
  mainPoint:  string;        // one-line "what this argues"
  // Expanded structural detail (from the per-source audit):
  centralClaim: string;
  keyWarrant:   string;      // the load-bearing unstated assumption
  steelman:     string;      // strongest version of THIS source's position
}

export interface TopicTakeaways {
  agree:            string;  // where all sides agree
  realDisagreement: string;  // the actual point of dispute
  sharedAssumption: string;  // what everyone assumes but nobody defends
  talkingPast:      string;  // where sources talk past each other
}

export interface TopicData {
  question:   string;
  framing:    string;        // 2-3 sentence Whetstone framing
  sources:    TopicSource[];
  takeaways:  TopicTakeaways;
}

// ---------------------------------------------------------------------------
// Leaning → label + colour. AllSides convention: red = left, blue = right.
// ---------------------------------------------------------------------------

export interface LeaningStyle {
  label:    string;
  pill:     string;   // tailwind classes for the mobile pill
  dot:      string;   // tailwind bg for the spectrum dot
  edge:     string;   // tailwind border colour for the card's left edge
}

export function leaningStyle(leaning: number): LeaningStyle {
  if (leaning <= -50) return { label: 'Left',       pill: 'bg-red-100 text-red-700',     dot: 'bg-red-600',    edge: 'border-l-red-500' };
  if (leaning <= -15) return { label: 'Lean Left',  pill: 'bg-red-50 text-red-600',      dot: 'bg-red-400',    edge: 'border-l-red-300' };
  if (leaning <   15) return { label: 'Center',     pill: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-500',   edge: 'border-l-gray-300' };
  if (leaning <   50) return { label: 'Lean Right', pill: 'bg-blue-50 text-blue-600',    dot: 'bg-blue-400',   edge: 'border-l-blue-300' };
  return                     { label: 'Right',      pill: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-600',   edge: 'border-l-blue-500' };
}

/** Position 0-100% on the spectrum track for a -100..+100 leaning. */
export function spectrumPosition(leaning: number): number {
  return ((leaning + 100) / 200) * 100;
}
