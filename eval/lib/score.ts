// ---------------------------------------------------------------------------
// Deterministic scorer for the audit-engine eval corpus.
//
// PURE functions — no I/O, no network, no LLM. Everything here is checkable by
// a reader holding the raw corpus + output JSON, which is exactly what makes
// the numbers safe to (a) publish as marketing claims and (b) diff between
// engine versions to catch regressions.
//
// The judgment-heavy metrics — was this the *right* fallacy name, is the
// reading fair, is the groundedness KIND correct — come from the LLM grader
// (eval/graded/<version>.json) and are folded in by the runner. This module
// owns only what a machine can settle unambiguously:
//   - false positives on clean controls   (the headline honesty number)
//   - defect *location* recall            (did we flag the planted sentence at all)
//   - quote-verbatim integrity
//   - groundedness / severity / contestability distributions
//   - run-to-run consistency (Jaccard of finding sets across repeats)
//   - latency
//
// "Location recall" is deliberately lens-agnostic: a defect the answer key
// files under modalScope but the engine flagged as a Slippery Slope fallacy
// still counts as *caught*. Whether it landed in the right lens, and whether it
// was named correctly, are separate, secondary axes — because for a reader the
// first question is "did the audit surface this problem", not "did it file it
// under the taxonomically ideal heading".
// ---------------------------------------------------------------------------

// --- Shapes (read defensively; outputs are plain JSON) ----------------------

export interface Groundedness {
  kind: 'structural' | 'interpretive' | 'empirical';
  band?: 'high' | 'medium' | 'low';
}

export interface Finding {
  severity?: 'high' | 'medium' | 'low';
  groundedness?: Groundedness;
  [k: string]: unknown;
}

export interface Audit {
  centralClaim?: string;
  toulmin?: { unstatedWarrants?: Finding[]; [k: string]: unknown };
  namedFallacies?: Finding[];
  loadedLanguage?: Finding[];
  keyTermScrutiny?: Finding[];
  referentChecks?: Finding[];
  falsifiabilityChecks?: Finding[];
  modalScopeChecks?: Finding[];
  [k: string]: unknown;
}

export interface RunFile {
  id: string;
  run?: number;
  latencyMs?: number;
  result: { audit: Audit };
}

export interface CorpusItem {
  id: string;
  category: string;
  targetLenses?: string[];
  text: string;
  answerKey: AnswerKey;
}

export interface AnswerKey {
  fallacies?: Array<{ name: string; plantedSentence: string } | string>;
  unstatedWarrants?: string[];
  loadedLanguage?: Array<{ phrase: string; technique?: string }>;
  keyTerms?: Array<string | { term: string }>;
  referents?: string[];
  falsifiability?: string[];
  modalScope?: string[];
  traps?: Array<{ description: string; whyNotAFlaw: string }>;
  expectClean?: boolean;
}

// --- Text normalisation + fuzzy matching ------------------------------------

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'for', 'are', 'was', 'were', 'its',
  'their', 'they', 'them', 'from', 'have', 'has', 'not', 'but', 'you', 'your',
  'our', 'will', 'would', 'can', 'could', 'all', 'any', 'who', 'what', 'which',
  'when', 'how', 'why', 'into', 'out', 'about', 'than', 'then', 'more', 'most',
]);

