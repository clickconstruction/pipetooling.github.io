import { describe, expect, it } from 'vitest'
import { healthTiles, parseJourneyHealthCounts } from './journeyHealth'

describe('journeyHealth — the health row (v2.3513)', () => {
  it('parses the RPC jsonb defensively and words five tiles with their doors', () => {
    const c = parseJourneyHealthCounts({
      as_of: '2026-09-16T16:00:00Z',
      agreements: { signed: 5, sent_unopened: 24, sent_waiting: 30, live_jobs_without: 105 },
      bid_rooms: { published: 31, never_opened: 9, signed: 12 },
      portals: { customers_with_link: 110, ever_visited: 14 },
      sub_portals: { subs_with_link: 18, ever_visited: 11 },
      statements: { gcs_with_billed_work: 9, certified_this_month: 0, sent_this_month: 2 },
    })
    expect(c).not.toBeNull()
    const tiles = healthTiles(c!)
    expect(tiles.map((t) => t.id)).toEqual(['agreements', 'bid_rooms', 'portals', 'sub_portals', 'statements'])
    expect(tiles[0]).toMatchObject({ line: '5 signed · 24 sent, unopened 3+ days · 105 live jobs with none', attention: true, door: { label: 'Start the sweep', to: '/jobs?tab=pipeline' } })
    expect(tiles[1]).toMatchObject({ line: '31 rooms open · 9 sent, never opened · 12 signed', attention: true })
    expect(tiles[2]).toMatchObject({ line: '110 customers with a link · 14 ever visited · 96 never', attention: true })
    expect(tiles[3]).toMatchObject({ line: '18 subs with a link · 11 ever visited · 7 never' })
    expect(tiles[4]).toMatchObject({ line: '9 builders with billed work · 0 certified this month · 2 sent', attention: true, door: { label: 'GC Review' } })
  })
  it('a quiet company reads as nothing stuck; missing sections and non-numbers read as zero; bad shapes are null', () => {
    const tiles = healthTiles(parseJourneyHealthCounts({ agreements: { signed: 1, sent_unopened: 0, live_jobs_without: 0 }, portals: { customers_with_link: 'x' } })!)
    expect(tiles[0]).toMatchObject({ attention: false, door: { label: 'Open the Pipeline' } })
    expect(tiles[2]?.line).toBe('0 customers with a link · 0 ever visited · 0 never')
    expect(tiles.some((t) => t.attention)).toBe(false)
    expect(parseJourneyHealthCounts(null)).toBeNull()
    expect(parseJourneyHealthCounts([1])).toBeNull()
    expect(parseJourneyHealthCounts('no')).toBeNull()
  })
})
