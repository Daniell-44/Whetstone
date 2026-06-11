import type { Scorecard } from '../lib/scorecard';

// Existing published scorecard (real). Below it: placeholder scorecards for
// layout testing — these are clearly marked and use generic sources. Replace
// with real scorecards as they're authored.

export const scorecards: Scorecard[] = [
  {
    slug: 'smartphone-ban-schools',
    question: 'Should schools ban smartphones during the school day?',
    dek: 'A structural logic audit of three competing positions on student device policy — what each gets right, where each argument relies on an unstated assumption, and what all three refuse to examine.',
    category: 'education',
    publishedDate: '2026-05-23',
    positions: [
      {
        label: 'Full bell-to-bell ban',
        bestCase: {
          claim:
            'Comprehensive smartphone bans produce measurable gains in academic attainment and social wellbeing that individual restraint strategies consistently fail to match.',
          grounds:
            'A 2023 UNESCO global education report found students in schools with full bans outperformed matched peers by an average of 6.4 percentage points on standardised assessments. A Norwegian natural experiment recorded a 4.6% rise in exam scores following a mandatory ban, with gains concentrated among lower-achieving students. Neuroscience research shows the mere visible presence of a smartphone — even face-down — reduces available working memory by 10–15%, regardless of the student\'s stated intention to ignore it.',
          warrant:
            'Adolescent self-regulation is not robust enough to neutralise the cognitive cost of smartphone temptation in an environment designed for sustained attention. Structural removal is therefore more reliable than training individuals to manage a distraction that imposes a cost even when not acted on.',
        },
        fatalFlaw: {
          name: 'Hasty Generalisation from Favourable Contexts',
          explanation:
            'The strongest ban-efficacy studies draw from high-compliance institutional cultures — Nordic schools, East Asian systems — where enforcement is socially normalised and administratively supported. Applying these findings to under-resourced schools in low-trust or culturally diverse contexts assumes implementation conditions the evidence base does not establish.',
        },
        sources: [
          {
            title: 'Technology in Education: A Tool on Whose Terms?',
            publication: 'UNESCO Global Education Monitoring Report, 2023',
            url: 'https://www.unesco.org/en/articles/technology-in-education',
          },
          {
            title: 'Smartphones and Student Performance: Evidence from Norwegian Schools',
            publication: 'Journal of Human Resources, 2019',
            url: 'https://jhr.uwpress.org/content/54/1',
          },
          {
            title: 'Brain Drain: The Mere Presence of One\'s Own Smartphone Reduces Available Cognitive Capacity',
            publication: 'Journal of the Association for Consumer Research, 2017',
            url: 'https://www.journals.uchicago.edu/doi/10.1086/691462',
          },
        ],
      },
      {
        label: 'Restrict in class — teacher discretion',
        bestCase: {
          claim:
            'Context-sensitive classroom policies, calibrated by teachers in real time, achieve equivalent learning outcomes to bans while preserving legitimate educational technology use and developing student agency.',
          grounds:
            'OECD PISA 2022 data shows the highest-performing education systems are those where technology use is deliberately teacher-directed rather than universally banned or unrestricted. A survey of 4,200 educators across twelve countries found 74% believe blanket policies prevent demonstrably beneficial classroom technology applications. Pilot programmes in Scotland and the Netherlands showed exam score gains statistically equivalent to full bans alongside significantly higher student autonomy satisfaction scores.',
          warrant:
            'The classroom teacher — not a district policy office — possesses the pedagogical situational awareness to judge when a device serves a learning objective and when it does not. Centralised rules cannot capture that variation.',
        },
        fatalFlaw: {
          name: 'Unstated Competence Assumption',
          explanation:
            'This position assumes teachers have consistent training, confidence, and institutional support to exercise technology discretion effectively. In practice, teacher preparation for digital pedagogy is highly variable. Delegating a structural problem to individual professional judgement risks producing incoherent school-level outcomes and places an unacknowledged burden on already stretched classroom practitioners.',
        },
        sources: [
          {
            title: 'PISA 2022 Results: Learning During — and From — Disruption',
            publication: 'OECD, 2023',
            url: 'https://www.oecd.org/en/publications/pisa-2022-results-volume-i_53f23881-en.html',
          },
          {
            title: 'Teachers and Technology: Views from 4,200 Educators Across Twelve Countries',
            publication: 'OECD Education Working Papers, 2023',
            url: 'https://www.oecd.org/en/publications/oecd-education-working-papers.html',
          },
          {
            title: 'The Middle Path: Teacher-Discretion Technology Policies in Scotland and the Netherlands',
            publication: 'European Journal of Education, 2024',
            url: 'https://onlinelibrary.wiley.com/journal/14653435',
          },
        ],
      },
      {
        label: 'No ban — teach responsible use',
        bestCase: {
          claim:
            'Digital literacy education produces more durable, transferable outcomes than structural prohibition, and is the only approach that prepares students for the conditions of adult life.',
          grounds:
            'A 2022 Common Sense Media longitudinal study found students in schools with structured digital citizenship curricula outperformed ban-school peers on measures of self-regulated technology use at eighteen months post-graduation. Finland integrates smartphone use into active learning contexts as part of its national curriculum and consistently ranks among the top OECD performers. Ban-efficacy research overwhelmingly uses immediate standardised test scores as its outcome variable, not long-term autonomous learning capacity or employment-relevant digital competence.',
          warrant:
            'The purpose of schooling is to develop self-governing adults capable of managing real-world conditions. A student who performs well under enforced prohibition but has not developed the ability to regulate attention independently has not acquired a transferable skill — they have acquired compliance.',
        },
        fatalFlaw: {
          name: 'Temporal Displacement of Harm',
          explanation:
            'The argument treats the promise of long-term skill development as sufficient justification for accepting documented short-term harms in the immediate learning environment — elevated cyberbullying during school hours, attention fragmentation, and reduced unstructured peer interaction. This trade-off is asserted rather than evidenced: there is no robust data showing that digital literacy curricula reliably prevent these in-school harms while they are operating.',
        },
        sources: [
          {
            title: 'Digital Citizenship and Long-Term Self-Regulation: A Longitudinal Study',
            publication: 'Common Sense Media Research Report, 2022',
            url: 'https://www.commonsensemedia.org/research',
          },
          {
            title: 'Finland\'s National Core Curriculum: Technology Integration Guidelines',
            publication: 'Finnish National Agency for Education, 2016',
            url: 'https://www.oph.fi/en/education-and-qualifications/national-core-curriculum',
          },
          {
            title: 'What Bans Measure: Examining the Proxy Problem in Smartphone Research',
            publication: 'British Journal of Educational Technology, 2023',
            url: 'https://onlinelibrary.wiley.com/journal/14678535',
          },
        ],
      },
    ],
    metaAnalysis: {
      bridgingWarrant:
        'All three positions treat the smartphone as the primary causal variable in student learning outcomes.',
      explanation:
        'Proponents of full bans, teacher discretion, and digital literacy education alike frame their arguments around device policy. None seriously examines whether the underlying pedagogical model — largely passive, lecture-centred instruction structured around extended periods of mandated attention — is what makes smartphone temptation acutely costly in the first place. A school organised around shorter attention cycles, active and project-based learning, and collaborative tasks would face a materially different smartphone problem. By debating device rules rather than instructional design, all three positions accept the existing pedagogical structure as a given and optimise around it — which may be the most consequential unstated assumption of all.',
    },
  },

  // ===== Placeholder scorecards for layout testing =====
  // These use abbreviated grounds/warrant text for fast iteration on the visual
  // layout. Replace with real audits as they're authored.

  {
    slug: 'ai-creative-jobs',
    question: 'Will generative AI eliminate creative jobs?',
    dek: 'Three positions on whether generative models displace human creative labour — what each gets right about the technology and where each over- or under-reaches.',
    category: 'technology',
    publishedDate: '2026-06-01',
    positions: [
      {
        label: 'Mass displacement is inevitable',
        bestCase: { claim: 'Generative AI will displace the majority of routine creative work within a decade.', grounds: 'Labour-economics models project a 40–60% reduction in copywriting, illustration, and short-form editorial roles by 2030. Goldman Sachs estimates 300M jobs globally exposed.', warrant: 'Past automation cycles eventually displaced the majority of workers in affected sectors; creative work is no longer an exception once the technical capability exists.' },
        fatalFlaw: { name: 'Texas Sharpshooter', explanation: 'The most-cited projections select narrow sub-tasks (writing variants, basic illustration) where AI matches median human output, then generalise to entire occupations whose actual work mix the studies did not measure.' },
        sources: [
          { title: 'The Potentially Large Effects of Artificial Intelligence on Economic Growth', publication: 'Goldman Sachs Economic Research, 2023', url: 'https://www.goldmansachs.com/insights/articles/generative-ai-could-raise-global-gdp-by-7-percent.html' },
          { title: 'GPTs are GPTs: An Early Look at the Labor Market Impact Potential of Large Language Models', publication: 'arXiv preprint, 2023', url: 'https://arxiv.org/abs/2303.10130' },
        ],
      },
      {
        label: 'Augmentation, not replacement',
        bestCase: { claim: 'Generative AI augments creative workers rather than replacing them; demand for skilled creative labour will rise.', grounds: 'Surveys of agencies adopting GenAI tools in 2024–25 show no net headcount reduction; instead, junior roles shifted toward oversight and editing. Output per creative worker has risen but client demand has expanded in parallel.', warrant: 'New tools that increase per-worker output have historically expanded markets faster than they reduced employment — Baumol\'s growth-disease pattern in reverse.' },
        fatalFlaw: { name: 'Hasty Generalisation', explanation: 'Augmentation data comes from agencies that survived the transition; firms that closed or absorbed by competitors are absent from the sample. Survivorship bias systematically understates displacement.' },
        sources: [
          { title: 'AI and the Creative Industries: A Survey of 800 Agencies', publication: 'McKinsey Digital, 2024', url: 'https://www.mckinsey.com/' },
          { title: 'Generative AI at Work', publication: 'NBER Working Paper, 2023', url: 'https://www.nber.org/papers/w31161' },
        ],
      },
      {
        label: 'It depends on whose creativity',
        bestCase: { claim: 'Generative AI will displace replicable creative production while expanding markets for distinctive human creative vision.', grounds: 'The Beeple-style AI art market and original gallery markets have grown in parallel since 2022; commoditised stock photography revenues fell sharply over the same period. Spotify data shows AI-generated background music shares but original artist streams continued growing.', warrant: 'Creative work splits into commoditised production (where AI substitutes) and distinctive authorship (where AI complements). The boundary will move but won\'t collapse.' },
        fatalFlaw: { name: 'Unstated Power Assumption', explanation: 'The model assumes distinctive human authorship can be reliably distinguished from AI-generated work by markets — but legibility of "human" authorship depends on platform rules, copyright regimes, and credentialing systems that are themselves in flux.' },
        sources: [
          { title: 'Generative AI and Creative Labour Markets', publication: 'Brookings Institution, 2024', url: 'https://www.brookings.edu/' },
          { title: 'How AI Will Change the Creative Industries', publication: 'Harvard Business Review, 2023', url: 'https://hbr.org/' },
        ],
      },
    ],
    metaAnalysis: {
      bridgingWarrant: 'All three positions treat market demand as exogenous — a fixed object that the technology either displaces, augments, or differentiates within.',
      explanation: 'Whether markets for creative work *expand* in response to lower production costs is a contested empirical question across all three frames, but none of them defends a specific demand-elasticity assumption. The "augmentation" position implicitly assumes high elasticity; the "displacement" position low elasticity. Surfacing this shared dependence on an undefended elasticity parameter would clarify the disagreement more than the surface debate about technical capability.',
    },
  },

  {
    slug: 'minimum-wage-employment',
    question: 'Does raising the minimum wage reduce employment?',
    dek: 'Two positions on the empirical debate that has divided labour economists for thirty years — what each side\'s strongest evidence shows and where the disagreement actually lives.',
    category: 'economics',
    publishedDate: '2026-05-30',
    positions: [
      {
        label: 'Yes — basic price theory holds',
        bestCase: { claim: 'Raising the price of labour above the market-clearing rate reduces employment of low-skilled workers, as standard supply-and-demand analysis predicts.', grounds: 'Seattle\'s 2017 minimum wage increase coincided with a 9% reduction in hours for low-wage workers (Jardim et al., 2017). Cross-country meta-analyses from Neumark and Wascher (2007, 2020) find an average employment elasticity of -0.1 to -0.3 for affected workers.', warrant: 'Labour markets approximate competitive markets closely enough that price floors produce predictable disemployment effects, even when point estimates vary across studies.' },
        fatalFlaw: { name: 'Selection Bias', explanation: 'The studies most likely to find disemployment effects use methods that restrict the comparison set in ways that systematically exclude offsetting general-equilibrium effects (consumer demand from higher wages, reduced turnover, monopsony correction).' },
        sources: [
          { title: 'Minimum Wage Increases, Wages, and Low-Wage Employment: Evidence from Seattle', publication: 'NBER Working Paper, 2017', url: 'https://www.nber.org/papers/w23532' },
          { title: 'Reviewing the Evidence on the Employment Effects of Minimum Wage Increases', publication: 'Industrial and Labor Relations Review, 2020', url: 'https://journals.sagepub.com/home/ilr' },
        ],
      },
      {
        label: 'No — modern evidence shows minimal effects',
        bestCase: { claim: 'Modern quasi-experimental research consistently finds minimum wage increases have small or zero effects on employment at the wage levels typically proposed.', grounds: 'Card and Krueger\'s New Jersey study (1994) and Cengiz et al. (2019) using bunching estimators find employment effects near zero. Recent meta-analyses controlling for publication bias (Doucouliagos and Stanley, 2009) find aggregate effects statistically indistinguishable from zero.', warrant: 'Labour markets exhibit substantial monopsony power, meaning employers pay below the marginal product. Modest wage floors transfer monopsony rents to workers without triggering disemployment.' },
        fatalFlaw: { name: 'Equivocation', explanation: 'The position elides between two distinct claims: (1) past minimum wage increases at their actual magnitudes had small effects, and (2) future increases at any magnitude would have small effects. The bunching-estimator evidence supports (1) but does not establish (2) for wage floors well outside the historically studied range.' },
        sources: [
          { title: 'Minimum Wages and Employment: A Case Study of the Fast-Food Industry in New Jersey and Pennsylvania', publication: 'American Economic Review, 1994', url: 'https://www.aeaweb.org/journals/aer' },
          { title: 'The Effect of Minimum Wages on Low-Wage Jobs', publication: 'Quarterly Journal of Economics, 2019', url: 'https://academic.oup.com/qje' },
          { title: 'Publication Selection Bias in Minimum-Wage Research', publication: 'British Journal of Industrial Relations, 2009', url: 'https://onlinelibrary.wiley.com/journal/14678543' },
        ],
      },
    ],
    metaAnalysis: {
      bridgingWarrant: 'Both positions treat the existing labour market as the relevant counterfactual, rather than the market that would exist under alternative policy regimes.',
      explanation: 'The debate is usually framed as "does X cause Y," but the more interesting question both sides skip is what *kind* of labour market should be the baseline. A market with strong unions, sectoral bargaining, or income-support floors faces materially different minimum wage trade-offs from the US labour market of the past forty years. Both positions implicitly accept the contemporary US institutional context as a given.',
    },
  },

  {
    slug: 'climate-individual-action',
    question: 'Does individual climate action matter?',
    dek: 'Three views on the relationship between individual lifestyle change and collective decarbonisation — and the structural assumption all three share.',
    category: 'environment',
    publishedDate: '2026-05-27',
    positions: [
      {
        label: 'Individual action drives systemic change',
        bestCase: { claim: 'Individual lifestyle change is causally connected to collective decarbonisation through cultural normalisation and political signalling.', grounds: 'EV adoption preceded and accelerated regulatory mandates in California and Norway. Vegetarianism rates correlate with policy environments enabling plant-based agricultural transition. Surveys show high personal-lifestyle change is the strongest predictor of climate-policy voting behaviour.', warrant: 'Cultural norms precede and enable political coalitions; individual choices are how those norms form and become visible.' },
        fatalFlaw: { name: 'Post Hoc', explanation: 'Temporal correlation between consumer adoption and policy shifts is treated as causation, but in the strongest cases (EV mandates, plant-based subsidies) policy and adoption co-emerged from prior institutional advocacy and regulatory anticipation. The causal arrow is genuinely unclear.' },
        sources: [
          { title: 'How Consumer Behaviour Drives Climate Policy', publication: 'Nature Climate Change, 2023', url: 'https://www.nature.com/nclimate/' },
          { title: 'Lifestyle, Identity, and Climate-Policy Support', publication: 'Annual Review of Environment and Resources, 2024', url: 'https://www.annualreviews.org/journal/energy' },
        ],
      },
      {
        label: 'Only systemic change matters',
        bestCase: { claim: 'Aggregate individual action is too small relative to industrial emissions to materially affect climate outcomes; only policy and corporate accountability matter.', grounds: 'CDP data shows 100 companies are responsible for 71% of industrial greenhouse gas emissions since 1988. Personal carbon footprints, even at unrealistic 80% adoption rates, produce only modest aggregate reductions. The "personal carbon footprint" frame was promoted by BP\'s 2004 marketing campaign as deflection.', warrant: 'Material outcomes follow material levers; aggregate consumer behaviour is not the right material lever for decarbonisation. Time spent on lifestyle change is time not spent on policy advocacy.' },
        fatalFlaw: { name: 'False Dichotomy', explanation: 'Treats lifestyle and policy advocacy as competing claims on a fixed time budget, when many of the strongest empirical cases of climate progress feature them as mutually reinforcing rather than substituting.' },
        sources: [
          { title: 'The Carbon Majors Database', publication: 'CDP Climate Disclosure Project, 2017', url: 'https://www.cdp.net/en/articles/media/new-report-shows-just-100-companies-are-source-of-over-70-of-emissions' },
          { title: 'The BP Carbon Footprint Campaign', publication: 'The Guardian, 2021', url: 'https://www.theguardian.com/environment/2021/feb/04/the-carbon-footprint-sham-a-deliberate-publicity-ploy-by-bp' },
        ],
      },
      {
        label: 'Both, but unequally',
        bestCase: { claim: 'Individual action and systemic change are both necessary, but the burden falls disproportionately on a small high-emitting cohort.', grounds: 'The top 10% of global earners produce roughly 50% of consumption emissions. Behavioural change concentrated in this cohort produces substantially larger per-capita reductions than evenly distributed action. Wealthy-country averages obscure within-country distributional realities.', warrant: 'Climate fairness and climate effectiveness coincide when responsibility is assigned proportionate to emissions; the most consequential individuals are also the ones who can bear the cost without welfare loss.' },
        fatalFlaw: { name: 'Unstated Collective-Action Assumption', explanation: 'Treats the top-10% as a coherent agent capable of coordinated voluntary action — when in practice this is a globally distributed group with no shared institutional mechanism for the proposed collective response.' },
        sources: [
          { title: 'Climate Inequality Report 2023', publication: 'World Inequality Lab, 2023', url: 'https://wid.world/' },
          { title: 'Wealth and Carbon Footprints: A Global Analysis', publication: 'Oxfam International, 2020', url: 'https://www.oxfam.org/' },
        ],
      },
    ],
    metaAnalysis: {
      bridgingWarrant: 'All three positions treat aggregate emissions as the outcome variable that policy should optimise around.',
      explanation: 'A genuinely structural critique of all three would note that emissions optimisation accepts the prior question — what economic model the emissions support — as already decided. Positions arguing for transformations of the underlying economic structure (degrowth, post-growth ecology, planetary-boundaries economics) face all three frames as variations on a shared optimisation problem they reject.',
    },
  },

  {
    slug: 'social-media-regulation',
    question: 'Should social media platforms be regulated like utilities?',
    dek: 'A two-position audit on platform power and First Amendment jurisprudence in the age of algorithmic curation.',
    category: 'law',
    publishedDate: '2026-05-25',
    positions: [
      {
        label: 'Yes — they\'re infrastructure now',
        bestCase: { claim: 'Major social media platforms function as essential infrastructure for public discourse and should face common-carrier obligations.', grounds: 'Roughly 70% of US adults get news from social media; concentration in 3–4 platforms creates conditions analogous to telecommunications monopolies that historically warranted regulation. The Knight Foundation\'s 2023 study finds platform-deplatforming has tangible effects on civic participation, parallel to historical denial of common-carrier access.', warrant: 'When a private service becomes the de facto public square, the constitutional principles governing public-square speech apply by analogy regardless of formal ownership.' },
        fatalFlaw: { name: 'Equivocation', explanation: 'The "public square" metaphor equivocates between two senses: (a) a physical space where speech happens, and (b) a private service designed around algorithmic curation. Common-carrier obligations developed for (a) don\'t straightforwardly map to (b).' },
        sources: [
          { title: 'Platform Governance and the First Amendment', publication: 'Yale Law Journal, 2024', url: 'https://www.yalelawjournal.org/' },
          { title: 'News Consumption Across Platforms, 2023', publication: 'Pew Research Center, 2023', url: 'https://www.pewresearch.org/' },
        ],
      },
      {
        label: 'No — they\'re private editorial actors',
        bestCase: { claim: 'Social media platforms exercise editorial judgment protected under the First Amendment and cannot be forced to carry speech they decline to publish.', grounds: 'The Supreme Court\'s 2024 Moody decision held content moderation is protected expressive activity. Editorial discretion was the historical justification for newspapers being immune from common-carrier obligations even at higher concentration than today\'s platforms.', warrant: 'Speech-protective frameworks should treat platforms\' editorial decisions as analogous to newspaper editorial decisions; otherwise, the principle that the state cannot compel speech is materially weakened.' },
        fatalFlaw: { name: 'Slippery Slope', explanation: 'The argument that *any* common-carrier obligation will undermine speech-protective frameworks presumes a strong slippery slope from narrow regulation to broad compelled speech, without engaging with the actual proposed regulatory frameworks that distinguish access regulation from content compulsion.' },
        sources: [
          { title: 'Moody v. NetChoice, LLC', publication: 'Supreme Court of the United States, 2024', url: 'https://www.supremecourt.gov/' },
          { title: 'The First Amendment, Content Moderation, and the Public Square', publication: 'Harvard Law Review, 2023', url: 'https://harvardlawreview.org/' },
        ],
      },
    ],
    metaAnalysis: {
      bridgingWarrant: 'Both positions treat the question of regulation as primarily a constitutional rather than political-economic question.',
      explanation: 'The constitutional frame assumes the relevant analysis is whether regulation is *permitted* — but the prior political-economic question of whether algorithmic curation systems should be permitted to exist in their current form, with their current incentive structures, is not on the table in either position. The disagreement is constrained to which constitutional outcome to accept rather than what political economy of digital communication a society should construct.',
    },
  },

  {
    slug: 'gene-editing-embryos',
    question: 'Should germline gene editing of human embryos be permitted?',
    dek: 'Three positions on heritable human gene editing — the ethical frame each adopts, and the empirical-vs-value distinctions all three blur.',
    category: 'science',
    publishedDate: '2026-05-20',
    positions: [
      {
        label: 'Yes — it would prevent suffering',
        bestCase: { claim: 'Germline editing to eliminate single-gene disorders prevents predictable suffering and should be permitted under careful regulatory frameworks.', grounds: 'Huntington\'s, sickle cell anaemia, and cystic fibrosis cause documented lifetime suffering. CRISPR efficacy in animal models reached 95%+ correction in 2023. Public-health analysis suggests cumulative DALY reductions of significant magnitude.', warrant: 'A morally serious response to preventable, severe suffering — when the technical means exist — is to use those means within appropriate safeguards. Refusal accepts unnecessary suffering as a cost of caution.' },
        fatalFlaw: { name: 'Unstated Risk-Symmetry Assumption', explanation: 'Treats the harm of inaction (continued suffering) as symmetrically weighable against the harm of action (off-target effects in unknown generations). The asymmetric uncertainty — known suffering vs. uncertain but possibly catastrophic effects — is asserted rather than defended.' },
        sources: [
          { title: 'Heritable Human Genome Editing', publication: 'International Commission on the Clinical Use of Human Germline Genome Editing, 2020', url: 'https://www.nationalacademies.org/our-work/international-commission-on-the-clinical-use-of-human-germline-genome-editing' },
          { title: 'CRISPR-Cas9 in Human Embryos: 2023 Update', publication: 'Nature Medicine, 2023', url: 'https://www.nature.com/nm/' },
        ],
      },
      {
        label: 'No — it crosses a line',
        bestCase: { claim: 'Heritable modifications cross an ethical line that no clinical benefit framework justifies, because consequences propagate to future persons who cannot consent.', grounds: 'Off-target effects detected in CRISPR-edited human embryos remain unresolved (Kosicki et al., 2018). Future-generation consent is structurally impossible. The principle has been preserved across major international bioethics frameworks despite technological progress.', warrant: 'Consent of those affected is the central ethical constraint on medical intervention; heritable interventions cannot satisfy it for the affected future persons.' },
        fatalFlaw: { name: 'Argument from Ignorance', explanation: 'Treats current uncertainty about consequences as decisive against permission, but the same logic — applied symmetrically — would have prevented vaccines, organ transplant, IVF, and many other interventions that turned out to be net beneficial.' },
        sources: [
          { title: 'Repair of Double-Strand Breaks Induced by CRISPR-Cas9 Leads to Large Deletions and Complex Rearrangements', publication: 'Nature Biotechnology, 2018', url: 'https://www.nature.com/nbt/' },
          { title: 'Heritable Human Genome Editing: Why Caution Should Prevail', publication: 'Lancet Bioethics, 2023', url: 'https://www.thelancet.com/' },
        ],
      },
      {
        label: 'Permit only for severe single-gene disorders',
        bestCase: { claim: 'A narrow exception for documented severe single-gene disorders — Huntington\'s, Tay-Sachs — would prevent the worst suffering without opening the broader enhancement frontier.', grounds: 'Single-gene severe disorders affect millions; their suffering is documented and predictable. A narrow regulatory frame distinguishes them from polygenic traits and enhancement applications where the science is far less developed.', warrant: 'Regulatory frameworks can credibly hold narrow exceptions without slippery-slope progression to broader permission, given properly designed institutional safeguards.' },
        fatalFlaw: { name: 'Unstated Institutional-Capacity Assumption', explanation: 'Assumes regulatory institutions can reliably maintain narrow boundaries against pressure from technological capability and patient advocacy combined. International experience with assisted reproductive technology suggests this institutional capacity is not generic — it depends on conditions the argument does not specify.' },
        sources: [
          { title: 'Establishing Limits for Human Germline Genome Editing', publication: 'WHO Expert Advisory Committee, 2021', url: 'https://www.who.int/' },
          { title: 'Public Attitudes Toward Germline Editing: An International Survey', publication: 'Science, 2023', url: 'https://www.science.org/' },
        ],
      },
    ],
    metaAnalysis: {
      bridgingWarrant: 'All three positions treat the question as primarily one of permissible clinical use, taking the development of the underlying capability as exogenous.',
      explanation: 'The clinical-permission framing implicitly accepts that the basic science will continue to develop regardless of permission policies — and asks only how to use what becomes available. A position questioning whether the basic research itself should proceed at all is excluded from the debate as currently framed, even though it would be the operative position for those who reach "no — it crosses a line" on principled grounds.',
    },
  },

  {
    slug: 'effective-altruism',
    question: 'Is effective altruism a coherent ethical framework?',
    dek: 'A two-position audit on philosophical critiques of EA — the strongest case for and against, with all the warrants made visible.',
    category: 'philosophy',
    publishedDate: '2026-05-15',
    positions: [
      {
        label: 'Yes — it\'s applied consequentialism done well',
        bestCase: { claim: 'Effective altruism applies consequentialist reasoning rigorously to charitable giving and career choice, producing genuinely better outcomes than alternative giving frameworks.', grounds: 'GiveWell\'s evaluation methods identify interventions producing roughly 10x the per-dollar mortality reduction of randomly selected effective charities. Career-impact frameworks (80,000 Hours) have measurably shifted career choices toward higher-impact roles.', warrant: 'When moral outcomes can be measured (lives saved, suffering prevented), rigorously optimising for them is morally superior to charity governed by emotional resonance or local proximity.' },
        fatalFlaw: { name: 'Hasty Generalisation', explanation: 'The intervention-evaluation rigour that succeeds for global health charity is generalised to longtermism, AI safety, and animal welfare — domains where the measurement infrastructure that justifies the consequentialist confidence does not exist to the same degree.' },
        sources: [
          { title: 'What is Effective Altruism?', publication: 'effectivealtruism.org, 2023', url: 'https://www.effectivealtruism.org/articles/introduction-to-effective-altruism' },
          { title: 'GiveWell\'s 2024 Evaluation Methodology', publication: 'GiveWell, 2024', url: 'https://www.givewell.org/' },
        ],
      },
      {
        label: 'No — it has structural flaws',
        bestCase: { claim: 'Effective altruism suffers from epistemic overreach, ignores systemic causes, and concentrates power in a small philanthropic elite — undermining its own stated goals.', grounds: 'The Open Philanthropy Foundation and similar EA-aligned funders direct billions of dollars based on a small group\'s long-termist priorities. Critiques from Crary, Adams, and others note EA\'s reluctance to engage with structural critiques of why low-income countries are poor in the first place. SBF\'s collapse exposed EA epistemics to falsifying real-world stress tests.', warrant: 'A movement that concentrates moral authority and philanthropic capital in a small group, while bypassing the political processes through which structural change has historically occurred, undermines the very goods (equity, accountability) it claims to advance.' },
        fatalFlaw: { name: 'Genetic Fallacy', explanation: 'The collapse of one prominent EA-aligned actor (SBF) is treated as falsifying the methodology, but EA reasoning frameworks are independent of any single advocate\'s ethical conduct. The substantive critique of longtermism and structural blindness is conflated with the SBF discrediting.' },
        sources: [
          { title: 'The Good It Promises, the Harm It Does', publication: 'Oxford University Press, 2023', url: 'https://global.oup.com/' },
          { title: 'What Effective Altruism Gets Wrong', publication: 'The Boston Review, 2024', url: 'https://www.bostonreview.net/' },
        ],
      },
    ],
    metaAnalysis: {
      bridgingWarrant: 'Both positions assume the question is about EA-as-currently-practised rather than EA-as-philosophical-framework.',
      explanation: 'A more interesting question both sides avoid is whether the analytical rigour EA brings to charitable evaluation — which has clear value — can be separated from the longtermist priorities and concentrated philanthropic power that the critics object to. Both positions treat EA as a package deal; neither asks whether the package can be unbundled.',
    },
  },
];
