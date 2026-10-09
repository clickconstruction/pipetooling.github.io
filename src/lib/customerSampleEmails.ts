/**
 * The sample emails What customers see renders in the browser: the same builders the edge
 * functions run, fed the same fixture and the live Settings rows.
 */
import { buildEstimateLetterheadEmail, type EstimateLetterheadEmail } from './estimateEmailLetterhead'
import { buildBidRoomLinkEmail, type BidRoomLinkEmail } from '../../supabase/functions/_shared/bidRoomLinkEmail'
import { ESTIMATE_PUBLIC_TERMS_KEY, sampleBidRoomResponse, type AppSettingRow } from '../../supabase/functions/_shared/customerSampleFixtures'
import { BID_COVER_LETTER_EXCLUSIONS_KEY, BID_COVER_LETTER_TERMS_KEY } from '../../supabase/functions/_shared/customerSampleFixtures'
import { parseSharedBidRoomPayload } from '../../supabase/functions/_shared/bidRoomPayload'
import { ESTIMATE_EXPERIENCE_APP_KEY_LIST, resolveEstimateCustomerExperience } from './estimateCustomerExperience'
import { buildContractSigningEmail, type ContractSigningEmail } from './contractSigningEmail'
import { PORTAL_SHORT_ORIGIN } from './portal/portalShortOrigin'
import { PORTAL_COMPANY } from '../../supabase/functions/_shared/portalCompany'
import { COMPANY_EMAIL_FROM_LABEL, CUSTOMER_EMAIL_FROM_ADDRESS, estimateEmailFrom } from './customerEmailFrom'
import { SAMPLE_BID, SAMPLE_CONTRACT, SAMPLE_ESTIMATE, SAMPLE_GC, SAMPLE_HOMEOWNER, SAMPLE_SUB, ymdPlusDays } from './customerSample'
import { BID_ROOM_SAMPLE_PATH, CONTRACT_SAMPLE_PATH, ESTIMATE_SAMPLE_PATH, JOB_CONTRACT_SAMPLE_PATH, SUBMITTAL_ROOM_SAMPLE_PATH, TRADE_PORTAL_SAMPLE_PATH, type SampleEmailId } from './customerJourneys'
import { buildSubmittalRoomLinkEmail, roomLinkBidLabel } from '../../supabase/functions/_shared/submittalRoomLinkEmail'
import { buildJobContractPaperEmail, buildJobContractReminderEmail, buildJobContractSendEmail, buildJobContractSignedCopyEmail, type BuiltEmail } from './jobContractEmail'
import { SAMPLE_JOB_CONTRACT } from './customerSample'
import { testReportSampleEmail } from './jobs/testReportSample'
import { buildBidPricingPackageEmailHtml, buildBidPricingPackagePlainText, buildBidPricingPackageTableHtml, type PackageExternalRow } from './buildBidPricingPackageHtml'
import { buildGcStatementEmailHtml, buildGcStatementEmailText, gcStatementEmailSubject, gcStatementQrDataUrl } from './jobsDocuments/gcStatementEmail'
import type { GcReviewGroup } from './gcReviewRollup'
import { buildRfqEmail } from './rfqEmail'
import { composeJobAccountEmail } from './supplyHouseJobAccount'
import { buildLegalConfirmEmail, buildLegalDigestEmail, buildLegalNowEmail, buildLegalWelcomeEmail } from './legalEmails'
import { SAMPLE_FIRM, SAMPLE_HOUSE, SAMPLE_RFQ_LINES } from '../../supabase/functions/_shared/customerSampleFixtures'
import { LEGAL_CONFIRMED_SAMPLE_PATH, LEGAL_PORTAL_SAMPLE_PATH, PAY_SAMPLE_PATH } from './customerJourneys'
import { buildStripeBillEmail } from '../../supabase/functions/_shared/stripeBillEmail'
import { qrMatrix } from '../../supabase/functions/_shared/qrMatrix'
import { bytesToBase64, qrPngBytes } from '../../supabase/functions/_shared/qrPng'
import { SAMPLE_JOB } from './journeys/paperSamples'
import { buildGcPlanQuestionEmail } from '../../supabase/functions/_shared/gcPlanQuestionEmail'
import { buildGcSubmittalEmail } from '../../supabase/functions/_shared/gcArchitectEmail'
import { buildGcTradeEmail, GC_TRADE_EMAIL_FROM_NAME } from '../../supabase/functions/_shared/gcTradeEmail'
import { buildGcCustomerEmail, GC_CUSTOMER_EMAIL_FROM_NAME } from '../../supabase/functions/_shared/gcCustomerEmails'
import { certifiedMail, certifyAskMail, changeOrderMail, interestBillMail, payAppMail, type PayAppMailFacts } from './gc/customerEmail'
import { payReminderMail } from './gc/ownerBillingRemind'
import { gcTradePortalSample, gcTradePortalSampleRows } from '../../supabase/functions/_shared/gcTradePortalSample'
import { mailboxWithName } from '../../supabase/functions/_shared/mailboxWithName'
import { inviteMessage, mailRecipients, portalMailGroup } from './gc/portal'
import { inviteEmailLines } from './gc/tradeEmail'
import { tradePortalState } from './gc/tradePortalState'

