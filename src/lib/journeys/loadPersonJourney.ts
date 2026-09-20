/**
 * Loads the rows `personJourney.ts` reads for one real person (v2.3508), through the office's
 * own RLS — nothing here is readable that the signed-in person could not already open from the
 * surface that owns it. Reads only. The customer-portal open stats come from the same staff
 * peek the portal globe button uses (`?preview=1` + the office session), which never counts
 * as a customer visit.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { staffAwarePublicHeaders } from '../publicFunctionStaffHeaders'
import { withPreviewFlag } from '../publicViewCounting'
import { parseOfficeViewStats } from '../portal/portalOpenedLabel'
import { parseVisitSummaryRow } from '../portal/subPortalVisits'
import {
  buildPersonJourney,
  type BidRoomRow,
  type ContractEventRow,
  type CustomerRows,
  type DemandLetterRow,
  type EstimateEventRow,
  type EstimateRow,
  type FirmRows,
  type HazmatRow,
  type HouseRows,
  type InvoiceRow,
  type JobContractRow,
  type JobRow,
  type LienFilingRow,
  type LienReleaseRow,
  type PersonJourney,
  type PersonSubject,
  type PortalLinkRow,
  type RoomEventRow,
  type SubRows,
  type SubmittalRoomRow,
  type TestReportRow,
  type GcStatementRow,
  customerRowsForJob,
} from './personJourney'

type Q = ReturnType<typeof supabase.from>

/** One select, typed by what the kernel asks for; an RLS-empty answer is `[]`, never a throw. */
async function rows<T>(label: string, q: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const data = await withSupabaseRetry(() => q() as never, label)
  return (Array.isArray(data) ? data : []) as T[]
}

