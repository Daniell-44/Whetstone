export interface DbApiKey {
  id:           string;
  user_id:      string;
  name:         string;
  key_prefix:   string;
  key_hash:     string;
  created_at:   number;
  last_used_at: number | null;
  revoked_at:   number | null;
}

export interface ApiKeyDb {
  createKey(key: DbApiKey): Promise<void>;
  findByHash(hash: string): Promise<DbApiKey | null>;
  listForUser(userId: string): Promise<DbApiKey[]>;
  revokeKey(keyId: string, userId: string): Promise<void>;
  touchLastUsed(keyId: string, now: number): Promise<void>;
}
