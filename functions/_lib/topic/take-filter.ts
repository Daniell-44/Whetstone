// Lightweight content filter for community takes — runs server-side before a
// take is accepted. Post-moderation model: this catches the obvious stuff so
// most takes can show immediately; a human reports/removes the rest.

export const TAKE_MAX_LEN = 240;
export const NAME_MAX_LEN = 40;

// Minimal slur/abuse blocklist. Deliberately small + conservative — the goal
// is to block the indefensible, not to police opinion. Extend as needed.
const BLOCKED = [
  'nigger', 'faggot', 'retard', 'kike', 'spic', 'chink', 'tranny', 'cunt',
];

export interface FilterResult {
  ok:    boolean;
  error?: string;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '');
}

export function filterTakeBody(raw: string): FilterResult {
  const body = raw.trim();
  if (body.length === 0)            return { ok: false, error: 'Take cannot be empty.' };
  if (body.length > TAKE_MAX_LEN)   return { ok: false, error: `Keep it under ${TAKE_MAX_LEN} characters.` };
  if (/\n/.test(body))              return { ok: false, error: 'Keep it to a single line.' };
  if (/(https?:\/\/|www\.)/i.test(body)) return { ok: false, error: 'Links are not allowed in takes.' };
  const flat = normalise(body);
  if (BLOCKED.some(w => flat.includes(w))) return { ok: false, error: 'That contains language we do not allow.' };
  return { ok: true };
}

export function filterDisplayName(raw: string): FilterResult {
  const name = raw.trim();
  if (name.length === 0)          return { ok: false, error: 'Add a display name.' };
  if (name.length > NAME_MAX_LEN) return { ok: false, error: `Name must be under ${NAME_MAX_LEN} characters.` };
  const flat = normalise(name);
  if (BLOCKED.some(w => flat.includes(w))) return { ok: false, error: 'That name is not allowed.' };
  return { ok: true };
}