export function norm(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of norm(s).split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Does `needle` (a planted phrase/sentence) match `hay` (an engine span)?
 * True when either normalised string contains the other, or token overlap
 * clears the threshold. Short planted phrases match by containment; long
 * planted sentences match by token overlap even when the engine quoted only a
 * fragment.
 */
export function overlaps(needle: string, hay: string, threshold = 0.5): boolean {
  const n = norm(needle);
  const h = norm(hay);
  if (n.length === 0 || h.length === 0) return false;
  if (h.includes(n) || n.includes(h)) return true;
  return jaccard(tokens(needle), tokens(hay)) >= threshold;
}

// --- Engine span extraction (lens-agnostic recall) --------------------------

const LENS_KEYS = [
  'namedFallacies',
  'loadedLanguage',
  'keyTermScrutiny',
  'referentChecks',
  'falsifiabilityChecks',
  'modalScopeChecks',
] as const;

// Wide set: every field that quotes/points-at a source span. Used for
// lens-agnostic *recall* — we want to find the planted defect wherever the
// engine anchored it, including near-verbatim pointers like `inflatedModal`.
const SPAN_FIELDS = ['quote', 'phrase', 'evidence', 'usage_a', 'usage_b', 'inflatedModal', 'term'];

// Narrow set: only the fields the engine's own filterValidQuotes contract
// requires to be VERBATIM substrings of the source. `warrant`, `impliedModal`,
// `explanation`, `necessity`, `claim` are paraphrases by design and must NOT be
// held to the verbatim standard, or the metric punishes intended behaviour.
const VERBATIM_FIELDS = ['quote', 'phrase', 'evidence', 'usage_a', 'usage_b'];

function findingSpans(f: Finding): string[] {
  const out: string[] = [];
  for (const k of SPAN_FIELDS) {
    const v = f[k];
    if (typeof v === 'string' && v.trim()) out.push(v);
  }
  return out;
}

function verbatimSpansOf(f: Finding): string[] {
  const out: string[] = [];
  for (const k of VERBATIM_FIELDS) {
    const v = f[k];
    if (typeof v === 'string' && v.trim()) out.push(v);
  }
  return out;
}

function allFindings(a: Audit): Finding[] {
  const out: Finding[] = [];
  for (const k of LENS_KEYS) {
    const arr = a[k];
    if (Array.isArray(arr)) out.push(...(arr as Finding[]));
  }
  const w = a.toulmin?.unstatedWarrants;
  if (Array.isArray(w)) out.push(...w);
  return out;
}

/** Every verbatim span the engine surfaced, across every lens. */
function allSpans(a: Audit): string[] {
  const out: string[] = [];
  for (const k of LENS_KEYS) {
    const arr = a[k];
    if (Array.isArray(arr)) for (const f of arr as Finding[]) out.push(...findingSpans(f));
  }
  const w = a.toulmin?.unstatedWarrants;
  if (Array.isArray(w)) for (const f of w) if (typeof f.warrant === 'string') out.push(f.warrant);
  return out;
}

// --- Per-item scoring -------------------------------------------------------

export interface LensRecall {
  planted: number;
  located: number; // caught *somewhere* in the audit
}

export interface ItemScore {
  id: string;
  category: string;
  expectClean: boolean;
  runs: number;
  latencyMs: number[];
  findingCount: number;          // mean across runs, rounded
  perLensCount: Record<string, number>;
  verbatimViolations: number;    // spans not found in source text (across runs)
  verbatimSpans: number;
  falsePositives: number | null; // clean controls only: findings that shouldn't exist
  recall: Record<string, LensRecall>;
  nameCorrect: number;           // fallacies located AND named correctly
  nameLocated: number;           // fallacies located (any lens)
  groundedness: { structural: number; interpretive: number; empirical: number };
  severity: { high: number; medium: number; low: number };
  contestability: { high: number; medium: number; low: number };
  consistency: number | null;    // mean pairwise Jaccard of span sets across runs
}

function countGroundedness(findings: Finding[]) {
  const g = { structural: 0, interpretive: 0, empirical: 0 };
  const s = { high: 0, medium: 0, low: 0 };
  const c = { high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    const kind = f.groundedness?.kind;
    if (kind === 'structural' || kind === 'interpretive' || kind === 'empirical') g[kind]++;
    const sev = f.severity;
    if (sev === 'high' || sev === 'medium' || sev === 'low') s[sev]++;
    if (kind === 'interpretive' && f.groundedness?.band) {
      const b = f.groundedness.band;
      if (b === 'high' || b === 'medium' || b === 'low') c[b]++;
    }
  }
  return { g, s, c };
}

// Recall for one planted set against the union of engine spans.
function recallFor(planted: string[], spans: string[], threshold = 0.5): LensRecall {
  let located = 0;
  for (const p of planted) {
    if (spans.some((sp) => overlaps(p, sp, threshold))) located++;
  }
  return { planted: planted.length, located };
}

function plantedStrings(key: AnswerKey) {
  // `fallacies` is normally {name, plantedSentence}[]; the smoke item uses a
  // bare string[] with no planted sentence — those can't support location
  // recall, so drop them (they'd otherwise count as permanently-missed).
  const fallacyKeys = (key.fallacies ?? []).filter(
    (f): f is { name: string; plantedSentence: string } => typeof f === 'object' && f !== null && typeof (f as { plantedSentence?: unknown }).plantedSentence === 'string',
  );
  return {
    namedFallacies: fallacyKeys.map((f) => f.plantedSentence),
    loadedLanguage: (key.loadedLanguage ?? []).map((l) => l.phrase),
    unstatedWarrants: key.unstatedWarrants ?? [],
    keyTermScrutiny: (key.keyTerms ?? []).map((k) => (typeof k === 'string' ? k : k.term)),
    referentChecks: key.referents ?? [],
    falsifiabilityChecks: key.falsifiability ?? [],
    modalScopeChecks: key.modalScope ?? [],
  };
}

export function scoreItem(item: CorpusItem, runsForItem: RunFile[]): ItemScore {
  const key = item.answerKey ?? ({} as AnswerKey);
  const expectClean = key.expectClean === true;
  const planted = plantedStrings(key);
  const plantedFallacies = (key.fallacies ?? []).filter(
    (f): f is { name: string; plantedSentence: string } => typeof f === 'object' && f !== null && typeof (f as { plantedSentence?: unknown }).plantedSentence === 'string',
  );

  const recall: Record<string, LensRecall> = {};
  const perLensCount: Record<string, number> = {};
  let findingTotal = 0;
  let verbatimViolations = 0;
  let verbatimSpans = 0;
  let nameCorrect = 0;
  let nameLocated = 0;
  const grounded = { structural: 0, interpretive: 0, empirical: 0 };
  const severity = { high: 0, medium: 0, low: 0 };
  const contest = { high: 0, medium: 0, low: 0 };
  const latencyMs: number[] = [];
  const spanSets: Set<string>[] = [];

  const ni = norm(item.text);

  for (const rf of runsForItem) {
    const audit = rf.result.audit;
    if (typeof rf.latencyMs === 'number') latencyMs.push(rf.latencyMs);

    const findings = allFindings(audit);
    findingTotal += findings.length;

    for (const k of LENS_KEYS) {
      const arr = Array.isArray(audit[k]) ? (audit[k] as Finding[]) : [];
      perLensCount[k] = (perLensCount[k] ?? 0) + arr.length;
    }
    const warr = Array.isArray(audit.toulmin?.unstatedWarrants) ? audit.toulmin!.unstatedWarrants! : [];
    perLensCount.unstatedWarrants = (perLensCount.unstatedWarrants ?? 0) + warr.length;

    // Verbatim integrity — only over contract-verbatim fields (paraphrase
    // fields like warrant text are excluded so we don't punish intended design).
    for (const f of findings) {
      for (const sp of verbatimSpansOf(f)) {
        verbatimSpans++;
        if (!ni.includes(norm(sp))) verbatimViolations++;
      }
    }

    // Wide span set drives lens-agnostic recall + run-to-run consistency.
    const spans = allSpans(audit);
    spanSets.push(new Set(spans.map(norm)));

    // Lens-agnostic location recall.
    for (const [lens, plist] of Object.entries(planted)) {
      if (plist.length === 0) continue;
      const th = lens === 'unstatedWarrants' ? 0.35 : 0.5;
      const r = recallFor(plist, spans, th);
      const acc = recall[lens] ?? { planted: 0, located: 0 };
      recall[lens] = { planted: acc.planted + r.planted, located: acc.located + r.located };
    }

    // Fallacy name accuracy (located + exact name match).
    const fallacies = Array.isArray(audit.namedFallacies) ? (audit.namedFallacies as Finding[]) : [];
    for (const pf of plantedFallacies) {
      const hit = fallacies.find((f) => typeof f.quote === 'string' && overlaps(pf.plantedSentence, f.quote, 0.5));
      if (hit) {
        nameLocated++;
        if (String(hit.name).toLowerCase() === pf.name.toLowerCase()) nameCorrect++;
      }
    }

    const { g, s, c } = countGroundedness(findings);
    grounded.structural += g.structural; grounded.interpretive += g.interpretive; grounded.empirical += g.empirical;
    severity.high += s.high; severity.medium += s.medium; severity.low += s.low;
    contest.high += c.high; contest.medium += c.medium; contest.low += c.low;
  }

  const runs = runsForItem.length || 1;

  // Consistency: mean pairwise Jaccard of span sets (only when repeated).
  let consistency: number | null = null;
  if (spanSets.length >= 2) {
    let sum = 0, pairs = 0;
    for (let i = 0; i < spanSets.length; i++)
      for (let j = i + 1; j < spanSets.length; j++) { sum += jaccard(spanSets[i], spanSets[j]); pairs++; }
    consistency = pairs ? sum / pairs : null;
  }

  return {
    id: item.id,
    category: item.category,
    expectClean,
    runs,
    latencyMs,
    findingCount: Math.round(findingTotal / runs),
    perLensCount,
    verbatimViolations,
    verbatimSpans,
    falsePositives: expectClean ? Math.round(findingTotal / runs) : null,
    recall,
    nameCorrect,
    nameLocated,
    groundedness: grounded,
    severity,
    contestability: contest,
    consistency,
  };
}

// --- Aggregate across the corpus --------------------------------------------

export interface Aggregate {
  label: string;
  nItems: number;
  nRuns: number;
  cleanControls: { nItems: number; falsePositives: number; itemsClean: number };
  detection: {
    plantedTotal: number;
    locatedTotal: number;
    locatedRate: number;
    perLens: Record<string, { planted: number; located: number; rate: number }>;
    nameTotal: number;
    nameLocated: number;
    nameCorrect: number;
    nameRate: number;
  };
  verbatim: { spans: number; violations: number; passRate: number };
  groundedness: { structural: number; interpretive: number; empirical: number; total: number; pct: Record<string, number> };
  severity: { high: number; medium: number; low: number };
  contestability: { high: number; medium: number; low: number };
  latency: { meanMs: number; p50Ms: number; p95Ms: number };
  consistency: { items: number; meanJaccard: number } | null;
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function aggregate(label: string, scores: ItemScore[]): Aggregate {
  const cleanItems = scores.filter((s) => s.expectClean);
  const clean = {
    nItems: cleanItems.length,
    falsePositives: cleanItems.reduce((a, s) => a + (s.falsePositives ?? 0), 0),
    itemsClean: cleanItems.filter((s) => (s.falsePositives ?? 0) === 0).length,
  };

  const perLens: Record<string, { planted: number; located: number; rate: number }> = {};
  let plantedTotal = 0, locatedTotal = 0;
  for (const s of scores) {
    for (const [lens, r] of Object.entries(s.recall)) {
      const acc = perLens[lens] ?? { planted: 0, located: 0, rate: 0 };
      acc.planted += r.planted; acc.located += r.located;
      perLens[lens] = acc;
      plantedTotal += r.planted; locatedTotal += r.located;
    }
  }
  for (const lens of Object.keys(perLens)) perLens[lens].rate = pct(perLens[lens].located, perLens[lens].planted);

  const nameLocated = scores.reduce((a, s) => a + s.nameLocated, 0);
  const nameCorrect = scores.reduce((a, s) => a + s.nameCorrect, 0);
  const nameTotal = scores.reduce((a, s) => a + (s.recall.namedFallacies?.planted ?? 0), 0);

  const spans = scores.reduce((a, s) => a + s.verbatimSpans, 0);
  const violations = scores.reduce((a, s) => a + s.verbatimViolations, 0);

  const g = { structural: 0, interpretive: 0, empirical: 0 };
  const sev = { high: 0, medium: 0, low: 0 };
  const con = { high: 0, medium: 0, low: 0 };
  for (const s of scores) {
    g.structural += s.groundedness.structural; g.interpretive += s.groundedness.interpretive; g.empirical += s.groundedness.empirical;
    sev.high += s.severity.high; sev.medium += s.severity.medium; sev.low += s.severity.low;
    con.high += s.contestability.high; con.medium += s.contestability.medium; con.low += s.contestability.low;
  }
  const gTotal = g.structural + g.interpretive + g.empirical;

  const lat = scores.flatMap((s) => s.latencyMs).sort((a, b) => a - b);
  const meanMs = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;

  const consItems = scores.filter((s) => s.consistency !== null);
  const consistency = consItems.length
    ? { items: consItems.length, meanJaccard: Math.round((consItems.reduce((a, s) => a + (s.consistency ?? 0), 0) / consItems.length) * 100) / 100 }
    : null;

  const nRuns = scores.reduce((a, s) => a + s.runs, 0);

  return {
    label,
    nItems: scores.length,
    nRuns,
    cleanControls: clean,
    detection: {
      plantedTotal,
      locatedTotal,
      locatedRate: pct(locatedTotal, plantedTotal),
      perLens,
      nameTotal,
      nameLocated,
      nameCorrect,
      nameRate: pct(nameCorrect, nameTotal),
    },
    verbatim: { spans, violations, passRate: pct(spans - violations, spans) },
    groundedness: {
      ...g,
      total: gTotal,
      pct: { structural: pct(g.structural, gTotal), interpretive: pct(g.interpretive, gTotal), empirical: pct(g.empirical, gTotal) },
    },
    severity: sev,
    contestability: con,
    latency: { meanMs, p50Ms: percentile(lat, 50), p95Ms: percentile(lat, 95) },
    consistency,
  };
}
