/**
 * Customer Hub — activity feed merge kernel (Customer Hub train, PR 2).
 *
 * Pure: takes the raw per-source rows the fetch helper collects for one
 * customer and merges them into a single reverse-chronological feed. Every
 * mapping (source row → event kind/title/detail) lives here so the tests pin
 * the feed's vocabulary. No Supabase, no Date.now — "now" never matters, only
 * each row's own timestamp.
 *
 * Color language downstream: money events render green, job events blue —
 * the kind carries which family an event belongs to.
 */
import { labelJobsLedgerStatusForDashboard } from '../jobsLedgerStatusPipeline'

export type ActivityEventKind =
  | 'job_created'
  | 'status'
  | 'invoice_billed'
  | 'payment'
  | 'note'
  | 'estimate'
  | 'dispatch'
  | 'contact'

/** Which filter family an event belongs to (feed filter chips). */
export type ActivityFamily = 'money' | 'jobs' | 'notes'

export type ActivityEvent = {
  /** Stable unique key for React lists: `${source}:${row id}[:facet]`. */
  key: string
  kind: ActivityEventKind
  family: ActivityFamily
  /** ISO timestamp the feed sorts by (desc). */
  atIso: string
  /** Job ledger id when the event belongs to a job (opens Job Detail). */
  jobId: string | null
  /** Display label of the job, e.g. "941" (effective ledger number). */
  jobLabel: string | null
  title: string
  detail: string | null
  actorName: string | null
}

export type ActivityJobInput = {
  id: string
  label: string
  jobName: string | null
  createdAt: string | null
  invoices: Array<{ id: string; status: string; amount: number | null; billed_at: string | null }>
  payments: Array<{ invoice_id: string | null; amount: number | null; paid_on: string | null }>
}

export type ActivityStatusEventInput = {
  id: string
  job_id: string
  from_status: string | null
  to_status: string
  changed_at: string
  changed_by_user_id: string | null
}

export type ActivityThreadNoteInput = {
  id: string
  job_id: string
  body: string
  created_at: string
  author_user_id: string
}

export type ActivityEstimateInput = {
  id: string
  estimate_number: number
  title: string | null
  status: string
  total_cents: number
  created_at: string | null
  sent_at: string | null
  updated_at: string | null
}

export type ActivityDispatchInput = {
  id: string
  job_ledger_id: string | null
  title: string
  status: string
  created_at: string
}

export type ActivityContactInput = {
  id: string
  contact_date: string
  contact_method: string | null
  details: string | null
  created_by: string | null
}

export type ActivityFeedInputs = {
  jobs: ActivityJobInput[]
  statusEvents: ActivityStatusEventInput[]
  threadNotes: ActivityThreadNoteInput[]
  estimates: ActivityEstimateInput[]
  dispatchRequests: ActivityDispatchInput[]
  customerContacts: ActivityContactInput[]
  /** users.id → display name, for actor attribution. */
  userNames: Record<string, string>
}

const money = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

function nameOf(userNames: Record<string, string>, id: string | null): string | null {
  if (!id) return null
  const n = (userNames[id] ?? '').trim()
  return n || null
}

/** Estimate status → feed phrasing for the latest state stamp. */
function estimateStateEvent(e: ActivityEstimateInput): { atIso: string; title: string } | null {
  if (e.status === 'customer_accepted' && e.updated_at)
    return { atIso: e.updated_at, title: `Estimate #${e.estimate_number} accepted` }
  if (e.status === 'declined' && e.updated_at)
    return { atIso: e.updated_at, title: `Estimate #${e.estimate_number} declined` }
  if (e.status === 'sent' && e.sent_at) return { atIso: e.sent_at, title: `Estimate #${e.estimate_number} sent` }
  return null
}

