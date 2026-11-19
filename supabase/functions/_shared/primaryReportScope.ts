/**
 * Primary scoping, reports, for the senders that read with the service role (the owner's word of 2026-11-19: a
 * primary reads a report only when its job names them as account manager or lists them as superintendent). Row
 * security holds a primary to those reports in the app (migration *_primary_scope_reports), but a function that
 * switches to the service role queries as nobody, so no policy reaches it. The field report emails, the digest and the
 * push on a new report each name a recipient, and each asks here which reports that recipient may be sent.
 *
 * The rule itself is in the database and nowhere else: `reports_open_to_user(user, report ids)` and, for an outside
 * address, `reports_open_to_address(address, report ids)` (migration *_primary_reports_named_user, service role only).
 * Both answer every id for a recipient who is not a primary. An outside address is narrowed only when it is a
 * primary's own account address, which My email subscriptions already lists as that primary's.
 *
 * The digest also lists each job's crew time (hours, clock notes, cost). `report_jobs_open_to_user(user, job ids)`
 * answers which jobs' crew time a recipient may be sent: every job unless they are a primary, and then the jobs whose
 * reports they read.
 *
 * When the question fails (the functions are not on the database yet, the network drops) this file does not guess
 * the rule. It reads who the primaries are, one plain read of `users`. A recipient who is not one is sent everything,
 * as before the rule. A primary, or anyone when that read fails too, is sent nothing: a held report is not logged as
 * sent, so the next send picks it up, and a report that leaks cannot be taken back. Each case logs one line.
 *
 * It imports nothing, and `admin` is typed by the calls it makes, so a function that imports it takes on no other file.
 */

/** The service-role client, as far as this file reads it: the three `rpc` calls and one read of `users`. */
export interface ReportScopeAdmin {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
  /** Not the read's own chain: checking supabase-js's client against one runs past TypeScript's instantiation limit (see `reportSubject.ts`). */
  from: (table: string) => unknown
}

/** The read of the primaries, as this file makes it: `.from('users').select('id, email').eq('role', 'primary')`. A test's fake is typed against it. */
export type PrimariesRead = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>
    }
  }
}

/** Who a send is for: one of our users, or an outside address. The user wins when both are given; with neither, nothing is narrowed. */
export type ReportRecipient = { userId?: string | null; email?: string | null }

function words(e: unknown): string {
  return e instanceof Error ? e.message : typeof (e as { message?: unknown } | null)?.message === 'string' ? (e as { message: string }).message : String(e)
}

/** Two addresses are the same account's: trimmed, whatever their case. The match `get_my_email_schedule` makes. */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? '').trim().toLowerCase()
  return left !== '' && left === (b ?? '').trim().toLowerCase()
}

/** True or false when the read of the primaries answers; null when it does not, and nobody can say. */
async function recipientIsPrimary(admin: ReportScopeAdmin, userId: string | null, email: string | null): Promise<boolean | null> {
  try {
    const { data, error } = await (admin as unknown as PrimariesRead).from('users').select('id, email').eq('role', 'primary')
    if (error || !Array.isArray(data)) return null
    return (data as Array<{ id?: unknown; email?: unknown }>).some((row) =>
      userId ? row.id === userId : sameAddress(typeof row.email === 'string' ? row.email : null, email),
    )
  } catch {
    return null
  }
}

/**
 * One question to the database, and what to do when it has no answer. `ids` are distinct and not empty, and one of
 * `userId` and `email` is given. The answer is kept to the ids asked.
 */
async function openTo(admin: ReportScopeAdmin, fn: string, args: Record<string, unknown>, ids: readonly string[], userId: string | null, email: string | null): Promise<Set<string>> {
  let why: string
  try {
    const { data, error } = await admin.rpc(fn, args)
    if (!error && Array.isArray(data)) {
      const asked = new Set(ids)
      return new Set((data as unknown[]).filter((id): id is string => typeof id === 'string' && asked.has(id)))
    }
    why = error?.message ?? 'no answer'
  } catch (e) {
    why = words(e)
  }

  const primary = await recipientIsPrimary(admin, userId, email)
  if (primary === false) {
    console.error(`${fn} failed (${why}). The recipient is not a primary: sent as before.`)
    return new Set(ids)
  }
  console.error(`${fn} failed (${why}). ${primary ? 'The recipient is a primary' : 'Who the primaries are did not read either'}: nothing is sent to this recipient.`)
  return new Set()
}

/**
 * Of `reportIds`, the ones that recipient may be sent. Every one for a recipient who is not a primary, and when no
 * recipient is named. With no report nothing is asked.
 */
export async function reportsOpenToRecipient(admin: ReportScopeAdmin, recipient: ReportRecipient, reportIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(reportIds)]
  if (ids.length === 0) return new Set()
  const userId = recipient.userId?.trim() || null
  const email = userId ? null : recipient.email?.trim() || null
  if (!userId && !email) return new Set(ids)
  return userId
    ? openTo(admin, 'reports_open_to_user', { p_user_id: userId, p_report_ids: ids }, ids, userId, null)
    : openTo(admin, 'reports_open_to_address', { p_email: email, p_report_ids: ids }, ids, null, email)
}

/**
 * Of `jobIds`, the jobs whose crew time (hours, clock notes, cost) that user may be sent in the digest. Every one for
 * a user who is not a primary, and when no user is named. With no job nothing is asked.
 */
export async function reportJobsOpenToUser(admin: ReportScopeAdmin, userId: string | null | undefined, jobIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(jobIds)]
  if (ids.length === 0) return new Set()
  const who = userId?.trim() || null
  if (!who) return new Set(ids)
  return openTo(admin, 'report_jobs_open_to_user', { p_user_id: who, p_job_ids: ids }, ids, who, null)
}

/** The rows of `rows` on a job whose crew time that user may be sent, in their order. A row on no job is not sent. */
export async function rowsOnJobsOpenToUser<T extends { job_ledger_id: string | null }>(admin: ReportScopeAdmin, userId: string | null | undefined, rows: readonly T[]): Promise<T[]> {
  const onJob = rows.filter((r): r is T & { job_ledger_id: string } => !!r.job_ledger_id)
  if (onJob.length === 0) return []
  const open = await reportJobsOpenToUser(admin, userId, onJob.map((r) => r.job_ledger_id))
  return onJob.filter((r) => open.has(r.job_ledger_id))
}

/** The people a notice about that one report may go to: the ids who read it, in the order given. */
export async function recipientsWhoReadReport(admin: ReportScopeAdmin, reportId: string | null | undefined, userIds: readonly string[]): Promise<string[]> {
  if (!reportId || userIds.length === 0) return [...userIds]
  const open = await Promise.all(userIds.map((userId) => reportsOpenToRecipient(admin, { userId }, [reportId])))
  return userIds.filter((_, i) => open[i]!.has(reportId))
}

/** The rows of `rows` that recipient may be sent, in their order. `rows` are reports, or anything keyed by a report's id. */
export async function rowsOpenToRecipient<T extends { id: string }>(admin: ReportScopeAdmin, recipient: ReportRecipient, rows: readonly T[]): Promise<T[]> {
  if (rows.length === 0) return []
  const open = await reportsOpenToRecipient(admin, recipient, rows.map((r) => r.id))
  return rows.filter((r) => open.has(r.id))
}
