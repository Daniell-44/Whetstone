import { z } from 'zod';

export const StrongestCaseSchema = z.object({
  claim:   z.string().min(1),
  grounds: z.string().min(1),
  warrant: z.string().min(1),
});

export const CounterargumentSchema = z.object({
  position:      z.string().min(1),
  strongestCase: StrongestCaseSchema,
  missedByDraft: z.string().min(1),
  why:           z.string().min(1),
});

export const CounterargumentResultSchema = z.object({
  centralClaim:     z.string().min(1),
  counterarguments: z.array(CounterargumentSchema).min(2).max(3),
  notes:            z.string().nullable(),
});
