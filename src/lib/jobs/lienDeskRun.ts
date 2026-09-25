import { buildLienNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer, type FilingDocBlock, type FilingDocExtras, type LienNoticeFields, type LienNoticeInstrument } from '../jobsDocuments/lienFilingDocuments'
import { filingDocumentPayload } from './lienFilingDocumentLink'
import { correctedClaim } from './lienClaimCorrection'
import { demandDate, demandMoney } from '../jobsDocuments/demandLetter'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from './lienProperty'
import { ownerFromRollUnconfirmed } from './ownerConfirm'
import type { LienDeskEntry } from './lienDesk'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { buildLienNoticeFieldsForJob, buildLienRetainageNoticeFieldsForJob, describeNoticeMonths, homesteadStatementApplies, lienRetainageCoverNote, parseLienDeskDraftFields } from './lienNoticeDraft'
import type { LienRetainageEntry } from './lienDeskRetainage'
import { affidavitMonthWord, coverLetterKindFor, coverLetterParagraphs, counselCoverLetterTemplate, fillCoverLetter } from './gcOnNotice'
import { runCopies, runEnvelopes, type RunEnvelope } from './runEnvelopes'
import { payPageBlocks, type PayPageAssets, type PayPageRow } from './lienNoticePayPage'

/**
 * The run (pure kernel): every approved notice on the desk, its two
 * statutory recipients (the owner of record and the original contractor),
 * the packet to print (a cover sheet listing the envelopes, then what goes
 * in each, in envelope order — the owner's copy behind its cover page, the
 * original contractor's copy alone; notices to one name at one address
 * share an envelope, v2.3720), and the `job_lien_filings` payload recording
 * it with every month it named.
 */

export type RunSendMethod = 'certified_mail' | 'traceable_courier' | 'email' | 'hand'

export const RUN_SEND_METHODS: ReadonlyArray<{ key: RunSendMethod; label: string }> = [
  { key: 'certified_mail', label: 'certified mail, return receipt' },
  { key: 'traceable_courier', label: 'traceable courier' },
  { key: 'email', label: 'email (courtesy — mail it too)' },
  { key: 'hand', label: 'hand delivery' },
]

export type RunRecipient = {
  key: 'owner' | 'original_contractor'
  label: string
  name: string
  address: string
  email: string
  method: RunSendMethod
  tracking: string
}

export type RunNotice = {
  itemId: string
  jobId: string
  /** Which Subchapter C form this is (v2.3753): the monthly § 53.056 notice, or the § 53.057 retainage notice — same recipients, same envelope rules, its own form and footer. */
  kind: LienNoticeInstrument
  /** "650 · ATI Schertz" */
  label: string
  jobNumber: string
  months: string[]
  amount: number
  fields: LienNoticeFields
  extras: FilingDocExtras
  /** The cover note text, or null — a § 53.057 retainage notice's counsel note; a § 53.056 notice carries the letter instead (v2.3828). */
  coverNote: string | null
  /** Put a GC on notice (v2.3482): the run's letter, fills resolved for this notice — replaces the cover note on the owner's copy. Null when the item carries none. */
  coverLetter: string | null
  recipients: RunRecipient[]
  /** The owner came from the appraisal roll (the nightly save, v2.3450) and no person has confirmed it — the run refuses until someone does. */
  ownerUnconfirmed: boolean
}

