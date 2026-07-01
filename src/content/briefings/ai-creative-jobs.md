---
question: Will generative AI eliminate creative jobs?
category: technology
axisLeft: mass displacement
axisRight: pure augmentation
publishedDate: 2026-06-24
---

::sources
goldman   | Goldman Sachs (300M exposed)     | Goldman Sachs Research  | https://www.goldmansachs.com/        | -80 | left  | assessed
gpts      | Eloundou et al., "GPTs are GPTs" | arXiv                   | https://arxiv.org/abs/2303.10130     | -62 | left
frey      | Frey & Osborne lineage           | Oxford Martin           | https://www.oxfordmartin.ox.ac.uk/   | -70 | left
acemoglu  | Acemoglu, the "task" view        | NBER                    | https://www.nber.org/                | -10 | mid
brookings | Brookings, creative labour       | Brookings Institution   | https://www.brookings.edu/           |   6 | mid   | assessed
nberwork  | Generative AI at Work            | NBER                    | https://www.nber.org/papers/w31161   |  45 | right
mckinsey  | McKinsey, 800 agencies           | McKinsey Digital        | https://www.mckinsey.com/            |  72 | right | assessed
hbr       | HBR, augmentation                | Harvard Business Review | https://hbr.org/                     |  80 | right

::landscape
The fight over whether generative AI ends creative work has narrowed from "can the machine do it?" to a quieter question: when production gets cheap, does the market for creative work shrink, hold, or grow?

::position colour=0 source=gpts label="Mass displacement"
The displacement case reaches for scale. The "GPTs are GPTs" study found that "around 80% of the U.S. workforce could have at least 10% of their work tasks affected by the introduction of LLMs, while approximately 19% of workers may see at least 50% of their tasks impacted." Read as a jobs forecast, that becomes the long arc of automation: once the capability exists, affected sectors eventually shed most of their workers.
::audit name="Texas Sharpshooter" kind=structural
The figure measures exposure at the level of individual work tasks, then gets read as whole jobs disappearing — but a task being "affected" is not a worker being replaced, and the study never measured occupations.

The optimists answer from the other end of the same data.

::position colour=1 source=mckinsey label="Augmentation"
Surveying 800 agencies through the first adoption wave, McKinsey reported "no net headcount reduction" — junior roles shifted toward oversight and editing, while output per worker and client demand rose together. The historical pattern, they argue, is that tools which raise output expand markets faster than they shrink employment.
::audit name="Hasty Generalisation" kind=structural
The reassuring numbers come only from agencies that survived the transition; the ones that closed are absent from the sample, so survivorship bias understates displacement.

A third camp says both are right about different halves of the work.

::position colour=2 source=brookings label="Bifurcation"
Brookings draws the line down the middle: "commoditised production and distinctive authorship part ways." Stock-photography revenue collapsed while gallery and signature-artist markets grew in parallel — AI substitutes for the replicable and complements the distinctive. The boundary moves, but it doesn't close.
::audit name="Unstated Power Assumption" kind=structural
It assumes markets can reliably tell "human" authorship from AI output — but that legibility depends on platform rules, copyright, and credentialing systems that are themselves in flux.

::shared
All three treat market demand as exogenous — a fixed object the technology displaces, augments, or splits. None defends a demand-elasticity assumption, yet that parameter is doing the real work: high elasticity makes augmentation true, low elasticity makes displacement true. Argue the elasticity and you would actually be arguing the question.

::editor
My read: the bifurcation case is the most honest, but it understates how quickly the "distinctive" tier can itself be commoditised once the tools learn a signature style.
::why-wrong
If demand for creative work is genuinely elastic, cheaper production could expand the whole market enough that even the displaced find new seats.