export function buildCustomerActivityFeed(inputs: ActivityFeedInputs): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const jobById = new Map(inputs.jobs.map((j) => [j.id, j]))
  const jobLabel = (jobId: string | null): string | null => (jobId ? (jobById.get(jobId)?.label ?? null) : null)

  for (const job of inputs.jobs) {
    if (job.createdAt) {
      events.push({
        key: `job:${job.id}`,
        kind: 'job_created',
        family: 'jobs',
        atIso: job.createdAt,
        jobId: job.id,
        jobLabel: job.label,
        title: `${job.label} created`,
        detail: (job.jobName ?? '').trim() || null,
        actorName: null,
      })
    }
    for (const inv of job.invoices) {
      if (!inv.billed_at) continue
      events.push({
        key: `invoice:${inv.id}`,
        kind: 'invoice_billed',
        family: 'money',
        atIso: inv.billed_at,
        jobId: job.id,
        jobLabel: job.label,
        title: `Invoice billed — ${money(Number(inv.amount ?? 0))}`,
        detail: job.label,
        actorName: null,
      })
    }
    job.payments.forEach((p, i) => {
      if (!p.paid_on) return
      events.push({
        key: `payment:${job.id}:${i}`,
        kind: 'payment',
        family: 'money',
        atIso: p.paid_on,
        jobId: job.id,
        jobLabel: job.label,
        title: `Payment received — ${money(Number(p.amount ?? 0))}`,
        detail: job.label,
        actorName: null,
      })
    })
  }

  for (const ev of inputs.statusEvents) {
    const fromLabel = ev.from_status ? labelJobsLedgerStatusForDashboard(ev.from_status) : null
    const toLabel = labelJobsLedgerStatusForDashboard(ev.to_status)
    events.push({
      key: `status:${ev.id}`,
      kind: 'status',
      family: 'jobs',
      atIso: ev.changed_at,
      jobId: ev.job_id,
      jobLabel: jobLabel(ev.job_id),
      title: fromLabel ? `${fromLabel} → ${toLabel}` : `Moved to ${toLabel}`,
      detail: jobLabel(ev.job_id),
      actorName: nameOf(inputs.userNames, ev.changed_by_user_id),
    })
  }

  for (const note of inputs.threadNotes) {
    events.push({
      key: `note:${note.id}`,
      kind: 'note',
      family: 'notes',
      atIso: note.created_at,
      jobId: note.job_id,
      jobLabel: jobLabel(note.job_id),
      title: `Note on ${jobLabel(note.job_id) ?? 'job'}`,
      detail: note.body,
      actorName: nameOf(inputs.userNames, note.author_user_id),
    })
  }

  for (const e of inputs.estimates) {
    if (e.created_at) {
      events.push({
        key: `estimate:${e.id}:created`,
        kind: 'estimate',
        family: 'money',
        atIso: e.created_at,
        jobId: null,
        jobLabel: null,
        title: `Estimate #${e.estimate_number} created — ${money(e.total_cents / 100)}`,
        detail: (e.title ?? '').trim() || null,
        actorName: null,
      })
    }
    const state = estimateStateEvent(e)
    if (state) {
      events.push({
        key: `estimate:${e.id}:${e.status}`,
        kind: 'estimate',
        family: 'money',
        atIso: state.atIso,
        jobId: null,
        jobLabel: null,
        title: state.title,
        detail: (e.title ?? '').trim() || null,
        actorName: null,
      })
    }
  }

  for (const d of inputs.dispatchRequests) {
    events.push({
      key: `dispatch:${d.id}`,
      kind: 'dispatch',
      family: 'jobs',
      atIso: d.created_at,
      jobId: d.job_ledger_id,
      jobLabel: jobLabel(d.job_ledger_id),
      title: `Dispatch task${d.status === 'closed' ? ' (closed)' : ''}`,
      detail: d.title,
      actorName: null,
    })
  }

  for (const c of inputs.customerContacts) {
    events.push({
      key: `contact:${c.id}`,
      kind: 'contact',
      family: 'notes',
      atIso: c.contact_date,
      jobId: null,
      jobLabel: null,
      title: c.contact_method ? `Customer note (${c.contact_method})` : 'Customer note',
      detail: (c.details ?? '').trim() || null,
      actorName: nameOf(inputs.userNames, c.created_by),
    })
  }

  events.sort((a, b) => (a.atIso < b.atIso ? 1 : a.atIso > b.atIso ? -1 : a.key < b.key ? 1 : -1))
  return events
}

export function filterActivityFeed(events: ActivityEvent[], family: ActivityFamily | 'all'): ActivityEvent[] {
  if (family === 'all') return events
  return events.filter((e) => e.family === family)
}
