import { describe, it, expect, beforeEach } from 'vitest';
import type { AuditLinkIndexDb, AuditLinkIndexRow } from '../../functions/_lib/audit-links/index-db';
import { TTL_SECONDS } from '../../functions/_lib/audit-links/storage';

const TTL_MS = TTL_SECONDS * 1000;

// ---------------------------------------------------------------------------
// Map-backed fake AuditLinkIndexDb (mirrors real D1 semantics)
// ---------------------------------------------------------------------------

function makeFakeAuditLinkIndexDb(): AuditLinkIndexDb {
  const rows = new Map<string, AuditLinkIndexRow>();

  return {
    insert: async (id, userId, title, createdAt) => {
      rows.set(id, {
        id,
        user_id:    userId,
        title,
        created_at: createdAt,
        expires_at: createdAt + TTL_MS,
        revoked:    0,
      });
    },

    listForUser: async (userId, now) => {
      // Mirrors the real impl's opportunistic purge: expired rows for this
      // user are deleted on read, not just filtered out.
      for (const [id, r] of rows) {
        if (r.user_id === userId && r.expires_at <= now) rows.delete(id);
      }
      return [...rows.values()]
        .filter(r => r.user_id === userId && r.expires_at > now)
        .sort((a, b) => b.created_at - a.created_at);
    },

    getById: async (id) => rows.get(id) ?? null,

    deleteRow: async (id, userId) => {
      const row = rows.get(id);
      if (row && row.user_id === userId) rows.delete(id);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLinkIndexDb (fake)', () => {
  let db: AuditLinkIndexDb;
  const NOW = 1_700_000_000_000;

  beforeEach(() => { db = makeFakeAuditLinkIndexDb(); });

  it('inserts and retrieves a share link row', async () => {
    await db.insert('AbCdEfGhIjKl', 'user-a', 'My argument', NOW);
    const row = await db.getById('AbCdEfGhIjKl');
    expect(row?.user_id).toBe('user-a');
    expect(row?.title).toBe('My argument');
    expect(row?.created_at).toBe(NOW);
    expect(row?.revoked).toBe(0);
  });

  it('derives expires_at from the KV TTL', async () => {
    await db.insert('AbCdEfGhIjKl', 'user-a', null, NOW);
    const row = await db.getById('AbCdEfGhIjKl');
    expect(row?.expires_at).toBe(NOW + TTL_MS);
  });

  it('allows a null title', async () => {
    await db.insert('AbCdEfGhIjKl', 'user-a', null, NOW);
    const row = await db.getById('AbCdEfGhIjKl');
    expect(row?.title).toBeNull();
  });

  it('returns null for a missing id', async () => {
    expect(await db.getById('nosuchidhere')).toBeNull();
  });

  it('lists only the given user\'s links', async () => {
    await db.insert('linkAAAAAAAA', 'user-a', 'A', NOW);
    await db.insert('linkBBBBBBBB', 'user-b', 'B', NOW);

    const list = await db.listForUser('user-a', NOW + 1000);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('linkAAAAAAAA');
  });

  it('lists newest first', async () => {
    await db.insert('linkOldOldOl', 'user-a', 'Old', NOW - 5000);
    await db.insert('linkNewNewNe', 'user-a', 'New', NOW);
    await db.insert('linkMidMidMi', 'user-a', 'Mid', NOW - 2000);

    const list = await db.listForUser('user-a', NOW + 1000);
    expect(list.map(r => r.id)).toEqual(['linkNewNewNe', 'linkMidMidMi', 'linkOldOldOl']);
  });

  it('deleteRow removes the row entirely (revocation retains nothing)', async () => {
    await db.insert('linkAAAAAAAA', 'user-a', 'A', NOW);
    await db.insert('linkBBBBBBBB', 'user-a', 'B', NOW + 1);
    await db.deleteRow('linkAAAAAAAA', 'user-a');

    const list = await db.listForUser('user-a', NOW + 1000);
    expect(list.map(r => r.id)).toEqual(['linkBBBBBBBB']);
    expect(await db.getById('linkAAAAAAAA')).toBeNull();
  });

  it('deleteRow is user-scoped: another user cannot delete the row', async () => {
    await db.insert('linkAAAAAAAA', 'user-a', 'A', NOW);
    await db.deleteRow('linkAAAAAAAA', 'user-b');
    expect(await db.getById('linkAAAAAAAA')).not.toBeNull();
  });

  it('excludes expired links from the list and purges them', async () => {
    await db.insert('linkAAAAAAAA', 'user-a', 'A', NOW);
    const justBeforeExpiry = NOW + TTL_MS - 1;
    const atExpiry         = NOW + TTL_MS;

    expect(await db.listForUser('user-a', justBeforeExpiry)).toHaveLength(1);
    expect(await db.listForUser('user-a', atExpiry)).toHaveLength(0);
    // The expired row is gone, not merely filtered.
    expect(await db.getById('linkAAAAAAAA')).toBeNull();
  });

  it('deleteRow on a missing id is a no-op', async () => {
    await db.deleteRow('nosuchidhere', 'user-a');
    expect(await db.getById('nosuchidhere')).toBeNull();
  });
});
