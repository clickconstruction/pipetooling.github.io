import type { LienAffidavitFields, LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { workMonthLabel } from './forecastWorkMonths'
import { cleanStoredAddress } from '../displayAddress'
import { lienTradeWords } from './lienTradeWords'
import type { CoverLetterKind } from './gcOnNotice'
import { lienWorkSpan, type LienWorkSpanJob } from './lienWorkSpan'
import { lienAffidavitMonthsInSpan, lienAffidavitNoticeMonths, lienAffidavitNoticesWords, lienAffidavitOwnerSends, type LienAffidavitNoticeRow } from './lienAffidavitNotices'

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
  /** The job's service type name (v2.3849) — the form's default *Type of labor or materials*; blank reads as plumbing. */
  serviceTypeName?: string | null
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
    laborMaterialsType: lienTradeWords(f.serviceTypeName).laborMaterials,
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
 * "Malachi Whites, Master Plumber," in "Call Malachi Whites, Master Plumber, at (830) …" (v2.3850):
 * a contact with a title is an appositive, and the call line closes it with a comma; a bare name is left alone.
 */
export function callLineName(contact: string): string {
  const c = contact.trim()
  return c.includes(',') ? `${c},` : c
}

/**
 * The cover letter on a § 53.057 retainage notice — counsel's letter everywhere (v2.3844),
 * redrafted to counsel's persuasion rules (v2.3850, the owner's call of 2026-09-26). Counsel's
 * memo of 2026-09-22 wrote no retainage letter; it set the rules — its own page, ask the owner
 * to hold the reserved 10 percent (§ 53.101) AND our subcontract retainage and release neither
 * to the GC, no joint check, no GC smear, copy the GC; on a § 53.057-only packet the § 53.081(c)
 * withhold starts when the owner receives a copy of the filed affidavit; "check each job for a
 * bond before you tell an owner to hold 10%". v2.3844 kept those rules and forgot the memo's
 * persuasion rules, so this letter adds what counsel's § 53.056 letters have: the owner's risk
 * (§ 53.105 on the reserve, § 53.084 after the affidavit copy), the three doors and none a joint
 * check, the day our contract ended and the affidavit copy within five days of recording
 * (§ 53.055), why the notice comes now (the 30-day clock, due or not), the payment that matters
 * (retainage or the final draw, not "the next payment"), counsel's homestead line and closer.
 * Counsel has it to read (`to-dos/owner-decisions-pending.md`).
 */
export function lienRetainageCoverLetter(input: {
  claimantName: string
  gcName: string
  property: string
  /** The retainage as money — `$4,250.00`. */
  amount: string
  inClaim: boolean
  endedHow?: 'complete' | 'terminated' | 'abandoned' | null
  /** The day our contract ended, as the letter says it — "September 3, 2026" — or '' when unknown. */
  endedOn?: string | null
  /** 'yes' drops the ask to hold the 10 % reserve, as counsel's bond rule says. */
  paymentBond?: 'yes' | 'no' | 'unknown' | null
  /** Which of counsel's registers the property gets — the homestead line and each kind's closer. */
  kind?: CoverLetterKind | null
  contact: string
  phone: string
  /** The job's service type name (v2.3849) — "the electrical contractor" on an electrical job; blank reads as plumbing. */
  trade?: string | null
}): string {
  const us = input.claimantName.trim() || 'us'
  const gc = input.gcName.trim() || 'the original contractor'
  const kind: CoverLetterKind = input.kind ?? 'commercial'
  const on = (input.endedOn ?? '').trim()
  const ended =
    input.endedHow === 'terminated'
      ? on ? `Our subcontract on this project was terminated on ${on}` : 'Our subcontract on this project has been terminated'
      : input.endedHow === 'abandoned'
        ? on ? `Our subcontract on this project was abandoned on ${on}` : 'Our subcontract on this project has been abandoned'
        : on ? `Our work on this project was completed on ${on}` : 'Our work on this project is complete'
  const bonded = input.paymentBond === 'yes'
  const hold = bonded
    ? [`Until this claim is paid or released, please keep our retainage of ${input.amount} in your hands and do not release it to ${gc}. A payment bond covers this project, so we are not asking you to hold the 10% reserve for us.`]
    : [
        `Until this claim is paid or released, please keep both of these in your hands and release neither to ${gc}:`,
        `• the 10% of your contract with ${gc} that the Code requires you to reserve during the work and for 30 days after that contract is completed (§ 53.101); and`,
        `• our retainage of ${input.amount}.`,
        `If the 10% is paid to ${gc} when it should have been reserved, the property can still be reached for that amount (§ 53.105).`,
      ]
  const trap = input.inClaim
    ? `Our retainage was also named in our earlier notice of claim under § 53.056, so it is already part of what you may withhold from any further payment to ${gc} (§ 53.081). If you pay ${gc} that money anyway, those dollars can follow the property (§ 53.084).`
    : `On a retainage notice alone, your right to withhold our ${input.amount} from ${gc} begins when you receive a copy of our filed lien affidavit (§ 53.081(c)). If the retainage is not paid, we will file that affidavit and send you the copy within five days of recording (§ 53.055). Payments to ${gc} after that day can follow the property (§ 53.084).`
  const contact = callLineName(input.contact) || 'us'
  const phone = input.phone.trim()
  const reach = phone ? `${contact} at ${phone}` : contact
  const closer = kind === 'homestead' ? 'We would rather pick up a check than put an affidavit on a homestead.' : kind === 'residential' ? 'We would rather pick up a check than file a lien on a house.' : 'We would rather pick up a check than file a lien on your property.'
  return [
    `To the owner of ${input.property.trim() || 'the property'},`,
    `This page is a cover letter. The enclosed Notice of Claim for Unpaid Retainage is given under Texas Property Code § 53.057.${kind === 'homestead' ? ' Because this property appears to be your homestead, the notice also includes the statement required by § 53.254(g).' : ''}`,
    `We are the ${lienTradeWords(input.trade).contractor} on your project, working under ${gc}. Under that subcontract ${gc} holds back ${input.amount} of our pay as retainage. ${ended}, and that retainage has not been paid to us.`,
    'You did not hire us, and this is not a lawsuit. Texas law gives us 30 days from the day our contract on this project ended to send this notice if we are going to keep lien rights on that retainage, whether or not it is yet due under our subcontract. That is why it comes now.',
    ...hold,
    trap,
    `The clean ways to finish it, before you release retainage or make a final payment to ${gc}. We cannot deposit a joint check, so please do not send one.`,
    `• ${gc} pays us ${input.amount}, payable only to ${us}. The day it clears we will send you a release of this notice.`,
    `• You keep ${input.amount} in your hands and call ${reach} so we know it is held.`,
    `• If ${gc} writes that you may pay ${us} directly, you send us ${input.amount} and deduct it from what you owe ${gc}. We send the release the same day.`,
    `A copy of this letter and the notice is going to ${gc}.`,
    `Call ${reach} before you release retainage or make a final payment to ${gc}. ${closer}`,
  ].join('\n\n')
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
  /** The office left the supply houses out of the owner's letter (v2.4725); absent means the paragraph rides when a house is owed. */
  housesInLetter?: false
  /** The conditional release enclosed with this notice (v2.4729): the `job_lien_releases` draft the tick made; issued when the run is recorded. */
  releaseId?: string
  /** The wording was changed from the job's defaults (v2.3522): who, and when — the leader sees it before approving. */
  wording?: { editedBy: string; editedAt: string }
  /** The pay page's line under each bill's code, typed by the office (v2.4724), by invoice id; '' prints no line. The bill keeps its own line. */
  payLines?: Record<string, string>
  /** The months named are the job's creation month, not clock hours (v2.3747) — the paper trail says where the date came from. */
  monthsDatedFromCreation?: true
  /** Letter two (v2.3760): this item is the second mailing on the job — which letter, and the first packet it follows. */
  letterTwo?: { kind: 'paid_out' | 'unresponsive'; afterItemId: string; afterSentAt: string }
  /** The GC's written okay for the owner to pay us directly (v2.3760), noted on the first packet's item — letter two is then not due. */
  gcAuthorizedDirectPay?: { at: string; name: string; note: string }
  /** The owner's call (v2.3767): the three questions the letter asks, answered — on the first packet's item; a later call overwrites. */
  ownerCall?: { at: string; name: string; owesGc: 'yes' | 'no' | 'unknown'; owesAmount: number | null; reserved: 'held' | 'released' | 'never' | 'unknown'; originalContractCompletedOn: string | null; note: string }
  /** An affidavit item drafted on the short form (punch list #305, `lienAffidavitForm.ts`); absent on a paper drafted on the earlier form, which keeps it. */
  affidavitForm?: 'short'
}

export function parseLienDeskDraftFields(raw: unknown): LienDeskDraftFields | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { notice?: unknown; gcEmail?: unknown; skipReason?: unknown; skippedBy?: unknown; windowClosed?: unknown; batchReason?: unknown; coverLetter?: unknown; staleNote?: unknown; wording?: unknown; payLines?: unknown; monthsDatedFromCreation?: unknown; letterTwo?: unknown; gcAuthorizedDirectPay?: unknown; ownerCall?: unknown }
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
    ...((o as { housesInLetter?: unknown }).housesInLetter === false ? { housesInLetter: false as const } : {}),
    ...(typeof (o as { releaseId?: unknown }).releaseId === 'string' && (o as { releaseId: string }).releaseId ? { releaseId: (o as { releaseId: string }).releaseId } : {}),
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
    ...(o.payLines && typeof o.payLines === 'object' && Object.keys(o.payLines).length
      ? { payLines: Object.fromEntries(Object.entries(o.payLines as Record<string, unknown>).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v as string])) }
      : {}),
    ...(o.monthsDatedFromCreation === true ? { monthsDatedFromCreation: true as const } : {}),
    ...((o as { affidavitForm?: unknown }).affidavitForm === 'short' ? { affidavitForm: 'short' as const } : {}),
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
  /** The GC's name and address as its customer row holds them. Read on a job under a GC alone: with no GC the paper names our own company (`lienOriginalContractor`). */
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
  /** What the sent bills still owe (v2.4969, the desk's open_balance). Given, the sworn unpaid amount is this less the correction; absent, revenue − paymentsMade as before. */
  openBalance?: number
  /** 'YYYY-MM' — the last month worked, as the desk's RPC names it; the span's fallback when the job carries no day — its first to its last day (v2.6061). */
  lastMonth: string
  /** 'YYYY-MM' — the first month with a session, when the caller knows it (the Lien window's months, v2.6809); the start's fallback while the job has no first day. */
  firstMonth?: string | null
  /** The job's work days (v2.6061): the first and last approved clock day as the ledger keeps them (`first_work_date`, `last_work_date`) and the last day set by hand (`lien_last_work_on`); paragraph 5 swears the span from them. Absent, the month's. */
  workDays?: LienWorkSpanJob | null
  /** Today, 'YYYY-MM-DD' — a month still running ends today on the paper. */
  todayYmd?: string | null
  noticesRecorded: boolean
  contactPerson: string
  issuer: PhysicalInvoiceIssuer | null
  /** The job's service type name (v2.3849) — the affidavit's kind of work. */
  serviceTypeName?: string | null
  /**
   * Which paper to fill (punch list #305): the short form unless the caller says `'long'`, the ten-paragraph form a
   * paper drafted before the short form keeps (`lienAffidavitFormForItem`).
   */
  form?: 'short' | 'long'
  /** The job's recorded filings (`job_lien_filings`): the short form reads the § 53.056 notices among them for the months it names (those inside the job's own work span) and the day and method each went to the owner. */
  filings?: ReadonlyArray<LienAffidavitNoticeRow> | null
  /** The property record says homestead (`customer_addresses.homestead`): the short form opens with the § 53.254(f) notice. The flag alone, never the property kind: a house that is not a homestead must not say its affidavit is not a lien. */
  homestead?: boolean
}

