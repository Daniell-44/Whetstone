// Offline A4 A/B — runs contextual-severity re-banding over the cached sample
// audits (no API). Shows how many findings change band and why, so we can judge
// whether the phase-1 model behaves sensibly before wiring it on for real.
//   npx tsx evals/a4-rebanding.ts
import { SAMPLES } from '../src/data/samples';
import { contextualSeverity } from '../functions/_lib/audit/contextual-severity';
import type { AuditResult } from '../functions/_lib/audit/types';

type Sev = 'high' | 'medium' | 'low';
const rank: Record<Sev, number> = { low: 0, medium: 1, high: 2 };

function findings(a: AuditResult): { quote: string; sev: Sev; lens: string }[] {
  const out: { quote: string; sev: Sev; lens: string }[] = [];
  for (const f of a.namedFallacies)             out.push({ quote: f.quote,   sev: f.severity, lens: f.name });
  for (const l of a.loadedLanguage)             out.push({ quote: l.phrase,  sev: l.severity, lens: l.technique });
  for (const f of (a.keyTermScrutiny ?? []))    out.push({ quote: f.usage_a, sev: f.severity, lens: `key-term "${f.term}"` });
  for (const f of (a.referentChecks ?? []))     out.push({ quote: f.evidence, sev: f.severity, lens: `referent "${f.phrase}"` });
  for (const f of (a.falsifiabilityChecks ?? [])) out.push({ quote: f.evidence, sev: f.severity, lens: 'falsifiability' });
  for (const f of (a.modalScopeChecks ?? []))   out.push({ quote: f.evidence, sev: f.severity, lens: 'modal-scope' });
  return out;
}
const counts = (ss: Sev[]) => ({ high: ss.filter(s => s === 'high').length, medium: ss.filter(s => s === 'medium').length, low: ss.filter(s => s === 'low').length });

let total = 0, changed = 0, up = 0, down = 0;
for (const s of SAMPLES) {
  const fs = findings(s.cached.audit);
  const rows = fs.map(f => {
    const cs = contextualSeverity({ quote: f.quote, severity: f.sev }, s.cached.extraction);
    return { ...f, band: cs.band as Sev, reason: cs.reason, matched: cs.matchedStatementId, changed: cs.band !== f.sev };
  });
  total += rows.length;
  const ch = rows.filter(r => r.changed);
  changed += ch.length;
  for (const r of ch) (rank[r.band] > rank[r.sev] ? up++ : down++);
  console.log(`\n### ${s.shortLabel} — ${rows.length} findings, ${s.cached.extraction.statements.length} statements`);
  console.log(`  base: ${JSON.stringify(counts(rows.map(r => r.sev)))}   ctx: ${JSON.stringify(counts(rows.map(r => r.band)))}`);
  for (const r of ch) console.log(`  ${r.sev} -> ${r.band}  [${r.lens}] "${r.quote.slice(0, 46)}${r.quote.length > 46 ? '…' : ''}" (${r.reason}${r.matched ? `, ${r.matched}` : ''})`);
  if (ch.length === 0) console.log('  (no band changes)');
}
console.log(`\n=== A4 phase-1 re-banding over ${SAMPLES.length} cached samples ===`);
console.log(`findings: ${total}   changed: ${changed}  (${up} up, ${down} down)   unchanged: ${total - changed}`);
