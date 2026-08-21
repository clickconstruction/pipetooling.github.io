/**
 * Customer profile modal — data assembly (v2.1322). One batched fetch of
 * everything the modal shows, all from existing tables under existing RLS
 * (the opener lives on office surfaces, which can read all of this):
 * customer row + contact persons, jobs w/ invoices+payments (money stats),
 * projects w/ steps (current-step via buildProjectAttention), bids, estimates.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import type { ProfileJob } from './customerProfileStats'
import { buildProjectAttention, type ProjectAttention, type AttentionStepInput } from '../projects/projectAttention'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type CustomerRow = Database['public']['Tables']['customers']['Row']

export type CustomerProfileData = {
  customer: CustomerRow
  contactPersons: Array<{ id: string; name: string; phone: string | null; email: string | null }>
  /** Additional addresses beyond customers.address (addresses train PR 2). */
  extraAddresses: Array<{ id: string; address: string; note: string | null }>
  jobs: Array<
    ProfileJob & {
      hcp_number: string | null
      click_number: string | null
      job_name: string | null
      created_at: string | null
    }
  >
  projects: Array<{ id: string; name: string | null; status: string | null; attention: ProjectAttention | null }>
  bids: Array<import('./customerProfileRails').ProfileBid>
  estimates: Array<{
    id: string
    estimate_number: number
    title: string | null
    status: string
    total_cents: number
    sent_at: string | null
    updated_at: string | null
  }>
  /** Jobs where this customer is the GC/Builder (v2.1985 header chip); 0 = not a GC. */
  gcJobCount: number
  /** Latest GC statement email to this customer (gc_statement_emails audit); null = never / not visible. */
  gcLastStatementSentAt: string | null
}

export async function fetchCustomerProfile(customerId: string): Promise<CustomerProfileData> {
  const [customerRes, contactsRes, jobsRes, projectsRes, bidsRes, estimatesRes, addressesRes, gcCountRes, gcSentRes] = await Promise.all([
    withSupabaseRetry(
      () => supabase.from('customers').select('*').eq('id', customerId).single(),
      'customer profile: customer',
    ),
    supabase
      .from('customer_contact_persons')
      .select('id, name, phone, email')
      .eq('customer_id', customerId)
      .order('name'),
    withSupabaseRetry(
      () =>
        supabase
          .from('jobs_ledger')
          .select(
            'id, hcp_number, click_number, job_name, status, revenue, payments_made, created_at, invoices:jobs_ledger_invoices(id, status, amount, billed_at, estimated_bill_date), payments:jobs_ledger_payments(invoice_id, amount, paid_on)',
          )
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false }),
      'customer profile: jobs',
    ),
    supabase
      .from('projects')
      .select('id, name, status, workflows:project_workflows(id, project_workflow_steps(name, status, sequence_order, assigned_to_name, started_at, scheduled_start_date, scheduled_end_date))')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('bids')
      .select('id, bid_number, project_name, outcome, address, bid_value, agreed_value, bid_date_sent, bid_due_date')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('estimates')
      .select('id, estimate_number, title, status, total_cents, sent_at, updated_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('customer_addresses')
      .select('id, address, note')
      .eq('customer_id', customerId)
      .order('sequence_order', { ascending: true }),
    supabase.from('jobs_ledger').select('id', { count: 'exact', head: true }).eq('gc_customer_id', customerId),
    supabase
      .from('gc_statement_emails')
      .select('sent_at')
      .eq('gc_customer_id', customerId)
      .order('sent_at', { ascending: false })
      .limit(1),
  ])

  const customer = customerRes as unknown as CustomerRow | null
  if (!customer) throw new Error('Customer not found')
  type ProjectRow = {
    id: string
    name: string | null
    status: string | null
    workflows: Array<{ id: string; project_workflow_steps: AttentionStepInput[] | null }> | null
  }
  const projects = (((projectsRes as { data: unknown }).data ?? []) as ProjectRow[]).map((p) => {
    // One workflow per project (see AI_CONTEXT data flow); steps ride the chain.
    const steps = p.workflows?.[0]?.project_workflow_steps ?? []
    let attention: ProjectAttention | null = null
    try {
      const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
      attention = steps.length > 0 ? buildProjectAttention(steps, todayYmd, calendarYmdInAppTzFromIso) : null
    } catch {
      attention = null
    }
    return { id: p.id, name: p.name, status: p.status, attention }
  })

  return {
    customer,
    contactPersons: ((contactsRes.data ?? []) as CustomerProfileData['contactPersons']).filter((c) => (c.name ?? '').trim()),
    extraAddresses: ((addressesRes.data ?? []) as CustomerProfileData['extraAddresses']).filter((a) => (a.address ?? '').trim()),
    jobs: (jobsRes ?? []) as unknown as CustomerProfileData['jobs'],
    projects,
    bids: ((bidsRes.data ?? []) as CustomerProfileData['bids']),
    estimates: ((estimatesRes.data ?? []) as CustomerProfileData['estimates']),
    gcJobCount: gcCountRes.count ?? 0,
    gcLastStatementSentAt: ((gcSentRes.data ?? []) as Array<{ sent_at: string }>)[0]?.sent_at ?? null,
  }
}
