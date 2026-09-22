/**
 * The Day book's one line per person, from the RAW payload rows (to-dos/day-book, PR 6b,
 * v2.3733). A Deno-safe port of what the client reads off its lines
 * (`src/lib/people/dayBookOneLiner.ts` + the kernel's grouping): the crew-day email cannot
 * import the client kernel, so this file groups one day's events itself and writes the
 * same phrases. `src/lib/people/dayBookOneLinerShared.test.ts` pins the two together.
 * Pure; no Deno APIs.
 */

export type DayBookRawEvent = {
  actor_user_id: string
  day: string
  kind: string
  ref_id: string | null
  detail: Record<string, unknown> | null
}

function n(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}
function statusWord(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return 'a new status'
  const known: Record<string, string> = { billed: 'Billed', paid: 'Paid', working: 'Working', scheduled: 'Scheduled', complete: 'Complete', completed: 'Complete', cancelled: 'Cancelled', canceled: 'Cancelled', collections: 'Collections' }
  return known[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

/** The phrases for one person's events on one day, in the Day book's line order. */
export function dayBookOneLinerPhrases(events: ReadonlyArray<DayBookRawEvent>): string[] {
  const out: string[] = []
  const of = (kind: string) => events.filter((e) => e.kind === kind)
  const distinct = (rows: DayBookRawEvent[], key: (e: DayBookRawEvent) => string | null) => new Set(rows.map(key).filter((k): k is string => k !== null)).size

  const billed = of('billed')
  if (billed.length) out.push(`billed ${distinct(billed, (e) => str(e.detail?.invoice_id) ?? `${e.ref_id}:${e.day}`)}`)
  const deposits = of('deposit')
  if (deposits.length) out.push(n(deposits.length, 'deposit', 'deposits'))
  const payments = of('payment')
  if (payments.length) out.push(n(payments.length, 'payment', 'payments'))
  const status = of('status')
  if (status.length) {
    const byTo = new Map<string, Set<string>>()
    for (const e of status) {
      const to = statusWord(e.detail?.to)
      const set = byTo.get(to) ?? new Set<string>()
      set.add(e.ref_id ?? `${e.day}:${byTo.size}`)
      byTo.set(to, set)
    }
    for (const [to, jobs] of byTo) out.push(`moved ${n(jobs.size, 'job', 'jobs')} to ${to}`)
  }
  const sent = of('contract_sent')
  if (sent.length) out.push(`${n(sent.length, 'contract', 'contracts')} sent`)
  const filed = of('contract_filed')
  if (filed.length) out.push(`${filed.length} signed ${filed.length === 1 ? 'contract' : 'contracts'} filed`)
  const approvals = of('approval')
  if (approvals.length) out.push(`approved ${n(approvals.length, 'session', 'sessions')}`)
  if (of('hours_reviewed').length) out.push('reviewed hours')
  const dispatch = of('dispatch_answered')
  if (dispatch.length) out.push(`${n(dispatch.length, 'dispatch request', 'dispatch requests')} answered`)
  const sched = of('schedule')
  if (sched.length) out.push('updated the schedule')
  // Estimator lines (the kinds the client's default branch lowercases: the verb as the kernel writes it).
  const bids = of('bid_sent')
  if (bids.length) out.push(`sent ${n(distinct(bids, (e) => e.ref_id), 'bid', 'bids')}`)
  const priced = of('priced')
  if (priced.length) out.push(`priced ${n(distinct(priced, (e) => e.ref_id), 'bid', 'bids')}`)
  const efforts = of('best_effort')
  if (efforts.length) out.push(efforts.length === 1 ? 'recorded a best effort' : `recorded ${efforts.length} best efforts`)
  const rfqs = of('rfq_asked')
  if (rfqs.length) out.push(`asked ${n(distinct(rfqs, (e) => str(e.detail?.supply_house_id) ?? `${e.ref_id}:${e.day}`), 'house', 'houses')} for prices`)
  const audited = of('audited')
  if (audited.length) out.push(`audited ${n(distinct(audited, (e) => e.ref_id), 'bid', 'bids')}`)
  const answered = of('robot_answered')
  if (answered.length) out.push(`answered ${answered.length} robot ${answered.length === 1 ? 'question' : 'questions'}`)
  const followed = of('followed_up')
  if (followed.length) out.push(`followed up ${n(distinct(followed, (e) => str(e.detail?.gc_customer_id) ?? `${e.ref_id}:${e.day}`), 'GC', 'GCs')}`)
  // Deletions are muted on the tab and left off the line.
  return out
}

/** userId → one line, for every person with something on the record that day. */
export function dayBookOneLinersByUser(events: ReadonlyArray<DayBookRawEvent>, day: string, max = 5): Record<string, string> {
  const byUser = new Map<string, DayBookRawEvent[]>()
  for (const e of events) {
    if (e.day !== day || !e.actor_user_id) continue
    const list = byUser.get(e.actor_user_id) ?? []
    list.push(e)
    byUser.set(e.actor_user_id, list)
  }
  const out: Record<string, string> = {}
  for (const [userId, rows] of byUser) {
    const parts = dayBookOneLinerPhrases(rows)
    if (parts.length === 0) continue
    out[userId] = parts.slice(0, max).join(' · ') + (parts.length > max ? ` · +${parts.length - max}` : '')
  }
  return out
}
