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
  /** Unpaid subcontract retainage recorded on the job (`jobs_ledger.lien_retainage_held`, v2.3753) — named inside the claim ("Of which, unpaid retainage"). Undefined or 0 prints nothing. */
  retainageHeld?: number | null
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
    ...(retainageInsideClaim(f.openBalance, f.retainageHeld) ? { retainageIncluded: retainageInsideClaim(f.openBalance, f.retainageHeld).toFixed(2) } : {}),
  }
}

/**
 * The retainage the § 53.056 form names inside its claim (v2.3753): the
 * recorded figure, never more than the claim itself — the claim is the open
 * balance (or the office's corrected figure) and the retainage is a part of
 * it, not on top of it. 0 when none is recorded.
 */
export function retainageInsideClaim(claim: number, retainageHeld: number | null | undefined): number {
  const r = Number(retainageHeld ?? 0)
  if (!Number.isFinite(r) || r <= 0) return 0
  return Math.min(Math.max(0, claim), r)
}

/** The § 53.057 form, filled from the job (v2.3753): the § 53.056 fields with the retainage as the figure and no per-month or retainage lines. */
export function buildLienRetainageNoticeFieldsForJob(f: Omit<LienNoticeJobFacts, 'openBalance' | 'claimSplit' | 'retainageHeld'> & { retainageHeld: number }): LienNoticeFields {
  const fields: LienNoticeFields = buildLienNoticeFieldsForJob({ ...f, openBalance: f.retainageHeld })
  delete fields.claimSplit
  delete fields.retainageIncluded
  return fields
}

/**
 * The cover note that rides with a § 53.057 notice — counsel's rules for the
 * retainage cover (2026-09-22): its own page, ask the owner to hold the
 * reserved 10 percent and our subcontract retainage and not release either to
 * the GC, no joint check, the GC copied; and, when the packet is § 53.057
 * only, that the § 53.081(c) withhold starts when they receive a copy of the
 * filed affidavit.
 */
export function lienRetainageCoverNote(claimantName: string, opts: { inClaim: boolean; endedHow?: 'complete' | 'terminated' | 'abandoned' | null }): string {
  const ended = opts.endedHow === 'terminated' ? 'now that its contract on this project has been terminated' : opts.endedHow === 'abandoned' ? 'now that its contract on this project has been abandoned' : 'now that its work on this project is complete'
  const trap = opts.inClaim
    ? 'The retainage in this notice was also named in our earlier notice of claim under § 53.056, so it is already part of the amount you may withhold from the original contractor.'
    : 'Under § 53.081(c) you may withhold this retainage from the original contractor once you receive a copy of our filed lien affidavit; we will send that copy the day it is recorded.'
  return `This is the notice ${claimantName} sends under Texas Property Code § 53.057 to preserve its claim on the retainage still unpaid under its subcontract, ${ended}. Please keep the 10 percent Texas law asks you to reserve on the original contract, and this retainage, in your hands until the claim is paid or released; do not release either to the original contractor. ${trap} We cannot deposit a joint check — a payment that ends this is one payable only to ${claimantName}, and we send a release the day it clears. A copy of this notice goes to the original contractor. It is not a claim that you are in default.`
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
  /** The months named are the job's creation month, not clock hours (v2.3747) — the paper trail says where the date came from. */
  monthsDatedFromCreation?: true
  /** Letter two (v2.3760): this item is the second mailing on the job — which letter, and the first packet it follows. */
  letterTwo?: { kind: 'paid_out' | 'unresponsive'; afterItemId: string; afterSentAt: string }
  /** The GC's written okay for the owner to pay us directly (v2.3760), noted on the first packet's item — letter two is then not due. */
  gcAuthorizedDirectPay?: { at: string; name: string; note: string }
  /** The owner's call (v2.3767): the three questions the letter asks, answered — on the first packet's item; a later call overwrites. */
  ownerCall?: { at: string; name: string; owesGc: 'yes' | 'no' | 'unknown'; owesAmount: number | null; reserved: 'held' | 'released' | 'never' | 'unknown'; originalContractCompletedOn: string | null; note: string }
}

