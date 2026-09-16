/**
 * The paper a customer receives, built from the sample fixture by the app's own builders
 * (v2.3509, PRs 3+5 of the What-customers-see train): the bill by email, the hazmat notice, the
 * final demand letter, the § 53.056 notice to the owner of record, and the lien release. Each
 * sample gives an HTML preview the tab can frame at once and a `pdf()` that builds the same
 * document the customer would open — the PDF builders load lazily so Settings stays light.
 *
 * Pure apart from the lazy imports; nothing here touches the database. Figures are invented
 * and say so in the memo lines.
 */
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { SAMPLE_GC, SAMPLE_HOMEOWNER, ymdPlusDays } from '../customerSample'
import { buildPhysicalInvoiceDocument, buildPhysicalInvoiceEmailBodies, physicalInvoiceEmailSubject, type PhysicalInvoiceDocument } from '../physicalInvoiceDocument'
import { buildHazmatFeeNoticeHtml, type HazmatNoticeJobInfo } from '../jobsDocuments/hazmatFeeNotice'
import type { HazmatIncidentDraft } from '../hazmatFee'
import { buildDemandLetterPrintHtml, type DemandLetterFields } from '../jobsDocuments/demandLetter'
import { buildLienNoticeBlocks, filingDocPrintHtml, type FilingDocExtras, type LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import { buildLienWaiverParagraphs, buildLienWaiverSignatureLines, lienWaiverTitle, type LienWaiverFields, type LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'

export type PaperId = 'bill-by-email' | 'hazmat-notice' | 'demand-letter' | 'owner-notice' | 'lien-release'

export const PAPER_IDS: readonly PaperId[] = ['bill-by-email', 'hazmat-notice', 'demand-letter', 'owner-notice', 'lien-release']

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

export function sampleDemandLetterFields(todayYmd: string): DemandLetterFields {
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
    serviceAddress: SAMPLE_JOB.address,
    invoiceNumber: SAMPLE_JOB.number,
    invoiceDate: ymdPlusDays(todayYmd, -52),
    serviceDescription: SAMPLE_JOB.lineDescription,
    invoiceTotal: SAMPLE_JOB.amount.toFixed(2),
    paymentsReceived: '0.00',
    outstanding: SAMPLE_JOB.amount.toFixed(2),
    deadlineDate: ymdPlusDays(todayYmd, 10),
    paymentMethod: 'by card or bank transfer from the bill link, or by check to the office',
    includeSmallClaims: true,
    includeLien: false,
    lienFilingDeadline: '',
    includeTheftOfServices: false,
    includeLateFees: true,
    includeNotarial: false,
    priorNotices: [],
  }
}

export function sampleDemandLetter(todayYmd: string): PaperSample {
  const f = sampleDemandLetterFields(todayYmd)
  return {
    title: 'Final demand letter',
    subject: `Final demand for payment — invoice ${SAMPLE_JOB.number}`,
    html: buildDemandLetterPrintHtml(f, todayYmd, SAMPLE_JOB.number),
    filename: `Demand-letter-${SAMPLE_JOB.number}-sample.pdf`,
    pdf: async () => (await import('../jobsDocuments/demandLetter')).buildDemandLetterPdfBlob(f, todayYmd),
  }
}

export const SAMPLE_OWNER = { name: 'Sample Owner LLC', project: 'Cedar Bend Apartments, 4400 Sample Pkwy, Kyle, TX 78640' } as const

export function sampleOwnerNoticeInputs(todayYmd: string): { fields: LienNoticeFields; extras: FilingDocExtras } {
  return {
    fields: {
      noticeDate: todayYmd,
      projectDescription: SAMPLE_OWNER.project,
      claimantName: PORTAL_COMPANY.name,
      laborMaterialsType: 'Plumbing labor and materials',
      originalContractorName: SAMPLE_GC.company,
      contractedWithIfDifferent: '',
      claimAmount: '12,400.00',
      contactPerson: `The office · ${PORTAL_COMPANY.phone}`,
      claimantAddress: `${PORTAL_COMPANY.name}, Kyle, TX`,
    },
    extras: {
      letterhead: { company: PORTAL_COMPANY.name, licenseLine: PORTAL_COMPANY.licenseLine, contactLines: [PORTAL_COMPANY.phone] },
      refItems: [`Re: ${SAMPLE_OWNER.project}`, `Original contractor: ${SAMPLE_GC.company}`, `Unpaid: ${ymdPlusDays(todayYmd, -60).slice(0, 7)}`],
    },
  }
}

export function sampleOwnerNotice(todayYmd: string): PaperSample {
  const { fields, extras } = sampleOwnerNoticeInputs(todayYmd)
  const blocks = buildLienNoticeBlocks(fields, extras)
  return {
    title: 'Notice of Claim for Unpaid Labor or Materials (§ 53.056)',
    subject: `Notice of claim — ${SAMPLE_OWNER.project}`,
    html: filingDocPrintHtml(blocks, 'Notice of Claim for Unpaid Labor or Materials'),
    filename: 'Notice-53-056-sample.pdf',
    pdf: async () => (await import('../jobsDocuments/lienFilingDocuments')).filingDocPdfBlob(blocks),
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
  const lines = buildLienWaiverSignatureLines(fields)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px/1.5 Georgia,serif;color:#16283c;background:#fff;margin:0;padding:32px 40px;max-width:720px}h1{font-size:19px;text-align:center;margin:0 0 20px}p{margin:0 0 12px}.sig{margin-top:28px;display:grid;gap:14px}.sig div{border-top:1px solid #16283c;padding-top:4px;font-size:13px;max-width:320px}</style></head><body><h1>${esc(title)}</h1>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}<div class="sig">${lines.map((l) => `<div>${esc(l.label)}${l.value ? `: ${esc(l.value)}` : ''}</div>`).join('')}</div></body></html>`
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
  }
}
