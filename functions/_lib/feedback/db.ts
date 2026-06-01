import type { D1Database } from '@cloudflare/workers-types';
import type { FeedbackRow, FeedbackSubmission, FeedbackSummary, TargetLens } from './types';

export interface FeedbackFilters {
  lens?: string;
  type?: string;
}

export interface FeedbackDb {
  recordFeedback(
    params: { id: string; userId: string } & FeedbackSubmission,
  ): Promise<void>;

  listFeedbackSince(sinceMs: number, filters?: FeedbackFilters): Promise<FeedbackRow[]>;

  summariseFeedback(sinceMs: number, filters?: FeedbackFilters): Promise<FeedbackSummary>;
}

export function makeFeedbackDb(db: D1Database): FeedbackDb {
  return {
    async recordFeedback({ id, userId, feedbackType, documentId, versionId, targetLens, matchKey, findingSnapshot, rating, qualitative }) {
      const snapshotJson = findingSnapshot != null ? JSON.stringify(findingSnapshot) : null;
      const now = Date.now();
      await db
        .prepare(
          `INSERT INTO feedback
             (id, user_id, document_id, version_id, feedback_type, target_lens, match_key, finding_snapshot, rating, qualitative, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          userId,
          documentId ?? null,
          versionId  ?? null,
          feedbackType,
          targetLens ?? null,
          matchKey   ?? null,
          snapshotJson,
          rating     ?? null,
          qualitative ?? null,
          now,
        )
        .run();
    },

    async listFeedbackSince(sinceMs, filters = {}) {
      let sql    = 'SELECT * FROM feedback WHERE created_at >= ?';
      const args: unknown[] = [sinceMs];

      if (filters.lens) { sql += ' AND target_lens = ?'; args.push(filters.lens); }
      if (filters.type) { sql += ' AND feedback_type = ?'; args.push(filters.type); }
      sql += ' ORDER BY created_at DESC';

      const result = await db.prepare(sql).bind(...args).all<FeedbackRow>();
      return result.results ?? [];
    },

    async summariseFeedback(sinceMs, filters = {}) {
      // Count query — group by lens+type
      let countSql    = 'SELECT target_lens, feedback_type, COUNT(*) as cnt FROM feedback WHERE created_at >= ?';
      const countArgs: unknown[] = [sinceMs];
      if (filters.lens) { countSql += ' AND target_lens = ?'; countArgs.push(filters.lens); }
      if (filters.type) { countSql += ' AND feedback_type = ?'; countArgs.push(filters.type); }
      countSql += ' GROUP BY target_lens, feedback_type';

      const countResult = await db.prepare(countSql).bind(...countArgs).all<{ target_lens: string | null; feedback_type: string; cnt: number }>();
      const counts = countResult.results ?? [];

      // Qualitative reasons query
      let qualSql    = `SELECT target_lens, feedback_type, qualitative, created_at, finding_snapshot
                        FROM feedback WHERE created_at >= ? AND qualitative IS NOT NULL AND qualitative != ''`;
      const qualArgs: unknown[] = [sinceMs];
      if (filters.lens) { qualSql += ' AND target_lens = ?'; qualArgs.push(filters.lens); }
      if (filters.type) { qualSql += ' AND feedback_type = ?'; qualArgs.push(filters.type); }
      qualSql += ' ORDER BY created_at DESC';

      const qualResult = await db.prepare(qualSql).bind(...qualArgs).all<{
        target_lens:      string | null;
        feedback_type:    string;
        qualitative:      string;
        created_at:       number;
        finding_snapshot: string | null;
      }>();

      const LENSES: TargetLens[] = ['namedFallacies', 'loadedLanguage', 'unstatedWarrants', 'counterarguments'];
      const byLens: FeedbackSummary['byLens'] = {
        namedFallacies:   { up: 0, down: 0, downRate: 0 },
        loadedLanguage:   { up: 0, down: 0, downRate: 0 },
        unstatedWarrants: { up: 0, down: 0, downRate: 0 },
        counterarguments: { up: 0, down: 0, downRate: 0 },
      };

      let thumbsUp = 0, thumbsDown = 0, auditRatings = 0, bugReports = 0;

      for (const row of counts) {
        const cnt = row.cnt;
        switch (row.feedback_type) {
          case 'finding_thumbs_up':   thumbsUp      += cnt; break;
          case 'finding_thumbs_down': thumbsDown    += cnt; break;
          case 'audit_rating':        auditRatings  += cnt; break;
          case 'bug_report':          bugReports    += cnt; break;
        }
        if (row.target_lens && LENSES.includes(row.target_lens as TargetLens)) {
          const lens = row.target_lens as TargetLens;
          if (row.feedback_type === 'finding_thumbs_up')   byLens[lens].up   += cnt;
          if (row.feedback_type === 'finding_thumbs_down') byLens[lens].down += cnt;
        }
      }

      for (const lens of LENSES) {
        const total = byLens[lens].up + byLens[lens].down;
        byLens[lens].downRate = total > 0 ? Math.round((byLens[lens].down / total) * 100) / 100 : 0;
      }

      const sinceDate = new Date(sinceMs).toISOString();
      const untilDate = new Date().toISOString();

      return {
        ok: true,
        period: { since: sinceDate, until: untilDate },
        totals: { thumbsUp, thumbsDown, auditRatings, bugReports },
        byLens,
        qualitativeReasons: (qualResult.results ?? []).map(r => ({
          lens:            r.target_lens,
          type:            r.feedback_type,
          text:            r.qualitative,
          createdAt:       new Date(r.created_at).toISOString(),
          findingSnapshot: r.finding_snapshot ? JSON.parse(r.finding_snapshot) : null,
        })),
      };
    },
  };
}
