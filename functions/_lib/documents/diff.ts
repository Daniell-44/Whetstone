import type { AuditResult, NamedFallacy, LoadedLanguage, ToulminAnalysis, UnstatedWarrant } from '../audit/types';
import type { CounterargumentResult, Counterargument } from '../counterargument/types';

// ---------------------------------------------------------------------------
// Internal normalisation helpers
// ---------------------------------------------------------------------------

function normaliseQuoteHead(quote: string): string {
  return quote.slice(0, 30).toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalisePhraseKey(phrase: string): string {
  return phrase.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

function matchFallacies(
  from: NamedFallacy[],
  to:   NamedFallacy[],
): { removed: NamedFallacy[]; added: NamedFallacy[]; persisted: NamedFallacy[] } {
  const key = (f: NamedFallacy) => `${f.name}::${normaliseQuoteHead(f.quote)}`;
  const fromKeys = new Map(from.map(f => [key(f), f]));
  const toKeys   = new Map(to.map(f => [key(f), f]));

  return {
    removed:   from.filter(f => !toKeys.has(key(f))),
    added:     to.filter(f => !fromKeys.has(key(f))),
    persisted: from.filter(f =>  toKeys.has(key(f))),
  };
}

function matchLoadedLanguage(
  from: LoadedLanguage[],
  to:   LoadedLanguage[],
): { removed: LoadedLanguage[]; added: LoadedLanguage[]; persisted: LoadedLanguage[] } {
  const key = (item: LoadedLanguage) => `${normalisePhraseKey(item.phrase)}::${item.technique}`;
  const fromKeys = new Map(from.map(item => [key(item), item]));
  const toKeys   = new Map(to.map(item => [key(item), item]));

  return {
    removed:   from.filter(item => !toKeys.has(key(item))),
    added:     to.filter(item => !fromKeys.has(key(item))),
    persisted: from.filter(item =>  toKeys.has(key(item))),
  };
}

// ---------------------------------------------------------------------------
// Public diff types
// ---------------------------------------------------------------------------

export interface AuditDiff {
  fromAudited: boolean;
  toAudited:   boolean;
  fallacies:        { removed: NamedFallacy[]; added: NamedFallacy[]; persisted: NamedFallacy[] };
  loadedLanguage:   { removed: LoadedLanguage[]; added: LoadedLanguage[]; persisted: LoadedLanguage[] };
  unstatedWarrants: { from: UnstatedWarrant[]; to: UnstatedWarrant[] };
  toulmin:          { from: ToulminAnalysis | null; to: ToulminAnalysis | null };
  centralClaim:     { from: string | null; to: string | null; changed: boolean };
  summary: {
    fallaciesRemoved:    number;
    fallaciesAdded:      number;
    fallaciesPersisted:  number;
    loadedRemoved:       number;
    loadedAdded:         number;
    centralClaimChanged: boolean;
  };
}

export interface CounterargumentDiff {
  fromGenerated: boolean;
  toGenerated:   boolean;
  counterarguments: { from: Counterargument[]; to: Counterargument[] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function diffAuditResults(
  fromJson: string | null,
  toJson:   string | null,
): AuditDiff {
  const fromAudited = fromJson !== null;
  const toAudited   = toJson !== null;

  const from: AuditResult | null = fromJson ? (JSON.parse(fromJson) as AuditResult) : null;
  const to:   AuditResult | null = toJson   ? (JSON.parse(toJson)   as AuditResult) : null;

  const fallacies      = matchFallacies(from?.namedFallacies ?? [], to?.namedFallacies ?? []);
  const loadedLanguage = matchLoadedLanguage(from?.loadedLanguage ?? [], to?.loadedLanguage ?? []);
  const claimChanged   = !!(from && to && from.centralClaim !== to.centralClaim);

  return {
    fromAudited,
    toAudited,
    fallacies,
    loadedLanguage,
    unstatedWarrants: {
      from: from?.toulmin.unstatedWarrants ?? [],
      to:   to?.toulmin.unstatedWarrants   ?? [],
    },
    toulmin: {
      from: from?.toulmin ?? null,
      to:   to?.toulmin   ?? null,
    },
    centralClaim: {
      from:    from?.centralClaim ?? null,
      to:      to?.centralClaim   ?? null,
      changed: claimChanged,
    },
    summary: {
      fallaciesRemoved:    fallacies.removed.length,
      fallaciesAdded:      fallacies.added.length,
      fallaciesPersisted:  fallacies.persisted.length,
      loadedRemoved:       loadedLanguage.removed.length,
      loadedAdded:         loadedLanguage.added.length,
      centralClaimChanged: claimChanged,
    },
  };
}

export function diffCounterargResults(
  fromJson: string | null,
  toJson:   string | null,
): CounterargumentDiff {
  const fromGenerated = fromJson !== null;
  const toGenerated   = toJson !== null;

  const from: CounterargumentResult | null = fromJson ? (JSON.parse(fromJson) as CounterargumentResult) : null;
  const to:   CounterargumentResult | null = toJson   ? (JSON.parse(toJson)   as CounterargumentResult) : null;

  return {
    fromGenerated,
    toGenerated,
    counterarguments: {
      from: from?.counterarguments ?? [],
      to:   to?.counterarguments   ?? [],
    },
  };
}
