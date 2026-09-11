/**
 * The firm's portal payload (Legal portal PR 3): what `legal-portal` returns,
 * parsed defensively, and the step that turns one matter's raw records into
 * the same packet the office desk shows — through the one kernel, so the firm
 * and the office never disagree. Held entries never arrive (the function
 * applies the office's decisions under the service role); `sharedOverrides`
 * carries only the pre-bill entries the office chose to share, so the kernel
 * shows them as going rather than held.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { CustomerAddressRow } from '../jobs/lienProperty'
import type { JobContractRowLike, SignedEstimateLike } from '../jobs/jobContractCoverage'
import type { JobDemandLetterRow } from '../jobs/demandLetterTracking'
import type { JobLienFilingRow } from '../jobs/lienDeadlines'
import { classifyPromises, parsePaymentPromisesRpc, parsePromiseRecordsRpc } from '../jobs/paymentPromises'
import { parseChaseTouchesRpc } from '../jobs/paymentChase'
import { buildLegalPacket, groupCollectionsByPayer, type LegalContactEntryLike, type LegalContactLike, type LegalCustomerLike, type LegalFeeModel, type LegalPacket } from './legalPacket'
import { buildJobContractCoverage } from '../jobs/jobContractCoverage'
import { feeModelOf, type LegalEntryRow, type LegalFirmRow } from './legalMatters'

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
  jobs: Array<JobWithDetails & { collections_by_name?: string | null }>
  customer: LegalCustomerLike
  contacts: LegalContactLike[]
  contactEntries: LegalContactEntryLike[]
  addresses: CustomerAddressRow[]
  contracts: LegalPortalContract[]
  signedEstimates: SignedEstimateLike[]
  demandLetters: JobDemandLetterRow[]
  lienFilings: JobLienFilingRow[]
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
  matters: LegalPortalMatter[]
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
      jobs: m.jobs as LegalPortalMatter['jobs'],
      customer: (isRecord(m.customer) ? m.customer : null) as LegalCustomerLike,
      contacts: Array.isArray(m.contacts) ? (m.contacts as LegalContactLike[]) : [],
      contactEntries: Array.isArray(m.contactEntries) ? (m.contactEntries as LegalContactEntryLike[]) : [],
      addresses: Array.isArray(m.addresses) ? (m.addresses as CustomerAddressRow[]) : [],
      contracts: Array.isArray(m.contracts) ? (m.contracts as LegalPortalContract[]) : [],
      signedEstimates: Array.isArray(m.signedEstimates) ? (m.signedEstimates as SignedEstimateLike[]) : [],
      demandLetters: Array.isArray(m.demandLetters) ? (m.demandLetters as JobDemandLetterRow[]) : [],
      lienFilings: Array.isArray(m.lienFilings) ? (m.lienFilings as JobLienFilingRow[]) : [],
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
    matters,
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
    contracts: m.contracts,
    signedEstimates: m.signedEstimates,
    demandLetters: m.demandLetters,
    lienFilings: m.lienFilings,
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
