import { supabase } from './supabase'

/**
 * Report email subscriptions — types, pure helpers, and the data-access boundary
 * for the four backing tables (report_email_subscriptions,
 * report_email_subscription_authors, report_email_subscription_team_leads —
 * v2.3480, report_email_dispatch_log), added in migrations 20260718180000 and
 * 20260915180000 and present in the generated database types.
 *
 * Scope rule (mirrored by supabase/functions/send-report-email): a report is
 * in scope when the subscription covers all authors, or its author is a named
 * author, or its author is (or is led by) a named team lead — team membership
 * is team_leader_assignments, read at send time.
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

export interface ReportEmailSubscriptionTeamLeadRow {
  id: string
  subscription_id: string
  leader_user_id: string
  created_at: string | null
}

/** One row of list_report_email_team_leads(): a leader with at least one member. */
export interface TeamLeadOption {
  user_id: string
  name: string
  member_count: number
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
  /** Team leads (v2.3480): everyone they lead, plus themselves, resolved at send time. */
  teamLeadUserIds: string[]
  autoSend: boolean
  enabled: boolean
}

export type DraftValidation = { ok: true } | { ok: false; error: string }

/** One subscription plus its resolved author-id list, ready for the UI. */
export interface SubscriptionWithAuthors {
  subscription: ReportEmailSubscriptionRow
  authorUserIds: string[]
  teamLeadUserIds: string[]
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
  if (!draft.allAuthors && draft.authorUserIds.length === 0 && draft.teamLeadUserIds.length === 0) {
    return { ok: false, error: 'Pick at least one person or team lead, or choose “All reports”.' }
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
  return subscriptionMatchesReport(
    sub,
    { authorUserIds, teamLeadUserIds: [] },
    { authorUserId: reportAuthorUserId, leaderUserIds: [] },
  )
}

/**
 * The full scope rule (v2.3480): all authors, or the author is named, or the
 * author is — or is led by — a named team lead. `leaderUserIds` is the
 * report author's leaders from team_leader_assignments.
 */
export function subscriptionMatchesReport(
  sub: Pick<ReportEmailSubscriptionRow, 'enabled' | 'all_authors'>,
  scope: { authorUserIds: readonly string[]; teamLeadUserIds: readonly string[] },
  report: { authorUserId: string; leaderUserIds: readonly string[] },
): boolean {
  if (!sub.enabled) return false
  if (sub.all_authors) return true
  if (scope.authorUserIds.includes(report.authorUserId)) return true
  if (scope.teamLeadUserIds.length === 0) return false
  if (scope.teamLeadUserIds.includes(report.authorUserId)) return true
  return report.leaderUserIds.some((leader) => scope.teamLeadUserIds.includes(leader))
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
  teamLeadUserIds: readonly string[] = [],
): string {
  if (sub.all_authors) return 'All reports'
  if (authorUserIds.length === 0 && teamLeadUserIds.length === 0) return 'No authors selected'
  const names = [
    ...authorUserIds.map((id) => userNameById.get(id)?.trim() || 'Unknown'),
    ...teamLeadUserIds.map((id) => `${userNameById.get(id)?.trim() || 'Unknown'}'s team`),
  ]
  if (names.length <= 2) return `Reports from ${names.join(' & ')}`
  return `Reports from ${names[0]}, ${names[1]} +${names.length - 2} more`
}

// ---------------------------------------------------------------------------
// Data access (impure; DB-type casts contained here)
// ---------------------------------------------------------------------------

export async function loadReportEmailSubscriptions(): Promise<SubscriptionWithAuthors[]> {
  const [
    { data: subsData, error: subsErr },
    { data: authorsData, error: authorsErr },
    { data: leadsData, error: leadsErr },
  ] = await Promise.all([
    supabase
      .from('report_email_subscriptions')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase.from('report_email_subscription_authors').select('subscription_id, author_user_id'),
    supabase.from('report_email_subscription_team_leads').select('subscription_id, leader_user_id'),
  ])
  if (subsErr) throw subsErr
  if (authorsErr) throw authorsErr
  // The team-leads table arrives with migration 20260915180000; a checkout ahead
  // of the push reads it as "no team leads" so the modal keeps working.
  if (leadsErr) console.warn('report_email_subscription_team_leads unavailable:', leadsErr.message)
  const subs: ReportEmailSubscriptionRow[] = subsData ?? []
  const authorsBySub = new Map<string, string[]>()
  for (const r of authorsData ?? []) {
    const list = authorsBySub.get(r.subscription_id) ?? []
    list.push(r.author_user_id)
    authorsBySub.set(r.subscription_id, list)
  }
  const leadsBySub = new Map<string, string[]>()
  for (const r of leadsErr ? [] : (leadsData ?? [])) {
    const list = leadsBySub.get(r.subscription_id) ?? []
    list.push(r.leader_user_id)
    leadsBySub.set(r.subscription_id, list)
  }
  return subs.map((subscription) => ({
    subscription,
    authorUserIds: authorsBySub.get(subscription.id) ?? [],
    teamLeadUserIds: leadsBySub.get(subscription.id) ?? [],
  }))
}

/** The team-lead picker's options (report-email managers; empty for anyone else). */
export async function loadReportEmailTeamLeadOptions(): Promise<TeamLeadOption[]> {
  const { data, error } = await supabase.rpc('list_report_email_team_leads')
  if (error) throw error
  const rows = Array.isArray(data) ? (data as unknown[]) : []
  return rows
    .map((r) => r as Partial<TeamLeadOption>)
    .filter((r): r is TeamLeadOption => typeof r.user_id === 'string' && typeof r.name === 'string')
    .map((r) => ({ user_id: r.user_id, name: r.name, member_count: Number(r.member_count) || 0 }))
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
    const { error } = await supabase
      .from('report_email_subscriptions')
      .update(payload)
      .eq('id', existingId)
    if (error) throw error
  } else {
    const { data, error } = await supabase
      .from('report_email_subscriptions')
      .insert({ ...payload, created_by: authUserId })
      .select('id')
      .single()
    if (error) throw error
    subscriptionId = data.id
  }