function chunks<T>(ids: T[], size = 200): T[][] {
  const out: T[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

/** `.in()` over many job ids, in chunks, so a builder with hundreds of jobs still loads. */
async function byJobIds<T>(label: string, table: string, select: string, jobIds: string[]): Promise<T[]> {
  if (jobIds.length === 0) return []
  const parts = await Promise.all(chunks(jobIds).map((ids) => rows<T>(label, () => (supabase.from(table as never) as unknown as Q).select(select).in('job_id', ids))))
  return parts.flat()
}

async function portalOpensForToken(token: string | null): Promise<ReturnType<typeof parseOfficeViewStats>> {
  if (!token) return null
  try {
    const res = await fetch(withPreviewFlag(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/customer-portal?token=${encodeURIComponent(token)}`), { headers: await staffAwarePublicHeaders() })
    if (!res.ok) return null
    const body: unknown = await res.json().catch(() => null)
    return parseOfficeViewStats(body)
  } catch {
    return null
  }
}

export async function loadCustomerRows(customerId: string): Promise<CustomerRows> {
  const [jobs, estimates, portalLinks, slugRows, bidRooms, gcStatements] = await Promise.all([
    rows<JobRow>('journey jobs', () => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, status, customer_id, gc_customer_id').or(`customer_id.eq.${customerId},gc_customer_id.eq.${customerId}`)),
    rows<EstimateRow>('journey estimates', () => supabase.from('estimates').select('id, estimate_number, status, sent_at, acceptor_consented_at, updated_at').eq('customer_id', customerId)),
    rows<PortalLinkRow>('journey portal links', () => supabase.from('customer_portal_links').select('audience, token, revoked_at, created_at').eq('customer_id', customerId)),
    rows<{ slug: string | null }>('journey portal slug', () => supabase.from('customer_portal_slugs').select('slug').eq('customer_id', customerId)),
    rows<BidRoomRow>('journey bid rooms', () => supabase.from('bid_proposal_rooms').select('id, bid_id, public_token, recipient_email, created_at').eq('customer_id', customerId)),
    rows<GcStatementRow>('journey statements', () => supabase.from('gc_statement_emails').select('sent_at, total, sent_to').eq('gc_customer_id', customerId)),
  ])
  const jobIds = jobs.map((j) => j.id)
  const estimateIds = estimates.map((e) => e.id)
  const roomIds = bidRooms.map((r) => r.id)
  const bidIds = Array.from(new Set(bidRooms.map((r) => r.bid_id)))
  const activeLink = portalLinks.find((l) => !l.revoked_at && l.token && l.audience === 'all') ?? portalLinks.find((l) => !l.revoked_at && l.token) ?? null

  const [estimateEvents, contracts, invoices, hazmat, bidRoomEvents, submittalRooms, testReports, demandLetters, lienFilings, lienReleases, portalOpens] = await Promise.all([
    estimateIds.length ? rows<EstimateEventRow>('journey estimate events', () => supabase.from('estimate_customer_events').select('estimate_id, event_type, occurred_at').in('estimate_id', estimateIds)) : Promise.resolve([] as EstimateEventRow[]),
    byJobIds<JobContractRow>('journey contracts', 'job_contracts', 'id, job_id, revision, status, sent_at, last_sent_at, send_count, reminder_count, first_viewed_at, view_count, signed_at, signer_mode, paper_signed_on, voided_at, public_token, sent_channel', jobIds),
    byJobIds<InvoiceRow>('journey invoices', 'jobs_ledger_invoices', 'id, job_id, status, stripe_invoice_id, stripe_invoice_status, sent_to_customer_at, external_send_channel, hosted_invoice_url, amount', jobIds),
    byJobIds<HazmatRow>('journey hazmat', 'job_hazmat_incidents', 'job_id, notice_emailed_at, public_token, voided_at', jobIds),
    roomIds.length ? rows<RoomEventRow>('journey room events', () => supabase.from('bid_proposal_room_events').select('room_id, event_type, occurred_at').in('room_id', roomIds)) : Promise.resolve([] as RoomEventRow[]),
    bidIds.length ? rows<SubmittalRoomRow>('journey submittal rooms', () => supabase.from('bid_submittal_rooms').select('id, bid_id, token, shared_at, status').in('bid_id', bidIds)) : Promise.resolve([] as SubmittalRoomRow[]),
    byJobIds<TestReportRow>('journey test reports', 'job_test_reports', 'id, job_id, sent_at, status, test_type', jobIds),
    byJobIds<DemandLetterRow>('journey demand letters', 'job_demand_letters', 'job_id, sent_at, sent_method, deadline_date, voided_at, amount', jobIds),
    byJobIds<LienFilingRow>('journey lien filings', 'job_lien_filings', 'job_id, kind, filed_at, served_at, sends, voided_at', jobIds),
    byJobIds<LienReleaseRow>('journey lien releases', 'job_lien_releases', 'job_id, sent_to_customer_at, signed_at, voided_at', jobIds),
    portalOpensForToken(activeLink?.token ?? null),
  ])
  const submittalRoomIds = submittalRooms.map((r) => r.id)
  const contractIds = contracts.map((c) => c.id)
  const contractEvents = contractIds.length
    ? await rows<ContractEventRow>('journey contract shares', () => supabase.from('job_contract_events').select('contract_id, event_type, occurred_at').in('contract_id', contractIds).eq('event_type', 'shared'))
    : ([] as ContractEventRow[])
  const submittalEvents = submittalRoomIds.length ? await rows<RoomEventRow>('journey submittal events', () => supabase.from('bid_submittal_events').select('room_id, event_type, occurred_at').in('room_id', submittalRoomIds)) : []

  return {
    jobs,
    estimates,
    estimateEvents,
    contracts,
    contractEvents,
    invoices,
    hazmat,
    portalLinks,
    portalSlug: slugRows[0]?.slug ?? null,
    portalOpens,
    bidRooms,
    bidRoomEvents,
    submittalRooms,
    submittalEvents,
    testReports,
    gcStatements,
    demandLetters,
    lienFilings,
    lienReleases,
  }
}

export async function loadSubRows(personId: string): Promise<SubRows> {
  const [portalLinks, slugRows, contracts, summary] = await Promise.all([
    rows<{ token: string | null; revoked_at: string | null; created_at: string | null }>('journey sub links', () => supabase.from('sub_portal_links').select('token, revoked_at, created_at').eq('person_id', personId)),
    rows<{ slug: string | null }>('journey sub slug', () => supabase.from('sub_portal_slugs').select('slug').eq('person_id', personId)),
    rows<SubRows['contracts'][number]>('journey sub contracts', () => supabase.from('person_contract_documents').select('id, document_name, status, sent_at, signer_last_viewed_at, signed_at, expires_at').eq('person_id', personId)),
    rows<unknown>('journey sub visits', () => supabase.rpc('sub_portal_visit_summary' as never, { p_person_ids: [personId] } as never)),
  ])
  const s = summary.map(parseVisitSummaryRow).find((x) => x && x.personId === personId) ?? null
  return {
    portalLinks,
    portalSlug: slugRows[0]?.slug ?? null,
    visits: s ? { outsideCount: s.outsideOpens, lastOutsideAt: s.lastOutsideAt } : null,
    contracts,
  }
}

export async function loadHouseRows(supplyHouseId: string): Promise<HouseRows> {
  const rfqs = await rows<HouseRows['rfqs'][number]>('journey rfqs', () =>
    supabase.from('bid_rfqs').select('id, token, status, sent_via, sent_to, requested_on, viewed_at, reminder_count, created_at').eq('supply_house_id', supplyHouseId),
  )
  return { rfqs }
}

export async function loadFirmRows(firmId: string): Promise<FirmRows> {
  const [portalLinks, recipients, queue] = await Promise.all([
    rows<FirmRows['portalLinks'][number]>('journey firm links', () => supabase.from('legal_portal_links').select('token, revoked_at, created_at').eq('firm_id', firmId)),
    rows<FirmRows['recipients'][number]>('journey firm recipients', () => supabase.from('legal_firm_recipients').select('name, email, mode, confirmed_at, paused_at, removed_at, last_digest_at').eq('firm_id', firmId)),
    rows<FirmRows['queue'][number]>('journey firm queue', () => supabase.from('legal_notification_queue').select('sent_now_at, digested_at, created_at').eq('firm_id', firmId)),
  ])
  return { portalLinks, recipients, queue }
}

/** `jobId` (v2.3615): a customer's journey narrowed to one job — the Job window's door. Ignored for other kinds. */
export async function loadPersonJourney(subject: PersonSubject, now: Date = new Date(), options?: { jobId?: string | null }): Promise<PersonJourney> {
  if (subject.kind === 'customer') {
    const all = await loadCustomerRows(subject.id)
    const rows = options?.jobId ? customerRowsForJob(all, options.jobId) : all
    return buildPersonJourney(subject, { kind: 'customer', rows }, now)
  }
  if (subject.kind === 'sub') return buildPersonJourney(subject, { kind: 'sub', rows: await loadSubRows(subject.id) }, now)
  if (subject.kind === 'house') return buildPersonJourney(subject, { kind: 'house', rows: await loadHouseRows(subject.id) }, now)
  return buildPersonJourney(subject, { kind: 'firm', rows: await loadFirmRows(subject.id) }, now)
}
