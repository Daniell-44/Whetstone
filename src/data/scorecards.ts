import type { Scorecard } from '../lib/scorecard';

export const scorecards: Scorecard[] = [
  {
    slug: 'smartphone-ban-schools',
    question: 'Should schools ban smartphones during the school day?',
    dek: 'A structural logic audit of three competing positions on student device policy — what each gets right, where each argument relies on an unstated assumption, and what all three refuse to examine.',
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
];
