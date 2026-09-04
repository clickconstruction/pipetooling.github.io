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
import { SAMPLE_BID, SAMPLE_CONTRACT, SAMPLE_ESTIMATE, SAMPLE_HOMEOWNER, SAMPLE_SUB, ymdPlusDays } from './customerSample'
import { BID_ROOM_SAMPLE_PATH, CONTRACT_SAMPLE_PATH, ESTIMATE_SAMPLE_PATH, type SampleEmailId } from './customerJourneys'

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
    officePhone: null,
  })
}

export function buildSampleEmail(id: SampleEmailId, ctx: SampleEmailContext): { subject: string; html: string; text: string } {
  if (id === 'estimate') return buildSampleEstimateEmail(ctx)
  if (id === 'contract') return buildSampleContractEmail(ctx)
  return buildSampleBidRoomEmail(ctx, id === 'bid-room-revised')
}
