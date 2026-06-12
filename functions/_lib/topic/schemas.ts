import { z } from 'zod';

export const StoredTopicSourceSchema = z.object({
  id:           z.string().min(1),
  outlet:       z.string().min(1).max(120),
  writer:       z.string().max(120).nullable(),
  date:         z.string().min(1).max(40),
  type:         z.enum(['news', 'opinion', 'analysis']),
  leaning:      z.number().min(-100).max(100),
  title:        z.string().min(1).max(300),
  url:          z.string().url(),
  mainPoint:    z.string().min(1).max(500),
  centralClaim: z.string().min(1).max(600),
  keyWarrant:   z.string().min(1).max(600),
  steelman:     z.string().min(1).max(800),
});

export const StoredTopicTakeawaysSchema = z.object({
  agree:            z.string().min(1).max(800),
  realDisagreement: z.string().min(1).max(800),
  sharedAssumption: z.string().min(1).max(800),
  talkingPast:      z.string().min(1).max(800),
});

export const StoredTopicSchema = z.object({
  slug:          z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
  question:      z.string().min(1).max(300),
  framing:       z.string().min(1).max(1000),
  category:      z.string().max(60).nullable(),
  sources:       z.array(StoredTopicSourceSchema).min(2).max(6),
  takeaways:     StoredTopicTakeawaysSchema,
  editorNote:    z.string().max(2000).nullable(),
  publishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status:        z.enum(['draft', 'published']),
});