/** Every Ready-to-send entry as a run notice. Entries with no live approved item are skipped. */
export function buildLienDeskRun(
  entries: ReadonlyArray<LienDeskEntry>,
  data: LienDeskData,
  issuer: PhysicalInvoiceIssuer | null,
  signerNameFor: (masterUserId: string | null) => string,
  todayYmd: string,
  /** The signer's own phone for `{{phone}}` (v2.3753); the letterhead's when absent. */
  signerPhoneFor?: (masterUserId: string | null) => string,
): RunNotice[] {
  const out: RunNotice[] = []
  for (const e of entries) {
    const item = e.item
    if (!item || item.status !== 'approved') continue
    const job = data.jobsById[e.jobId]
    const gc = e.gcCustomerId ? data.gcsById[e.gcCustomerId] : undefined
    const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
    const property = resolveLienProperty(address, data.ownerByJob[e.jobId] ?? null)
    const ownerName = lienPropertyOwnerDisplayName(property.owner)
    const draft = parseLienDeskDraftFields(item.fields)
    const months = item.months.length ? item.months.slice().sort() : e.dueMonths
    const fields =
      draft?.notice ??
      buildLienNoticeFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        originalContractorName: gc?.name ?? '',
        openBalance: correctedClaim(e.openBalance, data.claimCorrectionsByJob[e.jobId] ?? null).claim,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
        homesteadStatement: homesteadStatementApplies(property),
        retainageHeld: job?.lien_retainage_held ?? null,
      })
    const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'
    const name = (job?.job_name ?? '').trim()
    const ownerEmail = (data.ownerByJob[e.jobId]?.owner_email ?? '').trim()
    const phone = signerPhoneFor ? signerPhoneFor(job?.master_user_id ?? null) : (issuer?.phone ?? '').trim()
    out.push({
      itemId: item.id,
      jobId: e.jobId,
      kind: 'notice_53_056',
      label: name ? `${jobNumber} · ${name}` : jobNumber,
      jobNumber,
      months,
      amount: e.openBalance,
      fields,
      extras: {
        letterhead: filingLetterheadFromIssuer(issuer),
        refItems: [`Job #${jobNumber}`, months.length ? `Work months ${describeNoticeMonths(months)}` : '', demandDate(todayYmd)].filter(Boolean),
      },
      // Counsel's letter everywhere (v2.3828): the box on the desk now turns counsel's letter on or off; the short routine note is gone.
      coverNote: null,
      coverLetter: item.cover_note || draft?.coverLetter ? fillCoverLetter(counselCoverLetterTemplate({ stored: draft?.coverLetter, gcName: gc?.name ?? fields.originalContractorName, claimantName: fields.claimantName, property }), { property: (job?.job_address ?? '').trim(), months: describeNoticeMonths(months), job: jobNumber, amount: demandMoney(fields.claimAmount), staleNote: draft?.staleNote ?? '', contact: fields.contactPerson, phone, affidavitMonth: affidavitMonthWord(coverLetterKindFor(property)) }) : null,
      ownerUnconfirmed: property.owner.source === 'property_record' && ownerFromRollUnconfirmed(address),
      recipients: [
        { key: 'owner', label: 'Owner of record', name: ownerName, address: property.owner.mailingAddress, email: ownerEmail, method: 'certified_mail', tracking: '' },
        { key: 'original_contractor', label: 'Original contractor', name: gc?.name ?? fields.originalContractorName, address: gc?.address ?? '', email: draft?.gcEmail || gc?.email || '', method: 'certified_mail', tracking: '' },
      ],
    })
  }
  return out
}

/**
 * Every approved § 53.057 retainage notice as a run notice (v2.3753): the same
 * two statutory recipients and envelope rules as the monthly notice, the
 * retainage as the figure, no months, counsel's retainage cover note in place
 * of the routine one. Rides in the same run as the § 53.056 notices.
 */
