/**
 * The firm's portal payload (Legal portal PR 3): what `legal-portal` returns,
 * parsed defensively, and the step that turns one matter's raw records into
 * the same packet the office desk shows — through the one kernel, so the firm
 * and the office never disagree. Held entries never arrive (the function
 * applies the office's decisions under the service role) — since #85 item 29
 * everything goes unless the office held it back, and `heldCount` says how
 * many were. `sharedOverrides` marks every entry that arrived as shared, so a
 * page still on the old default rule shows them too.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { CustomerAddressRow } from '../jobs/lienProperty'
import type { JobContractRowLike, SignedEstimateLike } from '../jobs/jobContractCoverage'
import type { JobDemandLetterRow } from '../jobs/demandLetterTracking'
import type { JobLienFilingRow } from '../jobs/lienDeadlines'
import { classifyPromises, parsePaymentPromisesRpc, parsePromiseRecordsRpc } from '../jobs/paymentPromises'
import { parseChaseTouchesRpc } from '../jobs/paymentChase'
import type { LegalDeskItemLike } from './legalLienPaper'
import type { LegalJobOwnerRow } from './legalProperty'
import { buildLegalPacket, groupCollectionsByPayer, type LegalContactEntryLike, type LegalContactLike, type LegalCustomerLike, type LegalFeeModel, type LegalPacket } from './legalPacket'
import { buildJobContractCoverage } from '../jobs/jobContractCoverage'
import { feeModelOf, type LegalEntryRow, type LegalFirmRow } from './legalMatters'
import { parseLienBookRaw, type LienBookRaw } from '../jobs/lienTimelineBookAssemble'
import { settlementFloorOf, type LegalSettlementFloor } from '../../../supabase/functions/_shared/legalSettlement'

export type LegalPortalRecipient = { id: string; name: string; email: string; role: string; mode: 'now' | 'digest'; scope: 'all' | 'mine'; digestWeekday: number; digestTime: string; confirmed: boolean; paused: boolean; addedViaPortal: boolean; /** v2.4662: the day emails to this person began failing; null while they go through. */ failingSince: string | null }

export type LegalPortalContract = JobContractRowLike & { signedPdfUrl: string | null }

export type LegalPortalMatter = {
  id: string
  stage: string
  payer: { key: string; name: string; customerId: string | null }
  handling: string
  noteToFirm: string
  releasedAt: string | null
  feesToStatement: boolean
  sharedOverrides: Record<string, boolean>
  /** Entries the office held back from counsel (#85 item 29) — they never arrive, so the page shows the count; 0 from an older function. */
  heldCount: number
  /** The office's settlement floor (#85 item 20); null = the firm settles freely (and from an older function). */
  settlementFloor: LegalSettlementFloor | null
  jobs: Array<JobWithDetails & { collections_by_name?: string | null }>
  customer: LegalCustomerLike
  contacts: LegalContactLike[]
  contactEntries: LegalContactEntryLike[]
  addresses: CustomerAddressRow[]
  /** The records the matter's jobs name (`customer_address_id`), any customer's (#85 item 6); [] from an older function. */
  jobAddresses: CustomerAddressRow[]
  /** The jobs' owner overrides, no email (#85 item 6); [] from an older function. */
  jobOwners: LegalJobOwnerRow[]
  contracts: LegalPortalContract[]
  signedEstimates: SignedEstimateLike[]
  demandLetters: JobDemandLetterRow[]
  lienFilings: JobLienFilingRow[]
  /** The jobs' § 53.056 notice desk items, shaped down to the sent-notice facts (#41 PR 1b); [] from an older function. */
  lienDeskItems: LegalDeskItemLike[]
  promises: unknown[]
  promiseRecords: unknown[]
  chaseTouches: unknown[]
  reports: Array<{ jobId: string; createdAt: string; authorName: string; templateName: string; hasGps: boolean }>
  clockSessions: Array<{ jobId: string; workDate: string; clockedInAt: string; clockedOutAt: string | null; hasGps: boolean; approved: boolean; disqualified: boolean }>
  threadNotes: Array<{ jobId: string; body: string; createdAt: string; authorName: string | null }>
  entries: LegalEntryRow[]
}

