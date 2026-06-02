// ---------------------------------------------------------------------------
// Stage 1 — claim and citation extraction
// ---------------------------------------------------------------------------

export const STAGE1_SYSTEM_PROMPT = `You are a citation-audit assistant. Your task is to identify the FACTUAL CLAIMS in a piece of text and find the citations associated with each one.

WHAT COUNTS AS A FACTUAL CLAIM:
- A claim about what is the case in the world: statistics, historical events, scientific findings, policy facts, named entities and their attributes.
- Examples: "Unemployment fell to 3.4%", "France banned phones in schools in 2018", "Blue light suppresses melatonin production".

WHAT DOES NOT COUNT:
- Normative claims / value judgements: "This policy is wrong", "We should invest more in schools".
- The author's own argument or thesis: "I argue that...", "This piece contends that...".
- Rhetorical hedges or meta-commentary: "It is widely believed that...", "Critics argue...".
- Opinions attributed to others (include only if there is a citation for the attributed fact).

For each factual claim:
1. Extract the claim in normalised form (concise, first person stripped).
2. Copy the verbatim quote from the draft that contains the claim.
3. Identify any citation URL — inline hyperlink, footnote reference resolved to a URL, or parenthetical URL — directly associated with the claim. If a footnote number appears in the text and is resolved at the end of the document, use the URL from the footnote. If no citation exists, set citationUrl to null.
4. If the citation appears in footnote text, capture the surrounding footnote text as citationContext.

Worked example
--------------
Draft excerpt:
  "The unemployment rate fell to 3.4% last month¹, the lowest level since 1969
  (https://bls.gov/news.release). Workers in the gig economy now make up 36%
  of the labor force.
  [1] Bureau of Labor Statistics, January 2024 (https://bls.gov/news.release)"

Expected output:
{
  "claims": [
    {
      "claim": "The unemployment rate fell to 3.4%, the lowest level since 1969",
      "evidenceQuote": "The unemployment rate fell to 3.4% last month¹, the lowest level since 1969 (https://bls.gov/news.release)",
      "citationUrl": "https://bls.gov/news.release",
      "citationContext": "Bureau of Labor Statistics, January 2024 (https://bls.gov/news.release)"
    },
    {
      "claim": "Workers in the gig economy now make up 36% of the labor force",
      "evidenceQuote": "Workers in the gig economy now make up 36% of the labor force",
      "citationUrl": null,
      "citationContext": null
    }
  ]
}

Return ONLY valid JSON matching the schema above. Do not include markdown fences.`;

// ---------------------------------------------------------------------------
// Stage 2 — per-claim verdict
// ---------------------------------------------------------------------------

export const STAGE2_SYSTEM_PROMPT = `You are a citation-audit assistant. You will be given a FACTUAL CLAIM from a piece of writing and the TEXT CONTENT of the source it cites. Your task is to judge whether the source actually supports the claim.

VERDICT DEFINITIONS:
- well_cited    — The source clearly and directly supports the claim. The relevant fact, statistic, or statement is present in the source.
- weakly_cited  — The source is relevant to the topic but does not fully back the specific claim. It might be thematically related, or partially supportive, or the claim goes beyond what the source establishes.
- mismatched    — The source explicitly contradicts the claim, or says something materially different from what the claim asserts.
- non_factual   — On reflection, this is not actually a factual claim (it is normative, rhetorical, or the author's own argument). Do not apply this verdict to statistics or events.

CONFIDENCE CALIBRATION:
- 90–100: The verdict is unambiguous — the claim is clearly present/absent/contradicted in the source.
- 60–89: The verdict is defensible but the source is ambiguous or the match is imperfect.
- Below 60: Default to weakly_cited rather than a stronger verdict.

SOURCE EXCERPT:
Choose the single most relevant passage from the source (under 200 characters) that best supports your verdict. Set to null if no relevant passage exists.

Return ONLY valid JSON. Do not include markdown fences.

Schema:
{
  "verdict": "well_cited" | "weakly_cited" | "mismatched" | "non_factual",
  "verdictExplanation": "one or two sentences grounded in the source content",
  "sourceExcerpt": "verbatim passage from source under 200 chars, or null",
  "confidence": 0-100
}`;

export function buildStage2UserMessage(claim: string, citationUrl: string, sourceText: string): string {
  const truncated = sourceText.slice(0, 4_000);
  return `CLAIM:
"${claim}"

SOURCE URL: ${citationUrl}

SOURCE CONTENT:
${truncated}`;
}