export function buildLienRetainageRun(
  entries: ReadonlyArray<LienRetainageEntry>,
  data: LienDeskData,
  issuer: PhysicalInvoiceIssuer | null,
  signerNameFor: (masterUserId: string | null) => string,
  todayYmd: string,
): RunNotice[] {
  const out: RunNotice[] = []
  for (const e of entries) {
    const item = e.item
    if (!item || item.status !== 'approved') continue
    const job = data.jobsById[e.jobId]
    const gc = e.gcCustomerId ? data.gcsById[e.gcCustomerId] : undefined
    const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
    const property = resolveLienProperty(address, data.ownerByJob[e.jobId] ?? null)
    const ownerName = lienPropertyOwnerDisplayName(property.owner)
    const draft = parseLienDeskDraftFields(item.fields)
    const fields =
      draft?.notice ??
      buildLienRetainageNoticeFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        originalContractorName: gc?.name ?? '',
        retainageHeld: e.retainageHeld,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
        homesteadStatement: homesteadStatementApplies(property),
      })
    const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'
    const name = (job?.job_name ?? '').trim()
    const ownerEmail = (data.ownerByJob[e.jobId]?.owner_email ?? '').trim()
    out.push({
      itemId: item.id,
      jobId: e.jobId,
      kind: 'retainage_53_057',
      label: name ? `${jobNumber} · ${name}` : jobNumber,
      jobNumber,
      months: [],
      amount: Number(fields.claimAmount) || e.retainageHeld,
      fields,
      extras: {
        letterhead: filingLetterheadFromIssuer(issuer),
        refItems: [`Job #${jobNumber}`, e.contractEndedOn ? `Our contract ${e.contractEndedHow ?? 'ended'} ${demandDate(e.contractEndedOn)}` : '', demandDate(todayYmd)].filter(Boolean),
      },
      coverNote: item.cover_note ? lienRetainageCoverNote(fields.claimantName, { inClaim: e.inClaim, endedHow: e.contractEndedHow }) : null,
      coverLetter: null,
      ownerUnconfirmed: property.owner.source === 'property_record' && ownerFromRollUnconfirmed(address),
      recipients: [
        { key: 'owner', label: 'Owner of record', name: ownerName, address: property.owner.mailingAddress, email: ownerEmail, method: 'certified_mail', tracking: '' },
        { key: 'original_contractor', label: 'Original contractor', name: gc?.name ?? fields.originalContractorName, address: gc?.address ?? '', email: draft?.gcEmail || gc?.email || '', method: 'certified_mail', tracking: '' },
      ],
    })
  }
  return out
}

/** "Notice of claim for unpaid labor or materials (Tex. Prop. Code § 53.056)" / the retainage form's name — the cover page's "Enclosed:" line and the run's words. */
export function runNoticeInstrumentWords(kind: LienNoticeInstrument): string {
  return kind === 'retainage_53_057' ? 'Notice of claim for unpaid retainage (Tex. Prop. Code § 53.057)' : 'Notice of claim for unpaid labor or materials (Tex. Prop. Code § 53.056)'
}

/** "June and July 2026" for a monthly notice; "retainage" for the § 53.057 form — what the row, the envelope line and the cover page name. */
export function runNoticeWhatWords(n: Pick<RunNotice, 'kind' | 'months'>): string {
  return n.kind === 'retainage_53_057' ? 'retainage' : describeNoticeMonths(n.months)
}

export const RUN_OWNER_UNCONFIRMED_PROBLEM = 'Owner of record: from the roll, unconfirmed — press Confirm on the desk first'

/** A recipient sent by email needs an address; everything else can go without a tracking number (typed later). An owner nobody confirmed (v2.3450) blocks the record. */
export function runNoticeProblems(n: RunNotice): string[] {
  const out: string[] = []
  if (n.ownerUnconfirmed) out.push(RUN_OWNER_UNCONFIRMED_PROBLEM)
  for (const r of n.recipients) {
    if (!r.name && !r.address) out.push(`${r.label}: nobody to send to`)
    else if (r.method === 'email' && !r.email) out.push(`${r.label}: no email on file`)
    else if (r.method !== 'email' && !r.address) out.push(`${r.label}: no mailing address`)
  }
  return out
}

/** One envelope's contents as the cover sheet lists them: "650 · ATI Schertz — June and July 2026 — $33,500.00", or "2 notices: … ; …". */
export function envelopeContentsText(env: RunEnvelope): string {
  const lines = env.contents.map((c) => `${c.notice.label} — ${runNoticeWhatWords(c.notice)} — ${demandMoney(String(c.notice.amount))}`)
  return lines.length === 1 ? lines[0]! : `${lines.length} notices: ${lines.join('; ')}`
}

/** The cover sheet's statute sentence: which forms are in the run and who each goes to. */
function runInstrumentsSentence(notices: ReadonlyArray<RunNotice>): string {
  const hasMonthly = notices.some((n) => n.kind !== 'retainage_53_057')
  const hasRetainage = notices.some((n) => n.kind === 'retainage_53_057')
  if (hasMonthly && hasRetainage) return 'Each § 53.056 notice and each § 53.057 retainage notice goes to the owner of record and the original contractor (Tex. Prop. Code §§ 53.056(a-1), 53.057(a))'
  if (hasRetainage) return 'Each § 53.057 retainage notice goes to the owner of record and the original contractor (Tex. Prop. Code § 53.057(a))'
  return 'Each § 53.056 notice goes to the owner of record and the original contractor (Tex. Prop. Code § 53.056(a-1))'
}

