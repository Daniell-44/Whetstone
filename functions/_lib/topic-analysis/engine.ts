import { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import type { LlmProvider } from '../providers/types';

// ---------------------------------------------------------------------------
// Topic analysis — one Pro call that turns curated sources into the full
// topic-page shape: per-source structure (central claim, load-bearing
// assumption, steelman) + an AI-SUGGESTED leaning (-100..+100, the curator
// always overrides) + the four cross-source takeaways.
//
// This is purpose-built for the topic page rather than chaining the
// cross-document engine, because the output shape is specific (4 named
// takeaways + per-source steelman + leaning) and one structured call is
// cheaper and more direct than audit-then-map.
// ---------------------------------------------------------------------------

const TOPIC_MODEL           = 'gemini-2.5-pro';
const TOPIC_THINKING_BUDGET = 8192;

export interface TopicAnalysisInputSource {
  id:     string;
  outlet: string;
  text:   string;   // the article body or a substantial excerpt
}

const PerSourceSchema = z.object({
  id:               z.string(),
  centralClaim:     z.string().min(5),
  keyWarrant:       z.string().min(5),
  steelman:         z.string().min(5),
  suggestedLeaning: z.number().min(-100).max(100),
  leaningReason:    z.string().min(3),
});

export const TopicAnalysisResultSchema = z.object({
  perSource: z.array(PerSourceSchema),
  takeaways: z.object({
    agree:            z.string().min(5),
    realDisagreement: z.string().min(5),
    sharedAssumption: z.string().min(5),
    talkingPast:      z.string().min(5),
  }),
  framing: z.string().min(10),
});

export type TopicAnalysisResult = z.infer<typeof TopicAnalysisResultSchema>;

const SYSTEM_PROMPT = `\
You are a critical-thinking analyst preparing a "topic page" that shows how a question is argued across several sources. You are given 2-5 source articles, each with an id and outlet. Produce structured analysis.

For EACH source, output:
- centralClaim: one sentence stating what this source is actually arguing.
- keyWarrant: the load-bearing assumption the source relies on but does not defend. The thing that, if a reader rejected it, would collapse the argument.
- steelman: the strongest version of THIS source's position, written as if it were correct (2-3 sentences). Not a strawman; the best case a thoughtful person who held this view would make.
- suggestedLeaning: an integer from -100 (strongly left) through 0 (centre) to +100 (strongly right), estimating where this source's framing sits politically. Judge the FRAMING, not the outlet's reputation. Be conservative: most news framing is closer to centre than people assume. This is a SUGGESTION a human editor will override.
- leaningReason: one short clause explaining the leaning estimate (what in the framing signals it).

Then across ALL sources, output four takeaways:
- agree: where all sides actually agree (the common ground beneath the dispute).
- realDisagreement: the true point of dispute - often not what the sources foreground.
- sharedAssumption: what every source assumes but none defends or even names.
- talkingPast: where sources are answering different questions and never engage each other directly.

Also output:
- framing: a neutral 2-3 sentence framing of the debate for a reader arriving cold. Descriptive, not a verdict.

CONSTRAINTS:
- Be specific to the actual texts, not generic.
- Stay descriptive on leaning; you are estimating framing position, not endorsing a label.
- Return ONLY valid JSON matching the schema. No prose outside the JSON.`;

function buildPrompt(sources: TopicAnalysisInputSource[]): string {
  const blocks = sources.map(s => `=== SOURCE ${s.id} (${s.outlet}) ===\n${s.text}\n`).join('\n');
  return `Analyse the following ${sources.length} sources for a topic page. Produce per-source structure, suggested leaning, and the four cross-source takeaways.\n\n${blocks}\n\nRespond with JSON only.`;
}

export async function analyseTopic(
  sources: TopicAnalysisInputSource[],
  deps:    { provider: LlmProvider; apiKey: string; backoffDelaysMs?: readonly number[] },
): Promise<{ result: TopicAnalysisResult; inputTokens: number; outputTokens: number }> {
  const { output, inputTokens, outputTokens } = await callWithRetry<TopicAnalysisResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'synthesize',
          model:             TOPIC_MODEL,
          systemInstruction: SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildPrompt(sources) }],
          responseFormat:    'json',
          thinkingBudget:    TOPIC_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    TopicAnalysisResultSchema,
    'topic-analysis',
    deps.backoffDelaysMs,
  );
  return { result: output, inputTokens, outputTokens };
}