export type { AppSettingRow }

/** Every app_settings key the sample surfaces read — one fetch for the whole tab. */
export const CUSTOMER_SAMPLE_SETTING_KEYS: readonly string[] = [
  ...ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  ESTIMATE_PUBLIC_TERMS_KEY,
  BID_COVER_LETTER_TERMS_KEY,
  BID_COVER_LETTER_EXCLUSIONS_KEY,
]

export type SampleEmailSender = { name: string; email: string; phone: string }

export type SampleEmailContext = {
  rows: AppSettingRow[]
  /** Settings → Jobs & billing → Test reports, when loaded (v2.3511); the test-report email waits for it. */
  testReportSettings?: Parameters<typeof testReportSampleEmail>[1] | null
  /** The app origin the links and brand image point at. */
  origin: string
  todayYmd: string
  /** "Sep 4, 2026" — the send date as the email shows it. */
  dateLabel: string
  sender: SampleEmailSender | null
}

export function buildSampleEstimateEmail(ctx: SampleEmailContext): EstimateLetterheadEmail {
  const acceptUrl = `${ctx.origin}${ESTIMATE_SAMPLE_PATH}`
  const resolved = resolveEstimateCustomerExperience(ctx.rows, null, { acceptUrl, title: SAMPLE_ESTIMATE.title, estimateNumber: SAMPLE_ESTIMATE.number }, { docKind: 'estimate' })
  return buildEstimateLetterheadEmail({
    docKind: 'estimate',
    estimateNumber: SAMPLE_ESTIMATE.number,
    title: SAMPLE_ESTIMATE.title,
    totalCents: SAMPLE_ESTIMATE.totalCents,
    validUntilYmd: ymdPlusDays(ctx.todayYmd, SAMPLE_ESTIMATE.validDays),
    forAddress: SAMPLE_HOMEOWNER.address,
    acceptUrl,
    brand: 'plum',
    brandImageUrl: `${ctx.origin}/brand/click-plum.png`,
    bodyText: resolved.emailBody,
    options: [],
    footerLines: resolved.acceptPageFooter.split('\n'),
    sender: ctx.sender ? { name: ctx.sender.name, email: ctx.sender.email } : null,
    dateLabel: ctx.dateLabel,
  })
}

export function buildSampleBidRoomEmail(ctx: SampleEmailContext, revised: boolean): BidRoomLinkEmail {
  const room = sampleBidRoomResponse(ctx.rows, revised ? 'done' : 'live', new Date().toISOString(), ctx.todayYmd)
  const payload = parseSharedBidRoomPayload(room.payload)
  if (!payload) throw new Error('sample bid room payload did not parse')
  return buildBidRoomLinkEmail({
    payload,
    link: `${ctx.origin}${BID_ROOM_SAMPLE_PATH}`,
    brandImageUrl: `${ctx.origin}/brand/click-${SAMPLE_BID.headerBrand}.png`,
    revNumber: revised ? 2 : 1,
    revNote: revised ? SAMPLE_BID.revisionNote : null,
    sender: ctx.sender,
    dateLabel: ctx.dateLabel,
  })
}

