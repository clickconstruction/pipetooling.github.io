/**
 * The paper a customer receives, built from the sample fixture by the app's own builders
 * (v2.3509, PRs 3+5 of the What-customers-see train): the bill by email, the hazmat notice, the
 * final demand letter, the § 53.056 notice to the owner of record, the lien release, and the rest of the lien
 * letters (`lienLetterSamples.ts`). Each
 * sample gives an HTML preview the tab can frame at once and a `pdf()` that builds the same
 * document the customer would open — the PDF builders load lazily so Settings stays light.
 *
 * Pure apart from the lazy imports; nothing here touches the database. Figures are invented
 * and say so in the memo lines.
 */
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { SAMPLE_HOMEOWNER, ymdPlusDays } from '../customerSample'
import { buildPhysicalInvoiceDocument, buildPhysicalInvoiceEmailBodies, physicalInvoiceEmailSubject, type PhysicalInvoiceDocument } from '../physicalInvoiceDocument'
import { buildHazmatFeeNoticeHtml, type HazmatNoticeJobInfo } from '../jobsDocuments/hazmatFeeNotice'
import type { HazmatIncidentDraft } from '../hazmatFee'
import { buildDemandLetterPrintHtml, demandDate, feeClockDate, interestBasisFor, lienLineBlockedReason, type DemandLetterFields, type DemandStatementInvoice } from '../jobsDocuments/demandLetter'
import type { PayPageAssets } from '../jobs/lienNoticePayPage'
import { SAMPLE_PAY_CODE_ID, SAMPLE_PAY_CODE_SVG } from './samplePayCode'
import { sampleLetterTwo, sampleLienAffidavit, sampleLienCoverLetter, sampleOwnerNotice, sampleReleaseOfRecord, sampleRetainageNotice } from './lienLetterSamples'
import { buildLienWaiverFoot, buildLienWaiverParagraphs, lienWaiverFootLines, lienWaiverTitle, type LienWaiverFields, type LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'

/** The lien group's own papers (punch list #326) are built in `lienLetterSamples.ts`, on one made-up unpaid job. */
export { SAMPLE_OWNER, sampleOwnerNotice, sampleOwnerNoticeInputs } from './lienLetterSamples'

export type PaperId = 'bill-by-email' | 'hazmat-notice' | 'demand-letter' | 'owner-notice' | 'lien-release' | 'lien-cover-letter' | 'lien-letter-paid-out' | 'lien-letter-quiet' | 'lien-affidavit' | 'lien-release-of-record' | 'lien-retainage'

export const PAPER_IDS: readonly PaperId[] = ['bill-by-email', 'hazmat-notice', 'demand-letter', 'owner-notice', 'lien-release', 'lien-cover-letter', 'lien-letter-paid-out', 'lien-letter-quiet', 'lien-affidavit', 'lien-release-of-record', 'lien-retainage']

export type PaperSample = {
  /** The document's name, as the office knows it. */
  title: string
  /** The email subject, when the paper travels as an email. */
  subject?: string
  /** An HTML preview the tab frames at once: the email body, or the page, or the print view. */
  html: string
  /** The PDF the customer would open. Loads jsPDF / pdf-lib on demand. */
  pdf: () => Promise<Blob>
  /** The file name the PDF would carry. */
  filename: string
  /** Punch list #217: today's paper over a prototype's, one document, when this paper has a prototype; the tab's *Side by side* frames it. */
  sideBySideHtml?: string
}

export const SAMPLE_JOB = {
  number: '1042',
  name: 'Water heater replacement',
  address: SAMPLE_HOMEOWNER.address,
  amount: 1850,
  lineDescription: 'Replace 50-gallon gas water heater, haul away the old unit, new supply lines and pan',
} as const

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function localNoonIso(ymd: string): string {
  return `${ymd}T14:30:00.000Z`
}

export function sampleBillDocument(todayYmd: string): PhysicalInvoiceDocument {
  const doc = buildPhysicalInvoiceDocument({
    job: {
      customer_name: SAMPLE_HOMEOWNER.name,
      customer_email: SAMPLE_HOMEOWNER.email,
      customer_phone: SAMPLE_HOMEOWNER.phone,
      job_name: SAMPLE_JOB.name,
      hcp_number: SAMPLE_JOB.number,
      job_address: SAMPLE_JOB.address,
      last_work_date: ymdPlusDays(todayYmd, -3),
    },
    amountDollars: SAMPLE_JOB.amount,
    lineDescription: SAMPLE_JOB.lineDescription,
    memo: 'Sample bill — nothing here exists in the database.',
    invoiceDateYmd: todayYmd,
    dueDateYmd: ymdPlusDays(todayYmd, 14),
  })
  if (!doc) throw new Error('sample bill did not build')
  return doc
}

export function sampleBillByEmail(todayYmd: string): PaperSample {
  const doc = sampleBillDocument(todayYmd)
  const bodies = buildPhysicalInvoiceEmailBodies(doc)
  return {
    title: 'Bill by email',
    subject: physicalInvoiceEmailSubject(doc),
    html: bodies.html,
    filename: `Invoice-${SAMPLE_JOB.number}-sample.pdf`,
    pdf: async () => (await import('../physicalInvoicePdf')).buildPhysicalInvoicePdfBlob(doc),
  }
}

export function sampleHazmatInputs(todayYmd: string): { job: HazmatNoticeJobInfo; draft: HazmatIncidentDraft } {
  return {
    job: { jobNumber: SAMPLE_JOB.number, jobName: SAMPLE_JOB.name, jobAddress: SAMPLE_JOB.address, customerName: SAMPLE_HOMEOWNER.name },
    draft: {
      incidentAt: localNoonIso(ymdPlusDays(todayYmd, -3)),
      description: 'Sewage backup in the utility room reached the water heater pan and the floor around it; the crew stopped work to contain and disinfect the area before continuing.',
      exposedPeople: 'Two technicians',
      stageLabel: 'Rough-in',
      photoLinks: [],
      testimonials: [],
      tosClauseSnapshot: 'Biohazard remediation: where a crew encounters raw sewage, mold or other biological hazards, a remediation fee covers containment, disinfection and protective equipment, and is added to the bill for that visit.',
      feeAmount: 350,
    },
  }
}

export function sampleHazmatNotice(todayYmd: string): PaperSample {
  const { job, draft } = sampleHazmatInputs(todayYmd)
  return {
    title: 'Biohazard Remediation Fee Notice',
    subject: `Biohazard Remediation Fee Notice — job ${SAMPLE_JOB.number}`,
    html: buildHazmatFeeNoticeHtml(job, draft),
    filename: `Hazmat-notice-${SAMPLE_JOB.number}-sample.pdf`,
    pdf: async () => (await import('../jobsDocuments/hazmatFeeNoticePdf')).buildHazmatFeeNoticePdfBlob(job, draft),
  }
}

/**
 * The demand letter as the Lien window builds one today (v2.7086): the bill as a statement of account, its pay
 * code, the fee and interest lines by their own rules, a dated notice history and the two exhibits a letter
 * carries by default. The job is a house, so the lien line is off for the reason the window gives.
 */
export function sampleDemandLetterFields(todayYmd: string): DemandLetterFields {
  const sentYmd = ymdPlusDays(todayYmd, -52)
  const amount = SAMPLE_JOB.amount.toFixed(2)
  const statement: DemandStatementInvoice[] = [
    { invoiceNumber: `#${SAMPLE_JOB.number}`, sentYmd, dueYmd: ymdPlusDays(sentYmd, 14), lines: [{ description: SAMPLE_JOB.lineDescription, qty: '1', amount }], total: amount, paid: '0', balance: amount, invoiceId: SAMPLE_PAY_CODE_ID, payable: true },
  ]
  const interest = interestBasisFor(statement)
  return {
    businessName: PORTAL_COMPANY.name,
    senderName: 'The office',
    businessAddress: `${PORTAL_COMPANY.name}\nKyle, TX`,
    businessPhone: PORTAL_COMPANY.phone,
    businessEmail: PORTAL_COMPANY.email || 'office@example.com',
    businessLicense: PORTAL_COMPANY.licenseLine || undefined,
    recipientName: SAMPLE_HOMEOWNER.name,
    recipientEmail: SAMPLE_HOMEOWNER.email,
    recipientAddress: SAMPLE_HOMEOWNER.address,
    statement,
    serviceAddress: SAMPLE_JOB.address,
    enclosures: [
      { label: 'A', kind: 'invoice', title: `Invoice #${SAMPLE_JOB.number}, as sent ${demandDate(sentYmd)}`, pages: 1 },
      { label: 'B', kind: 'delivery', title: 'Delivery record', pages: 1 },
    ],
    feeClockYmd: feeClockDate(todayYmd),
    interestBasis: interest.basis,
    interestFromYmd: interest.fromYmd,
    lienBlockedReason: lienLineBlockedReason({ lienFilingDeadline: '', todayYmd, homestead: true, hasWorkMonth: false }),
    invoiceNumber: `#${SAMPLE_JOB.number}`,
    invoiceDate: sentYmd,
    serviceDescription: SAMPLE_JOB.lineDescription,
    invoiceTotal: amount,
    paymentsReceived: '0.00',
    outstanding: amount,
    deadlineDate: ymdPlusDays(todayYmd, 10),
    paymentMethod: '',
    includeSmallClaims: true,
    includeLien: false,
    lienFilingDeadline: '',
    includeTheftOfServices: false,
    includeLateFees: interest.basis !== 'none',
    includeNotarial: false,
    includePayCodes: true,
    layout: 'letter-first',
    priorNotices: [
      { date: sentYmd, label: 'Invoice sent' },
      { date: ymdPlusDays(sentYmd, 21), label: 'Invoice re-sent by email' },
    ],
  }
}

/** The sample letter's one code: the kept drawing for the page, and its picture for the PDF when a browser can make one. */
async function sampleDemandPayAssets(): Promise<PayPageAssets> {
  let png: string | null = null
  try {
    png = await (await import('../billing/payQr')).svgMarkupToPngDataUrl(SAMPLE_PAY_CODE_SVG, 480)
  } catch {
    png = null
  }
  return { [SAMPLE_PAY_CODE_ID]: { svg: SAMPLE_PAY_CODE_SVG, png } }
}

export function sampleDemandLetter(todayYmd: string): PaperSample {
  const f = sampleDemandLetterFields(todayYmd)
  return {
    title: 'Final demand letter',
    subject: `Final demand for payment — invoice ${SAMPLE_JOB.number}`,
    html: buildDemandLetterPrintHtml(f, todayYmd, SAMPLE_JOB.number, { payAssets: { [SAMPLE_PAY_CODE_ID]: { svg: SAMPLE_PAY_CODE_SVG, png: null } } }),
    filename: `Demand-letter-${SAMPLE_JOB.number}-sample.pdf`,
    pdf: async () => (await import('../jobsDocuments/demandLetter')).buildDemandLetterPdfBlob(f, todayYmd, { payAssets: await sampleDemandPayAssets() }),
  }
}

export function sampleLienReleaseInputs(todayYmd: string): { formType: LienWaiverFormType; fields: LienWaiverFields } {
  return {
    formType: 'unconditional_final',
    fields: {
      companyName: PORTAL_COMPANY.name,
      checkFrom: SAMPLE_HOMEOWNER.name,
      amount: SAMPLE_JOB.amount.toFixed(2),
      projectDescription: `${SAMPLE_JOB.name} — ${SAMPLE_JOB.address}`,
      throughDate: todayYmd,
      signedDate: todayYmd,
      signerName: 'The company owner',
      signerTitle: 'Owner',
    },
  }
}

export function sampleLienRelease(todayYmd: string): PaperSample {
  const { formType, fields } = sampleLienReleaseInputs(todayYmd)
  const title = lienWaiverTitle(formType)
  const paragraphs = buildLienWaiverParagraphs(formType, fields)
  const lines = lienWaiverFootLines(buildLienWaiverFoot(fields, null))
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px/1.5 Georgia,serif;color:#16283c;background:#fff;margin:0;padding:32px 40px;max-width:720px}h1{font-size:19px;text-align:center;margin:0 0 20px}p{margin:0 0 12px}.sig{margin-top:56px;border-top:1px solid #16283c;padding-top:6px;font-size:13px;max-width:420px}.sig div{margin:0 0 2px}</style></head><body><h1>${esc(title)}</h1>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}<div class="sig">${lines.map((l, i) => (i === 0 ? `<div><strong>${esc(l.split(', ')[0] ?? l)}</strong>${esc(l.slice((l.split(', ')[0] ?? l).length))}</div>` : `<div>${esc(l)}</div>`)).join('')}</div></body></html>`
  return {
    title,
    subject: `Lien release — ${SAMPLE_JOB.name}`,
    html,
    filename: `Lien-release-${SAMPLE_JOB.number}-sample.pdf`,
    pdf: async () => (await import('../jobsDocuments/lienWaiverRelease')).buildLienWaiverPdfBlob(formType, fields, null),
  }
}

export function paperSample(id: PaperId, todayYmd: string): PaperSample {
  switch (id) {
    case 'bill-by-email':
      return sampleBillByEmail(todayYmd)
    case 'hazmat-notice':
      return sampleHazmatNotice(todayYmd)
    case 'demand-letter':
      return sampleDemandLetter(todayYmd)
    case 'owner-notice':
      return sampleOwnerNotice(todayYmd)
    case 'lien-release':
      return sampleLienRelease(todayYmd)
    case 'lien-cover-letter':
      return sampleLienCoverLetter(todayYmd)
    case 'lien-letter-paid-out':
      return sampleLetterTwo('paid_out', todayYmd)
    case 'lien-letter-quiet':
      return sampleLetterTwo('unresponsive', todayYmd)
    case 'lien-affidavit':
      return sampleLienAffidavit(todayYmd)
    case 'lien-release-of-record':
      return sampleReleaseOfRecord(todayYmd)
    case 'lien-retainage':
      return sampleRetainageNotice(todayYmd)
  }
}
