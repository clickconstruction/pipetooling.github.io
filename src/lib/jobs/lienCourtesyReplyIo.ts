import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { chunkIds } from '../supabasePaging'
import { resolveLienProperty, type CustomerAddressRow, type JobPropertyOwnerLike } from './lienProperty'
import {
  courtesyRepliedAtByJob,
  courtesyRepliesSince,
  courtesyReplyChannelKeys,
  courtesyReplyContacts,
  type CourtesyChannelRow,
  type CourtesyContactRow,
  type CourtesyInboundLine,
  type CourtesyReplyParty,
} from './lienCourtesyReply'

/**
 * The reads behind a reply closing the courtesy notice (punch list #249, row 3): batched over the desk's sent
 * notices that carry a courtesy, never per job. Three selects — the contacts on the GCs' customer rows, the
 * channels that hold the owners' numbers and addresses (`contact_channels.key`, the spine's own match), and the
 * inbound `messages` lines on those contacts since the oldest courtesy — then the kernel picks each job's answer.
 * A failed read answers nothing closed, never a dark desk; the office reads the thread itself.
 */

export type CourtesyReplySource = CourtesyReplyParty & {
  jobId: string
  /** ISO — the newest courtesy press on the job's sent notice (`lastCourtesyAtByJob`). */
  lastCourtesyAt: string
}

/** The newest inbound line after each job's last courtesy, ISO, for the jobs one came back on. */
export async function readCourtesyRepliesByJob(sources: ReadonlyArray<CourtesyReplySource>, client: SupabaseClient<Database> = supabase): Promise<Record<string, string>> {
  if (sources.length === 0) return {}
  const gcIds = [...new Set(sources.map((s) => s.gcCustomerId).filter((v): v is string => Boolean(v)))]
  const keys = courtesyReplyChannelKeys(sources)
  const contacts: CourtesyContactRow[] = []
  for (const chunk of chunkIds(gcIds)) {
    if (chunk.length === 0) continue
    const part = await withSupabaseRetry(() => client.from('contacts').select('id, customer_id').in('customer_id', chunk), 'lien desk: the GCs’ Messages contacts')
    contacts.push(...((part ?? []) as CourtesyContactRow[]))
  }
  const channels: CourtesyChannelRow[] = []
  for (const chunk of chunkIds(keys)) {
    if (chunk.length === 0) continue
    const part = await withSupabaseRetry(() => client.from('contact_channels').select('contact_id, kind, key').in('key', chunk), 'lien desk: the owners’ numbers in Messages')
    channels.push(...((part ?? []) as CourtesyChannelRow[]))
  }
  const notices = sources.map((s) => ({ jobId: s.jobId, lastCourtesyAt: s.lastCourtesyAt, contactIds: courtesyReplyContacts(s, contacts, channels) })).filter((n) => n.contactIds.length > 0)
  const since = courtesyRepliesSince(notices)
  if (!since) return {}
  const contactIds = [...new Set(notices.flatMap((n) => n.contactIds))]
  const lines: CourtesyInboundLine[] = []
  for (const chunk of chunkIds(contactIds)) {
    if (chunk.length === 0) continue
    const part = await withSupabaseRetry(() => client.from('messages').select('contact_id, at').eq('direction', 'in').in('contact_id', chunk).gt('at', since), 'lien desk: replies since the courtesy')
    for (const l of (part ?? []) as Array<{ contact_id: string | null; at: string }>) if (l.contact_id) lines.push({ contactId: l.contact_id, at: l.at })
  }
  return courtesyRepliedAtByJob(notices, lines)
}

/**
 * The owner of record's number and address per job for a reader without the property rows (the light read):
 * the override and the record for just these jobs, resolved as the courtesy window resolves them.
 */
export async function readCourtesyOwnerContacts(
  jobs: ReadonlyArray<{ jobId: string; customerAddressId: string | null }>,
  client: SupabaseClient<Database> = supabase,
): Promise<Record<string, { phone: string; email: string }>> {
  if (jobs.length === 0) return {}
  const addressIds = [...new Set(jobs.map((j) => j.customerAddressId).filter((v): v is string => Boolean(v)))]
  const jobIds = jobs.map((j) => j.jobId)
  const [addrRows, ownerRows] = await Promise.all([
    addressIds.length ? withSupabaseRetry(() => client.from('customer_addresses').select('*').in('id', addressIds), 'lien desk: the owners’ records') : Promise.resolve([] as CustomerAddressRow[]),
    // The whole row (v2.6497): owner_phone and owner_email land with their migration, and a column named early fails the read.
    withSupabaseRetry(() => client.from('job_property_owners').select('*').in('job_id', jobIds), 'lien desk: the owners’ overrides'),
  ])
  const addressesById: Record<string, CustomerAddressRow> = {}
  for (const a of (addrRows ?? []) as CustomerAddressRow[]) addressesById[a.id] = a
  const ownerByJob: Record<string, JobPropertyOwnerLike> = {}
  for (const o of (ownerRows ?? []) as (NonNullable<JobPropertyOwnerLike> & { job_id: string })[]) ownerByJob[o.job_id] = o
  const out: Record<string, { phone: string; email: string }> = {}
  for (const j of jobs) {
    const owner = resolveLienProperty(j.customerAddressId ? addressesById[j.customerAddressId] ?? null : null, ownerByJob[j.jobId] ?? null).owner
    out[j.jobId] = { phone: owner.phone, email: owner.email }
  }
  return out
}
