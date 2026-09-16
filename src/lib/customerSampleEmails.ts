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
import { SAMPLE_BID, SAMPLE_CONTRACT, SAMPLE_ESTIMATE, SAMPLE_GC, SAMPLE_HOMEOWNER, SAMPLE_SUB, ymdPlusDays } from './customerSample'
import { BID_ROOM_SAMPLE_PATH, CONTRACT_SAMPLE_PATH, ESTIMATE_SAMPLE_PATH, JOB_CONTRACT_SAMPLE_PATH, type SampleEmailId } from './customerJourneys'
import { buildJobContractReminderEmail, buildJobContractSendEmail, type BuiltEmail } from './jobContractEmail'
import { SAMPLE_JOB_CONTRACT } from './customerSample'
import { testReportSampleEmail } from './jobs/testReportSample'
import { buildBidPricingPackageEmailHtml, buildBidPricingPackagePlainText, buildBidPricingPackageTableHtml, type PackageExternalRow } from './buildBidPricingPackageHtml'
import { buildGcStatementEmailHtml, buildGcStatementEmailText, gcStatementEmailSubject } from './jobsDocuments/gcStatementEmail'
import type { GcReviewGroup } from './gcReviewRollup'
import { buildRfqEmail } from './rfqEmail'
import { composeJobAccountEmail } from './supplyHouseJobAccount'
import { buildLegalConfirmEmail, buildLegalDigestEmail, buildLegalNowEmail, legalConfirmedPageBody, legalPageHtml } from './legalEmails'
import { SAMPLE_FIRM, SAMPLE_HOUSE, SAMPLE_RFQ_LINES } from '../../supabase/functions/_shared/customerSampleFixtures'
import { LEGAL_CONFIRMED_SAMPLE_URL, LEGAL_PORTAL_SAMPLE_PATH, type SampleHtmlId } from './customerJourneys'

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

/** The GC statement email (v2.3511): GC Review's own builder over two sample jobs, with the sample GC's portal as the pay link. */
export function sampleGcStatementGroup(todayYmd: string): GcReviewGroup {
  const rows = [
    { key: 'sample-inv-1', jobId: 'sample-job-1', hcp: '1042', jobName: SAMPLE_BID.projectName, jobAddress: '4400 Sample Pkwy, Kyle, TX 78640', customerName: SAMPLE_GC.company, referenceDateDisplay: ymdPlusDays(todayYmd, -34), ageDays: 34, remaining: 15200, inCollections: false },
    { key: 'sample-inv-2', jobId: 'sample-job-2', hcp: '1051', jobName: 'Bldg 3 top-out', jobAddress: '4400 Sample Pkwy, Kyle, TX 78640', customerName: SAMPLE_GC.company, referenceDateDisplay: ymdPlusDays(todayYmd, -6), ageDays: 6, remaining: 8450, inCollections: false },
  ]
  return { key: 'sample-gc', gcId: 'sample-gc', gcName: SAMPLE_GC.company, isNoGc: false, rows, subtotal: 23650, jobCount: 2, oldestAgeDays: 34 }
}

export function buildSampleGcStatementEmail(ctx: SampleEmailContext): BuiltEmail {
  const group = sampleGcStatementGroup(ctx.todayYmd)
  const opts = { dateStr: ctx.dateLabel, officePhone: PORTAL_COMPANY.phone || null, portalUrl: `${PORTAL_SHORT_ORIGIN}${SAMPLE_GC.portalSlug}` }
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

const LEGAL_UNSUBSCRIBE_SAMPLE_URL = LEGAL_CONFIRMED_SAMPLE_URL.replace('confirm=', 'unsubscribe=')

/** The firm's three emails (v2.3512): the senders' own builders over the sample firm. */
export function buildSampleLegalEmail(id: 'legal-confirm' | 'legal-now' | 'legal-digest', ctx: SampleEmailContext): BuiltEmail {
  const portalUrl = `${ctx.origin}${LEGAL_PORTAL_SAMPLE_PATH}`
  if (id === 'legal-confirm') return buildLegalConfirmEmail({ companyName: PORTAL_COMPANY.name, email: SAMPLE_FIRM.recipients[1].email, confirmUrl: LEGAL_CONFIRMED_SAMPLE_URL })
  if (id === 'legal-now')
    return buildLegalNowEmail({
      companyName: PORTAL_COMPANY.name,
      firmName: SAMPLE_FIRM.name,
      trigger: 'referred',
      payer: SAMPLE_HOMEOWNER.name,
      handling: SAMPLE_FIRM.handling,
      note: 'Two bills, 74 days past due; the office\'s calls went unanswered.',
      portalUrl,
      unsubscribeUrl: LEGAL_UNSUBSCRIBE_SAMPLE_URL,
    })
  return buildLegalDigestEmail({
    companyName: PORTAL_COMPANY.name,
    recipientName: SAMPLE_FIRM.recipients[1].name,
    matters: [{ payerName: SAMPLE_HOMEOWNER.name, stage: 'with_firm', handlingName: SAMPLE_FIRM.handling, releasedAt: ymdPlusDays(ctx.todayYmd, -3) }],
    events: [{ createdAt: ymdPlusDays(ctx.todayYmd, -1), trigger: 'referred', payer: SAMPLE_HOMEOWNER.name }],
    portalUrl,
    unsubscribeUrl: LEGAL_UNSUBSCRIBE_SAMPLE_URL,
  })
}

/** A plain page built from the same builder the function serves it with (v2.3518): the firm's confirmed page, for Ann Sample. */
export function buildSampleHtml(id: SampleHtmlId): string {
  if (id === 'legal-confirmed-page') return legalPageHtml(PORTAL_COMPANY.name, legalConfirmedPageBody(PORTAL_COMPANY.name, SAMPLE_FIRM.recipients[0].name, SAMPLE_FIRM.recipients[0].email))
  return ''
}

export function buildSampleEmail(id: SampleEmailId, ctx: SampleEmailContext): { subject: string; html: string; text: string } {
  if (id === 'estimate') return buildSampleEstimateEmail(ctx)
  if (id === 'contract') return buildSampleContractEmail(ctx)
  if (id === 'job-contract') return buildSampleJobContractEmail(ctx)
  if (id === 'job-contract-reminder') return buildSampleJobContractReminderEmail(ctx)
  if (id === 'test-report') return buildSampleTestReportEmail(ctx) ?? { subject: 'Test report', html: '<p>Loading the test-report settings…</p>', text: '' }
  if (id === 'pricing-package') return buildSamplePricingPackageEmail(ctx)
  if (id === 'gc-statement') return buildSampleGcStatementEmail(ctx)
  if (id === 'rfq-request') return buildSampleRfqEmail(ctx)
  if (id === 'job-account') return buildSampleJobAccountEmail(ctx)
  if (id === 'legal-confirm' || id === 'legal-now' || id === 'legal-digest') return buildSampleLegalEmail(id, ctx)
  return buildSampleBidRoomEmail(ctx, id === 'bid-room-revised')
}
