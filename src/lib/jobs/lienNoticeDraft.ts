import type { LienAffidavitFields, LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { workMonthLabel } from './forecastWorkMonths'

/**
 * The § 53.056 notice, filled from the job (pure). The Lien window's notice
 * tab and the Lien desk build the same document from the same facts, so a
 * draft approved on the desk is the paper the window would print.
 */

export type LienNoticeJobFacts = {
  jobName: string | null | undefined
  jobAddress: string | null | undefined
  /** The GC on the job — the "original contractor" line. */
  originalContractorName: string
  /** Open balance on the job (revenue − payments) — the claim amount. */
  openBalance: number
  /** The signer (the job's master's "Full name and title", else the session name). */
  contactPerson: string
  issuer: PhysicalInvoiceIssuer | null
  todayYmd: string
}

export const DEFAULT_CLAIMANT_NAME = 'Click Plumbing and Electrical'

export function buildLienNoticeFieldsForJob(f: LienNoticeJobFacts): LienNoticeFields {
  return {
    noticeDate: f.todayYmd,
    projectDescription: [f.jobName?.trim(), f.jobAddress?.trim()].filter(Boolean).join(' — '),
    claimantName: (f.issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME,
    laborMaterialsType: 'Plumbing labor and materials',
    originalContractorName: f.originalContractorName,
    contractedWithIfDifferent: '',
    claimAmount: Math.max(0, f.openBalance).toFixed(2),
    contactPerson: f.contactPerson,
    claimantAddress: (f.issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim(),
  }
}

/** "June, July and August 2026" — the months a notice names, for the reference strip and the cover note. */
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

function fullMonthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(key)
  if (!m) return workMonthLabel(key)
  return `${FULL_MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

export function describeNoticeMonths(months: ReadonlyArray<string>): string {
  const sorted = months.slice().sort()
  if (sorted.length === 0) return ''
  const years = new Set(sorted.map((m) => m.slice(0, 4)))
  const names = sorted.map((m) => (years.size === 1 ? fullMonthLabel(m).replace(/ \d{4}$/, '') : fullMonthLabel(m)))
  const joined = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return years.size === 1 ? `${joined} ${sorted[0]!.slice(0, 4)}` : joined
}

/** The optional cover note that rides with the notice: routine paper, not a claim of default. */
export function lienNoticeCoverNote(claimantName: string, months: ReadonlyArray<string>): string {
  const when = describeNoticeMonths(months)
  return `This is a routine notice ${claimantName} sends to preserve its rights under Texas Property Code chapter 53 for work furnished in ${when || 'the months named'}. It is not a claim that you are in default, and it is sent to the property owner and the original contractor as the statute requires. If this balance has already been paid, please let us know and we will update our records.`
}

/** The parsed draft stored on a desk item's `fields` jsonb. */
export type LienDeskDraftFields = {
  notice: LienNoticeFields
  /** Courtesy email copies the run should send (GC email when on file). */
  gcEmail: string
  /** Free text the office leaves on a skip. */
  skipReason?: string
  /** Put a GC on notice (v2.3470): the run's reason, kept on every notice in it — "GC is not paying its subs — <note>". */
  batchReason?: string
}

export function parseLienDeskDraftFields(raw: unknown): LienDeskDraftFields | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { notice?: unknown; gcEmail?: unknown; skipReason?: unknown; batchReason?: unknown }
  const n = o.notice as Partial<LienNoticeFields> | undefined
  if (!n || typeof n !== 'object') return null
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    notice: {
      noticeDate: str(n.noticeDate),
      projectDescription: str(n.projectDescription),
      claimantName: str(n.claimantName),
      laborMaterialsType: str(n.laborMaterialsType),
      originalContractorName: str(n.originalContractorName),
      contractedWithIfDifferent: str(n.contractedWithIfDifferent),
      claimAmount: str(n.claimAmount),
      contactPerson: str(n.contactPerson),
      claimantAddress: str(n.claimantAddress),
    },
    gcEmail: str(o.gcEmail),
    ...(typeof o.skipReason === 'string' ? { skipReason: o.skipReason } : {}),
    ...(typeof o.batchReason === 'string' && o.batchReason.trim() ? { batchReason: o.batchReason } : {}),
  }
}

/** The § 53.054 affidavit, filled from the job — the Lien window's affidavit tab's recipe. */
export type LienAffidavitJobFacts = {
  jobName: string | null | undefined
  jobAddress: string | null | undefined
  isSub: boolean
  originalContractorName: string
  originalContractorAddress: string
  ownerName: string
  ownerAddress: string
  county: string
  legalDescription: string
  customerName: string | null | undefined
  revenue: number
  paymentsMade: number
  /** 'YYYY-MM' — the last month worked; the affidavit swears the work span. */
  lastMonth: string
  noticesRecorded: boolean
  contactPerson: string
  issuer: PhysicalInvoiceIssuer | null
}

export function buildLienAffidavitFieldsForJob(f: LienAffidavitJobFacts): LienAffidavitFields {
  const unpaid = Math.max(0, f.revenue - f.paymentsMade)
  const monthEnd = /^\d{4}-\d{2}$/.test(f.lastMonth) ? `${f.lastMonth}-28` : ''
  return {
    county: f.county,
    claimantPersonName: f.contactPerson,
    claimantCompany: (f.issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME,
    claimantAddress: (f.issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim(),
    legalDescription: f.legalDescription,
    propertyAddress: (f.jobAddress ?? '').trim(),
    contractedWithName: f.isSub ? f.originalContractorName : f.ownerName || (f.customerName ?? '').trim(),
    workDescription: (f.jobName ?? '').trim() || 'Plumbing labor and materials',
    workStart: monthEnd,
    workEnd: monthEnd,
    ownerName: f.ownerName,
    ownerAddress: f.ownerAddress,
    originalContractorName: f.originalContractorName,
    originalContractorAddress: f.originalContractorAddress,
    contractAmount: f.revenue.toFixed(2),
    paidAmount: f.paymentsMade.toFixed(2),
    unpaidAmount: unpaid.toFixed(2),
    includeNoticesSworn: !f.isSub || f.noticesRecorded,
  }
}
