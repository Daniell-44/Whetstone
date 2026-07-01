import type { Audience, Intent } from '../../../functions/_lib/audit/goals';

interface Props {
  audience:    Audience;
  intent:      Intent;
  onAudienceChange: (a: Audience) => void;
  onIntentChange:   (i: Intent) => void;
  disabled?:   boolean;
}

const AUDIENCE_OPTIONS: { value: Audience; label: string; hint: string }[] = [
  { value: 'general',      label: 'General',      hint: 'Broad public readership' },
  { value: 'academic',     label: 'Academic',      hint: 'Scholars & peer reviewers' },
  { value: 'journalistic', label: 'Journalistic',  hint: 'Editors & newsrooms' },
  { value: 'legal',        label: 'Legal / Policy', hint: 'Legal professionals' },
  { value: 'technical',    label: 'Technical',     hint: 'Engineers & scientists' },
];

const INTENT_OPTIONS: { value: Intent; label: string; hint: string }[] = [
  { value: 'persuade', label: 'Persuade', hint: 'Making a case' },
  { value: 'inform',   label: 'Inform',   hint: 'Explaining or reporting' },
  { value: 'analyse',  label: 'Analyse',  hint: 'Evaluating a position' },
  { value: 'respond',  label: 'Respond',  hint: 'Rebutting an argument' },
];

export default function GoalSelector({ audience, intent, onAudienceChange, onIntentChange, disabled }: Props) {
  return (
    <div class="flex flex-col sm:flex-row gap-4">
      {/* Audience */}
      <div class="flex-1">
        <label class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5 block">
          Audience
        </label>
        <div class="flex sm:flex-wrap gap-1.5 overflow-x-auto sm:overflow-x-visible -mx-1 px-1 pb-1 sm:pb-0 scrollbar-thin">
          {AUDIENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onAudienceChange(opt.value)}
              title={opt.hint}
              class={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                audience === opt.value
                  ? 'bg-accent/10 text-accent ring-1 ring-accent'
                  : 'bg-hairline/40 text-muted hover:bg-hairline hover:text-ink'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Intent */}
      <div class="flex-1">
        <label class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5 block">
          Intent
        </label>
        <div class="flex sm:flex-wrap gap-1.5 overflow-x-auto sm:overflow-x-visible -mx-1 px-1 pb-1 sm:pb-0 scrollbar-thin">
          {INTENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onIntentChange(opt.value)}
              title={opt.hint}
              class={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                intent === opt.value
                  ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                  : 'bg-hairline/40 text-muted hover:bg-hairline hover:text-ink'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
