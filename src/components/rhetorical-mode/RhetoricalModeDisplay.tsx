import type { RhetoricalModeResult, RhetoricalMove } from '../../../functions/_lib/rhetorical-mode/types';
import GroundednessChip from '../grounded/GroundednessChip';

const APPEAL_META: Record<string, { label: string; cls: string; bar: string; desc: string }> = {
  ethos:  { label: 'Authority', cls: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', desc: 'Appeals to credibility / standing (ethos)' },
  pathos: { label: 'Emotion',   cls: 'bg-rose-100   text-rose-700',   bar: 'bg-rose-500',   desc: 'Appeals to feeling / values (pathos)'    },
  logos:  { label: 'Logic',     cls: 'bg-sky-100    text-sky-700',    bar: 'bg-sky-500',    desc: 'Appeals to evidence / reasoning (logos)' },
};

function BalanceBar({ balance }: { balance: RhetoricalModeResult['balance'] }) {
  return (
    <div class="space-y-2">
      <div class="flex h-3 rounded-full overflow-hidden bg-hairline/40">
        {balance.logosPercent > 0 && <div class="bg-sky-500" style={`width: ${balance.logosPercent}%`} title={`Logic ${balance.logosPercent}%`} />}
        {balance.pathosPercent > 0 && <div class="bg-rose-500" style={`width: ${balance.pathosPercent}%`} title={`Emotion ${balance.pathosPercent}%`} />}
        {balance.ethosPercent > 0 && <div class="bg-violet-500" style={`width: ${balance.ethosPercent}%`} title={`Authority ${balance.ethosPercent}%`} />}
      </div>
      <div class="flex items-center justify-between text-xs tabular-nums">
        <span class="text-sky-700">Logic {balance.logosPercent}%</span>
        <span class="text-rose-700">Emotion {balance.pathosPercent}%</span>
        <span class="text-violet-700">Authority {balance.ethosPercent}%</span>
      </div>
    </div>
  );
}

function MoveRow({ m }: { m: RhetoricalMove }) {
  const meta = APPEAL_META[m.kind];
  return (
    <div class="rounded-lg border border-hairline bg-surface p-3">
      <div class="flex items-center gap-2 mb-1.5">
        <span class={`text-xs font-medium px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
        <span class="text-xs text-muted">{meta.desc}</span>
      </div>
      <blockquote class="text-xs text-ink border-l-2 border-hairline pl-2.5 italic mb-1.5 leading-relaxed">{m.passage}</blockquote>
      <p class="text-xs text-ink leading-relaxed">{m.description}</p>
    </div>
  );
}

export default function RhetoricalModeDisplay({ result }: { result: RhetoricalModeResult }) {
  return (
    <div class="space-y-4">
      <div class="rounded-lg border border-hairline bg-surface p-4">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold uppercase tracking-widest text-muted">What it leans on</p>
          <GroundednessChip groundedness={result.groundedness} compact />
        </div>
        <BalanceBar balance={result.balance} />
        <p class="text-xs text-ink mt-3 leading-relaxed border-t border-hairline pt-3">
          <span class="font-semibold text-ink">For the reader:</span> {result.readerCaveat}
        </p>
      </div>

      {result.moves.length > 0 && (
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-widest text-muted">Specific moves</p>
          {result.moves.map((m, i) => <MoveRow key={i} m={m} />)}
        </div>
      )}

      {result.notes && <p class="text-xs text-muted italic">{result.notes}</p>}
    </div>
  );
}
