import { buildLienWaiverEmailHtml, lienWaiverMoney, type LienWaiverFields, type LienWaiverFormType, type LienWaiverSignature } from '../jobsDocuments/lienWaiverRelease'
import type { FilingDocExtras } from '../jobsDocuments/lienFilingDocuments'
import { lienReleaseFieldsFromSnapshot, type JobLienReleaseRow } from './lienReleaseTracking'

/**
 * A conditional release of lien enclosed with a § 53.056 notice (v2.4729, Stephen's addition to
 * Taunya's cover-letter ask): the app's own § 53.284 form, prefilled from the notice — the claim
 * as the amount, the GC as the check's maker, the last work month's end as the through date —
 * printed behind the owner's letter and behind the GC's form, with a paragraph in the letter that
 * says it is not effective until the money clears. The release is a `job_lien_releases` draft
 * from the tick and is issued when the run is recorded, so the Dashboard's cleared-release queue
 * sees it like any other. Pure: the words, the form, the fields, the page; the writes live in
 * `lienNoticeReleaseIo.ts`.
 */

/** Counsel has not read the release paragraph, nor how a release the owner or the GC may pay should name its maker: the desk draws an amber line until this flips. */
export const LIEN_RELEASE_PARAGRAPH_READ_BY_COUNSEL = false

export type NoticeReleaseForm = Extract<LienWaiverFormType, 'conditional_progress' | 'conditional_final'>

/** The release as the run carries it: the row's id, its form, its fields as snapshotted, its money, and the master's signature when he signed it in the app. */
export type NoticeRelease = {
  id: string
  formType: NoticeReleaseForm
  fields: LienWaiverFields
  amount: number
  signature: LienWaiverSignature | null
}

const EPSILON = 0.005

/** Final when the claim is everything still open on the job; progress when something else is still owed. */
export function noticeReleaseFormType(claim: number, openOnJob: number): NoticeReleaseForm {
  return openOnJob > EPSILON && claim + EPSILON >= openOnJob ? 'conditional_final' : 'conditional_progress'
}

/** The last day of the last work month the notice names ("2026-08" → "2026-08-31"); '' with no months. */
export function noticeReleaseThroughDate(months: readonly string[]): string {
  const last = months
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .slice()
    .sort()
    .pop()
  if (!last) return ''
  const [y, m] = last.split('-').map(Number) as [number, number]
  const end = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${last}-${String(end).padStart(2, '0')}`
}

/** "17585.00" / "$17,585.00" → 17585; 0 when it is not money. */
export function noticeReleaseMoney(s: string | number): number {
  const n = Number(String(s ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export type NoticeReleaseFieldsInput = {
  /** The claimant's name on the notice, the releasing party. */
  claimantName: string
  /** The original contractor — who owes us, and whom the letter asks to pay; the check's maker on the form. */
  gcName: string
  jobName: string | null | undefined
  jobAddress: string | null | undefined
  /** The notice's Claim amount, as the form types it. */
  claim: string | number
  months: readonly string[]
  /** The company's signer from Settings, else the notice's contact person. */
  signerName: string
  signerTitle?: string | null
}

/** The § 53.284 form's boxes, filled from the notice. The signature date stays blank: the master signs when he signs. */
export function noticeReleaseFields(i: NoticeReleaseFieldsInput): LienWaiverFields {
  const name = (i.jobName ?? '').trim()
  const address = (i.jobAddress ?? '').trim()
  return {
    companyName: i.claimantName.trim(),
    checkFrom: i.gcName.trim() || 'the original contractor',
    amount: noticeReleaseMoney(i.claim).toFixed(2),
    projectDescription: [name, address].filter(Boolean).join(', '),
    throughDate: noticeReleaseThroughDate(i.months),
    signedDate: '',
    signerName: i.signerName.trim(),
    signerTitle: (i.signerTitle ?? '').trim(),
  }
}

/**
 * The letter's paragraph (Stephen's words, 2026-10-06, with one sentence in front so the owner
 * knows what the extra page is). `amountWords` is the letter's own figure, "$17,585.00".
 */
export function conditionalReleaseParagraph(amountWords: string): string {
  return `A conditional release of lien is enclosed. This release is not effective today. It becomes effective only after ${amountWords} is received and the funds have cleared. Until then, the notice stands.`
}

/** The enclosure line's tail: ", and a conditional release of lien" when one rides in the envelope. */
export function noticeReleaseEnclosureWords(release: NoticeRelease | null | undefined): string {
  return release ? ', and a conditional release of lien' : ''
}

/** A release row as the run reads it; null for a row that is not a conditional form or has no money. */
export function noticeReleaseFromRow(row: Pick<JobLienReleaseRow, 'id' | 'form_type' | 'fields' | 'amount' | 'through_date'>, signature: LienWaiverSignature | null): NoticeRelease | null {
  if (row.form_type !== 'conditional_progress' && row.form_type !== 'conditional_final') return null
  const snap = lienReleaseFieldsFromSnapshot(row.fields)
  const fields: LienWaiverFields = {
    companyName: snap.companyName ?? '',
    checkFrom: snap.checkFrom ?? '',
    amount: snap.amount ?? String(row.amount ?? ''),
    projectDescription: snap.projectDescription ?? '',
    throughDate: snap.throughDate ?? row.through_date ?? '',
    signedDate: snap.signedDate ?? '',
    signerName: snap.signerName ?? '',
    signerTitle: snap.signerTitle ?? '',
  }
  return { id: row.id, formType: row.form_type, fields, amount: Number(row.amount ?? 0), signature }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The release as a page of the packet: the letterhead the notices carry, then the form as the
 * Release of Lien window prints it (title, paragraphs, the foot with the master's ink or a line
 * to sign by hand). A fragment, like every other page `runCopyPages` stacks.
 */
export function noticeReleasePageHtml(r: NoticeRelease, extras?: FilingDocExtras): string {
  const lh = extras?.letterhead
  const head =
    lh && lh.company.trim()
      ? `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:1.5rem;margin:0 0 1.2em;padding-bottom:0.5em;border-bottom:1px solid #cfcbc2"><div style="font-weight:700;font-size:1.12em">${esc(lh.company)}</div><div style="font-size:0.8em;color:#555;text-align:right">${lh.contactLines.map(esc).join('<br>')}</div></div>`
      : ''
  return `<div data-notice-release-page style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.75">${head}${buildLienWaiverEmailHtml(r.formType, r.fields, r.signature)}</div>`
}

/** "Conditional release of lien · $17,585.00" — the desk's tick and the run's page label. */
export function noticeReleaseLabel(amount: string | number): string {
  return `Conditional release of lien · ${lienWaiverMoney(String(amount))}`
}
