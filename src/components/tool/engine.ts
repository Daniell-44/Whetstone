// ---------------------------------------------------------------------------
// engine.ts - shared engine-run plumbing (Stage 2 of the audit/studio
// consolidation). One home for the fetch -> parse -> done/error/NETWORK
// state machine that every engine and lens call was repeating, so the
// Reader, Studio, and the merged workbench cannot drift apart on loading
// states or error handling.
//
// These are plain async functions rather than hooks: both call sites already
// hold their own useState setters, and a function that takes a setter is the
// smallest thing that dedupes the logic without dictating component state
// shape.
// ---------------------------------------------------------------------------

import { track } from '../../lib/analytics/track';

/** The lifecycle every engine/lens section moves through. */
export type SectionState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: T }
  | { status: 'error'; code: string; message: string };

export type LensName =
  | 'presupposition'
  | 'rhetorical-mode'
  | 'epistemic-humility'
  | 'disagreement-engagement'
  | 'structural-incentive';

export const NETWORK_MESSAGE = 'Network error - check your connection.';

export interface CallEngineOpts<T> {
  url: string;
  /** JSON body; omit for a bare POST (the version-scoped endpoints). */
  body?: unknown;
  /** Pull the payload out of the ok envelope (d.audit / d.extraction / d.result). */
  pick: (data: any) => T;
  /** Friendly overrides by error code; unmapped codes fall through to the server message. */
  errorMessages?: Record<string, string>;
  /** Message shown when the fetch itself throws; defaults to NETWORK_MESSAGE. */
  networkMessage?: string;
}

export type EngineOutcome<T> =
  | { ok: true;  data: T; envelope: any }
  | { ok: false; code: string; message: string };

/**
 * One engine call as a promise: POST, parse the ok/error envelope, map error
 * codes to friendly copy. Never throws - a network failure is an outcome.
 */
export async function callEngine<T>(opts: CallEngineOpts<T>): Promise<EngineOutcome<T>> {
  const { url, body, pick, errorMessages, networkMessage } = opts;
  try {
    const res = await fetch(url, body === undefined
      ? { method: 'POST' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json() as
      | ({ ok: true } & Record<string, unknown>)
      | { ok: false; error: { code: string; message: string } };
    if (data.ok) return { ok: true, data: pick(data), envelope: data };
    return { ok: false, code: data.error.code, message: errorMessages?.[data.error.code] ?? data.error.message };
  } catch {
    return { ok: false, code: 'NETWORK', message: networkMessage ?? NETWORK_MESSAGE };
  }
}

export interface RunEngineOpts<T> extends CallEngineOpts<T> {
  setter: (s: SectionState<T>) => void;
  /** Runs on ok with the full envelope - follow-up engines, analytics. */
  onOk?: (data: any) => void;
  /** Always runs last, success or failure (the checkDone bookkeeping slot). */
  onSettled?: () => void;
}

/**
 * callEngine driving a SectionState setter: sets loading, POSTs, and lands
 * the section in done/error. Callers wanting concurrency just don't await it.
 */
export async function runEngine<T>(opts: RunEngineOpts<T>): Promise<void> {
  const { setter, onOk, onSettled, ...callOpts } = opts;
  setter({ status: 'loading' });
  const outcome = await callEngine<T>(callOpts);
  try {
    if (outcome.ok) {
      setter({ status: 'done', data: outcome.data });
      onOk?.(outcome.envelope);
    } else {
      setter({ status: 'error', code: outcome.code, message: outcome.message });
    }
  } finally {
    // Bookkeeping must survive a throwing setter/onOk - a stuck "running"
    // flag is worse than a lost result.
    onSettled?.();
  }
}

const LENS_EVENT: Record<LensName, string> = {
  'presupposition':          'presupposition_requested',
  'rhetorical-mode':         'rhetorical_mode_requested',
  'epistemic-humility':      'epistemic_humility_requested',
  'disagreement-engagement': 'disagreement_engagement_requested',
  'structural-incentive':    'structural_incentive_requested',
};

export interface RunLensOpts {
  lens:    LensName;
  text:    string;
  /** Analytics surface ('reader' | 'studio'). */
  surface: string;
  setter:  (s: SectionState<any>) => void;
  /** Studio also emits a completion event carrying lens-specific metadata. */
  emitDoneEvent?: boolean;
}

/** Run one deeper lens against its endpoint. Auth/quota enforced server-side. */
export async function runLens({ lens, text, surface, setter, emitDoneEvent = false }: RunLensOpts): Promise<void> {
  track(LENS_EVENT[lens] as any, { surface });
  await runEngine<any>({
    url:    `/api/${lens}`,
    body:   { text },
    setter,
    pick:   d => d.result,
    onOk:   emitDoneEvent ? (data) => {
      const r = data.result as any;
      const meta: Record<string, string | number> =
        lens === 'presupposition'          ? { finding_count: r.presuppositions?.length ?? 0 } :
        lens === 'rhetorical-mode'         ? { dominant_appeal: r.dominantAppeal ?? 'unknown' } :
        lens === 'epistemic-humility'      ? { verdict: r.overallVerdict ?? 'unknown' } :
        lens === 'disagreement-engagement' ? { verdict: r.overallVerdict ?? 'unknown' } :
                                             { alignment_count: r.alignments?.length ?? 0 };
      track(LENS_EVENT[lens] as any, { surface: `${surface}_done`, ...meta });
    } : undefined,
  });
}
