import type { Database } from '../types/database'

/** Narrow shape from `users` embed on note rows (`created_by_user`). */
export type NoteCreatorUserRow = {
  name: string | null
  email: string | null
}

export type BidSubmissionEntryWithCreator = Database['public']['Tables']['bids_submission_entries']['Row'] & {
  created_by_user?: NoteCreatorUserRow | NoteCreatorUserRow[] | null
  /** Per-GC note scope (v2.2217): the GC this note is about; embed carries the name for the feed pill. */
  gc_customer?: { name: string | null } | { name: string | null }[] | null
}

/** The scoped GC's display name from the PostgREST embed ('' when whole-bid). */
export function gcScopeNameFromEmbed(embed: { name: string | null } | { name: string | null }[] | null | undefined): string {
  const row = Array.isArray(embed) ? embed[0] : embed
  return (row?.name ?? '').trim()
}

export type CustomerContactWithCreatorRow = Database['public']['Tables']['customer_contacts']['Row'] & {
  created_by_user?: NoteCreatorUserRow | NoteCreatorUserRow[] | null
}

/** PostgREST select lists for note list loads with embedded `users` (must match FK names). */
export const SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR =
  'id, bid_id, contact_method, created_at, created_by, notes, occurred_at, gc_customer_id, gc_customer:customers!bids_submission_entries_gc_customer_id_fkey(name), created_by_user:users!bids_submission_entries_created_by_fkey(name, email)' as const

export const SELECT_CUSTOMER_CONTACTS_WITH_CREATOR =
  'id, customer_id, contact_date, contact_method, created_at, created_by, details, created_by_user:users!customer_contacts_created_by_fkey(name, email)' as const

export function normalizeEmbeddedCreatorUser(
  raw: NoteCreatorUserRow | NoteCreatorUserRow[] | null | undefined,
): NoteCreatorUserRow | null {
  if (raw == null) return null
  const u = Array.isArray(raw) ? raw[0] ?? null : raw
  if (u == null || typeof u !== 'object') return null
  return {
    name: typeof u.name === 'string' ? u.name : null,
    email: typeof u.email === 'string' ? u.email : null,
  }
}

/**
 * Display label for note author from embedded `users` row.
 * Prefers trimmed name, then email, then fallback when creator unknown.
 */
export function noteAuthorLabel(
  createdByUser: NoteCreatorUserRow | null | undefined,
  fallbackWhenNoUserRow: string = '—',
): string {
  const u = createdByUser
  if (u == null) return fallbackWhenNoUserRow
  const name = typeof u.name === 'string' ? u.name.trim() : ''
  if (name) return name
  const email = typeof u.email === 'string' ? u.email.trim() : ''
  if (email) return email
  return fallbackWhenNoUserRow
}

/** Line prefix for note cards ("By Alice" / "By alice@…"). */
export function noteByLineFromEmbed(
  embed: NoteCreatorUserRow | NoteCreatorUserRow[] | null | undefined,
): string {
  return noteByLine(normalizeEmbeddedCreatorUser(embed))
}

export function noteByLine(createdByUser: NoteCreatorUserRow | null | undefined): string {
  return `By ${noteAuthorLabel(createdByUser, 'Unknown')}`
}
