import { describe, expect, it } from 'vitest'

import { picksFromQuotes, type RawQuote } from './picksFromQuotes'

const line = (o: Record<string, unknown>) => ({ id: 'x', fixture: 'F', label: null, picked: true, cant_supply: false, component_role: null, ...o })

describe('picksFromQuotes', () => {
  it('reads the latest quote per house, skips unpicked and can\'t-supply lines, and takes a kit\'s label with any line\'s annotation', () => {
    const quotes: RawQuote[] = [
      { id: 'old', supply_house_id: 'h1', received_at: '2026-09-01T00:00:00Z', supply_house: { name: 'NWS' }, bid_quote_lines: [line({ id: 'o1', fixture: 'Water closet', label: 'OLD BOWL' })] },
      {
        id: 'new',
        supply_house_id: 'h1',
        received_at: '2026-09-10T00:00:00Z',
        supply_house: [{ name: 'NWS' }],
        bid_quote_lines: [
          line({ id: 'k', fixture: 'Water closet', label: 'TOTO CT728 kit', component_role: 'kit' }),
          line({ id: 'b', fixture: 'Water closet', label: 'TOTO CT728CUVG#01', component_role: 'bowl', alternate_reason_kind: 'lead_time', alternate_reason_note: '8 wk out', lead_time_days: 14, product_status_override: 'superseded' }),
          line({ id: 'n', fixture: 'Hose bibb', label: 'WOODFORD B74', picked: false }),
          line({ id: 'c', fixture: 'PRV', label: 'WATTS LF223', cant_supply: true }),
        ],
      },
      { id: 'q2', supply_house_id: 'h2', received_at: '2026-09-11T00:00:00Z', supply_house: { name: 'Moore' }, bid_quote_lines: [line({ id: 'm1', fixture: 'Water heater', label: 'RHEEM RH400', lead_time_days: 28 }), line({ id: 'm2', fixture: ' water  closet ', label: 'KOHLER' })] },
      { id: 'q3', supply_house_id: null, received_at: '2026-09-12T00:00:00Z', supply_house: null, bid_quote_lines: [line({ id: 'z', fixture: 'Sink' })] },
    ]
    const { picks, overridesByFixture } = picksFromQuotes(quotes)
    expect(picks).toEqual([
      { fixture: 'Water closet', supplyHouseId: 'h1', houseName: 'NWS', quoteLineId: 'k', label: 'TOTO CT728 kit', alternateReasonKind: 'lead_time', alternateReasonNote: '8 wk out', leadTimeDays: 14 },
      { fixture: 'Water heater', supplyHouseId: 'h2', houseName: 'Moore', quoteLineId: 'm1', label: 'RHEEM RH400', alternateReasonKind: null, alternateReasonNote: null, leadTimeDays: 28 },
    ])
    expect(overridesByFixture.get('water closet')).toBe('superseded')
    expect(overridesByFixture.get('water heater')).toBeNull()
  })

  it('an empty store gives no picks', () => {
    expect(picksFromQuotes([])).toEqual({ picks: [], overridesByFixture: new Map() })
  })
})
