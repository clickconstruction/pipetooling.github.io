/**
 * The Jobs to GC lane's reads and writes (v2.5561): a lead's jobs (`prospect_jobs`), the customer
 * list for the double check, and the lead a lost GC project sends back to Prospects. The rules are
 * in `gcLeadLane.ts`.
 */
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { extractContactInfo } from '../bids/bidContactInfo'
import { customerRoleOf } from '../gc/projectRows'
import { lostOwnerLead, type NewProspectJob, type ProspectJob, type ProspectJobStatus } from './gcLeadLane'

export type { NewProspectJob }

const JOB_COLUMNS = 'id, prospect_id, name, address, sq_ft, size_note, plans_link, bid_due, status, won_by, note, created_at'

function failed(error: { message: string } | null, what: string): never {
  throw new Error(error?.message || `Could not ${what}.`)
}

/**
 * Every job of these leads, keyed by the lead. A lead with none has no key. The ids go in slices and
 * each slice is paged, so a long queue neither overruns the request's address nor stops at a page.
 */
export async function loadProspectJobs(prospectIds: readonly string[]): Promise<Record<string, ProspectJob[]>> {
  const out: Record<string, ProspectJob[]> = {}
  if (prospectIds.length === 0) return out
  const rows = await fetchAllRowsChunkedIn<ProspectJob, string>(
    [...prospectIds],
    (chunk, from, to) =>
      supabase.from('prospect_jobs').select(JOB_COLUMNS).in('prospect_id', chunk).order('created_at', { ascending: true }).order('id').range(from, to) as unknown as PromiseLike<{ data: ProspectJob[] | null; error: { message: string } | null }>,
    'prospect jobs',
  )
  for (const row of rows) {
    ;(out[row.prospect_id] ??= []).push(row)
  }
  return out
}

export async function addProspectJob(prospectId: string, job: NewProspectJob, userId: string): Promise<ProspectJob> {
  const { data, error } = await supabase
    .from('prospect_jobs')
    .insert({ prospect_id: prospectId, ...job, status: 'open', created_by: userId })
    .select(JOB_COLUMNS)
    .single()
  if (error || !data) failed(error, 'add the job')
  return data as ProspectJob
}

export async function setProspectJobStatus(jobId: string, status: ProspectJobStatus, wonBy: string | null = null): Promise<void> {
  const { error } = await supabase.from('prospect_jobs').update({ status, won_by: wonBy }).eq('id', jobId)
  if (error) failed(error, 'change the job')
}

export async function deleteProspectJob(jobId: string): Promise<void> {
  const { error } = await supabase.from('prospect_jobs').delete().eq('id', jobId)
  if (error) failed(error, 'remove the job')
}

/** The customers as the double check reads them: a name and a phone each. */
export async function loadCustomerDoubles(): Promise<{ id: string; name: string; phone: string | null }[]> {
  const { data, error } = await supabase.from('customers').select('id, name, contact_info').is('archived_at', null)
  if (error) failed(error, 'read the customers')
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, phone: extractContactInfo(c.contact_info).phone || null }))
}

/**
 * Send a lost GC project's owner back to Prospects (v2.5561). Reads the project, its GC row and the
 * customer itself, so the lead carries the customer's own phone and email and who won the job. An
 * owner who is already a live lead on Jobs to GC gets the lost job on that lead instead of a second
 * one, and a job already kept there is not kept twice. Returns the lead's id and the customer's name.
 */
export async function sendLostOwnerToProspects(
  projectId: string,
  by: { userId: string; masterUserId: string },
): Promise<{ prospectId: string; customerName: string; added: boolean }> {
  const { data: project, error: projectError } = await supabase.from('projects').select('name, address, customer_id').eq('id', projectId).single()
  if (projectError || !project) failed(projectError, 'read the project')
  const { data: gc, error: gcError } = await supabase
    .from('gc_projects')
    .select('customer_role, sq_ft, size_note, lost_on, won_by')
    .eq('project_id', projectId)
    .single()
  if (gcError || !gc) failed(gcError, 'read the project')
  if (!project.customer_id) throw new Error('The project names no customer.')
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, address, contact_info')
    .eq('id', project.customer_id)
    .single()
  if (customerError || !customer) failed(customerError, 'read the customer')
  const { phone, email } = extractContactInfo(customer.contact_info)
  const { prospect, job } = lostOwnerLead(
    {
      name: project.name,
      address: project.address ?? '',
      sqFt: gc.sq_ft,
      sizeNote: gc.size_note ?? '',
      customerRole: customerRoleOf(gc.customer_role),
      lostOn: gc.lost_on,
      wonBy: gc.won_by,
    },
    { id: customer.id, name: customer.name, phone: phone || null, email: email || null, address: customer.address },
    by,
  )

  // The owner already on the deck: keep the lost job on that lead.
  const { data: live, error: liveError } = await supabase
    .from('prospects')
    .select('id')
    .eq('kind', 'gc_lead')
    .eq('customer_id', customer.id)
    .is('prospect_fit_status', null)
    .limit(1)
  if (liveError) failed(liveError, 'look for the owner on Prospects')
  let prospectId = live?.[0]?.id ?? null
  let added = false
  if (!prospectId) {
    const { data: made, error } = await supabase.from('prospects').insert(prospect).select('id').single()
    if (error || !made) failed(error, 'send the owner to Prospects')
    prospectId = made.id
    added = true
  }
  const { data: kept, error: keptError } = await supabase.from('prospect_jobs').select('id').eq('prospect_id', prospectId).eq('name', job.name).eq('status', 'lost').limit(1)
  if (keptError) failed(keptError, 'look for the job on the lead')
  if (!kept || kept.length === 0) {
    const { error: jobError } = await supabase.from('prospect_jobs').insert({ prospect_id: prospectId, ...job, created_by: by.userId })
    if (jobError) failed(jobError, 'keep the lost job on the lead')
  }
  return { prospectId, customerName: customer.name, added }
}
