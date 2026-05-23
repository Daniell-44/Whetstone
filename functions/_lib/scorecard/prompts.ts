import type { DebatePositionInput, Stage1Output } from './schemas';

// ---------------------------------------------------------------------------
// Stage 1 — position synthesis
// ---------------------------------------------------------------------------

export const POSITION_SYNTHESIS_SYSTEM_PROMPT =
  'You are a structural argument analyst. Your task is to read a set of articles ' +
  'representing one position in a public debate and synthesise the strongest honest ' +
  'version of that position\'s argument.\n\n' +

  'Rules:\n' +
  '- Grounds must be drawn ONLY from the article text supplied. Never invent ' +
  'statistics, studies, institutions, quotations, or data. If the articles contain ' +
  'no quantitative evidence, describe the evidence qualitatively — do not fabricate ' +
  'numbers. Fabricated evidence is the single worst failure mode for this product.\n' +
  '- Best Case = the strongest Claim–Grounds–Warrant chain ACTUALLY present across ' +
  'the supplied articles. Steelman within the bounds of what was written; do not ' +
  'invent a better argument than the sources actually made.\n' +
  '- Fatal Flaw = the most significant structural weakness or unstated assumption the ' +
  'position relies on. Prefer genuine structural vulnerabilities (selection bias, ' +
  'conflated concepts, evidence gaps) over pedantic formal-fallacy spotting. ' +
  'Give the flaw a concise name of 2–5 words.\n' +
  '- Respond only with the specified JSON object — no preamble, no commentary outside ' +
  'the JSON.';

export function buildPositionSynthesisPrompt(position: DebatePositionInput): string {
  const articleBlocks = position.articles
    .map(
      (a, i) =>
        `[Article ${i + 1} — ${a.title}, ${a.publication}]\n${a.text}`,
    )
    .join('\n\n---\n\n');

  return (
    `Analyse the following position and its supporting articles. Synthesise the ` +
    `strongest case this position actually makes, then identify its most significant ` +
    `structural weakness.\n\n` +
    `Position: ${position.label}\n\n` +
    `Articles:\n\n${articleBlocks}\n\n` +
    `Return a JSON object with exactly this structure:\n` +
    `{\n` +
    `  "bestCase": {\n` +
    `    "claim": "the main position being argued for",\n` +
    `    "grounds": "the evidence or reasoning offered in support — drawn only from the supplied text",\n` +
    `    "warrant": "the usually-unstated assumption connecting the grounds to the claim"\n` +
    `  },\n` +
    `  "fatalFlaw": {\n` +
    `    "name": "concise name for the structural weakness (2–5 words)",\n` +
    `    "explanation": "one to two sentences explaining the weakness and why it undermines the position"\n` +
    `  }\n` +
    `}`
  );
}

// ---------------------------------------------------------------------------
// Stage 2 — meta-analysis
// ---------------------------------------------------------------------------

export const META_ANALYSIS_SYSTEM_PROMPT =
  'You are a cross-debate synthesis analyst. Given a set of competing positions in a ' +
  'public debate — each with a best case and fatal flaw already identified — your task ' +
  'is to identify the single assumption ALL positions share but none examines.\n\n' +

  'Rules:\n' +
  '- The bridging warrant must be specific to this debate. It must be an assumption ' +
  'that ALL positions genuinely rely on, not a generic truism about debates or ' +
  'epistemology in general.\n' +
  '- It must be an assumption that actually drives the debate — something whose ' +
  'rejection would reframe the question itself, not a peripheral commonality.\n' +
  '- The dek is one sentence summarising what this scorecard audits and why the ' +
  'debate matters. It must not editorialise or declare a winner.\n' +
  '- Respond only with the specified JSON object — no preamble, no commentary outside ' +
  'the JSON.';

export function buildMetaAnalysisPrompt(
  question: string,
  positions: Array<{ label: string; synthesis: Stage1Output }>,
): string {
  const positionBlocks = positions
    .map(
      (p) =>
        `Position: ${p.label}\n` +
        `  Claim: ${p.synthesis.bestCase.claim}\n` +
        `  Grounds: ${p.synthesis.bestCase.grounds}\n` +
        `  Warrant: ${p.synthesis.bestCase.warrant}\n` +
        `  Fatal flaw (${p.synthesis.fatalFlaw.name}): ${p.synthesis.fatalFlaw.explanation}`,
    )
    .join('\n\n---\n\n');

  return (
    `Debate question: ${question}\n\n` +
    `Positions and their synthesised arguments:\n\n` +
    `${positionBlocks}\n\n` +
    `Return a JSON object with exactly this structure:\n` +
    `{\n` +
    `  "dek": "one sentence describing what this scorecard audits and why the debate matters",\n` +
    `  "bridgingWarrant": "the unstated assumption all positions share but none examines",\n` +
    `  "explanation": "two to four sentences explaining the shared assumption, why it matters, and what would change if it were questioned"\n` +
    `}`
  );
}
