import { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { EvidenceSynthesisResultSchema } from './schemas';
import { SYNTHESIS_SYSTEM_PROMPT, buildSynthesisUserMessage, nonEmpiricalExplanation } from './prompts';
import { searchPapers, claimToSearchQuery } from './semantic-scholar';
import { EVIDENCE_MODEL, EVIDENCE_THINKING_BUDGET, MAX_CLAIMS_TO_ASSESS, S2_REQUEST_DELAY_MS } from './constants';
import type {
  ClaimType,
  EvidenceAssessment,
  EvidenceWeightedResult,
  EvidenceWeightedDeps,
  ConsensusLevel,
} from './types';
import { empirical, type GroundednessSignal } from '../grounded/types';

// Build the empirical groundedness signal from consensus + paper counts.
// This is where the chip's display-side count comes from.
function buildGroundedness(consensus: ConsensusLevel, topPapers: { stance: 'supports' | 'opposes' | 'mixed' | 'neutral' }[]): GroundednessSignal {
  const supporting = topPapers.filter(p => p.stance === 'supports').length;
  const opposing   = topPapers.filter(p => p.stance === 'opposes').length;
  return empirical(supporting, opposing, consensus);
}

// ---------------------------------------------------------------------------
// Input: extracted statements with claim types
// ---------------------------------------------------------------------------

export interface ClaimInput {
  id:        string;
  text:      string;
  claimType: ClaimType;
}

// ---------------------------------------------------------------------------
// Non-empirical claims get instant assessment without API calls
// ---------------------------------------------------------------------------

function assessNonEmpirical(claim: ClaimInput): EvidenceAssessment {
  const level = claim.claimType === 'empirical_uncontested' ? 'strong_support' as const : 'not_applicable' as const;
  const conf  = claim.claimType === 'empirical_uncontested' ? 95 : null;

  return {
    claim:             claim.text,
    claimType:         claim.claimType,
    consensusLevel:    level,
    confidencePercent: conf,
    paperCount:        0,
    topPapers:         [],
    explanation:       nonEmpiricalExplanation(claim.claimType),
    caveats:           null,
    groundedness:      buildGroundedness(level, []),
  };
}

// ---------------------------------------------------------------------------
// Delay utility for throttling S2 requests
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function assessEvidenceWeighted(
  claims: ClaimInput[],
  deps:   EvidenceWeightedDeps,
): Promise<{ result: EvidenceWeightedResult; inputTokens: number; outputTokens: number }> {
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;

  const assessments: EvidenceAssessment[] = [];

  // Separate empirical_contested claims (need S2 + LLM) from the rest
  const empiricalContested = claims.filter((c) => c.claimType === 'empirical_contested');
  const nonEmpirical       = claims.filter((c) => c.claimType !== 'empirical_contested');

  // Non-empirical: instant assessment, no API calls
  for (const claim of nonEmpirical) {
    assessments.push(assessNonEmpirical(claim));
  }

  // Empirical contested: search S2 then synthesize via LLM
  const toAssess = empiricalContested.slice(0, MAX_CLAIMS_TO_ASSESS);

  for (let i = 0; i < toAssess.length; i++) {
    const claim = toAssess[i]!;

    // Throttle S2 requests
    if (i > 0) await delay(S2_REQUEST_DELAY_MS);

    // Search for relevant papers
    const query  = claimToSearchQuery(claim.text);
    const papers = await searchPapers(query, { yearStart: 2015 });

    if (papers.length === 0) {
      // No papers found — return insufficient_data without LLM call
      assessments.push({
        claim:             claim.text,
        claimType:         claim.claimType,
        consensusLevel:    'insufficient_data',
        confidencePercent: null,
        paperCount:        0,
        topPapers:         [],
        explanation:       'No relevant academic papers were found for this claim. The evidence base is insufficient to assess consensus.',
        caveats:           null,
        groundedness:      buildGroundedness('insufficient_data', []),
      });
      continue;
    }

    // Synthesize via LLM
    try {
      const { output, inputTokens, outputTokens } = await callWithRetry(
        () =>
          deps.provider.complete(
            {
              operation:         'synthesize',
              model:             deps.model ?? EVIDENCE_MODEL,
              systemInstruction: SYNTHESIS_SYSTEM_PROMPT,
              messages:          [{ role: 'user', content: buildSynthesisUserMessage(claim.text, papers) }],
              responseFormat:    'json',
              thinkingBudget:    EVIDENCE_THINKING_BUDGET,
            },
            deps.apiKey,
          ),
        EvidenceSynthesisResultSchema,
        'evidence-synthesis',
        deps.backoffDelaysMs,
      );

      totalInputTokens  += inputTokens;
      totalOutputTokens += outputTokens;

      assessments.push({
        claim:             claim.text,
        claimType:         claim.claimType,
        consensusLevel:    output.consensusLevel,
        confidencePercent: output.confidencePercent,
        paperCount:        papers.length,
        topPapers:         output.topPapers,
        explanation:       output.explanation,
        caveats:           output.caveats,
        groundedness:      buildGroundedness(output.consensusLevel, output.topPapers),
      });
    } catch {
      // LLM synthesis failed — degrade to insufficient_data
      assessments.push({
        claim:             claim.text,
        claimType:         claim.claimType,
        consensusLevel:    'insufficient_data',
        confidencePercent: null,
        paperCount:        papers.length,
        topPapers:         [],
        explanation:       'Evidence synthesis failed. Papers were found but could not be analysed.',
        caveats:           null,
        groundedness:      buildGroundedness('insufficient_data', []),
      });
    }
  }

  // Sort: empirical_contested assessments first (the interesting ones),
  // then by consensus level (contested > insufficient > the rest)
  const CONSENSUS_ORDER: Record<string, number> = {
    contested:           0,
    moderate_opposition: 1,
    moderate_support:    2,
    strong_opposition:   3,
    insufficient_data:   4,
    strong_support:      5,
    not_applicable:      6,
  };

  assessments.sort((a, b) => {
    // Empirical contested first
    const aEc = a.claimType === 'empirical_contested' ? 0 : 1;
    const bEc = b.claimType === 'empirical_contested' ? 0 : 1;
    if (aEc !== bEc) return aEc - bEc;
    // Within group: by consensus level interest
    const ao = CONSENSUS_ORDER[a.consensusLevel] ?? 99;
    const bo = CONSENSUS_ORDER[b.consensusLevel] ?? 99;
    return ao - bo;
  });

  return {
    result: { assessments, notes: null },
    inputTokens:  totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