/** The cover sheet: one line per envelope — who it goes to, how, a blank for the tracking number, and what is inside. */
export function runCoverSheetBlocks(notices: ReadonlyArray<RunNotice>, todayYmd: string, extras?: FilingDocExtras): FilingDocBlock[] {
  const envelopes = runEnvelopes(notices)
  const shared = envelopes.length < runCopies(notices)
  const blocks: FilingDocBlock[] = [
    { kind: 'title', lines: ['Lien notice run', demandDate(todayYmd)] },
    { kind: 'paragraph', text: `${notices.length} ${notices.length === 1 ? 'notice' : 'notices'} · ${envelopes.length} ${envelopes.length === 1 ? 'envelope' : 'envelopes'}. ${runInstrumentsSentence(notices)}; certified mail with return receipt, or another traceable service, is the delivery the statute recognises (§ 53.003).${shared ? ' Notices to one name at one address share an envelope; its tracking number covers everything inside.' : ''}` },
  ]
  for (const env of envelopes) {
    blocks.push({
      kind: 'numbered',
      n: env.n,
      text: `${env.label}: ${env.name || '—'}${env.address ? `, ${env.address}` : ''} · ${RUN_SEND_METHODS.find((m) => m.key === env.method)?.label ?? env.method}${env.tracking ? ` · ${env.tracking}` : ' · tracking # ________________'} — ${envelopeContentsText(env)}`,
    })
  }
  const head: FilingDocBlock[] = []
  if (extras?.letterhead && extras.letterhead.company.trim()) head.push({ kind: 'letterhead', ...extras.letterhead })
  return [...head, ...blocks]
}

/**
 * The cover page as its own short page, signed by the contact person: the
 * run's letter when the item carries one (v2.3482 — every paragraph, the
 * first line as the salutation). Every § 53.056 notice carries counsel's letter (v2.3828); a § 53.057 notice its counsel note.
 */
/** What the cover page needs — the run passes a whole notice; the desk passes the same six fields for the paper it shows (v2.3540). */
export type CoverPageInput = Pick<RunNotice, 'label' | 'months' | 'fields' | 'extras' | 'coverNote' | 'coverLetter'> & Partial<Pick<RunNotice, 'kind'>> & {
  /** Unpaid invoices ride behind the form (§ 53.056(a-3)): the letter's Enclosed line says so, as counsel's letter does (v2.3828). */
  withInvoices?: boolean
}

/** The cover page as the packet prints it: the letterhead, "Re: <job>" and the months, the note (or the run's cover letter), the signature. Empty when the draft carries neither. */
export function runCoverNoteBlocks(n: CoverPageInput): FilingDocBlock[] {
  const head: FilingDocBlock[] = []
  if (n.extras.letterhead && n.extras.letterhead.company.trim()) head.push({ kind: 'letterhead', ...n.extras.letterhead })
  if (n.coverLetter) {
    const paragraphs = coverLetterParagraphs(n.coverLetter)
    return [
      ...head,
      { kind: 'title', lines: [`Re: ${n.label}`, runNoticeWhatWords({ kind: n.kind ?? 'notice_53_056', months: n.months })] },
      ...paragraphs.map((text): FilingDocBlock => ({ kind: 'paragraph', text })),
      { kind: 'paragraph', text: `Enclosed: ${runNoticeInstrumentWords(n.kind ?? 'notice_53_056')}${n.withInvoices ? ', with invoices' : ''}.` },
      { kind: 'signature', lines: [n.fields.contactPerson, n.fields.claimantName].filter((l) => l) },
    ]
  }
  if (!n.coverNote) return []
  return [
    ...head,
    { kind: 'title', lines: [`Re: ${n.label}`, runNoticeWhatWords({ kind: n.kind ?? 'notice_53_056', months: n.months })] },
    { kind: 'paragraph', text: n.coverNote },
    { kind: 'signature', lines: [n.fields.contactPerson, n.fields.claimantName].filter((l) => l) },
  ]
}

/** One notice's document for one recipient: the statutory form, the reference strip naming the copy. */
export function runNoticeBlocks(n: RunNotice, r: RunRecipient): FilingDocBlock[] {
  const extras: FilingDocExtras = { ...n.extras, refItems: [...(n.extras.refItems ?? []), `Copy for: ${r.label}`] }
  return buildLienNoticeBlocks(n.fields, extras, { instrument: n.kind })
}

