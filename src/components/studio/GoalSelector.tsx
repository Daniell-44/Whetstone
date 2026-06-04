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
        <label class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5 block">
          Audience
        </label>
        <div class="flex flex-wrap gap-1.5">
          {AUDIENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onAudienceChange(opt.value)}
              title={opt.hint}
              class={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                audience === opt.value
                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Intent */}
      <div class="flex-1">
        <label class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5 block">
          Intent
        </label>
        <div class="flex flex-wrap gap-1.5">
          {INTENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onIntentChange(opt.value)}
              title={opt.hint}
              class={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                intent === opt.value
                  ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
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