export type LegalPortalParticulars = { entity?: string; license?: string; agent?: string; custodian?: string; affiant?: string; phone?: string; email?: string; w9?: string }

export type LegalPortalPayload = {
  company: { name: string; cityLine?: string; phone?: string; email?: string }
  preparedOn: string
  firm: LegalFirmRow
  particulars: LegalPortalParticulars
  recipients: LegalPortalRecipient[]
  firmPaused: boolean
  matters: LegalPortalMatter[]
  /** The Lien desk's Timeline book, raw (#41 PR 2) — null when the function could not read it (or an older function). */
  lienBook: LienBookRaw | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** Defensive parse — null when the shape is not the function's. */
export function parseLegalPortalPayload(raw: unknown): LegalPortalPayload | null {
  if (!isRecord(raw) || !isRecord(raw.firm) || !Array.isArray(raw.matters)) return null
  const firm = raw.firm
  if (typeof firm.id !== 'string' || typeof firm.name !== 'string') return null
  const matters: LegalPortalMatter[] = []
  for (const m of raw.matters) {
    if (!isRecord(m) || typeof m.id !== 'string' || !isRecord(m.payer) || !Array.isArray(m.jobs)) continue
    matters.push({
      id: m.id,
      stage: typeof m.stage === 'string' ? m.stage : 'referred',
      payer: { key: String(m.payer.key ?? ''), name: String(m.payer.name ?? ''), customerId: typeof m.payer.customerId === 'string' ? m.payer.customerId : null },
      handling: typeof m.handling === 'string' ? m.handling : '',
      noteToFirm: typeof m.noteToFirm === 'string' ? m.noteToFirm : '',
      releasedAt: typeof m.releasedAt === 'string' ? m.releasedAt : null,
      feesToStatement: Boolean(m.feesToStatement),
      sharedOverrides: isRecord(m.sharedOverrides) ? Object.fromEntries(Object.entries(m.sharedOverrides).filter(([, v]) => typeof v === 'boolean') as Array<[string, boolean]>) : {},
      heldCount: typeof m.heldCount === 'number' && Number.isFinite(m.heldCount) && m.heldCount > 0 ? Math.floor(m.heldCount) : 0,
      settlementFloor: isRecord(m.settlementFloor) ? settlementFloorOf({ settlement_floor_amount: m.settlementFloor.amount, settlement_floor_pct: m.settlementFloor.pct }) : null,
      jobs: m.jobs as LegalPortalMatter['jobs'],
      customer: (isRecord(m.customer) ? m.customer : null) as LegalCustomerLike,
      contacts: Array.isArray(m.contacts) ? (m.contacts as LegalContactLike[]) : [],
      contactEntries: Array.isArray(m.contactEntries) ? (m.contactEntries as LegalContactEntryLike[]) : [],
      addresses: Array.isArray(m.addresses) ? (m.addresses as CustomerAddressRow[]) : [],
      jobAddresses: Array.isArray(m.jobAddresses) ? (m.jobAddresses as unknown[]).filter((a): a is CustomerAddressRow => isRecord(a) && typeof a.id === 'string') : [],
      jobOwners: Array.isArray(m.jobOwners) ? (m.jobOwners as unknown[]).filter((o): o is LegalJobOwnerRow => isRecord(o) && typeof o.job_id === 'string') : [],
      contracts: Array.isArray(m.contracts) ? (m.contracts as LegalPortalContract[]) : [],
      signedEstimates: Array.isArray(m.signedEstimates) ? (m.signedEstimates as SignedEstimateLike[]) : [],
      demandLetters: Array.isArray(m.demandLetters) ? (m.demandLetters as JobDemandLetterRow[]) : [],
      lienFilings: Array.isArray(m.lienFilings) ? (m.lienFilings as JobLienFilingRow[]) : [],
      lienDeskItems: Array.isArray(m.lienDeskItems) ? (m.lienDeskItems as unknown[]).filter((it): it is LegalDeskItemLike => isRecord(it) && typeof it.id === 'string' && typeof it.job_id === 'string') : [],
      promises: Array.isArray(m.promises) ? m.promises : [],
      promiseRecords: Array.isArray(m.promiseRecords) ? m.promiseRecords : [],
      chaseTouches: Array.isArray(m.chaseTouches) ? m.chaseTouches : [],
      reports: Array.isArray(m.reports) ? (m.reports as LegalPortalMatter['reports']) : [],
      clockSessions: Array.isArray(m.clockSessions) ? (m.clockSessions as LegalPortalMatter['clockSessions']) : [],
      threadNotes: Array.isArray(m.threadNotes) ? (m.threadNotes as LegalPortalMatter['threadNotes']) : [],
      entries: Array.isArray(m.entries) ? (m.entries as LegalEntryRow[]) : [],
    })
  }
  return {
    company: isRecord(raw.company) && typeof raw.company.name === 'string' ? (raw.company as LegalPortalPayload['company']) : { name: 'Click Plumbing and Electrical' },
    preparedOn: typeof raw.preparedOn === 'string' ? raw.preparedOn : '',
    firm: firm as unknown as LegalFirmRow,
    particulars: isRecord(raw.particulars) ? (raw.particulars as LegalPortalParticulars) : {},
    recipients: Array.isArray(raw.recipients)
      ? (raw.recipients as unknown[]).filter(isRecord).map((r): LegalPortalRecipient => ({ id: String(r.id ?? ''), name: String(r.name ?? ''), email: String(r.email ?? ''), role: String(r.role ?? ''), mode: r.mode === 'digest' ? 'digest' : 'now', scope: r.scope === 'mine' ? 'mine' : 'all', digestWeekday: Number(r.digestWeekday) || 1, digestTime: typeof r.digestTime === 'string' ? r.digestTime : '07:00', confirmed: Boolean(r.confirmed), paused: Boolean(r.paused), addedViaPortal: Boolean(r.addedViaPortal), failingSince: typeof r.failingSince === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.failingSince) ? r.failingSince : null }))
      : [],
    firmPaused: Boolean(raw.firmPaused),
    matters,
    lienBook: parseLienBookRaw(raw.lienBook),
  }
}