export function parseLienDeskDraftFields(raw: unknown): LienDeskDraftFields | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { notice?: unknown; gcEmail?: unknown; skipReason?: unknown; skippedBy?: unknown; windowClosed?: unknown; batchReason?: unknown; coverLetter?: unknown; staleNote?: unknown; wording?: unknown; monthsDatedFromCreation?: unknown; letterTwo?: unknown; gcAuthorizedDirectPay?: unknown; ownerCall?: unknown }
  const n = o.notice as (Partial<LienNoticeFields> & { claimSplit?: unknown; retainageIncluded?: unknown }) | undefined
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
      ...(str(n.retainageIncluded) ? { retainageIncluded: str(n.retainageIncluded) } : {}),
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
    ...(o.monthsDatedFromCreation === true ? { monthsDatedFromCreation: true as const } : {}),
    ...parseLienNoticeSentFacts(o),
  }
}

/** The facts a sent notice's item carries beside its draft — letter two (v2.3760), the GC's written okay (v2.3760), the owner's call (v2.3767). */
export type LienNoticeSentFacts = Pick<LienDeskDraftFields, 'letterTwo' | 'gcAuthorizedDirectPay' | 'ownerCall'>

/**
 * The three sent-notice facts read on their own, without the draft (#41 PR 1b):
 * the firm's portal receives each notice item shaped down to exactly these, so
 * the legal packet and letter two's clock read them here rather than through
 * `parseLienDeskDraftFields`, which needs the notice block. Tolerant: an
 * absent or malformed fact is simply absent.
 */
export function parseLienNoticeSentFacts(raw: unknown): LienNoticeSentFacts {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as { letterTwo?: unknown; gcAuthorizedDirectPay?: unknown; ownerCall?: unknown }
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    ...(o.letterTwo && typeof o.letterTwo === 'object' && ((o.letterTwo as { kind?: unknown }).kind === 'paid_out' || (o.letterTwo as { kind?: unknown }).kind === 'unresponsive')
      ? { letterTwo: { kind: (o.letterTwo as { kind: 'paid_out' | 'unresponsive' }).kind, afterItemId: str((o.letterTwo as { afterItemId?: unknown }).afterItemId), afterSentAt: str((o.letterTwo as { afterSentAt?: unknown }).afterSentAt) } }
      : {}),
    ...(o.gcAuthorizedDirectPay && typeof o.gcAuthorizedDirectPay === 'object' && typeof (o.gcAuthorizedDirectPay as { at?: unknown }).at === 'string'
      ? { gcAuthorizedDirectPay: { at: str((o.gcAuthorizedDirectPay as { at?: unknown }).at), name: str((o.gcAuthorizedDirectPay as { name?: unknown }).name), note: str((o.gcAuthorizedDirectPay as { note?: unknown }).note) } }
      : {}),
    ...(parseOwnerCallFields(o.ownerCall) ? { ownerCall: parseOwnerCallFields(o.ownerCall)! } : {}),
  }
}

/** The owner's call as stored (v2.3767) — the same reading `lienOwnerCall.ts` does, kept here so the draft parser has no cycle. */
function parseOwnerCallFields(raw: unknown): NonNullable<LienDeskDraftFields['ownerCall']> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.at !== 'string' || !o.at) return null
  return {
    at: o.at,
    name: typeof o.name === 'string' ? o.name : '',
    owesGc: o.owesGc === 'yes' || o.owesGc === 'no' ? o.owesGc : 'unknown',
    owesAmount: typeof o.owesAmount === 'number' && Number.isFinite(o.owesAmount) ? o.owesAmount : null,
    reserved: o.reserved === 'held' || o.reserved === 'released' || o.reserved === 'never' ? o.reserved : 'unknown',
    originalContractCompletedOn: typeof o.originalContractCompletedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.originalContractCompletedOn) ? o.originalContractCompletedOn : null,
    note: typeof o.note === 'string' ? o.note : '',
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
