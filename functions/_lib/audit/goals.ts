// ---------------------------------------------------------------------------
// Draft goals — audience and intent declarations that tune audit emphasis
// ---------------------------------------------------------------------------

export const AUDIENCES = [
  'general',      // broad public readership
  'academic',     // scholars, peer reviewers, students
  'journalistic', // editors, fact-checkers, newsrooms
  'legal',        // legal professionals, policy analysts
  'technical',    // engineers, scientists, domain specialists
] as const;

export type Audience = (typeof AUDIENCES)[number];

export const INTENTS = [
  'persuade',  // the writer is making a case for a position
  'inform',    // the writer is explaining or reporting
  'analyse',   // the writer is evaluating someone else's position
  'respond',   // the writer is rebutting a specific argument
] as const;

export type Intent = (typeof INTENTS)[number];

export interface DraftGoals {
  audience: Audience;
  intent:   Intent;
}

// ---------------------------------------------------------------------------
// Audience-specific calibration instructions
// ---------------------------------------------------------------------------

const AUDIENCE_CALIBRATION: Record<Audience, string> = {
  general: `The draft targets a general audience. Calibrate severity with an emphasis on clarity and accessibility:
- Loaded language and weasel words should be weighted higher — general readers are more susceptible to framing effects.
- Formal validity issues matter less than practical reasoning clarity — most general-audience arguments are enthymematic by design.
- Referent checks are important — vague group references ("the elite", "ordinary people") are especially misleading for non-specialist readers.`,

  academic: `The draft targets an academic audience. Calibrate severity with an emphasis on rigour and precision:
- Unstated warrants should be weighted higher — academic readers expect explicit premises.
- Key-term scrutiny is critical — equivocation in academic writing undermines the entire contribution.
- Citation audit findings are high-priority — academic writing lives or dies on source fidelity.
- Loaded language is lower-priority unless it substitutes for argument — academic audiences tolerate disciplinary jargon.`,

  journalistic: `The draft targets a journalistic audience. Calibrate severity for accuracy and fairness:
- Referent checks are high-priority — vague attribution ("sources say", "experts believe") is a core journalistic failure.
- Cherry-picking and selection bias are high-priority — journalistic balance requires engaging contrary evidence.
- Loaded language matters when it substitutes for reporting — emotionally charged framing without evidentiary basis is a higher-severity finding in journalism.
- Falsifiability checks are important — unfalsifiable claims presented as news analysis mislead readers.`,

  legal: `The draft targets a legal or policy audience. Calibrate severity for precision and precedent:
- Modal scope checks are high-priority — legal arguments distinguish carefully between "must", "shall", "may", and "should", and conflation is a serious drafting error.
- Unstated warrants are high-priority — legal reasoning requires explicit premises traceable to statute, precedent, or principle.
- Composition and division fallacies matter — legal arguments frequently fail by applying rules at the wrong level of generality.
- Key-term scrutiny is critical — legal terms of art have precise meanings; equivocation between legal and ordinary senses is a fundamental error.`,

  technical: `The draft targets a technical or scientific audience. Calibrate severity for empirical rigour:
- Base-rate neglect and selection bias are high-priority — technical claims must respect statistical methodology.
- Falsifiability checks are critical — unfalsifiable claims have no place in technical writing.
- Appeal to authority matters less (citing domain experts is standard practice) unless the authority is outside the relevant domain.
- Hasty generalisation is high-priority — technical claims from insufficient data are a core failure mode.`,
};

// ---------------------------------------------------------------------------
// Intent-specific calibration instructions
// ---------------------------------------------------------------------------

const INTENT_CALIBRATION: Record<Intent, string> = {
  persuade: `The writer's intent is to persuade. This means:
- Counterargument gaps are the highest-priority finding class — a persuasive piece that ignores the strongest opposition is structurally weak.
- Loaded language findings should distinguish between rhetorical force (acceptable in persuasion) and manipulation (substituting emotion for argument). Only flag the latter at high severity.
- Unstated warrants matter — persuasion that hides its premises is less honest persuasion.
- The overall audit should help the writer make a *stronger* case, not a less passionate one.`,

  inform: `The writer's intent is to inform or explain. This means:
- Neutrality failures are high-priority — loaded language, framing bias, and one-sided evidence selection undermine informational writing.
- Referent checks matter — informational writing should be precise about what it names.
- Philosophical commitments detection is useful — an informational piece that unknowingly operates within a single framework may mislead readers into thinking it is more neutral than it is.
- Fallacy findings should be calibrated lower unless they distort the information being conveyed.`,

  analyse: `The writer's intent is to analyse another position. This means:
- Straw man detection is the highest-priority fallacy — misrepresenting the position being analysed is the cardinal sin of analytical writing.
- Charitable interpretation matters — flag findings where the writer may be reading the target text uncharitably.
- The audit should help the writer produce a *fair* analysis, not just a technically correct one.
- Referent checks on attributed positions are important — "they argue that…" requires a clear referent.`,

  respond: `The writer's intent is to respond to a specific argument. This means:
- Tu quoque detection is high-priority — responding by pointing at the opponent's behaviour rather than engaging the argument is the most common failure.
- Ad hominem detection is high-priority for the same reason.
- Red herring detection matters — responses that change the subject rather than engaging the point.
- The audit should help the writer produce a response that *actually engages* the original argument.`,
};

// ---------------------------------------------------------------------------
// Build the goals preamble for the system prompt
// ---------------------------------------------------------------------------

export function buildGoalsPreamble(goals: DraftGoals): string {
  return `
## Draft context — audience and intent

The writer has declared the following goals for this draft:
- **Audience:** ${goals.audience}
- **Intent:** ${goals.intent}

Use these to calibrate severity and emphasis across all lenses. The calibration instructions below modify the baseline severity rules — they do not override the structural definitions of each finding type.

### Audience calibration
${AUDIENCE_CALIBRATION[goals.audience]}

### Intent calibration
${INTENT_CALIBRATION[goals.intent]}

Apply both calibrations simultaneously. Where they conflict (rare), audience calibration takes precedence — the audience determines what counts as a serious failure.

---

`;
}