/**
 * Who the original contractor is on a lien paper, and where. Pure, the one rule the desk and the Lien window share.
 * The original contractor is whoever contracted with the owner (§ 53.001(7)). On a job under a GC that is the GC:
 * its name and address as the customer row holds them, blank when none is on file, which the desk lists as a blank
 * to fill. On a job with no GC we contracted with the owner, so it is our own company at its own address, the
 * claimant the paper already names. The desk's draft read the GC's row alone and printed a blank there.
 */
export function lienOriginalContractor(f: { isSub: boolean; gcName: string | null | undefined; gcAddress?: string | null; issuer: PhysicalInvoiceIssuer | null }): { name: string; address: string } {
  if (f.isSub) return { name: f.gcName ?? '', address: f.gcAddress ?? '' }
  return { name: (f.issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME, address: (f.issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim() }
}

/**
 * The months a job's affidavit swears, as keys ('YYYY-MM', oldest first): the months its recorded § 53.056 notices name
 * that fall inside the job's own work span. The short form prints them in words; the notice check reads them as they
 * are (punch list #314). None on a job contracted with the owner.
 */
export function lienAffidavitSwornMonths(f: Pick<LienAffidavitJobFacts, 'isSub' | 'workDays' | 'firstMonth' | 'lastMonth' | 'todayYmd' | 'filings'>): string[] {
  if (!f.isSub) return []
  const span = lienWorkSpan(f.workDays, { firstMonth: f.firstMonth, lastMonth: f.lastMonth, todayYmd: f.todayYmd })
  return lienAffidavitMonthsInSpan(lienAffidavitNoticeMonths(f.filings), span.workStart, span.workEnd)
}

export function buildLienAffidavitFieldsForJob(f: LienAffidavitJobFacts): LienAffidavitFields {
  const unpaid = Math.max(0, (f.openBalance ?? f.revenue - f.paymentsMade) - (f.claimAmountOff ?? 0))
  // One rule for paragraph 7: the GC on a job under one, our own company on a job contracted with the owner, whatever the caller handed over.
  const originalContractor = lienOriginalContractor({ isSub: f.isSub, gcName: f.originalContractorName, gcAddress: f.originalContractorAddress, issuer: f.issuer })
  // The period paragraph 5 swears (v2.6061): the first approved day through the last, or the day set by hand; the month's first to last day as the fallback. Until v2.6061 both ends were the 28th of the last month.
  const span = lienWorkSpan(f.workDays, { firstMonth: f.firstMonth, lastMonth: f.lastMonth, todayYmd: f.todayYmd })
  // The company's second address (punch list #305), when Settings hold one: the short form prints it after the mailing address when the two differ.
  // Line by line, so a field holding only blank lines is no address.
  const physicalAddress = (f.issuer?.physicalAddressText ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(', ')
  return {
    county: f.county,
    claimantPersonName: f.contactPerson,
    claimantCompany: (f.issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME,
    claimantAddress: (f.issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim(),
    legalDescription: f.legalDescription,
    propertyAddress: cleanStoredAddress(f.jobAddress),
    contractedWithName: f.isSub ? f.originalContractorName : f.ownerName || (f.customerName ?? '').trim(),
    // The trade, never the job's name (v2.4719): a job is often named for its customer, and the affidavit swore "the kind of work … was: Bruce Hall".
    workDescription: lienTradeWords(f.serviceTypeName).laborMaterials,
    workStart: span.workStart,
    workEnd: span.workEnd,
    ownerName: f.ownerName,
    ownerAddress: f.ownerAddress,
    originalContractorName: originalContractor.name,
    originalContractorAddress: originalContractor.address,
    contractAmount: f.revenue.toFixed(2),
    paidAmount: f.paymentsMade.toFixed(2),
    unpaidAmount: unpaid.toFixed(2),
    includeNoticesSworn: !f.isSub || f.noticesRecorded,
    ...(f.form === 'long'
      ? {}
      : {
          form: 'short' as const,
          isSub: f.isSub,
          ...(f.homestead === true ? { homestead: true } : {}),
          ...(physicalAddress ? { claimantPhysicalAddress: physicalAddress } : {}),
          // A job contracted with the owner names no months and no notices: neither is asked of an original contractor.
          // The months are the noticed ones inside this job's own span: a notice mailed for several jobs stores the whole paper's months on each.
          ...(f.isSub ? { workMonthsWords: describeNoticeMonths(lienAffidavitSwornMonths(f)), noticesSentWords: lienAffidavitNoticesWords(lienAffidavitOwnerSends(f.filings)) } : {}),
        }),
  }
}
