import { ANALYTICS_EVENT_NAMES, EVENT_METADATA_ALLOWLIST, type AnalyticsEventName } from './events';

export interface AnalyticsRow {
  id:           string;
  timestamp:    number;
  session_hash: string;
  user_id:      string | null;
  event_name:   AnalyticsEventName;
  path:         string | null;
  metadata:     string | null;   // JSON
}

export interface IncomingEvent {
  eventName:   string;            // validated against catalogue
  sessionHash: string;            // short opaque id from the client
  userId:      string | null;
  path:        string | null;
  metadata:    Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Sanitise metadata: strip keys not in the allowlist for this event, coerce
// values to primitive strings/numbers/booleans only. Keeps the schema honest
// even when the client tries to send something it shouldn't.
// ---------------------------------------------------------------------------

function sanitiseMetadata(
  eventName: AnalyticsEventName,
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) return null;
  const allow = EVENT_METADATA_ALLOWLIST[eventName] ?? [];
  if (allow.length === 0) return null;

  const out: Record<string, string | number | boolean> = {};
  for (const key of allow) {
    const v = metadata[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string')  out[key] = v.slice(0, 200); // hard cap on string length
    if (typeof v === 'number')  out[key] = Number.isFinite(v) ? v : 0;
    if (typeof v === 'boolean') out[key] = v;
  }
  return Object.keys(out).length === 0 ? null : JSON.stringify(out);
}

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

export interface AnalyticsDb {
  insert(event: IncomingEvent): Promise<void>;
  count(since: number): Promise<number>;
  countByEvent(since: number): Promise<Array<{ event_name: string; count: number }>>;
  purgeOlderThan(timestamp: number): Promise<number>;
}

export function makeAnalyticsDb(d1: D1Database): AnalyticsDb {
  return {
    insert: async (event) => {
      // Reject events not in the catalogue at the DB layer — defence in depth
      if (!ANALYTICS_EVENT_NAMES.includes(event.eventName as AnalyticsEventName)) return;

      const id = crypto.randomUUID();
      const metadata = sanitiseMetadata(event.eventName as AnalyticsEventName, event.metadata);

      await d1
        .prepare(
          'INSERT INTO analytics_events (id, timestamp, session_hash, user_id, event_name, path, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          Date.now(),
          event.sessionHash.slice(0, 64),
          event.userId,
          event.eventName,
          event.path?.slice(0, 200) ?? null,
          metadata,
        )
        .run();
    },

    count: async (since) => {
      const row = await d1
        .prepare('SELECT COUNT(*) AS count FROM analytics_events WHERE timestamp > ?')
        .bind(since)
        .first<{ count: number }>();
      return row?.count ?? 0;
    },

    countByEvent: async (since) => {
      const result = await d1
        .prepare(
          'SELECT event_name, COUNT(*) AS count FROM analytics_events WHERE timestamp > ? GROUP BY event_name ORDER BY count DESC',
        )
        .bind(since)
        .all<{ event_name: string; count: number }>();
      return result.results;
    },

    purgeOlderThan: async (timestamp) => {
      const result = await d1
        .prepare('DELETE FROM analytics_events WHERE timestamp < ?')
        .bind(timestamp)
        .run();
      return result.meta.changes ?? 0;
    },
  };
}
