import { supabase } from './supabase'

/**
 * Report email subscriptions — types, pure helpers, and the typed data-access
 * boundary. The three backing tables (report_email_subscriptions,
 * report_email_subscription_authors, report_email_dispatch_log) land in
 * migration 20260718180000 and are not yet in the generated database types, so
 * every supabase call for them is cast here (via `as never`) and nowhere else.
 * Once types are regenerated post-merge, the casts can be dropped with no
 * change to callers.
 */

export interface ReportEmailSubscriptionRow {
  id: string
  recipient_user_id: string | null
  recipient_email: string | null
  label: string | null
  all_authors: boolean
  auto_send: boolean
  enabled: boolean
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ReportEmailSubscriptionAuthorRow {
  id: string
  subscription_id: string
  author_user_id: string
  created_at: string | null
}

export type RecipientKind = 'user' | 'email'

/** Editable shape used by the settings modal before it is persisted. */
export interface SubscriptionDraft {
  recipientKind: RecipientKind
  recipientUserId: string | null
  recipientEmail: string
  label: string
  allAuthors: boolean
  authorUserIds: string[]
  autoSend: boolean
  enabled: boolean
}

export type DraftValidation = { ok: true } | { ok: false; error: string }

/** One subscription plus its resolved author-id list, ready for the UI. */
export interface SubscriptionWithAuthors {
  subscription: ReportEmailSubscriptionRow
  authorUserIds: string[]
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in reportEmailSubscriptions.test.ts)
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Deliberately permissive single-address check — mirrors typical form-level validation. */
export function isValidEmail(email: string): boolean {
  const e = email.trim()
  if (!e || /\s/.test(e)) return false
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(e)
}

export function validateSubscriptionDraft(draft: SubscriptionDraft): DraftValidation {
  if (draft.recipientKind === 'user') {
    if (!draft.recipientUserId) return { ok: false, error: 'Pick a recipient.' }
  } else {
    if (!isValidEmail(draft.recipientEmail)) {
      return { ok: false, error: 'Enter a valid email address.' }
    }
  }
  if (!draft.allAuthors && draft.authorUserIds.length === 0) {
    return { ok: false, error: 'Pick at least one person, or choose “All reports”.' }
  }
  return { ok: true }
}

/**
 * The matching rule the edge function applies in SQL, expressed once here for the
 * client-side "Send now" preview and for tests: a report is in scope for a
 * subscription when the subscription covers all authors, or the report's author
 * is in its author list. Disabled subscriptions never match.
 */
export function subscriptionMatchesAuthor(
  sub: Pick<ReportEmailSubscriptionRow, 'enabled' | 'all_authors'>,
  authorUserIds: readonly string[],
  reportAuthorUserId: string,
): boolean {
  if (!sub.enabled) return false
  if (sub.all_authors) return true
  return authorUserIds.includes(reportAuthorUserId)
}

/** Human label for a subscription row: explicit label, else the recipient's name/email. */
export function recipientDisplayLabel(
  sub: Pick<ReportEmailSubscriptionRow, 'recipient_user_id' | 'recipient_email' | 'label'>,
  userNameById: ReadonlyMap<string, string>,
): string {
  const label = (sub.label ?? '').trim()
  if (label) return label
  if (sub.recipient_user_id) {
    return userNameById.get(sub.recipient_user_id)?.trim() || 'Unknown user'
  }
  return (sub.recipient_email ?? '').trim() || 'Unknown recipient'
}

/** Short summary of a subscription's author scope for the UI. */
export function scopeSummary(
  sub: Pick<ReportEmailSubscriptionRow, 'all_authors'>,
  authorUserIds: readonly string[],
  userNameById: ReadonlyMap<string, string>,
): string {
  if (sub.all_authors) return 'All reports'
  if (authorUserIds.length === 0) return 'No authors selected'
  const names = authorUserIds.map((id) => userNameById.get(id)?.trim() || 'Unknown')
  if (names.length <= 2) return `Reports from ${names.join(' & ')}`
  return `Reports from ${names[0]}, ${names[1]} +${names.length - 2} more`
}

// ---------------------------------------------------------------------------
// Data access (impure; DB-type casts contained here)
// ---------------------------------------------------------------------------

/** Loosely-typed table handle for the not-yet-generated tables. */
function table(name: string) {
  return supabase.from(name as never)
}

export async function loadReportEmailSubscriptions(): Promise<SubscriptionWithAuthors[]> {
  const [{ data: subsData, error: subsErr }, { data: authorsData, error: authorsErr }] =
    await Promise.all([
      table('report_email_subscriptions').select('*').order('created_at', { ascending: true }),
      table('report_email_subscription_authors').select('subscription_id, author_user_id'),
    ])
  if (subsErr) throw subsErr
  if (authorsErr) throw authorsErr
  const subs = (subsData ?? []) as unknown as ReportEmailSubscriptionRow[]
  const authorRows = (authorsData ?? []) as unknown as Array<{
    subscription_id: string
    author_user_id: string
  }>
  const bySub = new Map<string, string[]>()
  for (const r of authorRows) {
    const list = bySub.get(r.subscription_id) ?? []
    list.push(r.author_user_id)
    bySub.set(r.subscription_id, list)
  }
  return subs.map((subscription) => ({
    subscription,
    authorUserIds: bySub.get(subscription.id) ?? [],
  }))
}

/**
 * Insert or update a subscription and reconcile its author rows to match the
 * draft. Returns the subscription id.
 */
export async function saveReportEmailSubscription(
  draft: SubscriptionDraft,
  authUserId: string,
  existingId?: string,
): Promise<string> {
  const valid = validateSubscriptionDraft(draft)
  if (!valid.ok) throw new Error(valid.error)

  const payload = {
    recipient_user_id: draft.recipientKind === 'user' ? draft.recipientUserId : null,
    recipient_email: draft.recipientKind === 'email' ? normalizeEmail(draft.recipientEmail) : null,
    label: draft.label.trim() || null,
    all_authors: draft.allAuthors,
    auto_send: draft.autoSend,
    enabled: draft.enabled,
  }

  let subscriptionId = existingId ?? ''
  if (existingId) {
    const { error } = await table('report_email_subscriptions')
      .update(payload as never)
      .eq('id', existingId)
    if (error) throw error
  } else {
    const { data, error } = await table('report_email_subscriptions')
      .insert({ ...payload, created_by: authUserId } as never)
      .select('id')
      .single()
    if (error) throw error
    subscriptionId = (data as unknown as { id: string }).id
  }

  await reconcileSubscriptionAuthors(
    subscriptionId,
    draft.allAuthors ? [] : draft.authorUserIds,
  )
  return subscriptionId
}

/** Replace a subscription's author rows with exactly `authorUserIds`. */
export async function reconcileSubscriptionAuthors(
  subscriptionId: string,
  authorUserIds: string[],
): Promise<void> {
  const { data: existingData, error: readErr } = await table('report_email_subscription_authors')
    .select('author_user_id')
    .eq('subscription_id', subscriptionId)
  if (readErr) throw readErr
  const existing = new Set(
    ((existingData ?? []) as unknown as Array<{ author_user_id: string }>).map((r) => r.author_user_id),
  )
  const wanted = new Set(authorUserIds)

  const toAdd = [...wanted].filter((id) => !existing.has(id))
  const toRemove = [...existing].filter((id) => !wanted.has(id))

  if (toAdd.length > 0) {
    const { error } = await table('report_email_subscription_authors').insert(
      toAdd.map((author_user_id) => ({ subscription_id: subscriptionId, author_user_id })) as never,
    )
    if (error) throw error
  }
  if (toRemove.length > 0) {
    const { error } = await table('report_email_subscription_authors')
      .delete()
      .eq('subscription_id', subscriptionId)
      .in('author_user_id', toRemove)
    if (error) throw error
  }
}

export async function deleteReportEmailSubscription(id: string): Promise<void> {
  const { error } = await table('report_email_subscriptions').delete().eq('id', id)
  if (error) throw error
}

export async function setSubscriptionEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await table('report_email_subscriptions').update({ enabled } as never).eq('id', id)
  if (error) throw error
}
