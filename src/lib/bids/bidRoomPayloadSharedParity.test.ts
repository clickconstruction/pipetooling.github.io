/** The room edge functions parse payloads with the _shared twin; this keeps it honest. */
import { describe, it, expect } from 'vitest'
import { parseSharedBidRoomPayload } from '../../../supabase/functions/_shared/bidRoomPayload'
import { buildBidRoomRevisionPayload, parseBidRoomRevisionPayload } from './bidRoomPayload'

describe('bid room payload parser parity', () => {
  it('shared and client parsers agree on a built payload', () => {
    const built = buildBidRoomRevisionPayload({
      projectName: 'Game Show Battle Rooms',
      projectAddress: '123 Main',
      gcName: 'NORTHSTAR',
      serviceTypeName: 'Plumbing',
      sections: [
        { name: 'To Plans', isAlternate: false, revenueSum: 249971.29, fixtureRows: [{ fixture: 'ft of 4IN WASTE', count: 537.27 }] },
        { name: 'VE', isAlternate: true, revenueSum: 97558.12, fixtureRows: [{ fixture: 'ft of 4IN WASTE', count: 200 }] },
      ],
      inclusions: 'inc',
      exclusions: 'exc',
      terms: 'terms',
    })!
    const wire = JSON.parse(JSON.stringify(built))
    expect(parseSharedBidRoomPayload(wire)).toEqual(parseBidRoomRevisionPayload(wire))
    expect(parseSharedBidRoomPayload(wire)).toEqual(built)
  })

  it('both refuse baseless payloads', () => {
    const bad = { v: 1, options: [{ key: 'a', name: 'x', is_base: false, total_cents: 1, fixture_rows: [] }] }
    expect(parseSharedBidRoomPayload(bad)).toBeNull()
    expect(parseBidRoomRevisionPayload(bad)).toBeNull()
  })
})
