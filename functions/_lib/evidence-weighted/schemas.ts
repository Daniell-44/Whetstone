import { z } from 'zod';

const CONSENSUS_LEVELS = [
  'strong_support',
  'moderate_support',
  'contested',
  'moderate_opposition',
  'strong_opposition',
  'insufficient_data',
  'not_applicable',
] as const;

const STANCES = ['supports', 'opposes', 'mixed', 'neutral'] as const;

const EvidencePaperSchema = z.object({
  title:         z.string().min(1),
  year:          z.number().nullable(),
  citationCount: z.number(),
  url:           z.string().min(1),
  stance:        z.enum(STANCES),
  relevance:     z.string().min(1),
});

export const EvidenceSynthesisResultSchema = z.object({
  consensusLevel:    z.enum(CONSENSUS_LEVELS),
  // Share of the assessed evidence that supports the claim (quality-weighted) —
  // NOT a probability the claim is true. Display must never frame it as truth.
  literatureSupport: z.number().int().min(0).max(100).nullable(),
  topPapers:         z.array(EvidencePaperSchema),
  explanation:       z.string().min(1),
  caveats:           z.string().nullable(),
});