  await reconcileSubscriptionAuthors(subscriptionId, draft.allAuthors ? [] : draft.authorUserIds)
  await reconcileSubscriptionTeamLeads(subscriptionId, draft.allAuthors ? [] : draft.teamLeadUserIds)
  return subscriptionId
}

/** Diff a subscription's sidecar rows (authors or team leads) to exactly `wantedIds`. */
function diffIds(existingIds: readonly string[], wantedIds: readonly string[]): { toAdd: string[]; toRemove: string[] } {
  const existing = new Set(existingIds)
  const wanted = new Set(wantedIds)
  return {
    toAdd: [...wanted].filter((id) => !existing.has(id)),
    toRemove: [...existing].filter((id) => !wanted.has(id)),
  }
}

/** Replace a subscription's author rows with exactly `authorUserIds`. */
export async function reconcileSubscriptionAuthors(
  subscriptionId: string,
  authorUserIds: string[],
): Promise<void> {
  const { data: existingData, error: readErr } = await supabase
    .from('report_email_subscription_authors')
    .select('author_user_id')
    .eq('subscription_id', subscriptionId)
  if (readErr) throw readErr
  const { toAdd, toRemove } = diffIds((existingData ?? []).map((r) => r.author_user_id), authorUserIds)

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('report_email_subscription_authors')
      .insert(toAdd.map((author_user_id) => ({ subscription_id: subscriptionId, author_user_id })))
    if (error) throw error
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('report_email_subscription_authors')
      .delete()
      .eq('subscription_id', subscriptionId)
      .in('author_user_id', toRemove)
    if (error) throw error
  }
}

/** Replace a subscription's team-lead rows with exactly `leaderUserIds` (v2.3480). */
export async function reconcileSubscriptionTeamLeads(
  subscriptionId: string,
  leaderUserIds: string[],
): Promise<void> {
  const { data: existingData, error: readErr } = await supabase
    .from('report_email_subscription_team_leads')
    .select('leader_user_id')
    .eq('subscription_id', subscriptionId)
  if (readErr) {
    // Pre-migration checkout: nothing to reconcile unless leads were picked.
    if (leaderUserIds.length === 0) return
    throw new Error('Team leads need the database update (migration 20260915180000) before they can be saved.')
  }
  const { toAdd, toRemove } = diffIds((existingData ?? []).map((r) => r.leader_user_id), leaderUserIds)

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('report_email_subscription_team_leads')
      .insert(toAdd.map((leader_user_id) => ({ subscription_id: subscriptionId, leader_user_id })))
    if (error) throw error
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('report_email_subscription_team_leads')
      .delete()
      .eq('subscription_id', subscriptionId)
      .in('leader_user_id', toRemove)
    if (error) throw error
  }
}

export async function deleteReportEmailSubscription(id: string): Promise<void> {
  const { error } = await supabase.from('report_email_subscriptions').delete().eq('id', id)
  if (error) throw error
}

export async function setSubscriptionEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('report_email_subscriptions').update({ enabled }).eq('id', id)
  if (error) throw error
}