/** One matter → the packet the desk would show, through the same kernel. */
export function buildMatterPacket(m: LegalPortalMatter, todayYmd: string, fee: LegalFeeModel): LegalPacket | null {
  const coverage = buildJobContractCoverage(m.jobs, m.contracts, m.signedEstimates)
  const accounts = groupCollectionsByPayer(m.jobs, coverage, todayYmd)
  const account = accounts.find((a) => a.key === m.payer.key) ?? accounts[0]
  if (!account) return null
  const promises = parsePaymentPromisesRpc(m.promises) ?? []
  const records = parsePromiseRecordsRpc(m.promiseRecords) ?? []
  const users = m.jobs.map((j) => ({ id: j.collections_by ?? '', name: j.collections_by_name ?? null })).filter((u) => u.id)
  return buildLegalPacket({
    todayYmd,
    account,
    customer: m.customer,
    contacts: m.contacts,
    contactEntries: m.contactEntries,
    addresses: m.addresses,
    jobAddresses: m.jobAddresses,
    jobOwners: m.jobOwners,
    contracts: m.contracts,
    signedEstimates: m.signedEstimates,
    demandLetters: m.demandLetters,
    lienFilings: m.lienFilings,
    lienDeskItems: m.lienDeskItems,
    promises,
    promiseOutcomes: classifyPromises(records, todayYmd),
    chaseTouches: parseChaseTouchesRpc(m.chaseTouches) ?? [],
    reports: m.reports,
    clockSessions: m.clockSessions,
    threadNotes: m.threadNotes,
    users,
    holdOverrides: m.sharedOverrides,
    fee,
  })
}

export function portalFeeModel(payload: LegalPortalPayload): LegalFeeModel {
  return feeModelOf(payload.firm)
}
