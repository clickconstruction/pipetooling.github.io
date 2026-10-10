import { describe, expect, it } from 'vitest'
import {
  BID_COVER_LETTER_EXCLUSIONS_KEY,
  BID_COVER_LETTER_TERMS_KEY,
  sampleBidRoomResponse,
} from '../../../supabase/functions/_shared/customerSampleFixtures'
import { SAMPLE_BID, SAMPLE_GC } from '../../../supabase/functions/_shared/customerSample'
import { buildBidRoomRevisionPayload, parseBidRoomRevisionPayload, roomGrandTotalCents, type BidRoomRevisionPayloadV1 } from './bidRoomPayload'

const now = '2026-10-09T21:00:00.000Z'
const today = '2026-10-09'
type Room = { payload: BidRoomRevisionPayloadV1; outcome: { event_type: string; metadata: Record<string, unknown> } | null }
const live = sampleBidRoomResponse([], 'live', now, today) as unknown as Room
const done = sampleBidRoomResponse([], 'done', now, today) as unknown as Room

describe('the sample bid room, through the publish kernel (v2.5105, #103)', () => {
  it('is exactly what the Cover Letter tab would publish for these sections, read back as the function reads a revision', () => {
    const published = buildBidRoomRevisionPayload({
      projectName: SAMPLE_BID.projectName,
      projectAddress: SAMPLE_BID.projectAddress,
      gcName: SAMPLE_GC.company,
      serviceTypeName: SAMPLE_BID.serviceTypeName,
      // The bid's two priced sections, as the Cover Letter tab hands them over.
      sections: [
        { name: 'To Plans', isAlternate: false, revenueSum: 56_343, bidVersionId: 'sample-bid-version-to-plans', fixtureRows: SAMPLE_BID.options[0].fixture_rows.map((r) => ({ ...r })) },
        { name: 'PEX in lieu of copper', isAlternate: true, revenueSum: 52_100, bidVersionId: 'sample-bid-version-pex', fixtureRows: SAMPLE_BID.options[1].fixture_rows.map((r) => ({ ...r })) },
      ],
      inclusions: SAMPLE_BID.inclusions,
      exclusions: SAMPLE_BID.exclusionsFallback,
      terms: SAMPLE_BID.termsFallback,
      addOns: [
        {
          tag: 'Clubhouse',
          label: 'Alternate 2 — Clubhouse restrooms',
          revenueSum: 4_850,
          fixtureRows: [
            { fixture: 'Water closet', count: 2 },
            { fixture: 'Lavatory', count: 2 },
            { fixture: 'Urinal', count: 1 },
          ],
        },
      ],
    })
    expect(live.payload).toEqual(published)
    // The room page's own parse reads it unchanged.
    expect(parseBidRoomRevisionPayload(JSON.parse(JSON.stringify(live.payload)))).toEqual(live.payload)
  })

  it('carries what a published room carries: the in-lieu alternate, each option’s version, the add-on and the brand', () => {
    expect(live.payload.options.map((o) => [o.key, o.name, o.total_cents, o.bid_version_id])).toEqual([
      ['base', 'To Plans', 5_634_300, 'sample-bid-version-to-plans'],
      ['alt-1', 'PEX in lieu of copper', 5_210_000, 'sample-bid-version-pex'],
    ])
    expect(live.payload.add_ons).toEqual([
      {
        key: 'group:clubhouse',
        name: 'Alternate 2 — Clubhouse restrooms',
        tag: 'Clubhouse',
        total_cents: 485_000,
        fixture_rows: [
          { fixture: 'Water closet', count: 2 },
          { fixture: 'Lavatory', count: 2 },
          { fixture: 'Urinal', count: 1 },
        ],
      },
    ])
    expect(live.payload.header_brand).toBe(SAMPLE_BID.headerBrand)
    expect(live.outcome).toBeNull()
  })

  it('takes today’s Settings for the exclusions and the terms, trimmed as the kernel trims them', () => {
    const rows = [
      { key: BID_COVER_LETTER_EXCLUSIONS_KEY, value_text: '  Trenching by others.  ' },
      { key: BID_COVER_LETTER_TERMS_KEY, value_text: 'Net 30.\n' },
    ]
    const room = sampleBidRoomResponse(rows, 'live', now, today) as unknown as Room
    expect(room.payload.exclusions).toBe('Trenching by others.')
    expect(room.payload.terms).toBe('Net 30.')
  })

  it('signed: the base and the add-on the room ticks to start, in the shape sign-bid-room writes', () => {
    const base = live.payload.options[0]!
    expect(done.outcome?.event_type).toBe('signed')
    expect(done.outcome?.metadata).toEqual({
      option_key: 'base',
      option_name: 'To Plans',
      option_version_id: 'sample-bid-version-to-plans',
      total_cents: roomGrandTotalCents(base, live.payload.add_ons),
      add_ons_taken: ['Alternate 2 — Clubhouse restrooms'],
      add_on_keys: ['group:clubhouse'],
      rev_number: 2,
      printed_name: SAMPLE_GC.contact,
    })
    expect(done.outcome?.metadata.total_cents).toBe(6_119_300)
  })
})
