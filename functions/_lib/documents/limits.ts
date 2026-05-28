import type { DocumentDb } from './types';

// Free users may only have one active document — archive the oldest before creating a second.
export async function ensureFreeUserCanCreateDocument(
  db:                   DocumentDb,
  userId:               string,
  hasActiveSubscription: boolean,
): Promise<void> {
  if (hasActiveSubscription) return;

  const count = await db.countActiveDocumentsForUser(userId);
  if (count === 0) return;

  const docs   = await db.listActiveDocumentsForUser(userId);
  const oldest = docs[docs.length - 1]; // sorted DESC by updated_at; last = oldest
  if (oldest) await db.archiveDocument(oldest.id);
}
