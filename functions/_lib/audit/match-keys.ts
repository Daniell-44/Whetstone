// ---------------------------------------------------------------------------
// Stable per-finding identifiers for persisting finding actions across re-runs
// ---------------------------------------------------------------------------

function normalise(text: string, maxLen?: number): string {
  let s = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  return maxLen !== undefined ? s.slice(0, maxLen) : s;
}

export function fallacyMatchKey(f: { name: string; quote: string }): string {
  return `${f.name}:${normalise(f.quote, 30)}`;
}

export function loadedLanguageMatchKey(l: { technique: string; phrase: string }): string {
  return `${l.technique}:${normalise(l.phrase)}`;
}

export function unstatedWarrantMatchKey(w: { warrant: string }): string {
  return `warrant:${normalise(w.warrant, 50)}`;
}

export function counterargumentMatchKey(c: { position: string }): string {
  return `counterarg:${normalise(c.position, 50)}`;
}

export function keyTermMatchKey(f: { term: string; issue: string }): string {
  return `keyterm:${normalise(f.term)}:${f.issue}`;
}

export function referentMatchKey(f: { phrase: string; issue: string }): string {
  return `referent:${normalise(f.phrase, 30)}:${f.issue}`;
}

export function falsifiabilityMatchKey(f: { claim: string; issue: string }): string {
  return `falsifiability:${normalise(f.claim, 40)}:${f.issue}`;
}
