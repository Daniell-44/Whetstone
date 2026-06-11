import type { RhetoricalModeResult, RhetoricalMove } from '../../../functions/_lib/rhetorical-mode/types';
import GroundednessChip from '../grounded/GroundednessChip';

const APPEAL_META: Record<string, { label: string; cls: string; bar: string; desc: string }> = {
  ethos:  { label: 'Ethos',  cls: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', desc: 'Authority / credibility' },
  pathos: { label: 'Pathos', cls: 'bg-rose-100   text-rose-700',   bar: 'bg-rose-500',   desc: 'Emotion / values'        },
  logos:  { label: 'Logos',  cls: 'bg-sky-100    text-sky-700',    bar: 'bg-sky-500',    desc: 'Logic / evidence'        },
};

function BalanceBar({ balance }: { balance: RhetoricalModeResult['balance'] }) {
  return (
    <div class="space-y-2">
      <div class="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {balance.logosPercent > 0 && <div class="bg-sky-500" style={`width: ${balance.logosPercent}%`} title={`Logos ${balance.logosPercent}%`} />}
        {balance.pathosPercent > 0 && <div class="bg-rose-500" style={`width: ${balance.pathosPercent}%`} title={`Pathos ${balance.pathosPercent}%`} />}
        {balance.ethosPercent > 0 && <div class="bg-violet-500" style={`width: ${balance.ethosPercent}%`} title={`Ethos ${balance.ethosPercent}%`} />}
      </div>
      <div class="flex items-center justify-between text-[11px] tabular-nums">
        <span class="text-sky-700">Logos {balance.logosPercent}%</span>
        <span class="text-rose-700">Pathos {balance.pathosPercent}%</span>
        <span class="text-violet-700">Ethos {balance.ethosPercent}%</span>
      </div>
    </div>
  );
}

function MoveRow({ m }: { m: RhetoricalMove }) {
  const meta = APPEAL_META[m.kind];
  return (
    <div class="rounded-lg border border-gray-200 bg-white p-3">
      <div class="flex items-center gap-2 mb-1.5">
        <span class={`text-[10px] font-medium px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
        <span class="text-[10px] text-gray-400">{meta.desc}</span>
      </div>
      <blockquote class="text-xs text-gray-600 border-l-2 border-gray-200 pl-2.5 italic mb-1.5 leading-relaxed">{m.passage}</blockquote>
      <p class="text-xs text-gray-700 leading-relaxed">{m.description}</p>
    </div>
  );
}

export default function RhetoricalModeDisplay({ result }: { result: RhetoricalModeResult }) {
  return (
    <div class="space-y-4">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <div class="flex items-center justify-between mb-3">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Appeal balance</p>
          <GroundednessChip groundedness={result.groundedness} compact />
        </div>
        <BalanceBar balance={result.balance} />
        <p class="text-xs text-gray-600 mt-3 leading-relaxed border-t border-gray-100 pt-3">
          <span class="font-semibold text-gray-800">For the reader:</span> {result.readerCaveat}
        </p>
      </div>

      {result.moves.length > 0 && (
        <div class="space-y-2">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Specific moves</p>
          {result.moves.map((m, i) => <MoveRow key={i} m={m} />)}
        </div>
      )}

      {result.notes && <p class="text-xs text-gray-400 italic">{result.notes}</p>}
    </div>
  );
}