/**
 * The pay page behind one recipient's copy (v2.3758, punch list #35): one code per unpaid
 * bill under "Once these bills are paid, there will be no lien filed." Empty for a copy the
 * page does not go to (the GC's, by default — `PAY_PAGE_ON_GC_COPY`) and for a job with no
 * unpaid bill.
 */
export function runPayPageBlocks(n: RunNotice, r: RunRecipient, rows: readonly PayPageRow[], assets: PayPageAssets, phone: string): FilingDocBlock[] {
  return payPageBlocks({
    rows,
    assets,
    copy: r.key,
    copyLabel: r.label,
    gcName: n.fields.originalContractorName,
    claimantName: n.fields.claimantName,
    contactPerson: n.fields.contactPerson,
    phone,
    extras: n.extras,
  })
}

/** The pay page's HTML per job and copy, as the run modal builds it once the bills are loaded. */
export type RunPayPages = Readonly<Record<string, Partial<Record<RunRecipient['key'], string>>>>

/**
 * The whole packet as one print document, in envelope order so the stack comes
 * off the printer ready to stuff: the cover sheet, then per envelope each notice
 * inside it — the owner's copy behind its cover page (the run's letter or the
 * note), the original contractor's copy alone, as the emailed copies are — each
 * copy followed by its pay page when `payPagesByJob` carries one (v2.3758) and by the
 * job's unpaid invoices when `invoiceSectionsByJob` carries them (v2.3437, § 53.056(a-3)).
 */
export function runPacketHtml(
  notices: ReadonlyArray<RunNotice>,
  todayYmd: string,
  issuer: PhysicalInvoiceIssuer | null,
  invoiceSectionsByJob?: Readonly<Record<string, readonly string[]>>,
  payPagesByJob?: RunPayPages,
): string {
  const pages: string[] = []
  const letter = { letterhead: filingLetterheadFromIssuer(issuer) }
  pages.push(filingDocHtml(runCoverSheetBlocks(notices, todayYmd, letter)))
  for (const env of runEnvelopes(notices)) {
    for (const { notice: n, recipient: r } of env.contents) {
      if (r.key === 'owner') {
        const note = runCoverNoteBlocks({ ...n, withInvoices: (invoiceSectionsByJob?.[n.jobId]?.length ?? 0) > 0 })
        if (note.length) pages.push(filingDocHtml(note))
      }
      pages.push(filingDocHtml(runNoticeBlocks(n, r)))
      // The pay page (v2.3758) sits between the form and the invoices it points at.
      const pay = payPagesByJob?.[n.jobId]?.[r.key]
      if (pay) pages.push(pay)
      for (const sec of invoiceSectionsByJob?.[n.jobId] ?? []) pages.push(sec)
    }
  }
  const body = pages.map((p, i) => `<section style="${i < pages.length - 1 ? 'page-break-after:always;' : ''}">${p}</section>`).join('')
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Lien notice run — ${demandDate(todayYmd)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; max-width: 44rem; margin: 2.5rem auto; padding: 0 1.5rem; font-size: 0.95rem; line-height: 1.75; }
  section + section { margin-top: 3rem; }
  @media print { body { margin: 0.5in auto; } section + section { margin-top: 0; } }
</style></head><body>${body}</body></html>`
}

export type RunSendRecord = { recipient: 'owner' | 'original_contractor'; method: RunSendMethod; tracking: string; sent_on: string }

/** The `job_lien_filings` insert for one notice — every month it named, both sends, and the saved copy when the office kept one (v2.3763). */
export function runFilingPayload(n: RunNotice, sends: ReadonlyArray<RunSendRecord>, userId: string | null, document: { url?: string | null; note?: string | null } = {}): Record<string, unknown> {
  return {
    ...filingDocumentPayload(document),
    job_id: n.jobId,
    created_by: userId,
    kind: n.kind,
    amount: n.amount,
    months_covered: n.months,
    fields: JSON.parse(JSON.stringify(n.fields)) as Record<string, unknown>,
    sends: sends.map((s) => ({ ...s })),
  }
}
