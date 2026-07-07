// Audit-signature aggregation — tested through the real parser so the test
// also covers the ::position/::audit/::takes wiring it depends on.

import { describe, it, expect } from 'vitest';
import { parseBriefingFile } from '../../functions/_lib/briefing/parse';
import { auditSignature } from '../../functions/_lib/briefing/signature';

const MD = `---
question: Does the test question hold?
kind: briefing
publishedDate: 2026-07-07
axisLeft: yes pole
axisRight: no pole
---

::landscape
The landscape paragraph.

::sources
alpha | Alpha et al. | NBER | https://example.org/a | -60 | left | assessed
beta  | Beta Weekly  | Beta | https://example.org/b | 55  | right | assessed

::position colour=0 label="Yes camp" source=alpha quote="the effect is large and general"
A paragraph quoting "the effect is large and general" in context.

::audit name="Hasty Generalisation" kind=structural
One city at one wage does not carry the general claim.

::position colour=1 label="No camp" source=beta quote="prices always adjust"
A paragraph containing "prices always adjust" for the other side.

::audit name="Equivocation" kind=interpretive
The word adjust shifts sense between premises.

::takes
Gamma (2020) | https://example.org/g | "a third view" | The take's audit note.
`;

describe('auditSignature', () => {
  const article = parseBriefingFile(MD, 'signature-fixture');
  const sig = auditSignature(article);

  it('collects named fallacies from position audits, deduped, in order', () => {
    expect(sig.fallacies).toEqual(['Hasty Generalisation', 'Equivocation']);
  });

  it('counts audited positions and audited takes', () => {
    expect(sig.auditedPositions).toBe(2);
    expect(sig.auditedTakes).toBe(1);
  });

  it('tallies the groundedness mix by kind', () => {
    expect(sig.kinds).toEqual({ structural: 1, interpretive: 1, empirical: 0 });
  });

  it('exposes the first audited position quote as the featured lead', () => {
    expect(sig.lead).toEqual({
      quote:   'the effect is large and general',
      fallacy: 'Hasty Generalisation',
    });
  });

  it('returns an empty signature for an explainer with no positions', () => {
    const explainer = parseBriefingFile(
      `---\nquestion: What a term means\nkind: explainer\npublishedDate: 2026-07-07\n---\n\nJust prose.`,
      'explainer-fixture',
    );
    const empty = auditSignature(explainer);
    expect(empty.fallacies).toEqual([]);
    expect(empty.auditedPositions).toBe(0);
    expect(empty.lead).toBeUndefined();
  });
});
