/**
 * Customer Hub — activity feed data assembly (Customer Hub train, PR 2).
 * Collects the raw per-source rows for one customer's feed; the pure merge
 * lives in customerActivityFeed.ts. All reads are existing tables under
 * existing RLS (the page's audience is the office set).
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type {
  ActivityContactInput,
  ActivityDispatchInput,
  ActivityEstimateInput,
  ActivityFeedInputs,
  ActivityJobInput,
  ActivityStatusEventInput,
  ActivityThreadNoteInput,
} from './customerActivityFeed'

type FeedJobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  created_at: string | null
  invoices: Array<{ id: string; status: string; amount: number | null; billed_at: string | null }>
  payments: Array<{ invoice_id: string | null; amount: number | null; paid_on: string | null }>
}

export async function fetchCustomerActivityInputs(customerId: string): Promise<ActivityFeedInputs> {
  const jobRows = (await withSupabaseRetry(
    () =>
      supabase
        .from('jobs_ledger')
        .select(
          'id, hcp_number, click_number, job_name, created_at, invoices:jobs_ledger_invoices(id, status, amount, billed_at), payments:jobs_ledger_payments(invoice_id, amount, paid_on)',
        )
        .eq('customer_id', customerId),
    'customer activity: jobs',
  )) as unknown as FeedJobRow[]

  const jobs: ActivityJobInput[] = (jobRows ?? []).map((j) => ({
    id: j.id,
    label: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || (j.job_name ?? '').trim() || 'Job',
    jobName: j.job_name,
    createdAt: j.created_at,
    invoices: j.invoices ?? [],
    payments: j.payments ?? [],
  }))
  const jobIds = jobs.map((j) => j.id)

  const [statusRes, notesRes, estimatesRes, dispatchRes, contactsRes] = await Promise.all([
    jobIds.length
      ? supabase
          .from('job_status_events')
          .select('id, job_id, from_status, to_status, changed_at, changed_by_user_id')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] as ActivityStatusEventInput[] }),
    jobIds.length
      ? supabase
          .from('jobs_ledger_thread_notes')
          .select('id, job_id, body, created_at, author_user_id')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] as ActivityThreadNoteInput[] }),
    supabase
      .from('estimates')
      .select('id, estimate_number, title, status, total_cents, created_at, sent_at, updated_at')
      .eq('customer_id', customerId),
    jobIds.length
      ? supabase
          .from('dispatch_requests')
          .select('id, job_ledger_id, title, status, created_at')
          .in('job_ledger_id', jobIds)
      : Promise.resolve({ data: [] as ActivityDispatchInput[] }),
    supabase
      .from('customer_contacts')
      .select('id, contact_date, contact_method, details, created_by')
      .eq('customer_id', customerId),
  ])

  const statusEvents = (statusRes.data ?? []) as ActivityStatusEventInput[]
  const threadNotes = (notesRes.data ?? []) as ActivityThreadNoteInput[]
  const estimates = (estimatesRes.data ?? []) as ActivityEstimateInput[]
  const dispatchRequests = (dispatchRes.data ?? []) as ActivityDispatchInput[]
  const customerContacts = (contactsRes.data ?? []) as ActivityContactInput[]

  const userIds = new Set<string>()
  for (const s of statusEvents) if (s.changed_by_user_id) userIds.add(s.changed_by_user_id)
  for (const n of threadNotes) userIds.add(n.author_user_id)
  for (const c of customerContacts) if (c.created_by) userIds.add(c.created_by)

  let userNames: Record<string, string> = {}
  if (userIds.size > 0) {
    const usersRes = await supabase.from('users').select('id, name').in('id', Array.from(userIds))
    userNames = Object.fromEntries(
      ((usersRes.data ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, u.name ?? '']),
    )
  }

  return { jobs, statusEvents, threadNotes, estimates, dispatchRequests, customerContacts, userNames }
}
