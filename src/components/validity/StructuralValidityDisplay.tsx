import type {
  StructuralValidityResult,
  SuppressedPremise,
  ValidityVerdict,
} from '../../../functions/_lib/structural-validity/types';

// The verdict is the headline: whether the conclusion actually follows. Colour
// carries the same meaning as the wording so it reads at a glance, but the
// wording never depends on the colour.
const VERDICT: Record<ValidityVerdict, { label: string; plain: string; tone: string }> = {
  valid: {
    label: 'Valid',
    plain: 'If the premises are true, the conclusion must be true.',
    tone:  'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  inductively_strong: {
    label: 'Inductively strong',
    plain: 'The premises make the conclusion likely, but do not guarantee it.',
    tone:  'text-sky-800 bg-sky-50 border-sky-200',
  },
  enthymematic: {
    label: 'Valid only with a missing premise',
    plain: 'It holds together once an unstated assumption is added — see below.',
    tone:  'text-amber-800 bg-amber-50 border-amber-200',
  },
  invalid: {
    label: 'Invalid',
    plain: 'Every premise could be true and the conclusion still false.',
    tone:  'text-red-800 bg-red-50 border-red-200',
  },
  indeterminate: {
    label: 'Indeterminate',
    plain: 'The structure is too loose to assess formally — common in prose written for a general reader.',
    tone:  'text-ink bg-surface border-hairline',
  },
};

function PremiseRow({ p }: { p: SuppressedPremise }) {
  return (
    <li class="rounded-lg border border-hairline bg-surface p-3">
      <p class="text-sm text-ink-strong leading-snug">{p.text}</p>
      <p class="mt-1.5 text-xs text-muted">
        <span class="font-semibold text-ink">Role:</span> {p.role}
        {' · '}
        {p.plausible
          ? <span class="text-emerald-700">plausible on its face</span>
          : <span class="text-red-700">questionable — worth defending explicitly</span>}
      </p>
    </li>
  );
}

export default function StructuralValidityDisplay({ result }: { result: StructuralValidityResult }) {
  const v = VERDICT[result.verdict] ?? VERDICT.indeterminate;

  return (
    <div class="space-y-4">
      <div class={`rounded-lg border p-4 ${v.tone}`}>
        <div class="flex items-baseline gap-2 flex-wrap">
          <p class="text-sm font-semibold">{v.label}</p>
          {result.formalPattern && (
            <span class="text-xs font-mono opacity-80">{result.formalPattern.name}</span>
          )}
        </div>
        <p class="mt-1 text-xs leading-relaxed opacity-90">{v.plain}</p>
      </div>

      {result.schematicForm && (
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">The argument's shape</p>
          {/* Symbolic form is dense; give it room and let it scroll rather than wrap mid-formula. */}
          <div class="overflow-x-auto rounded-lg border border-hairline bg-paper px-4 py-3">
            <code class="font-mono text-sm text-ink-strong whitespace-pre">{result.schematicForm}</code>
          </div>
          {result.formalPattern && (
            <p class="mt-1.5 text-xs text-muted leading-relaxed">{result.formalPattern.description}</p>
          )}
        </div>
      )}

      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">Why</p>
        <p class="text-sm text-ink leading-relaxed">{result.explanation}</p>
      </div>

      {result.countermodel && (
        <div class="rounded-lg border border-red-200 bg-red-50/50 p-4">
          <p class="text-xs font-semibold uppercase tracking-widest text-red-800 mb-1.5">
            A case that breaks it
          </p>
          <p class="text-sm text-ink leading-relaxed">{result.countermodel}</p>
          <p class="mt-2 text-xs text-muted leading-relaxed">
            Every premise holds in this scenario and the conclusion still fails — which is what
            makes the step invalid rather than merely weak.
          </p>
        </div>
      )}

      {result.suppressedPremises.length > 0 && (
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">
            What it takes for granted
          </p>
          <p class="text-xs text-muted leading-relaxed mb-2">
            The argument needs these to work, but never states them.
          </p>
          <ul class="space-y-2">
            {result.suppressedPremises.map((p, i) => <PremiseRow key={i} p={p} />)}
          </ul>
        </div>
      )}

      {result.notes && (
        <p class="text-xs text-muted leading-relaxed border-t border-hairline pt-3">{result.notes}</p>
      )}
    </div>
  );
}
