import type { LienAffidavitFields, LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { workMonthLabel } from './forecastWorkMonths'
import { cleanStoredAddress } from '../displayAddress'

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
  /** What the notice claims — the open balance, or the figure the office set by hand (v2.3682). */
  openBalance: number
  /** The per-month split as the paper states it, when a person gave a month its own figure. */
  claimSplit?: string
  /** The signer (the job's master's "Full name and title", else the session name). */
  contactPerson: string
  issuer: PhysicalInvoiceIssuer | null
  todayYmd: string
  /** Print the § 53.254(g) statement — `homesteadStatementApplies(property)` (v2.3744). */
  homesteadStatement?: boolean
}

export const DEFAULT_CLAIMANT_NAME = 'Click Plumbing and Electrical'

/**
 * Whether the notice prints the § 53.254(g) homestead statement (v2.3744):
 * on a property flagged homestead, and on every residential property — a
 * homestead is always residential, the roll's flag can be stale or missing,
 * and the statement costs nothing on a residence that is not one. Counsel,
 * 2026-09-22: the § 53.081 mechanics are the same on residential work; the
 * homestead lien is invalid without this statement.
 */
export function homesteadStatementApplies(property: { propertyKind: string; homestead: boolean } | null | undefined): boolean {
  if (!property) return false
  return property.homestead === true || property.propertyKind === 'residential'
}

export function buildLienNoticeFieldsForJob(f: LienNoticeJobFacts): LienNoticeFields {
  return {
    noticeDate: f.todayYmd,
    projectDescription: [f.jobName?.trim(), cleanStoredAddress(f.jobAddress)].filter(Boolean).join(' — '),
    claimantName: (f.issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME,
    laborMaterialsType: 'Plumbing labor and materials',
    originalContractorName: f.originalContractorName,
    contractedWithIfDifferent: '',
    claimAmount: Math.max(0, f.openBalance).toFixed(2),
    ...(f.claimSplit ? { claimSplit: f.claimSplit } : {}),
    contactPerson: f.contactPerson,
    claimantAddress: (f.issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim(),
    ...(f.homesteadStatement ? { homesteadStatement: true } : {}),
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
  /** Who skipped it and when (v2.3661) — a skip gives up a lien right, so the record says whose call it was. Absent on older skips. */
  skippedBy?: { name: string; at: string }
  /** A closed window a person noted after the fact (v2.3679): not a decision, a record that someone saw the loss. No `skipReason` on such an item. */
  windowClosed?: { name: string; at: string }
  /** Put a GC on notice (v2.3470): the run's reason, kept on every notice in it — "GC is not paying its subs — <note>". */
  batchReason?: string
  /** Put a GC on notice (v2.3482): the cover letter written once for the run, with its fills unresolved; replaces the standard cover note on this item. */
  coverLetter?: string
  /** The letter's `{{stale_note}}` (v2.3745): stale-month dollars named as information, '' or absent when none. */
  staleNote?: string
  /** The wording was changed from the job's defaults (v2.3522): who, and when — the leader sees it before approving. */
  wording?: { editedBy: string; editedAt: string }
}

export function parseLienDeskDraftFields(raw: unknown): LienDeskDraftFields | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { notice?: unknown; gcEmail?: unknown; skipReason?: unknown; skippedBy?: unknown; windowClosed?: unknown; batchReason?: unknown; coverLetter?: unknown; staleNote?: unknown; wording?: unknown }
  const n = o.notice as (Partial<LienNoticeFields> & { claimSplit?: unknown }) | undefined
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
      ...(str(n.claimSplit) ? { claimSplit: str(n.claimSplit) } : {}),
      contactPerson: str(n.contactPerson),
      claimantAddress: str(n.claimantAddress),
      ...(n.homesteadStatement === true ? { homesteadStatement: true } : {}),
    },
    gcEmail: str(o.gcEmail),
    ...(typeof o.skipReason === 'string' ? { skipReason: o.skipReason } : {}),
    ...(typeof o.staleNote === 'string' && o.staleNote.trim() ? { staleNote: o.staleNote.trim() } : {}),
    ...(o.skippedBy && typeof o.skippedBy === 'object' && typeof (o.skippedBy as { name?: unknown }).name === 'string'
      ? { skippedBy: { name: str((o.skippedBy as { name?: unknown }).name), at: str((o.skippedBy as { at?: unknown }).at) } }
      : {}),
    ...(o.windowClosed && typeof o.windowClosed === 'object' && typeof (o.windowClosed as { name?: unknown }).name === 'string'
      ? { windowClosed: { name: str((o.windowClosed as { name?: unknown }).name), at: str((o.windowClosed as { at?: unknown }).at) } }
      : {}),
    ...(typeof o.batchReason === 'string' && o.batchReason.trim() ? { batchReason: o.batchReason } : {}),
    ...(typeof o.coverLetter === 'string' && o.coverLetter.trim() ? { coverLetter: o.coverLetter } : {}),
    ...(o.wording && typeof o.wording === 'object' && typeof (o.wording as { editedBy?: unknown }).editedBy === 'string'
      ? { wording: { editedBy: str((o.wording as { editedBy?: unknown }).editedBy), editedAt: str((o.wording as { editedAt?: unknown }).editedAt) } }
      : {}),
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
  /** The claim set by hand (v2.3682): dollars off the unpaid balance the affidavit swears to. */
  claimAmountOff?: number
  /** 'YYYY-MM' — the last month worked; the affidavit swears the work span. */
  lastMonth: string
  noticesRecorded: boolean
  contactPerson: string
  issuer: PhysicalInvoiceIssuer | null
}

export function buildLienAffidavitFieldsForJob(f: LienAffidavitJobFacts): LienAffidavitFields {
  const unpaid = Math.max(0, f.revenue - f.paymentsMade - (f.claimAmountOff ?? 0))
  const monthEnd = /^\d{4}-\d{2}$/.test(f.lastMonth) ? `${f.lastMonth}-28` : ''
  return {
    county: f.county,
    claimantPersonName: f.contactPerson,
    claimantCompany: (f.issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME,
    claimantAddress: (f.issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim(),
    legalDescription: f.legalDescription,
    propertyAddress: cleanStoredAddress(f.jobAddress),
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
