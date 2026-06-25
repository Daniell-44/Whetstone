import type { BriefingArticle } from '../../functions/_lib/briefing/types';

// Article-format briefings. The minimum-wage piece is the working sample that
// proves the renderer + format (quotes here are illustrative until real sources
// are gathered). New briefings are authored against this shape.

export const briefings: BriefingArticle[] = [
  {
    slug: 'minimum-wage-jobs',
    question: 'Does raising the minimum wage cost jobs?',
    category: 'economics',
    publishedDate: '2026-06-25',
    spectrumAxis: { left: 'competitive market', right: 'monopsony power' },
    sources: [
      { id: 'wsj',      label: 'WSJ column',            publication: 'Wall Street Journal',  url: 'https://www.wsj.com/',                         leaning: -75, side: 'left',  assessed: true  },
      { id: 'neumark',  label: 'Neumark & Wascher',     publication: 'NBER',                 url: 'https://www.nber.org/',                       leaning: -82, side: 'left',  assessed: false },
      { id: 'cbo',      label: 'CBO, 2019',             publication: 'Congressional Budget Office', url: 'https://www.cbo.gov/',                 leaning: -55, side: 'left',  assessed: false },
      { id: 'jardim',   label: 'Jardim et al. (Seattle)', publication: 'NBER',               url: 'https://www.nber.org/papers/w23532',          leaning: -48, side: 'left',  assessed: false },
      { id: 'autor',    label: 'Autor et al.',          publication: 'Review of Economics',  url: 'https://direct.mit.edu/rest',                 leaning:   2, side: 'mid',   assessed: false },
      { id: 'manning',  label: 'Manning, monopsony survey', publication: 'JEL',              url: 'https://www.aeaweb.org/journals/jel',         leaning:  28, side: 'mid',   assessed: false },
      { id: 'cengiz',   label: 'Cengiz et al.',         publication: 'QJE',                  url: 'https://academic.oup.com/qje',                leaning:  64, side: 'right', assessed: false },
      { id: 'card',     label: 'Card & Krueger (1994)', publication: 'American Economic Review', url: 'https://www.aeaweb.org/journals/aer',     leaning:  78, side: 'right', assessed: false },
      { id: 'atlantic', label: 'The Atlantic piece',    publication: 'The Atlantic',         url: 'https://www.theatlantic.com/',                leaning:  72, side: 'right', assessed: true  },
      { id: 'dube',     label: 'Dube et al.',           publication: 'IRLE',                 url: 'https://irle.berkeley.edu/',                  leaning:  84, side: 'right', assessed: false },
    ],
    blocks: [
      { type: 'landscape', text: 'Thirty years after Card and Krueger, the question still splits economists — and it has narrowed to one point: how competitively does the low-wage market actually clear?' },
      {
        type: 'position',
        colourIndex: 0,
        label: 'Price floors cut jobs',
        sourceId: 'wsj',
        quote: 'labour is no exception',
        paragraph: 'The traditional case is almost reflexively simple. As one Wall Street Journal columnist puts it, "raise the price of anything and people buy less of it — labour is no exception," and the people who lose their jobs are "the youngest and least-skilled, the very workers the policy claims to help." On its own terms it isn\'t wrong. But the whole case rests on two words — no exception — and that is precisely the claim in dispute.',
        audit: {
          name: 'Begging the Question',
          kind: 'structural',
          explanation: '"No exception" asserts the very thing in question — that this market behaves like the textbook competitive one.',
        },
      },
      { type: 'prose', text: 'Which is where the evidence comes in — and the other camp denies exactly that.' },
      {
        type: 'position',
        colourIndex: 1,
        label: 'Monopsony absorbs it',
        sourceId: 'atlantic',
        quote: 'the job losses the theory predicts simply don’t show up',
        paragraph: 'A labour economist writing in The Atlantic answers directly: "we\'ve run this experiment dozens of times across dozens of states, and the job losses the theory predicts simply don\'t show up — what shows up is higher pay and lower turnover." Empirically it\'s the stronger hand. Yet it makes a quiet move of its own, sliding from the increases we\'ve actually measured to increases of any size — which proves that modest rises did little harm, not that no rise ever could.',
        audit: {
          name: 'Equivocation',
          kind: 'structural',
          explanation: 'It slides from "increases within the studied range did little harm" to "no increase could" — two different claims.',
        },
      },
      { type: 'shared', text: 'Both sides, though, stand on the same floor. Each treats today’s labour market as the fixed backdrop; neither asks what a market with sectoral bargaining — or a higher wage held for a decade — would do. That is the question that would actually settle it.' },
      {
        type: 'editorView',
        text: 'If forced to bet, the monopsony read is stronger at the wage levels actually proposed — but I hold it loosely, because those proposals keep drifting past the range we’ve studied.',
        whyWrong: 'A large enough jump leaves that studied range, and the textbook result could reassert itself.',
      },
    ],
  },

  {
    slug: 'ai-creative-jobs',
    question: 'Will generative AI eliminate creative jobs?',
    category: 'technology',
    publishedDate: '2026-06-24',
    spectrumAxis: { left: 'mass displacement', right: 'pure augmentation' },
    sources: [
      { id: 'goldman',  label: 'Goldman Sachs (300M exposed)',    publication: 'Goldman Sachs Research',     url: 'https://www.goldmansachs.com/',          leaning: -80, side: 'left',  assessed: true  },
      { id: 'gpts',     label: 'Eloundou et al., "GPTs are GPTs"', publication: 'arXiv',                     url: 'https://arxiv.org/abs/2303.10130',       leaning: -62, side: 'left',  assessed: false },
      { id: 'frey',     label: 'Frey & Osborne lineage',          publication: 'Oxford Martin',              url: 'https://www.oxfordmartin.ox.ac.uk/',     leaning: -70, side: 'left',  assessed: false },
      { id: 'acemoglu', label: 'Acemoglu, the "task" view',       publication: 'NBER',                       url: 'https://www.nber.org/',                  leaning: -10, side: 'mid',   assessed: false },
      { id: 'brookings',label: 'Brookings, creative labour',      publication: 'Brookings Institution',      url: 'https://www.brookings.edu/',             leaning:   6, side: 'mid',   assessed: true  },
      { id: 'nberwork', label: 'Generative AI at Work',           publication: 'NBER',                       url: 'https://www.nber.org/papers/w31161',     leaning:  45, side: 'right', assessed: false },
      { id: 'mckinsey', label: 'McKinsey, 800 agencies',          publication: 'McKinsey Digital',           url: 'https://www.mckinsey.com/',              leaning:  72, side: 'right', assessed: true  },
      { id: 'hbr',      label: 'HBR, augmentation',               publication: 'Harvard Business Review',    url: 'https://hbr.org/',                       leaning:  80, side: 'right', assessed: false },
    ],
    blocks: [
      { type: 'landscape', text: 'The fight over whether generative AI ends creative work has narrowed from "can the machine do it?" to a quieter question: when production gets cheap, does the market for creative work shrink, hold, or grow?' },
      {
        type: 'position', colourIndex: 0, label: 'Mass displacement', sourceId: 'goldman',
        quote: '300 million jobs globally exposed',
        paragraph: 'The displacement case reaches for scale. Goldman Sachs put "300 million jobs globally exposed" to automation by generative models, and labour-economics models project a 40–60% cut in routine copywriting, illustration, and short-form editorial work by 2030. The logic is the long arc of automation: once the capability exists, affected sectors eventually shed most of their workers.',
        audit: { name: 'Texas Sharpshooter', kind: 'structural', explanation: 'The headline figure is drawn around the narrow sub-tasks where AI already matches median output, then generalised to whole occupations the studies never measured.' },
      },
      { type: 'prose', text: 'The optimists answer from the other end of the same data.' },
      {
        type: 'position', colourIndex: 1, label: 'Augmentation', sourceId: 'mckinsey',
        quote: 'no net headcount reduction',
        paragraph: 'Surveying 800 agencies through the first adoption wave, McKinsey reported "no net headcount reduction" — junior roles shifted toward oversight and editing, while output per worker and client demand rose together. The historical pattern, they argue, is that tools which raise output expand markets faster than they shrink employment.',
        audit: { name: 'Hasty Generalisation', kind: 'structural', explanation: 'The reassuring numbers come only from agencies that survived the transition; the ones that closed are absent from the sample, so survivorship bias understates displacement.' },
      },
      { type: 'prose', text: 'A third camp says both are right about different halves of the work.' },
      {
        type: 'position', colourIndex: 2, label: 'Bifurcation', sourceId: 'brookings',
        quote: 'commoditised production and distinctive authorship part ways',
        paragraph: 'Brookings draws the line down the middle: "commoditised production and distinctive authorship part ways." Stock-photography revenue collapsed while gallery and signature-artist markets grew in parallel — AI substitutes for the replicable and complements the distinctive. The boundary moves, but it doesn\'t close.',
        audit: { name: 'Unstated Power Assumption', kind: 'structural', explanation: 'It assumes markets can reliably tell "human" authorship from AI output — but that legibility depends on platform rules, copyright, and credentialing systems that are themselves in flux.' },
      },
      { type: 'shared', text: 'All three treat market demand as exogenous — a fixed object the technology displaces, augments, or splits. None defends a demand-elasticity assumption, yet that parameter is doing the real work: high elasticity makes augmentation true, low elasticity makes displacement true. Argue the elasticity and you would actually be arguing the question.' },
      {
        type: 'editorView',
        text: 'My read: the bifurcation case is the most honest, but it understates how quickly the "distinctive" tier can itself be commoditised once the tools learn a signature style.',
        whyWrong: 'If demand for creative work is genuinely elastic, cheaper production could expand the whole market enough that even the displaced find new seats.',
      },
    ],
  },
];

export function getBriefing(slug: string): BriefingArticle | null {
  return briefings.find((b) => b.slug === slug) ?? null;
}
