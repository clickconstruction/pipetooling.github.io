/**
 * Sample data for the Outbound email catalog's "Preview" of the bid-room link email (v2.2732).
 * The sender is whoever is looking — the real email is signed by whoever presses send.
 */
import { buildBidRoomLinkEmail, type BidRoomLinkEmailSender } from './bidRoomLinkEmail'
import type { BidRoomRevisionPayloadV1 } from './bidRoomPayload'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export const BID_ROOM_LINK_EMAIL_SAMPLE_PAYLOAD: BidRoomRevisionPayloadV1 = {
  v: 1,
  project_name: 'Hunter Road Sound Studio',
  project_address: '2530 Hunter Rd, San Marcos, TX 78666',
  gc_name: 'Knight Contracting',
  service_type_name: 'Plumbing',
  options: [
    { key: 'base', name: 'To Plans', is_base: true, total_cents: 5_634_300, fixture_rows: [] },
    { key: 'alt1', name: 'PEX in lieu of copper', is_base: false, total_cents: 5_412_000, fixture_rows: [] },
    { key: 'alt2', name: 'PEX in lieu of copper · Standard-grade fixtures', is_base: false, total_cents: 4_170_000, fixture_rows: [] },
  ],
  inclusions: '',
  exclusions: '',
  terms: 'This estimate is subject to acceptance within thirty (30) days and is void thereafter.',
  header_brand: 'plum',
}

export function buildBidRoomLinkEmailPreview(input: { origin: string; sender: BidRoomLinkEmailSender | null; revised?: boolean }): { subject: string; html: string } {
  const origin = input.origin.replace(/\/$/, '')
  const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())
  const mail = buildBidRoomLinkEmail({
    payload: BID_ROOM_LINK_EMAIL_SAMPLE_PAYLOAD,
    link: `${origin}/bid-room?t=sample-link`,
    brandImageUrl: `${origin}/brand/click-plum.png`,
    revNumber: input.revised ? 2 : 1,
    revNote: input.revised ? 'per addendum 2 — water heater moved to the mezzanine' : null,
    sender: input.sender,
    dateLabel,
  })
  return { subject: mail.subject, html: mail.html }
}