/**
 * The contract-for-signature email (v2.2777): the send function's own builder over the sample
 * agreement, from the signed-in viewer, with the link's 14-day expiry and the sample sub's portal
 * address — the default opening line, since the per-send message is typed at send time.
 */
export function buildSampleContractEmail(ctx: SampleEmailContext): ContractSigningEmail {
  return buildContractSigningEmail({
    documentName: SAMPLE_CONTRACT.documentName,
    personName: SAMPLE_SUB.contact,
    acceptUrl: `${ctx.origin}${CONTRACT_SAMPLE_PATH}`,
    expiresYmd: ymdPlusDays(ctx.todayYmd, 14),
    sentYmd: ctx.todayYmd,
    subjectOverride: '',
    introPlain: '',
    sender: ctx.sender ? { name: ctx.sender.name, email: ctx.sender.email } : null,
    portalUrl: `${PORTAL_SHORT_ORIGIN}${SAMPLE_SUB.portalSlug}`,
    officePhone: PORTAL_COMPANY.phone || null,
  })
}

/** The customer's agreement email (v2.3510): the sender's own builder over the sample job, from the signed-in viewer. */
export function buildSampleJobContractEmail(ctx: SampleEmailContext): BuiltEmail {
  return buildJobContractSendEmail({
    recipientName: SAMPLE_HOMEOWNER.name,
    message: '',
    jobAddress: SAMPLE_JOB_CONTRACT.jobAddress,
    heading: SAMPLE_JOB_CONTRACT.heading,
    jobNo: SAMPLE_JOB_CONTRACT.jobNumber,
    amountLine: `Contract amount: $${(SAMPLE_JOB_CONTRACT.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    url: `${ctx.origin}${JOB_CONTRACT_SAMPLE_PATH}`,
    senderName: ctx.sender?.name ?? '',
  })
}

/** The agreement as a PDF to sign by hand (v2.3631's email, on the tab since v2.3635): the sender's own builder over the same sample. */
export function buildSampleJobContractPaperEmail(ctx: SampleEmailContext): BuiltEmail {
  return buildJobContractPaperEmail({
    recipientName: SAMPLE_HOMEOWNER.name,
    message: '',
    jobAddress: SAMPLE_JOB_CONTRACT.jobAddress,
    heading: SAMPLE_JOB_CONTRACT.heading,
    jobNo: SAMPLE_JOB_CONTRACT.jobNumber,
    amountLine: `Contract amount: $${(SAMPLE_JOB_CONTRACT.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    url: `${ctx.origin}${JOB_CONTRACT_SAMPLE_PATH}`,
    senderName: ctx.sender?.name ?? '',
  })
}

/** The reminder an unsigned agreement gets (v2.3510): the cron's own builder, the first of its reminders. */
export function buildSampleJobContractReminderEmail(ctx: SampleEmailContext): BuiltEmail {
  return buildJobContractReminderEmail({
    recipientName: SAMPLE_HOMEOWNER.name,
    heading: SAMPLE_JOB_CONTRACT.heading,
    jobNo: SAMPLE_JOB_CONTRACT.jobNumber,
    amountLabel: `$${(SAMPLE_JOB_CONTRACT.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    url: `${ctx.origin}${JOB_CONTRACT_SAMPLE_PATH}`,
    last: false,
  })
}

/** The signed copy the customer gets the moment they sign (v2.3617): the sender's own builder over the sample job, PDF attached. */
export function buildSampleJobContractSignedCopyEmail(ctx: SampleEmailContext): BuiltEmail {
  return buildJobContractSignedCopyEmail({
    printedName: SAMPLE_HOMEOWNER.name,
    heading: SAMPLE_JOB_CONTRACT.heading,
    jobNo: SAMPLE_JOB_CONTRACT.jobNumber,
    amountLabel: `$${(SAMPLE_JOB_CONTRACT.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    url: `${ctx.origin}${JOB_CONTRACT_SAMPLE_PATH}`,
    hasPdf: true,
  })
}

/** The test report email to the GC (v2.3511): the send sheet's own builder over the invented sewer pre-test, from the live Settings. Null until Settings load. */
export function buildSampleTestReportEmail(ctx: SampleEmailContext): BuiltEmail | null {
  if (!ctx.testReportSettings) return null
  return testReportSampleEmail('sewer-pre-pass', ctx.testReportSettings, ctx.todayYmd).email
}

export const SAMPLE_PRICING_ROWS: readonly PackageExternalRow[] = [
  { fixture: 'Water closet, wall-hung', count: 24, unitPrice: 1180, revenue: 28320 },
  { fixture: 'Lavatory, undermount', count: 24, unitPrice: 640, revenue: 15360 },
  { fixture: 'Shower valve and trim', count: 20, unitPrice: 890, revenue: 17800 },
  { fixture: 'Water heater, 100 gal commercial', count: 2, unitPrice: 9800, revenue: 19600 },
]

/** The bid's external pricing package email (v2.3511): the sender's builders over four sample rows for Cedar Bend. */
export function buildSamplePricingPackageEmail(ctx: SampleEmailContext): BuiltEmail {
  const totalRevenue = SAMPLE_PRICING_ROWS.reduce((a, r) => a + r.revenue, 0)
  const bidLabel = `BP482 ${SAMPLE_BID.projectName}`
  const address = '4400 Sample Pkwy, Kyle, TX 78640'
  const tableHtml = buildBidPricingPackageTableHtml({ externalRows: SAMPLE_PRICING_ROWS, totalRevenue })
  return {
    subject: `Pricing — ${bidLabel}`,
    html: buildBidPricingPackageEmailHtml({ bidLabel, plansLink: null, address, tableHtml, senderName: ctx.sender?.name || null }),
    text: buildBidPricingPackagePlainText({ externalRows: SAMPLE_PRICING_ROWS, totalRevenue, bidLabel, plansLink: null, address }),
  }
}

/** The GC statement email (v2.3511): GC Review's own builder over three sample bills at two properties, with the sample GC's portal as the pay link. */
export function sampleGcStatementGroup(todayYmd: string): GcReviewGroup {
  const bill = (key: string, jobId: string, hcp: string, jobName: string, jobAddress: string, daysAgo: number, billed: number, paid: number) => {
    const paidOn = paid > 0 ? ymdPlusDays(todayYmd, -Math.max(1, daysAgo - 12)) : null
    return {
      key, jobId, hcp, jobName, jobAddress, customerName: SAMPLE_GC.company,
      referenceDateDisplay: ymdPlusDays(todayYmd, -daysAgo), referenceYmd: ymdPlusDays(todayYmd, -daysAgo), referenceIsEstimate: false,
      ageDays: daysAgo, remaining: billed - paid, inCollections: false, billed,
      billPayments: paidOn ? [{ invoice_id: key, amount: paid, paid_on: paidOn, payment_type: 'check', reference_number: '4417', sequence_order: 1 }] : [],
    }
  }
  const rows = [
    bill('sample-inv-1', 'sample-job-1', '1042', SAMPLE_BID.projectName, '4400 Sample Pkwy, Kyle, TX 78640', 34, 20200, 5000),
    bill('sample-inv-2', 'sample-job-2', '1051', 'Bldg 3 top-out', '4400 Sample Pkwy, Kyle, TX 78640', 6, 6450, 0),
    bill('sample-inv-3', 'sample-job-3', '1058', 'Service Visit', '212 Example Ln, Buda, TX 78610', 9, 2000, 0),
  ]
  return { key: 'sample-gc', gcId: 'sample-gc', gcName: SAMPLE_GC.company, isNoGc: false, rows, subtotal: 23650, jobCount: 3, oldestAgeDays: 34 }
}

export function buildSampleGcStatementEmail(ctx: SampleEmailContext): BuiltEmail {
  const group = sampleGcStatementGroup(ctx.todayYmd)
  const portalUrl = `${PORTAL_SHORT_ORIGIN}${SAMPLE_GC.portalSlug}`
  // A real send carries the QR code as an inline attachment; a browser cannot load `cid:`, so the sample inlines it.
  const opts = { dateStr: ctx.dateLabel, officePhone: PORTAL_COMPANY.phone || null, portalUrl, qrImgSrc: gcStatementQrDataUrl(portalUrl) }
  return { subject: gcStatementEmailSubject(group, ctx.dateLabel), html: buildGcStatementEmailHtml(group, opts), text: buildGcStatementEmailText(group, opts) }
}

/** The price-request email a supply house gets (v2.3512): the sender's own builder over the sample scope. */
export function buildSampleRfqEmail(ctx: SampleEmailContext): BuiltEmail {
  return buildRfqEmail({
    kind: 'request',
    viewed: false,
    bidLabel: `BP482 · ${SAMPLE_BID.projectName}`,
    houseName: SAMPLE_HOUSE.name,
    itemCount: SAMPLE_RFQ_LINES.length,
    neededBy: ymdPlusDays(ctx.todayYmd, 5),
    vendorNote: null,
    senderName: ctx.sender?.name || null,
    listText: SAMPLE_RFQ_LINES.map((l) => `${l.count} ${l.unit ?? 'ea'} — ${l.fixture}`).join('\n'),
    token: 'sample',
    plansLink: null,
    appOrigin: ctx.origin,
  })
}

/** The job-account set-up email (v2.3512): the Share-with-supply-house modal's own composer over the sample building owner. */
export function buildSampleJobAccountEmail(ctx: SampleEmailContext): BuiltEmail {
  return composeJobAccountEmail(
    {
      propertyName: SAMPLE_BID.projectName,
      address: '4400 Sample Pkwy, Kyle, TX 78640',
      sitePhone: '(512) 555-0142',
      gcCompany: SAMPLE_GC.company,
      gcPhone: '(512) 555-0120',
      gcEmail: SAMPLE_GC.email,
      ownerMode: 'building_owner',
      ownerName: 'Pat Owner',
      companyName: 'Sample Owner LLC',
      mailingAddress: '1 Sample Owner Way, Austin, TX 78701',
      ownerEmail: 'ap@sampleowner.example.com',
    },
    `J1042 — ${SAMPLE_BID.projectName}`,
    ctx.sender?.name ?? '',
    { companyName: PORTAL_COMPANY.name, officePhone: PORTAL_COMPANY.phone },
  )
}



/** The firm's emails (v2.3512; the welcome v2.4624): the senders' own builders over the sample firm. */
export function buildSampleLegalEmail(id: 'legal-welcome' | 'legal-confirm' | 'legal-now' | 'legal-digest', ctx: SampleEmailContext): BuiltEmail {
  const portalUrl = `${ctx.origin}${LEGAL_PORTAL_SAMPLE_PATH}`
  const confirmUrl = `${ctx.origin}${LEGAL_CONFIRMED_SAMPLE_PATH}`
  const unsubscribeUrl = `${confirmUrl}&stop=1`
  if (id === 'legal-welcome')
    return buildLegalWelcomeEmail({ companyName: PORTAL_COMPANY.name, companyPhone: PORTAL_COMPANY.phone, firmName: SAMPLE_FIRM.name, greetName: SAMPLE_FIRM.handling, portalUrl, matterCount: 1, sender: ctx.sender })
  if (id === 'legal-confirm') return buildLegalConfirmEmail({ companyName: PORTAL_COMPANY.name, email: SAMPLE_FIRM.recipients[1].email, confirmUrl })
  if (id === 'legal-now')
    return buildLegalNowEmail({
      companyName: PORTAL_COMPANY.name,
      firmName: SAMPLE_FIRM.name,
      trigger: 'referred',
      payer: SAMPLE_HOMEOWNER.name,
      handling: SAMPLE_FIRM.handling,
      note: 'Two bills, 74 days past due; the office\'s calls went unanswered.',
      portalUrl,
      unsubscribeUrl,
    })
  // The digest reads instants (released_at, created_at), so the sample's days go in as instants on those days.
  return buildLegalDigestEmail({
    companyName: PORTAL_COMPANY.name,
    recipientName: SAMPLE_FIRM.recipients[1].name,
    matters: [{ payerName: SAMPLE_HOMEOWNER.name, stage: 'referred', handlingName: SAMPLE_FIRM.handling, releasedAt: `${ymdPlusDays(ctx.todayYmd, -3)}T18:00:00Z` }],
    events: [{ createdAt: `${ymdPlusDays(ctx.todayYmd, -1)}T18:00:00Z`, trigger: 'referred', payer: SAMPLE_HOMEOWNER.name }],
    portalUrl,
    unsubscribeUrl,
  })
}

/**
 * The bill email a payer gets for a Stripe bill: the send function's own builder and its own
 * QR code, over the sample job. A real send carries the code as an inline attachment; a
 * browser cannot load `cid:`, so the sample inlines the same file as a data URL.
 */
export function buildSampleBillEmail(ctx: SampleEmailContext): BuiltEmail {
  const portalUrl = `${PORTAL_SHORT_ORIGIN}${SAMPLE_HOMEOWNER.portalSlug}`
  const modules = qrMatrix(portalUrl)
  return buildStripeBillEmail({
    companyName: PORTAL_COMPANY.name,
    companyPhone: PORTAL_COMPANY.phone,
    payerName: SAMPLE_HOMEOWNER.name,
    jobAddress: SAMPLE_JOB.address,
    invoiceNumber: `${SAMPLE_JOB.number}-${ctx.todayYmd.slice(2).replace(/-/g, '')}0930`,
    amountDueCents: SAMPLE_JOB.amount * 100,
    dueDateUnix: Date.parse(`${ymdPlusDays(ctx.todayYmd, 14)}T18:00:00Z`) / 1000,
    payUrl: `${ctx.origin}${PAY_SAMPLE_PATH}`,
    invoicePdfUrl: null,
    pdfAttached: true,
    portalUrl,
    qrImgSrc: modules ? `data:image/png;base64,${bytesToBase64(qrPngBytes(modules))}` : null,
    canReply: ctx.sender != null,
  })
}

/** The From line the inbox shows for a sample — the estimate's per-trade name (the sample is the plumbing brand), the company for the rest (v2.4138). */
export function sampleEmailFrom(id: SampleEmailId): string {
  if (id === 'gc-trade-email') return mailboxWithName(GC_TRADE_EMAIL_FROM_NAME, CUSTOMER_EMAIL_FROM_ADDRESS)
  if (id === 'gc-pay-app' || id === 'gc-certify-ask' || id === 'gc-certified' || id === 'gc-change-order' || id === 'gc-reminder' || id === 'gc-interest-bill')
    return mailboxWithName(GC_CUSTOMER_EMAIL_FROM_NAME, CUSTOMER_EMAIL_FROM_ADDRESS)
  return id === 'estimate' ? estimateEmailFrom('plum') : COMPANY_EMAIL_FROM_LABEL
}

/** GC mode (v2.4799): the office's question about the plans to the project's architect, as `gc-plan-question-email` sends it. */
export function buildSampleGcPlanQuestionEmail(ctx: SampleEmailContext): BuiltEmail {
  return buildGcPlanQuestionEmail({
    architectName: 'Avery Lin',
    projectName: 'Fair Oaks Clinic',
    projectAddress: '1 Sample Rd, Boerne',
    askedByName: SAMPLE_GC.company,
    about: 'S-101, S-102, Concrete',
    text: 'The foundation plan shows 18 in. piers at grid C; the detail on S-102 shows 24 in. Which one do we price?',
    signer: ctx.sender?.name || 'The project manager',
    companyName: 'Click Construction',
  })
}

/** GC mode (the Building lane's U4b): a trade's submittal to the project's architect, as `gc-architect-email` sends it. */
export function buildSampleGcSubmittalEmail(ctx: SampleEmailContext): BuiltEmail {
  return buildGcSubmittalEmail({
    architectName: 'Avery Lin',
    projectName: 'Fair Oaks Clinic',
    projectAddress: '1 Sample Rd, Boerne',
    number: '26 24 16-01',
    title: 'Panelboards',
    kind: 'product data',
    from: 'Electrical, Pedernales Valley Electric',
    round: 2,
    file: 'PVE-panelboards-r1.pdf',
    driveUrl: 'https://drive.google.com/file/d/sample-panelboards/view',
    note: 'Ratings added.',
    neededBy: 'Mon, Oct 20',
    signer: ctx.sender?.name || 'The project manager',
    companyName: 'Click Construction',
  })
}

/**
 * GC mode (P3-a): an email to a trade partner, as `gc-trade-email` sends it. The sample company's invitation from the
 * portal's own kernels, to who gets its kind, through the same frame, linking the sample portal.
 */
export function buildSampleGcTradeEmail(ctx: SampleEmailContext): BuiltEmail {
  const { state, partnerId } = tradePortalState(gcTradePortalSample(ctx.todayYmd), ctx.todayYmd)
  const project = state.projects[0]!
  const pkg = project.packages[0]!
  const partner = state.partners.find((p) => p.id === partnerId)!
  const m = inviteMessage(project, pkg, pkg.invites[0]!, partner, 'en')
  const pm = gcTradePortalSampleRows(ctx.todayYmd).projects[0]?.team.find((t) => t.role === 'projectManager')
  return buildGcTradeEmail({
    lang: 'en',
    recipients: mailRecipients(partner, portalMailGroup(state, m)).map((r) => r.name),
    company: partner.company,
    subject: m.subject,
    lines: inviteEmailLines(m, 'en'),
    linkUrl: `${ctx.origin}${TRADE_PORTAL_SAMPLE_PATH}`,
    signer: String(pm?.name ?? ctx.sender?.name ?? 'The project manager'),
    gc: GC_TRADE_EMAIL_FROM_NAME,
  })
}

/** v2.5026 (Submittals decision 11): a named reviewer's own room link, as `send-submittal-room-link` sends it, to the sample room. */
export function buildSampleSubmittalRoomLinkEmail(ctx: SampleEmailContext): BuiltEmail {
  return buildSubmittalRoomLinkEmail({
    companyName: PORTAL_COMPANY.name,
    phone: PORTAL_COMPANY.phone,
    bidLabel: roomLinkBidLabel({ bid_number: 'P482', project_name: SAMPLE_BID.projectName }),
    revNumber: 2,
    personName: 'Alex Sample',
    mayDecide: true,
    link: `${ctx.origin}${SUBMITTAL_ROOM_SAMPLE_PATH}`,
    note: '',
  })
}

export function buildSampleEmail(id: SampleEmailId, ctx: SampleEmailContext): { subject: string; html: string; text: string; from: string } {
  return { ...buildSampleEmailBody(id, ctx), from: sampleEmailFrom(id) }
}

function buildSampleEmailBody(id: SampleEmailId, ctx: SampleEmailContext): { subject: string; html: string; text: string } {
  if (id === 'estimate') return buildSampleEstimateEmail(ctx)
  if (id === 'contract') return buildSampleContractEmail(ctx)
  if (id === 'job-contract') return buildSampleJobContractEmail(ctx)
  if (id === 'job-contract-paper') return buildSampleJobContractPaperEmail(ctx)
  if (id === 'job-contract-reminder') return buildSampleJobContractReminderEmail(ctx)
  if (id === 'job-contract-signed-copy') return buildSampleJobContractSignedCopyEmail(ctx)
  if (id === 'test-report') return buildSampleTestReportEmail(ctx) ?? { subject: 'Test report', html: '<p>Loading the test-report settings…</p>', text: '' }
  if (id === 'pricing-package') return buildSamplePricingPackageEmail(ctx)
  if (id === 'gc-statement') return buildSampleGcStatementEmail(ctx)
  if (id === 'rfq-request') return buildSampleRfqEmail(ctx)
  if (id === 'job-account') return buildSampleJobAccountEmail(ctx)
  if (id === 'legal-welcome' || id === 'legal-confirm' || id === 'legal-now' || id === 'legal-digest') return buildSampleLegalEmail(id, ctx)
  if (id === 'bill-email') return buildSampleBillEmail(ctx)
  if (id === 'gc-plan-question') return buildSampleGcPlanQuestionEmail(ctx)
  if (id === 'gc-submittal') return buildSampleGcSubmittalEmail(ctx)
  if (id === 'gc-trade-email') return buildSampleGcTradeEmail(ctx)
  if (id === 'gc-pay-app' || id === 'gc-certify-ask' || id === 'gc-certified' || id === 'gc-change-order') return buildSampleGcCustomerEmail(id, ctx)
  if (id === 'gc-reminder') return buildSampleGcReminderEmail(ctx)
  if (id === 'gc-interest-bill') return buildSampleGcInterestBillEmail(ctx)
  if (id === 'submittal-room-link') return buildSampleSubmittalRoomLinkEmail(ctx)
  return buildSampleBidRoomEmail(ctx, id === 'bid-room-revised')
}

/**
 * GC mode (O4b): our emails to a GC project's customer and its architect, as `gc-customer-email` sends them: the pay
 * application and the ask to certify it, the certified bill (with the customer's portal link, as when they have one)
 * and a change order to sign. A made-up month on the sample project, through the same words and frame.
 */
export function buildSampleGcCustomerEmail(id: 'gc-pay-app' | 'gc-certify-ask' | 'gc-certified' | 'gc-change-order', ctx: SampleEmailContext): BuiltEmail {
  const facts: PayAppMailFacts = {
    job: 'Sample Retail Shell',
    greeting: 'Elena',
    owner: 'Sample Owner LLC',
    architect: 'Sample Architects',
    number: 3,
    final: false,
    due: 48600,
    periodTo: ymdPlusDays(ctx.todayYmd, -5),
    retainagePct: 10,
  }
  const mail =
    id === 'gc-pay-app'
      ? payAppMail(facts)
      : id === 'gc-certify-ask'
        ? certifyAskMail(facts)
        : id === 'gc-certified'
          ? certifiedMail({ ...facts, asked: facts.due, certified: 45000, expectOn: ymdPlusDays(ctx.todayYmd, 30) })
          : changeOrderMail({ job: facts.job, greeting: facts.greeting, number: 2, description: 'Add a coffee bar cabinet, per the customer', price: 1100, days: 3, timeOnly: false })
  const portalUrl = id === 'gc-certified' ? `${PORTAL_SHORT_ORIGIN}sample-owner` : null
  return buildGcCustomerEmail({ subject: mail.subject, lines: mail.lines, signer: String(ctx.sender?.name ?? 'The project manager'), gc: GC_CUSTOMER_EMAIL_FROM_NAME, portalUrl })
}

/**
 * GC mode (O5b): our reminder to pay a late bill, as `gc-customer-email` sends it: the reminder kernel's words
 * (`payReminderMail`) on a made-up late bill, with the portal line, as when the customer has a link.
 */
export function buildSampleGcReminderEmail(ctx: SampleEmailContext): BuiltEmail {
  const mail = payReminderMail({
    greeting: 'Elena',
    job: 'Sample Retail Shell',
    bill: 'pay application 3',
    open: 43740,
    dueOn: ymdPlusDays(ctx.todayYmd, -4),
    promised: false,
    lastPaid: null,
    interest: null,
    by: ymdPlusDays(ctx.todayYmd, 5),
    note: '',
  })
  return buildGcCustomerEmail({
    subject: mail.subject,
    lines: mail.lines,
    signer: String(ctx.sender?.name ?? 'The project manager'),
    gc: GC_CUSTOMER_EMAIL_FROM_NAME,
    portalUrl: `${PORTAL_SHORT_ORIGIN}sample-owner`,
  })
}

/** GC mode (O6b-2): our bill for the interest on late bills, as `gc-customer-email` sends it, with the portal line. */
export function buildSampleGcInterestBillEmail(ctx: SampleEmailContext): BuiltEmail {
  const mail = interestBillMail({ job: 'Sample Retail Shell', greeting: 'Elena', amount: 284.92, pctPerMonth: 1.5 })
  return buildGcCustomerEmail({
    subject: mail.subject,
    lines: mail.lines,
    signer: String(ctx.sender?.name ?? 'The project manager'),
    gc: GC_CUSTOMER_EMAIL_FROM_NAME,
    portalUrl: `${PORTAL_SHORT_ORIGIN}sample-owner`,
  })
}
