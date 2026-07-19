// D1 access for the email capture list. Kept behind a narrow interface so the
// handler tests can run against an in-memory fake (same shape as the
// site-feedback / analytics db modules).

export type EmailCaptureSource = 'briefing' | 'extension' | 'footer';

export interface EmailCaptureRow {
  id:         string;
  email:      string;
  source:     EmailCaptureSource;
  created_at: number;
}

export interface EmailCaptureDb {
  /** INSERT OR IGNORE: a duplicate (email, source) pair is a silent no-op. */
  insert(row: EmailCaptureRow): Promise<void>;
  /** All captures, newest first — the admin export view. */
  listAll(): Promise<EmailCaptureRow[]>;
  count(): Promise<number>;
}

export function makeEmailCaptureDb(d1: D1Database): EmailCaptureDb {
  return {
    insert: async (row) => {
      // OR IGNORE rides the UNIQUE(email, source) constraint: re-submitting
      // an address that is already on the list succeeds without a second row,
      // so the endpoint never leaks list membership.
      await d1
        .prepare('INSERT OR IGNORE INTO email_captures (id, email, source, created_at) VALUES (?, ?, ?, ?)')
        .bind(row.id, row.email, row.source, row.created_at)
        .run();
    },

    listAll: async () => {
      const result = await d1
        .prepare('SELECT id, email, source, created_at FROM email_captures ORDER BY created_at DESC')
        .all<EmailCaptureRow>();
      return result.results;
    },

    count: async () => {
      const row = await d1
        .prepare('SELECT COUNT(*) AS count FROM email_captures')
        .first<{ count: number }>();
      return row?.count ?? 0;
    },
  };
}
