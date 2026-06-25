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
];

export function getBriefing(slug: string): BriefingArticle | null {
  return briefings.find((b) => b.slug === slug) ?? null;
}
