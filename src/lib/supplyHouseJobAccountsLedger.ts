/**
 * Supply house job-account share ledger (v2.1606) — pure grouping for the
 * Materials → Supply Houses "Job accounts" section and the share modal's
 * "already shared" hint. Rows come from supply_house_job_accounts (one row
 * per recipient per send, newest first from the query).
 */

export interface JobAccountShareRow {
  job_id: string
  contact_label: string
  contact_email: string
  sent_by_name: string
  sent_at: string
  /** 'app' (Resend via the edge function) or 'user_email' (sent from the user's own inbox, v2.1820). */
  send_method?: string | null
}

/** History-line suffix naming the send channel — null for app sends (the default, not worth ink). */
export function shareSendMethodLabel(row: Pick<JobAccountShareRow, 'send_method'>): string | null {
  return row.send_method === 'user_email' ? 'from their inbox' : null
}

export interface JobAccountLedgerRow {
  jobId: string
  /** Unique contact display names across every send, first-seen (newest) first. */
  contacts: string[]
  lastSentAt: string
  lastSentByName: string
}

/** Display name for a share row's recipient — label, else the bare email. */
export function shareContactDisplay(row: Pick<JobAccountShareRow, 'contact_label' | 'contact_email'>): string {
  return row.contact_label.trim() || row.contact_email.trim() || '—'
}

/** One ledger row per job, newest last-send first. Input order is respected for recency. */
export function groupJobAccountLedger(rows: JobAccountShareRow[]): JobAccountLedgerRow[] {
  const byJob = new Map<string, JobAccountLedgerRow>()
  const sorted = [...rows].sort((a, b) => (a.sent_at < b.sent_at ? 1 : a.sent_at > b.sent_at ? -1 : 0))
  for (const r of sorted) {
    const display = shareContactDisplay(r)
    const existing = byJob.get(r.job_id)
    if (!existing) {
      byJob.set(r.job_id, {
        jobId: r.job_id,
        contacts: display === '—' ? [] : [display],
        lastSentAt: r.sent_at,
        lastSentByName: r.sent_by_name.trim(),
      })
    } else if (display !== '—' && !existing.contacts.includes(display)) {
      existing.contacts.push(display)
    }
  }
  return [...byJob.values()].sort((a, b) => (a.lastSentAt < b.lastSentAt ? 1 : -1))
}

/**
 * Collapsed "already shared" hint for one job's rows: names the most recent
 * recipient and dates it; extra sends collapse into "+N more".
 * Null when the job has never been shared.
 */
export function summarizeJobShares(
  rows: JobAccountShareRow[],
  formatDate: (iso: string) => string
): string | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1))
  const newest = sorted[0]!
  const rest = sorted.length - 1
  return `Already shared with ${shareContactDisplay(newest)} · ${formatDate(newest.sent_at)}${
    rest > 0 ? ` · +${rest} more` : ''
  }`
}

/**
 * Job-window header storefront icon (v2.3160): the icon turns teal once a job
 * account packet is on record, and its tooltip names the newest send. Null
 * rows = the plain "set up a job account" affordance.
 */
export function jobAccountShareIconTitle(rows: JobAccountShareRow[], formatDate: (iso: string) => string): string {
  const summary = summarizeJobShares(rows, formatDate)
  if (!summary) return 'Share with supply house — set up a job account'
  return `Job account on file — ${summary.replace(/^Already shared with /, 'shared with ')}. Click for history or to resend.`
}

/** "Reece — Georgetown desk" → "Reece": the house half of a contact label (desk suffix dropped). */
export function jobAccountHouseShortName(row: Pick<JobAccountShareRow, 'contact_label' | 'contact_email'>): string {
  const display = shareContactDisplay(row)
  const head = display.split(/\s+[—–-]\s+/)[0]?.trim() ?? ''
  return head || display
}

export interface BillTabJobAccountNote {
  /** "Job account on file with Reece" */
  headline: string
  /** "packet sent 8/19/2026 by Taunya" */
  sentLine: string
  /** What it means for the money below. */
  whatItMeans: string
  /** Present only when unpaid flagged dollars sit on this job. */
  flaggedLine: string | null
}

/**
 * Bill-tab note (v2.3257): the billing-side companion to the teal storefront
 * icon. Null when no packet is on record — the Bill tab then looks exactly as
 * it does today. `flaggedDollars` = unpaid allocated dollars on flagged
 * invoices for this job (jobAccountSplitFromLines).
 */
export function billTabJobAccountNote(
  rows: JobAccountShareRow[],
  flaggedDollars: number,
  formatDate: (iso: string) => string,
): BillTabJobAccountNote | null {
  if (rows.length === 0) return null
  const newest = [...rows].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1))[0]!
  const house = jobAccountHouseShortName(newest)
  const by = newest.sent_by_name.trim()
  const dollars = flaggedDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return {
    headline: `Job account on file with ${house}`,
    sentLine: `packet sent ${formatDate(newest.sent_at)}${by ? ` by ${by}` : ''}`,
    whatItMeans: `If material invoices on this job go unpaid, ${house} bills the property owner — not you.`,
    flaggedLine: flaggedDollars > 0.005 ? `$${dollars} of this job's unpaid supplier invoices are on the account.` : null,
  }
}
